import { Avatar, Badge, Card, Text } from '@radix-ui/themes';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PlayingCard } from '../../components/PlayingCard';
import GlareHover from '../../components/reactbits/GlareHover';
import type { PeekHandlers } from './usePeek';
import { PROFILE_BY_ID } from '../../engine/bot';
import type { Card as CardT } from '../../engine/cards';
import { bestFive, describeScore, evaluate } from '../../engine/evaluator';
import { formatBB, potTotal, type GameState } from '../../engine/game';

interface Props {
  game: GameState;
  thinking: number | null;
  /** Temps de réflexion du bot qui parle, pour la barre de temps. */
  thinkMs: number;
  /** Siège affiché en bas de la table (en ligne : le vôtre). Par défaut, le joueur humain. */
  heroSeat?: number;
  /** Cartes cachées : votre main est affichée de dos tant que vous ne la regardez pas. */
  concealHero?: boolean;
  /** Gestes pour regarder sa main (maintenir le doigt ou la souris dessus). */
  peekHandlers?: PeekHandlers;
}

type RadixColor = 'gray' | 'blue' | 'grass' | 'amber' | 'tomato';

/** Couleur d'avatar par profil de bot. */
export const PROFILE_COLOR: Record<string, RadixColor> = { roc: 'gray', reg: 'blue', lag: 'tomato', station: 'amber' };

/** Vrai sur les écrans étroits, où la table passe en format vertical. */
function useCompact(): boolean {
  const query = '(max-width: 640px)';
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

/** Position d'un siège sur l'ellipse ; le joueur 0 (vous) est en bas, puis sens horaire. */
function seatPoint(i: number, n: number, scale: number, compact: boolean) {
  const angle = ((90 + (i * 360) / n) * Math.PI) / 180;
  const rx = compact ? 36 : 41;
  const ry = compact ? 42 : 40;
  return { x: 50 + rx * scale * Math.cos(angle), y: 50 + ry * scale * Math.sin(angle) };
}

function actionTag(label: string): { color: RadixColor; text: string } {
  if (label.startsWith('Couché')) return { color: 'gray', text: 'Couché' };
  if (label.startsWith('Parole')) return { color: 'blue', text: 'Check' };
  if (label.startsWith('Suit')) return { color: 'grass', text: label };
  if (label.startsWith('Tapis')) return { color: 'tomato', text: label };
  if (label.startsWith('SB') || label.startsWith('BB')) return { color: 'gray', text: label };
  return { color: 'amber', text: label };
}

/** Cartes communes, avec animation de distribution des nouvelles cartes. */
function Board({ board, highlight }: { board: CardT[]; highlight: CardT[] | null }) {
  const prev = useRef<CardT[]>([]);
  const firstNew =
    prev.current.length <= board.length && board.slice(0, prev.current.length).every((c, i) => c === prev.current[i])
      ? prev.current.length
      : 0;
  useEffect(() => {
    prev.current = board;
  }, [board]);
  return (
    <div className="board" aria-label="Cartes communes">
      {Array.from({ length: 5 }, (_, i) => {
        const c = board[i];
        if (c === undefined) return <span key={`slot${i}`} className="pcard pcard--md pcard--board pcard--slot" aria-hidden="true" />;
        const isNew = i >= firstNew;
        // Le turn et la river arrivent après une pause quand plusieurs rues sont déroulées d'un coup.
        const extra = i >= 3 ? (i - Math.max(firstNew, 2)) * 520 : 0;
        const delay = isNew ? (i - firstNew) * 110 + extra : undefined;
        return (
          <PlayingCard
            key={c}
            card={c}
            size="md"
            className="pcard--board"
            dealDelay={delay}
            highlight={highlight?.includes(c)}
            dim={highlight !== null && !highlight.includes(c)}
          />
        );
      })}
    </div>
  );
}

/** Échelle des sièges : ils rétrécissent avec la table sur les petites fenêtres. Elle dépend de la largeur
 *  et de la hauteur de la table, pour que les sièges d'un même côté ne se touchent pas. */
function useSeatScale(compact: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setScale(compact ? Math.max(0.72, Math.min(1, w / 358, h / 418)) : Math.max(0.6, Math.min(1, w / 860, h / 494)));
      placeBets(el);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);
  return [ref, scale] as const;
}

