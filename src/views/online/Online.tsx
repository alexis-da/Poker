import { CheckIcon, CopyIcon, ExitIcon, PersonIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Badge, Button, Callout, Card, Flex, Heading, SegmentedControl, Spinner, Switch, Text, TextField } from '@radix-ui/themes';
import { useEffect, useMemo, useState } from 'react';
import { PROFILE_BY_ID } from '../../engine/bot';
import { getAdvice, gradeDecision } from '../../engine/coach';
import { formatBB, getLegalActions, type Action, type GameState } from '../../engine/game';
import { callTable, onlineConfigured, OnlineError, savedPseudo, savePseudo, serverNow } from '../../online/client';
import type { PublicTable } from '../../online/logic';
import { CODE_LENGTH, normalizeCode } from '../../online/service';
import { useOnlineRoom, type HandRow, type MemberRow, type RoomRow } from '../../online/useOnlineRoom';
import { useSettings } from '../../store/store';
import { classifyDecision } from '../../training/classify';
import { logEvent } from '../../training/db';
import { ActionBar } from '../play/ActionBar';
import { CoachPanel } from '../play/CoachPanel';
import { placeLabel, type FeedbackEntry } from '../play/session';
import { PROFILE_COLOR, Table } from '../play/Table';

const STREET_FR = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Abattage' } as const;

const roomCodeFromHash = () => normalizeCode(window.location.hash.replace(/^#en-ligne\/?/, ''));
const roomLink = (code: string) => `${window.location.origin}${window.location.pathname}#en-ligne/${code}`;

/** Jeu en ligne : accueil (créer ou rejoindre) ou table, selon l'adresse. */
export function Online() {
  const code = roomCodeFromHash();
  if (!onlineConfigured) return <NotConfigured />;
  return code.length === CODE_LENGTH ? <RoomPage code={code} /> : <Lobby />;
}

function NotConfigured() {
  return (
    <div className="page">
      <header className="page-head">
        <Heading size="8">Jouer en ligne</Heading>
      </header>
      <Callout.Root color="amber">
        <Callout.Text>
          {import.meta.env.MODE === 'artifact'
            ? 'Le jeu en ligne n’est pas disponible dans cette version autonome : ouvrez le site de Coach Hold’em pour jouer avec vos amis.'
            : 'Le jeu en ligne n’est pas configuré sur cette version : il faut l’adresse du serveur Supabase (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).'}
        </Callout.Text>
      </Callout.Root>
    </div>
  );
}

function PseudoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Flex direction="column" gap="2">
      <Text as="label" size="2" weight="medium" htmlFor="pseudo">
        Votre pseudo
      </Text>
      <TextField.Root id="pseudo" size="3" value={value} maxLength={20} placeholder="Ex. : Alex" onChange={(e) => onChange(e.target.value)}>
        <TextField.Slot>
          <PersonIcon />
        </TextField.Slot>
      </TextField.Root>
    </Flex>
  );
}

