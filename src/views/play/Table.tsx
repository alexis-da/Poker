import { Avatar, Badge, Card, Text } from '@radix-ui/themes';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PlayingCard } from '../../components/PlayingCard';
import GlareHover from '../../components/reactbits/GlareHover';
import { PROFILE_BY_ID } from '../../engine/bot';
import type { Card as CardT } from '../../engine/cards';
import { bestFive, describeScore, evaluate } from '../../engine/evaluator';
import { formatBB, potTotal, type GameState } from '../../engine/game';

interface Props {
  game: GameState;
  thinking: number | null;
  /** Temps de réflexion du bot qui parle, pour la barre de temps. */
  thinkMs: number;
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
        if (c === undefined) return <span key={`slot${i}`} className="pcard pcard--board pcard--slot" aria-hidden="true" />;
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

export function Table({ game, thinking, thinkMs }: Props) {
  const compact = useCompact();
  const n = game.players.length;
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
    <div className={`table-stage seats-${n} ${compact ? 'is-compact' : ''}`}>
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
        const pt = seatPoint(i, n, 1, compact);
        const bt = seatPoint(i, n, compact ? 0.6 : 0.55, compact);
        const profile = p.profile ? PROFILE_BY_ID[p.profile] : null;
        const isTurn = game.toAct === i && !result;
        const showCards = p.isHuman || p.shown;
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
            >
              <div className="seat__cards">
                {p.isHuman && p.hole.length > 0 ? (
                  <GlareHover borderRadius="12px" glareOpacity={0.55} className="seat__glare">
                    <span className="seat__hand-cards">{cards}</span>
                  </GlareHover>
                ) : (
                  cards
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
                  <span className="seat__stack">{p.sittingOut ? 'Éliminé' : formatBB(p.stack, bb)}</span>
                  {p.isHuman && heroHand && (
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
              <span className="bet" style={{ left: `${bt.x}%`, top: `${bt.y}%` }}>
                <span className="chip-dot" aria-hidden="true" />
                {formatBB(p.bet, bb)}
              </span>
            )}
          </div>
        );
      })}

      {result &&
        [...winnerShare.keys()].map((w) => {
          const to = seatPoint(w, n, 0.72, compact);
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