type Box = { l: number; t: number; r: number; b: number };

/**
 * Pose chaque mise sur le tapis, au plus près de l'avant de son joueur, sans recouvrir un siège, une étiquette,
 * le pot, le tableau ou une autre mise. Les tailles sont lues hors animation (largeur de mise en page × échelle).
 */
function placeBets(stage: HTMLElement | null) {
  if (!stage) return;
  const bets = [...stage.querySelectorAll<HTMLElement>('.bet[data-seat]')];
  const feltEl = stage.querySelector<HTMLElement>('.table__felt');
  if (!bets.length || !feltEl) return;
  const S = stage.getBoundingClientRect();
  if (!S.width || !S.height) return;
  const k = parseFloat(getComputedStyle(stage).getPropertyValue('--seat-scale')) || 1;
  // Boîte d'un élément, centrée sur sa position affichée, à sa taille finale (les animations « pop » la réduisent).
  const centerEl = stage.querySelector<HTMLElement>('.table__center');
  const centerK = (centerEl && parseFloat(getComputedStyle(centerEl).scale)) || 1;
  const box = (el: HTMLElement, scale: number | null): Box | null => {
    const r = el.getBoundingClientRect();
    const w = scale ? el.offsetWidth * scale : r.width;
    const h = scale ? el.offsetHeight * scale : r.height;
    if (!w || !h) return null;
    const cx = (r.left + r.right) / 2 - S.left;
    const cy = (r.top + r.bottom) / 2 - S.top;
    return { l: cx - w / 2, t: cy - h / 2, r: cx + w / 2, b: cy + h / 2 };
  };
  const seats = new Map<number, Box>();
  const obstacles: Box[] = [];
  stage.querySelectorAll<HTMLElement>('.seat[data-seat]').forEach((el) => {
    const b = box(el, null);
    if (!b) return;
    seats.set(Number(el.dataset.seat), b);
    obstacles.push(b);
  });
  stage.querySelectorAll<HTMLElement>('.seat__tag').forEach((el) => {
    const b = box(el, k);
    if (b) obstacles.push(b);
  });
  stage.querySelectorAll<HTMLElement>('.table__center > *').forEach((el) => {
    const b = box(el, centerK);
    if (b) obstacles.push(b);
  });
  const F = feltEl.getBoundingClientRect();
  const fx = (F.left + F.right) / 2 - S.left;
  const fy = (F.top + F.bottom) / 2 - S.top;
  const ax = F.width / 2 - 6;
  const ay = F.height / 2 - 6;
  const onFelt = (x: number, y: number) => ((x - fx) / ax) ** 2 + ((y - fy) / ay) ** 2 <= 1;
  const hits = (c: Box, gap: number) => obstacles.some((o) => c.l < o.r + gap && o.l < c.r + gap && c.t < o.b + gap && o.t < c.b + gap);
  const mid = (b: Box) => ({ x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 });
  const step = Math.max(4, Math.min(S.width, S.height) / 70);

  for (const el of bets) {
    const seatBox = seats.get(Number(el.dataset.seat));
    if (!seatBox) continue;
    const w = el.offsetWidth * k;
    const h = el.offsetHeight * k;
    const own = mid(seatBox);
    // Point idéal : à mi-chemin entre le joueur et le centre de la table.
    const ideal = { x: own.x + (fx - own.x) * 0.5, y: own.y + (fy - own.y) * 0.5 };
    const others = [...seats.entries()].filter(([i]) => i !== Number(el.dataset.seat)).map(([, b]) => mid(b));
    let best = null as { x: number; y: number; d: number } | null;
    // D'abord avec une marge et devant son joueur, puis en relâchant ces exigences si la table est pleine.
    for (const [strict, gap] of [
      [true, 4 * k],
      [false, 4 * k],
      [false, 0],
    ] as const) {
      for (let y = h / 2; y <= S.height - h / 2; y += step) {
        for (let x = w / 2; x <= S.width - w / 2; x += step) {
          const d = Math.hypot(x - ideal.x, y - ideal.y);
          if (best && d >= best.d) continue;
          const c = { l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 };
          if (!onFelt(c.l, c.t) || !onFelt(c.r, c.t) || !onFelt(c.l, c.b) || !onFelt(c.r, c.b)) continue;
          if (hits(c, gap)) continue;
          // Plus près de son joueur que de tout autre, pour qu'on sache à qui est la mise.
          const dOwn = Math.hypot(x - own.x, y - own.y);
          if (strict && others.some((o) => Math.hypot(x - o.x, y - o.y) < dOwn)) continue;
          best = { x, y, d };
        }
      }
      if (best) break;
    }
    if (!best) continue;
    el.style.left = `${((best.x / S.width) * 100).toFixed(2)}%`;
    el.style.top = `${((best.y / S.height) * 100).toFixed(2)}%`;
    obstacles.push({ l: best.x - w / 2, t: best.y - h / 2, r: best.x + w / 2, b: best.y + h / 2 });
  }
}

