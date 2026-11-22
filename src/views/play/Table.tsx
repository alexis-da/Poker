import { useEffect, useRef, useState } from 'react';
import { PlayingCard } from '../../components/PlayingCard';
import { PROFILE_BY_ID } from '../../engine/bot';
import type { Card } from '../../engine/cards';
import { bestFive } from '../../engine/evaluator';
import { formatBB, potTotal, type GameState } from '../../engine/game';

interface Props {
  game: GameState;
  thinking: number | null;
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
  const rx = compact ? 36 : 42;
  const ry = compact ? 43 : 41;
  return { x: 50 + rx * scale * Math.cos(angle), y: 50 + ry * scale * Math.sin(angle) };
}

/** Cartes du board avec animation de distribution des nouvelles cartes. */
function Board({ board, highlight }: { board: Card[]; highlight: Card[] | null }) {
  const prev = useRef<Card[]>([]);
  const firstNew = prev.current.length <= board.length && board.slice(0, prev.current.length).every((c, i) => c === prev.current[i])
    ? prev.current.length
    : 0;
  useEffect(() => {
    prev.current = board;
  }, [board]);
  return (
    <div className="board" aria-label="Cartes communes">
      {Array.from({ length: 5 }, (_, i) => {
        const c = board[i];
        if (c === undefined) return <span key={`slot${i}`} className="pcard pcard--md pcard--slot" aria-hidden="true" />;
        const isNew = i >= firstNew;
        // Le turn et la river arrivent après une pause quand plusieurs rues sont déroulées d'un coup.
        const extra = i >= 3 ? (i - Math.max(firstNew, 2)) * 450 : 0;
        const delay = isNew ? (i - firstNew) * 90 + extra : undefined;
        return (
          <PlayingCard
            key={c}
            card={c}
            size="md"
            dealDelay={delay}
            highlight={highlight?.includes(c)}
            dim={highlight !== null && !highlight.includes(c)}
          />
        );
      })}
    </div>
  );
}

export function Table({ game, thinking }: Props) {
  const compact = useCompact();
  const n = game.players.length;
  const bb = game.bigBlind;
  const pot = potTotal(game);
  const streetBets = game.players.reduce((a, p) => a + p.bet, 0);
  const result = game.result;

  // Cartes gagnantes à mettre en valeur à l'abattage.
  let winningCards: Card[] | null = null;
  let winnerSet = new Set<number>();
  if (result) {
    winnerSet = new Set(result.pots.flatMap((p) => p.winners));
    if (result.showdown) {
      const w = result.pots[0].winners[0];
      winningCards = bestFive([...game.players[w].hole, ...game.board]);
    }
  }

  return (
    <div className={`table-wrap seats-${n}`}>
      <div className="table-rail">
        <div className="table-felt">
          <div className="table-center">
            <div className="pot" aria-live="polite">
              <span className="pot__label">Pot</span>
              <span className="pot__value">{formatBB(result ? pot : pot - streetBets, bb)}</span>
              {!result && streetBets > 0 && <span className="pot__total">total {formatBB(pot, bb)}</span>}
            </div>
            <Board board={game.board} highlight={winningCards} />
            {result && <div className="table-result">{result.summary}</div>}
          </div>
        </div>
      </div>

      {game.players.map((p, i) => {
        const pt = seatPoint(i, n, 1, compact);
        const bt = seatPoint(i, n, compact ? 0.62 : 0.56, compact);
        const profile = p.profile ? PROFILE_BY_ID[p.profile] : null;
        const isTurn = game.toAct === i;
        const showCards = p.isHuman || p.shown;
        const won = winnerSet.has(i);
        const net = result?.net[i] ?? 0;
        return (
          <div key={p.id}>
            <div
              className={`seat ${p.isHuman ? 'seat--hero' : ''} ${p.folded ? 'seat--folded' : ''} ${isTurn ? 'seat--turn' : ''} ${
                p.sittingOut ? 'seat--out' : ''
              } ${won ? 'seat--won' : ''}`}
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              <div className="seat__cards">
                {p.hole.length > 0 &&
                  p.hole.map((c, k) => (
                    <PlayingCard
                      key={k}
                      card={showCards ? c : null}
                      faceDown={!showCards}
                      size={p.isHuman ? 'md' : 'sm'}
                      highlight={winningCards !== null && won && winningCards.includes(c)}
                    />
                  ))}
              </div>
              <div className="seat__plate">
                {game.button === i && (
                  <span className="seat__dealer" title="Bouton du donneur">
                    D
                  </span>
                )}
                <div className="seat__top">
                  <span className="seat__name">{p.name}</span>
                  {game.positions[i] && <span className="seat__pos">{game.positions[i]}</span>}
                </div>
                <div className="seat__stack">{p.sittingOut ? 'Plus de jetons' : formatBB(p.stack, bb)}</div>
                {profile && <div className="seat__profile">{profile.label}</div>}
              </div>
              {thinking === i && <div className="seat__bubble seat__bubble--thinking">…</div>}
              {thinking !== i && p.lastAction && !result && <div className="seat__bubble">{p.lastAction}</div>}
              {result && net !== 0 && (
                <div className={`seat__bubble ${net > 0 ? 'seat__bubble--win' : 'seat__bubble--loss'}`}>
                  {net > 0 ? '+' : '−'}
                  {formatBB(Math.abs(net), bb)}
                </div>
              )}
            </div>
            {p.bet > 0 && !result && (
              <div className="bet" style={{ left: `${bt.x}%`, top: `${bt.y}%` }}>
                <span className="chip" aria-hidden="true" />
                {formatBB(p.bet, bb)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
