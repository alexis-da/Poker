-- Jeu en ligne : tables privées avec code, état public diffusé en temps réel,
-- cartes privées lisibles par leur seul propriétaire, état complet réservé au serveur.
-- Toutes les écritures passent par la fonction « table » (clé de service) ; les joueurs ne font que lire.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{5}$'),
  host uuid not null references auth.users (id) on delete cascade,
  max_seats smallint not null check (max_seats between 2 and 6),
  bots boolean not null default false,
  status text not null default 'attente' check (status in ('attente', 'en-cours', 'terminee')),
  version integer not null default 0,
  -- Vue publique de la partie (sans paquet ni cartes cachées).
  public jsonb,
  -- Change à chaque arrivée ou départ, pour que les navigateurs relisent la liste des joueurs.
  members_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat smallint not null check (seat between 0 and 5),
  name text not null check (char_length(name) between 1 and 20),
  away boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- État complet (paquet, cartes de tous) : aucune politique, donc illisible hors clé de service.
create table public.room_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  data jsonb not null
);

-- Cartes privées de chaque joueur pour la main en cours.
create table public.room_hands (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  hand integer not null,
  cards smallint[] not null,
  primary key (room_id, user_id)
);

create index rooms_updated_at_idx on public.rooms (updated_at);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_secrets enable row level security;
alter table public.room_hands enable row level security;

-- Évite la récursion des politiques sur room_members.
create function public.is_room_member (p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid());
$$;
revoke all on function public.is_room_member (uuid) from public, anon;
grant execute on function public.is_room_member (uuid) to authenticated;

create policy "membres : lire la table" on public.rooms
  for select to authenticated using (public.is_room_member (id));
create policy "membres : lire les joueurs" on public.room_members
  for select to authenticated using (public.is_room_member (room_id));
create policy "joueur : lire ses cartes" on public.room_hands
  for select to authenticated using (user_id = auth.uid());

-- Toute arrivée, sortie ou absence touche la table, ce qui prévient les navigateurs.
create function public.touch_room_members () returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.rooms set members_at = now(), updated_at = now()
   where id = coalesce(new.room_id, old.room_id);
  return null;
end $$;
create trigger room_members_touch after insert or update or delete on public.room_members
  for each row execute function public.touch_room_members ();

-- Écriture atomique d'un nouvel état, si personne n'a écrit entre-temps.
create function public.save_table (
  p_room uuid, p_version integer, p_status text, p_public jsonb, p_secret jsonb, p_hands jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.rooms
     set status = p_status, public = p_public, version = version + 1, updated_at = now()
   where id = p_room and version = p_version
  returning version into v;
  if v is null then return null; end if;
  insert into public.room_secrets (room_id, data) values (p_room, p_secret)
    on conflict (room_id) do update set data = excluded.data;
  if p_hands is not null and jsonb_array_length(p_hands) > 0 then
    insert into public.room_hands (room_id, user_id, hand, cards)
    select p_room, (h ->> 'userId')::uuid, (h ->> 'hand')::integer,
           array (select jsonb_array_elements_text(h -> 'cards')::smallint)
      from jsonb_array_elements(p_hands) as h
    on conflict (room_id, user_id) do update set hand = excluded.hand, cards = excluded.cards;
  end if;
  return v;
end $$;
revoke all on function public.save_table (uuid, integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_table (uuid, integer, text, jsonb, jsonb, jsonb) to service_role;

-- Ménage : tables inactives depuis plus de 2 jours (appelée par la fonction à la création d'une table).
create function public.purge_old_rooms () returns void
language sql security definer set search_path = public as $$
  delete from public.rooms where updated_at < now() - interval '2 days';
$$;
revoke all on function public.purge_old_rooms () from public, anon, authenticated;
grant execute on function public.purge_old_rooms () to service_role;

-- Droits explicites : lecture seule pour les joueurs connectés (filtrée par les règles ci-dessus),
-- tout pour le serveur de jeu.
revoke all on public.rooms, public.room_members, public.room_secrets, public.room_hands from anon, authenticated;
grant select on public.rooms, public.room_members, public.room_hands to authenticated;
grant all on public.rooms, public.room_members, public.room_secrets, public.room_hands to service_role;

alter publication supabase_realtime add table public.rooms, public.room_hands;