export function Table({ game, thinking, thinkMs, heroSeat, concealHero = false, peekHandlers }: Props) {
  const compact = useCompact();
  const [stageRef, seatScale] = useSeatScale(compact);
  // Après chaque rendu, avant l'affichage : replacer les mises selon ce qui est réellement à l'écran.
  useLayoutEffect(() => placeBets(stageRef.current));
  const n = game.players.length;
  // Rotation : le siège du joueur est toujours en bas, les autres dans le sens horaire.
  const hero = heroSeat ?? Math.max(0, game.players.findIndex((p) => p.isHuman));
  const at = (i: number) => (i - hero + n) % n;
  const bb = game.bigBlind;
  const pot = potTotal(game);
  const streetBets = game.players.reduce((a, p) => a + p.bet, 0);
  const result = game.result;
  const centerPot = result ? pot : pot - streetBets;
  const heroP = game.players.find((p) => p.isHuman);
  const heroHand =
    heroP && !heroP.folded && heroP.hole.length === 2 && game.board.length >= 3
      ? describeScore(evaluate([...heroP.hole, ...game.board]))
      : null;

  // Cartes gagnantes à mettre en valeur à l'abattage.
  let winningCards: CardT[] | null = null;
  const winnerShare = new Map<number, number>();
  if (result) {
    for (const p of result.pots) {
      const share = p.amount / p.winners.length;
      for (const w of p.winners) winnerShare.set(w, (winnerShare.get(w) ?? 0) + share);
    }
    if (result.showdown) {
      const w = result.pots[0].winners[0];
      winningCards = bestFive([...game.players[w].hole, ...game.board]);
    }
  }

  return (
    <div
      ref={stageRef}
      className={`table-stage seats-${n} ${compact ? 'is-compact' : ''}`}
      style={{ '--seat-scale': seatScale.toFixed(3) } as CSSProperties}
    >
      <div className="table">
        <div className="table__rail">
          <div className="table__felt">
            <div className="table__center">
              <span className="pot" aria-live="polite">
                Pot {formatBB(centerPot, bb)}
                {!result && streetBets > 0 && <span className="pot__total"> · total {formatBB(pot, bb)}</span>}
              </span>
              <Board board={game.board} highlight={winningCards} />
              {result && (
                <span className="table-result" key={game.handNumber}>
                  {result.summary}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {game.players.map((p, i) => {
        const pt = seatPoint(at(i), n, 1, compact);
        const bt = seatPoint(at(i), n, compact ? 0.6 : 0.55, compact);
        const profile = p.profile ? PROFILE_BY_ID[p.profile] : null;
        const isTurn = game.toAct === i && !result;
        const showCards = p.shown || (p.isHuman && !concealHero);
        const won = winnerShare.has(i);
        const net = result?.net[i] ?? 0;
        const tag = p.lastAction && !result && !p.isHuman ? actionTag(p.lastAction) : null;
        const cards = p.hole.map((c, k) => (
          <PlayingCard
            key={`${game.handNumber}-${k}`}
            card={c}
            faceDown={!showCards}
            size={p.isHuman ? 'lg' : 'sm'}
            tilt={k === 0 ? -5 : 5}
            dealDelay={k * 120 + i * 40}
            highlight={winningCards !== null && won && winningCards.includes(c)}
          />
        ));
        return (
          <div key={p.id}>
            <div
              className={[
                'seat',
                p.isHuman ? 'seat--hero' : '',
                p.folded ? 'seat--folded' : '',
                isTurn ? 'seat--turn' : '',
                p.sittingOut ? 'seat--out' : '',
                won ? 'seat--won' : '',
              ].join(' ')}
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
              data-seat={i}
            >
              <div
                className={p.isHuman && peekHandlers ? 'seat__cards seat__cards--peek' : 'seat__cards'}
                {...(p.isHuman && peekHandlers && p.hole.length > 0 ? peekHandlers : {})}
              >
                {p.isHuman && p.hole.length > 0 ? (
                  <GlareHover borderRadius="12px" glareOpacity={0.55} className="seat__glare">
                    <span className="seat__hand-cards">{cards}</span>
                  </GlareHover>
                ) : (
                  cards
                )}
                {p.isHuman && concealHero && !p.shown && p.hole.length > 0 && !p.folded && (
                  <span className="peek-hint" aria-hidden="true">
                    {compact ? 'Maintenir pour voir' : 'Maintenir pour voir · V'}
                  </span>
                )}
              </div>
              <Card size="1" variant="classic" className="seat__plate">
                <Avatar
                  size={compact ? '1' : p.isHuman ? '3' : '2'}
                  radius="full"
                  variant={isTurn || p.isHuman ? 'solid' : 'soft'}
                  color={p.isHuman ? 'grass' : PROFILE_COLOR[p.profile ?? 'reg']}
                  fallback={p.isHuman ? 'V' : p.name.slice(0, 1)}
                />
                <span className="seat__info">
                  <Text size="1" color="gray" className="seat__name">
                    {p.isHuman ? 'Vous' : p.name}
                    {game.positions[i] ? ` · ${game.positions[i]}` : ''}
                  </Text>
                  <span className="seat__stack">{p.sittingOut ? 'Hors jeu' : formatBB(p.stack, bb)}</span>
                  {p.isHuman && heroHand && (!concealHero || p.shown) && (
                    <Text size="1" className="seat__hand">
                      {heroHand}
                    </Text>
                  )}
                  {!p.isHuman && profile && !compact && (
                    <Text size="1" color="gray" className="seat__profile">
                      {profile.label}
                    </Text>
                  )}
                </span>
                {isTurn && (
                  <span
                    key={`${game.handNumber}-${game.history.length}`}
                    className={`seat__timer ${thinking === i ? 'seat__timer--run' : ''}`}
                    style={{ '--think': `${thinkMs}ms` } as CSSProperties}
                  />
                )}
                {game.button === i && (
                  <span className="seat__dealer" title="Bouton du donneur">
                    D
                  </span>
                )}
              </Card>
              {tag && (
                <Badge className="seat__tag" color={tag.color} variant="solid" size={compact ? '1' : '2'}>
                  {tag.text}
                </Badge>
              )}
              {result && net !== 0 && (
                <Badge className="seat__tag seat__tag--net" color={net > 0 ? 'grass' : 'tomato'} variant="solid" size={compact ? '1' : '2'}>
                  {net > 0 ? '+' : '−'}
                  {formatBB(Math.abs(net), bb)}
                </Badge>
              )}
            </div>
            {p.bet > 0 && !result && (
              <span className="bet" data-seat={i} style={{ left: `${bt.x}%`, top: `${bt.y}%` }}>
                <span className="chip-dot" aria-hidden="true" />
                {formatBB(p.bet, bb)}
              </span>
            )}
          </div>
        );
      })}

      {result &&
        [...winnerShare.keys()].map((w) => {
          const to = seatPoint(at(w), n, 0.72, compact);
          const style = { '--tx': `${to.x}%`, '--ty': `${to.y}%` } as CSSProperties;
          return (
            <span key={`fly-${game.handNumber}-${w}`} className="pot-flight" style={style} aria-hidden="true">
              <span className="chip-dot" />
              <span className="chip-dot" />
              <span className="chip-dot" />
            </span>
          );
        })}
    </div>
  );
}
