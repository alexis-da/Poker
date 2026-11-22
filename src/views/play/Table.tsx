import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from '../../components/Avatar';
import { ChipStack } from '../../components/Chips';
import { PlayingCard } from '../../components/PlayingCard';
import { PROFILE_BY_ID } from '../../engine/bot';
import type { Card } from '../../engine/cards';
import { bestFive, describeScore, evaluate } from '../../engine/evaluator';
import { formatBB, potTotal, type GameState } from '../../engine/game';

interface Props {
  game: GameState;
  thinking: number | null;
  /** Temps de réflexion du bot qui parle, pour l'anneau de l'avatar. */
  thinkMs: number;
}

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

type TagKind = 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'blind';

function actionTag(label: string): { kind: TagKind; text: string } {
  if (label.startsWith('Couché')) return { kind: 'fold', text: 'Couché' };
  if (label.startsWith('Parole')) return { kind: 'check', text: 'Check' };
  if (label.startsWith('Suit')) return { kind: 'call', text: label };
  if (label.startsWith('Tapis')) return { kind: 'allin', text: label };
  if (label.startsWith('SB') || label.startsWith('BB')) return { kind: 'blind', text: label };
  return { kind: 'raise', text: label };
}

/** Cartes communes, avec animation de distribution des nouvelles cartes. */
function Board({ board, highlight }: { board: Card[]; highlight: Card[] | null }) {
  const prev = useRef<Card[]>([]);
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
  const centerPot = result ? 0 : pot - streetBets;
  const heroP = game.players.find((p) => p.isHuman);
  const heroHand =
    heroP && !heroP.folded && heroP.hole.length === 2 && game.board.length >= 3
      ? describeScore(evaluate([...heroP.hole, ...game.board]))
      : null;

  // Cartes gagnantes à mettre en valeur à l'abattage.
  let winningCards: Card[] | null = null;
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
            <div className="felt__line" aria-hidden="true" />
            <div className="felt__brand" aria-hidden="true">
              Coach Hold’em
            </div>
            <div className="table__center">
              <div className="pot" aria-live="polite">
                {centerPot > 0 && <ChipStack amount={centerPot} size={compact ? 16 : 20} maxColumns={4} />}
                <span className="pot__amount">
                  <span className="pot__label">Pot</span> {formatBB(result ? pot : centerPot, bb)}
                </span>
                {!result && streetBets > 0 && <span className="pot__total">Total {formatBB(pot, bb)}</span>}
              </div>
              <Board board={game.board} highlight={winningCards} />
              {result && (
                <div className="table-result" key={game.handNumber}>
                  {result.summary}
                </div>
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
        const tag = p.lastAction && !result ? actionTag(p.lastAction) : null;
        const side = pt.y < 30 ? 'top' : 'bottom';
        return (
          <div key={p.id}>
            <div
              className={[
                'seat',
                `seat--${side}`,
                p.isHuman ? 'seat--hero' : '',
                p.folded ? 'seat--folded' : '',
                isTurn ? 'seat--turn' : '',
                p.sittingOut ? 'seat--out' : '',
                won ? 'seat--won' : '',
              ].join(' ')}
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              <div className="seat__cards">
                {p.hole.map((c, k) => (
                  <PlayingCard
                    key={`${game.handNumber}-${k}`}
                    card={c}
                    faceDown={!showCards}
                    size={p.isHuman ? 'lg' : 'sm'}
                    tilt={k === 0 ? -6 : 6}
                    dealDelay={k * 120 + i * 40}
                    highlight={winningCards !== null && won && winningCards.includes(c)}
                  />
                ))}
              </div>
              <div className="seat__pod">
                <Avatar name={p.name} profile={p.profile} isHero={p.isHuman} active={isTurn} size={compact ? 30 : 46} />
                <div className="seat__box">
                  <span className="seat__name">{p.isHuman ? 'Vous' : p.name}</span>
                  <span className="seat__stack">{p.sittingOut ? 'Éliminé' : formatBB(p.stack, bb)}</span>
                  {profile && <span className="seat__profile">{profile.label}</span>}
                  {p.isHuman && heroHand && <span className="seat__hand">{heroHand}</span>}
                  {isTurn && (
                    <span
                      key={`${game.handNumber}-${game.history.length}`}
                      className={`seat__timer ${thinking === i ? 'seat__timer--run' : ''}`}
                      style={{ '--think': `${thinkMs}ms` } as CSSProperties}
                    />
                  )}
                </div>
                {game.positions[i] && <span className="seat__pos">{game.positions[i]}</span>}
                {game.button === i && (
                  <span className="seat__dealer" title="Bouton du donneur">
                    D
                  </span>
                )}
              </div>
              {tag && <span className={`seat__tag seat__tag--${tag.kind}`}>{tag.text}</span>}
              {result && net !== 0 && (
                <span className={`seat__tag ${net > 0 ? 'seat__tag--win' : 'seat__tag--loss'}`}>
                  {net > 0 ? '+' : '−'}
                  {formatBB(Math.abs(net), bb)}
                </span>
              )}
            </div>
            {p.bet > 0 && !result && (
              <div className="bet" style={{ left: `${bt.x}%`, top: `${bt.y}%` }}>
                <ChipStack amount={p.bet} size={compact ? 13 : 16} maxColumns={3} maxPerColumn={6} />
                <span>{formatBB(p.bet, bb)}</span>
              </div>
            )}
          </div>
        );
      })}

      {result &&
        [...winnerShare.entries()].map(([w, amount]) => {
          const to = seatPoint(w, n, 0.72, compact);
          const style = { '--tx': `${to.x}%`, '--ty': `${to.y}%` } as CSSProperties;
          return (
            <div key={`fly-${game.handNumber}-${w}`} className="pot-flight" style={style} aria-hidden="true">
              <ChipStack amount={amount} size={compact ? 16 : 20} maxColumns={4} />
            </div>
          );
        })}
    </div>
  );
}