function Lobby() {
  const [pseudo, setPseudo] = useState(savedPseudo);
  const [seats, setSeats] = useState('6');
  const [bots, setBots] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = pseudo.trim();

  const create = async () => {
    if (!name) return setError('Choisissez un pseudo.');
    setBusy(true);
    setError(null);
    try {
      savePseudo(name);
      const res = await callTable({ action: 'creer', name, maxSeats: Number(seats), bots });
      window.location.hash = `en-ligne/${res.code}`;
    } catch (e) {
      setError(e instanceof OnlineError ? e.message : 'Impossible de créer la table.');
      setBusy(false);
    }
  };
  const join = () => {
    if (!name) return setError('Choisissez un pseudo.');
    const c = normalizeCode(code);
    if (c.length !== CODE_LENGTH) return setError(`Le code d’une table compte ${CODE_LENGTH} caractères.`);
    savePseudo(name);
    window.location.hash = `en-ligne/${c}`;
  };

  return (
    <div className="page">
      <header className="page-head">
        <Text size="2" color="gray">
          Tables privées · No-Limit Hold’em · 100 BB · blinds 0,5 / 1 BB
        </Text>
        <Heading size="8">Jouer en ligne</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          Créez une table, partagez le lien avec vos amis, et jouez ensemble. Les cartes sont mélangées et distribuées par le
          serveur : personne ne peut voir les vôtres.
        </Text>
      </header>

      {error && (
        <Callout.Root color="tomato" mb="4">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      <div className="online-lobby">
        <Card size="3" className="online-lobby__pseudo">
          <PseudoField value={pseudo} onChange={setPseudo} />
        </Card>
        <Card size="3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Flex direction="column" gap="4">
              <Heading size="4" as="h2">
                Créer une table
              </Heading>
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  Places
                </Text>
                <SegmentedControl.Root value={seats} onValueChange={setSeats} aria-label="Nombre de places">
                  {['2', '3', '4', '5', '6'].map((n) => (
                    <SegmentedControl.Item key={n} value={n}>
                      {n}
                    </SegmentedControl.Item>
                  ))}
                </SegmentedControl.Root>
              </Flex>
              <Text as="label" size="2">
                <Flex gap="2" align="center">
                  <Switch checked={bots} onCheckedChange={setBots} /> Compléter les places libres avec des bots
                </Flex>
              </Text>
              <Button size="3" type="submit" disabled={busy}>
                {busy ? <Spinner /> : null} Créer la table
              </Button>
            </Flex>
          </form>
        </Card>
        <Card size="3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <Flex direction="column" gap="4">
              <Heading size="4" as="h2">
                Rejoindre une table
              </Heading>
              <Flex direction="column" gap="2">
                <Text as="label" size="2" weight="medium" htmlFor="room-code">
                  Code de la table
                </Text>
                <TextField.Root
                  id="room-code"
                  size="3"
                  className="room-code-input"
                  value={code}
                  maxLength={CODE_LENGTH + 2}
                  placeholder="Ex. : K7M2Q"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </Flex>
              <Text size="2" color="gray">
                Ou ouvrez simplement le lien que l’on vous a envoyé.
              </Text>
              <Button size="3" type="submit" variant="soft">
                Rejoindre
              </Button>
            </Flex>
          </form>
        </Card>
      </div>
    </div>
  );
}

/** Table rejointe par son code : pseudo, connexion, puis salle d'attente ou partie. */
function RoomPage({ code }: { code: string }) {
  const [pseudo, setPseudo] = useState(savedPseudo);
  const [name, setName] = useState<string | null>(() => savedPseudo().trim() || null);
  const online = useOnlineRoom(code, name);
  const { state } = online;

  if (!name) {
    return (
      <div className="page">
        <header className="page-head">
          <Text size="2" color="gray">
            Table {code}
          </Text>
          <Heading size="8">Rejoindre la table</Heading>
        </header>
        <Card size="3" className="online-narrow">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = pseudo.trim();
              if (!n) return;
              savePseudo(n);
              setName(n);
            }}
          >
            <Flex direction="column" gap="4">
              <PseudoField value={pseudo} onChange={setPseudo} />
              <Button size="3" type="submit" disabled={!pseudo.trim()}>
                S’asseoir à la table
              </Button>
            </Flex>
          </form>
        </Card>
      </div>
    );
  }

  if (state.phase === 'connexion' || (state.phase === 'pret' && !state.room)) {
    return (
      <div className="page">
        <Flex align="center" gap="3" py="9" justify="center">
          <Spinner size="3" /> <Text color="gray">Connexion à la table {code}…</Text>
        </Flex>
      </div>
    );
  }

  if (state.phase === 'erreur' || state.phase === 'fermee' || !state.room) {
    return (
      <div className="page">
        <header className="page-head">
          <Heading size="8">Table {code}</Heading>
        </header>
        <Callout.Root color="tomato" mb="4">
          <Callout.Text>{state.phase === 'fermee' ? 'Cette table n’existe plus.' : state.error}</Callout.Text>
        </Callout.Root>
        <Flex gap="3">
          <Button asChild>
            <a href="#en-ligne">Retour au jeu en ligne</a>
          </Button>
          {state.phase === 'erreur' && (
            <Button variant="soft" color="gray" onClick={() => window.location.reload()}>
              <ReloadIcon /> Réessayer
            </Button>
          )}
        </Flex>
      </div>
    );
  }

  const leave = async () => {
    await online.leave();
    window.location.hash = 'en-ligne';
  };

  if (state.room.status === 'attente' || !state.room.public) {
    return <WaitingRoom room={state.room} members={state.members} me={state.me!} busy={online.busy} error={online.actionError} onLaunch={online.launch} onLeave={leave} />;
  }
  return (
    <OnlineGame
      room={state.room}
      pub={state.room.public}
      members={state.members}
      me={state.me!}
      hand={state.hand}
      busy={online.busy}
      error={online.actionError}
      onPlay={online.play}
      onReplay={online.replay}
      onLeave={leave}
    />
  );
}

function CopyLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="soft"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(roomLink(code));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Lien de la table :', roomLink(code));
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Lien copié' : 'Copier le lien'}
    </Button>
  );
}

function WaitingRoom(props: {
  room: RoomRow;
  members: MemberRow[];
  me: string;
  busy: boolean;
  error: string | null;
  onLaunch: () => void;
  onLeave: () => void;
}) {
  const { room, members, me } = props;
  const isHost = room.host === me;
  const canLaunch = members.length >= 2 || (room.bots && members.length >= 1);
  const host = members.find((m) => m.user_id === room.host);
  return (
    <div className="page">
      <header className="page-head">
        <Text size="2" color="gray">
          Table privée · {room.max_seats} places · 100 BB
        </Text>
        <Heading size="8">En attente des joueurs</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          Envoyez le lien ou le code à vos amis. {isHost ? 'Lancez la partie quand tout le monde est assis.' : `${host?.name ?? 'L’hôte'} lancera la partie.`}
        </Text>
      </header>
      {props.error && (
        <Callout.Root color="tomato" mb="4">
          <Callout.Text>{props.error}</Callout.Text>
        </Callout.Root>
      )}
      <div className="online-room">
        <Card size="3">
          <Flex direction="column" gap="3" align="start">
            <Text size="2" color="gray">
              Code de la table
            </Text>
            <span className="room-code">{room.code}</span>
            <Text size="2" color="gray" className="room-link">
              {roomLink(room.code)}
            </Text>
            <CopyLink code={room.code} />
          </Flex>
        </Card>
        <Card size="3">
          <Heading size="4" as="h2" mb="3">
            Places ({members.length} / {room.max_seats})
          </Heading>
          <ul className="seat-list">
            {Array.from({ length: room.max_seats }, (_, seat) => {
              const m = members.find((x) => x.seat === seat);
              return (
                <li key={seat}>
                  <Text weight={m ? 'medium' : 'regular'} color={m ? undefined : 'gray'}>
                    {m ? m.name : room.bots ? 'Bot au lancement' : 'Place libre'}
                  </Text>
                  <Flex gap="1">
                    {m?.user_id === me && (
                      <Badge color="grass" variant="soft">
                        vous
                      </Badge>
                    )}
                    {m?.user_id === room.host && (
                      <Badge color="gray" variant="soft">
                        hôte
                      </Badge>
                    )}
                  </Flex>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <Flex gap="3" mt="5" wrap="wrap" align="center">
        {isHost ? (
          <Button size="3" onClick={props.onLaunch} disabled={!canLaunch || props.busy}>
            {props.busy ? <Spinner /> : null} Lancer la partie
          </Button>
        ) : (
          <Text color="gray">
            <Spinner /> En attente de l’hôte…
          </Text>
        )}
        <Button size="3" variant="soft" color="gray" onClick={props.onLeave}>
          <ExitIcon /> Quitter la table
        </Button>
        {isHost && !canLaunch && (
          <Text size="2" color="gray">
            Il faut au moins un autre joueur (ou les bots).
          </Text>
        )}
      </Flex>
    </div>
  );
}

/** Vue de la partie pour ce joueur : ses propres cartes, les autres cachées, lui en bas. */
function playerView(pub: PublicTable, me: string, hand: HandRow | null, myName: string | undefined): GameState {
  const g = pub.game;
  const result = g.result && myName ? { ...g.result, summary: g.result.summary.replace(new RegExp(`^${escapeRe(myName)} gagne\\b`), 'Vous gagnez') } : g.result;
  return {
    ...g,
    result,
    players: g.players.map((p, i) => {
      const mine = pub.seats[i]?.userId === me;
      return { ...p, isHuman: mine, hole: mine && hand && hand.hand === g.handNumber ? hand.cards : p.hole };
    }),
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function useCountdown(at: number | null): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (at === null) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 500);
    return () => window.clearInterval(t);
  }, [at]);
  return at === null ? null : Math.max(0, Math.ceil((at - serverNow()) / 1000));
}

function OnlineGame(props: {
  room: RoomRow;
  pub: PublicTable;
  members: MemberRow[];
  me: string;
  hand: HandRow | null;
  busy: boolean;
  error: string | null;
  onPlay: (a: Action) => void;
  onReplay: () => void;
  onLeave: () => void;
}) {
  const { room, pub, me } = props;
  const [settings] = useSettings();
  const [feedback, setFeedback] = useState<FeedbackEntry | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const heroIndex = pub.seats.findIndex((s) => s.userId === me);
  const myName = pub.seats[heroIndex]?.name;
  const game = useMemo(() => playerView(pub, me, props.hand, myName), [pub, me, props.hand, myName]);
  const over = pub.over;
  const toAct = !game.result && !over ? game.toAct : null;
  const heroTurn = toAct !== null && toAct === heroIndex && game.players[heroIndex].hole[0] >= 0;
  const legal = heroTurn ? getLegalActions(game) : null;
  const advice = useMemo(
    () => (heroTurn && settings.coachMode !== 'off' ? getAdvice(game) : null),
    // Un seul calcul par situation (le conseil fait un Monte Carlo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroTurn, room.version, settings.coachMode, props.hand?.hand],
  );
  const seconds = useCountdown(pub.nextAt);
  const isHost = room.host === me;
  const street = STREET_FR[game.street];
  const actor = toAct !== null ? pub.seats[toAct] : null;
  const hero = game.players[heroIndex];

  const onAction = (action: Action, label: string) => {
    const grade = advice && settings.coachMode !== 'off' ? gradeDecision(advice, action) : null;
    const event = advice && grade ? classifyDecision(advice, action, grade) : null;
    if (event) void logEvent(event);
    if (grade) setFeedback({ grade, action: label, street, hand: game.handNumber, event });
    props.onPlay(action);
  };

  const title = over
    ? 'Partie terminée'
    : game.result
      ? 'Main terminée'
      : heroTurn
        ? `${street}, à vous de parler`
        : hero && (hero.folded || hero.sittingOut)
          ? `${street} · ${hero.sittingOut ? 'vous n’avez plus de jetons' : 'vous avez passé la main'}`
          : `${street} · ${actor?.name ?? ''} réfléchit`;

  const myPlace = pub.eliminations.find((e) => e.userId === me)?.place;

  return (
    <div className="play">
      <div className="play__main">
        <div className="play__bar">
          <div>
            <Text size="2" color="gray">
              Table {room.code} · main n° {game.handNumber} · {game.players.filter((p) => !p.sittingOut).length} joueurs
            </Text>
            <Heading size="6" className="play__title">
              {title}
            </Heading>
          </div>
          {confirmLeave ? (
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="2">Quitter la table ?</Text>
              <Button size="2" color="tomato" onClick={props.onLeave}>
                Quitter
              </Button>
              <Button size="2" variant="soft" color="gray" onClick={() => setConfirmLeave(false)}>
                Rester
              </Button>
            </Flex>
          ) : (
            <Button size="2" variant="soft" color="gray" onClick={() => setConfirmLeave(true)} aria-label="Quitter la table">
              <ExitIcon /> <span className="hide-phone">Quitter la table</span>
            </Button>
          )}
        </div>

        <div className="table-area">
          <Table game={game} heroSeat={Math.max(0, heroIndex)} thinking={toAct !== null && toAct !== heroIndex ? toAct : null} thinkMs={Math.max(0, (pub.nextAt ?? 0) - serverNow())} />
        </div>

        <div className="console">
          {props.error && (
            <Callout.Root color="tomato" size="1" mb="2">
              <Callout.Text>{props.error}</Callout.Text>
            </Callout.Root>
          )}
          {heroTurn && legal ? (
            <div className={props.busy ? 'is-busy' : undefined} aria-busy={props.busy}>
              <ActionBar
                key={`${room.version}`}
                game={game}
                legal={legal}
                advice={settings.coachMode === 'visible' ? advice : null}
                showHint={settings.coachMode === 'visible'}
                onAction={onAction}
              />
            </div>
          ) : over ? (
            <Card size="3" className="action-bar action-bar--result">
              <Flex direction="column" gap="3" align="center">
                <Text size="4" weight="bold">
                  {myPlace === 1 ? 'Vous remportez la partie !' : myPlace ? `Vous terminez ${placeLabel(myPlace)}.` : 'Partie terminée.'}
                </Text>
                {isHost ? (
                  <Button size="3" onClick={props.onReplay} disabled={props.busy}>
                    <ReloadIcon /> Rejouer avec les mêmes joueurs
                  </Button>
                ) : (
                  <Text size="2" color="gray">
                    L’hôte peut relancer une partie.
                  </Text>
                )}
              </Flex>
            </Card>
          ) : (
            <Card size="3" className="action-bar action-bar--wait">
              <Text size="3" color="gray">
                {game.result
                  ? `Main suivante dans ${seconds ?? 0} s`
                  : actor?.bot
                    ? `${actor.name} réfléchit…`
                    : actor
                      ? `${actor.name} a ${seconds ?? 0} s pour jouer${actor.away ? ' (absent : joué automatiquement)' : ''}`
                      : ''}
              </Text>
            </Card>
          )}
        </div>
      </div>

      <aside className="play__side">
        <CoachPanel advice={advice} mode={settings.coachMode} feedback={feedback} heroTurn={heroTurn} bigBlind={game.bigBlind} />
        <Card size="3">
          <Text as="p" size="2" weight="bold" mb="3">
            Joueurs
          </Text>
          <Flex direction="column" gap="2">
            {pub.seats.map((s, i) => {
              const p = game.players[i];
              const out = pub.eliminations.find((e) => e.name === s.name && e.userId === s.userId && p.stack === 0);
              const prof = s.bot ? PROFILE_BY_ID[s.bot] : null;
              return (
                <Flex key={i} justify="between" align="center" gap="2">
                  <Text size="2" weight="medium" color={out || s.away ? 'gray' : undefined}>
                    {s.userId === me ? `${s.name} (vous)` : s.name}
                  </Text>
                  <Flex gap="2" align="center">
                    {out ? (
                      <Badge color="gray" variant="outline">
                        {placeLabel(out.place)}
                      </Badge>
                    ) : s.away ? (
                      <Badge color="amber" variant="soft">
                        absent
                      </Badge>
                    ) : prof ? (
                      <Badge color={PROFILE_COLOR[prof.id]} variant="soft">
                        bot · {prof.label}
                      </Badge>
                    ) : null}
                    <Text size="2" className="mono">
                      {formatBB(p.stack, game.bigBlind)}
                    </Text>
                  </Flex>
                </Flex>
              );
            })}
          </Flex>
        </Card>
        <Card size="3">
          <Flex direction="column" gap="3" align="start">
            <Text size="2" weight="bold">
              Inviter
            </Text>
            <Text size="2" color="gray">
              Code <span className="mono">{room.code}</span> : de nouveaux joueurs pourront s’asseoir dès la fin de cette partie.
            </Text>
            <CopyLink code={room.code} />
          </Flex>
        </Card>
      </aside>
    </div>
  );
}
