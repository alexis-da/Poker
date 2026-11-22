import { useEffect, useMemo, useState } from 'react';
import { PlayingCard } from '../../components/PlayingCard';
import { parseCards, RANK_LABELS, SUIT_SYMBOLS, makeCard, type Card } from '../../engine/cards';
import { computeEquity, type EquityPlayer, type EquityResult } from '../../engine/equity';
import { describeScore, evaluate } from '../../engine/evaluator';
import { parseRange, rangeCombos } from '../../engine/ranges';

type Mode = 'cards' | 'range' | 'random';

interface PlayerInput {
  mode: Mode;
  cards: (Card | null)[];
  range: string;
}

type Slot = { kind: 'player'; p: number; k: number } | { kind: 'board'; k: number };

const PRESETS: { label: string; players: (string | { range: string } | null)[]; board: string }[] = [
  { label: 'AK contre QQ', players: ['AsKs', 'QhQd'], board: '' },
  { label: 'Tirage couleur contre top paire', players: ['Ah5h', 'KsQd'], board: 'Kh8h2c' },
  { label: 'Paire contre deux overcards', players: ['8c8d', 'AhKs'], board: '' },
  { label: 'JJ contre une range de 3-bet', players: ['JsJh', { range: 'QQ+, AKs, AKo, A5s-A4s' }], board: '' },
  { label: 'Trois joueurs au flop', players: ['AsJs', 'TdTc', '9h8h'], board: 'Js9d7h' },
];

function fromPreset(i: number): { players: PlayerInput[]; board: (Card | null)[] } {
  const pr = PRESETS[i];
  const players = pr.players.map<PlayerInput>((p) => {
    if (p === null) return { mode: 'random', cards: [null, null], range: '' };
    if (typeof p === 'string') return { mode: 'cards', cards: parseCards(p), range: '' };
    return { mode: 'range', cards: [null, null], range: p.range };
  });
  const b = pr.board ? parseCards(pr.board) : [];
  return { players, board: [...b, ...Array(5 - b.length).fill(null)] };
}

const pctStr = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

export function EquityCalculator() {
  const initial = useMemo(() => fromPreset(0), []);
  const [players, setPlayers] = useState<PlayerInput[]>(initial.players);
  const [board, setBoard] = useState<(Card | null)[]>(initial.board);
  const [active, setActive] = useState<Slot | null>({ kind: 'board', k: 0 });
  const [result, setResult] = useState<EquityResult | null>(null);
  const [computing, setComputing] = useState(false);

  const used = new Set<Card>();
  players.forEach((p) => p.mode === 'cards' && p.cards.forEach((c) => c !== null && used.add(c)));
  board.forEach((c) => c !== null && used.add(c));

  const boardCards = board.filter((c): c is Card => c !== null);
  const parsedRanges = players.map((p) => {
    if (p.mode !== 'range') return null;
    try {
      const r = parseRange(p.range);
      return { combos: rangeCombos(r, used), error: r.size ? null : 'Range vide' };
    } catch (e) {
      return { combos: [], error: (e as Error).message };
    }
  });

  const problems: string[] = [];
  if (boardCards.length === 1 || boardCards.length === 2) problems.push('Le board doit compter 0, 3, 4 ou 5 cartes.');
  players.forEach((p, i) => {
    if (p.mode === 'cards' && p.cards.filter((c) => c !== null).length !== 2)
      problems.push(`Joueur ${i + 1} : choisissez deux cartes.`);
    if (p.mode === 'range' && parsedRanges[i]?.error) problems.push(`Joueur ${i + 1} : ${parsedRanges[i]!.error}.`);
    if (p.mode === 'range' && parsedRanges[i] && !parsedRanges[i]!.error && parsedRanges[i]!.combos.length === 0)
      problems.push(`Joueur ${i + 1} : aucune combinaison disponible.`);
  });

  const inputKey = JSON.stringify({ players, board });
  useEffect(() => {
    if (problems.length) {
      setResult(null);
      return;
    }
    setComputing(true);
    const t = window.setTimeout(() => {
      const eqPlayers: EquityPlayer[] = players.map((p, i) => {
        if (p.mode === 'cards') return { cards: p.cards as Card[] };
        if (p.mode === 'range') return { range: parsedRanges[i]!.combos };
        return null;
      });
      setResult(computeEquity(eqPlayers, boardCards, { iterations: players.length > 3 ? 25000 : 40000 }));
      setComputing(false);
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, problems.length]);

  const setCard = (slot: Slot, card: Card | null) => {
    if (slot.kind === 'board') {
      setBoard((b) => b.map((c, k) => (k === slot.k ? card : c)));
    } else {
      setPlayers((ps) => ps.map((p, i) => (i === slot.p ? { ...p, cards: p.cards.map((c, k) => (k === slot.k ? card : c)) } : p)));
    }
  };

  const nextEmpty = (after: Slot | null): Slot | null => {
    const slots: Slot[] = [];
    players.forEach((p, i) => p.mode === 'cards' && [0, 1].forEach((k) => slots.push({ kind: 'player', p: i, k })));
    for (let k = 0; k < 5; k++) slots.push({ kind: 'board', k });
    const isEmpty = (s: Slot) => (s.kind === 'board' ? board[s.k] === null : players[s.p].cards[s.k] === null);
    const same = (a: Slot, b: Slot) => a.kind === b.kind && a.k === b.k && (a.kind === 'board' || a.p === (b as typeof a).p);
    const start = after ? slots.findIndex((s) => same(s, after)) + 1 : 0;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[(start + i) % slots.length];
      if (after && same(s, after)) continue;
      if (isEmpty(s)) return s;
    }
    return null;
  };

  const pickCard = (c: Card) => {
    if (!active) return;
    setCard(active, c);
    setActive(nextEmpty(active));
  };

  const isActive = (s: Slot) =>
    active !== null && active.kind === s.kind && active.k === s.k && (s.kind === 'board' || (active as typeof s).p === s.p);

  const slotButton = (s: Slot, card: Card | null) => (
    <button
      type="button"
      key={`${s.kind}${s.kind === 'player' ? s.p : ''}-${s.k}`}
      className={`slot ${isActive(s) ? 'slot--active' : ''}`}
      onClick={() => (card !== null && isActive(s) ? setCard(s, null) : setActive(s))}
      aria-label={card === null ? 'Emplacement vide' : 'Changer la carte'}
    >
      {card === null ? <span className="pcard pcard--md pcard--slot" /> : <PlayingCard card={card} size="md" />}
    </button>
  );

  const load = (i: number) => {
    const p = fromPreset(i);
    setPlayers(p.players);
    setBoard(p.board);
    setActive(null);
  };

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Outil</p>
        <h1>Calculateur d’équité</h1>
        <p className="lede">
          Choisissez les mains (cartes précises, range ou main aléatoire) et le board : le calcul est exact quand c’est possible,
          sinon simulé sur plusieurs dizaines de milliers de donnes.
        </p>
      </header>

      <div className="chip-row" role="group" aria-label="Exemples">
        {PRESETS.map((p, i) => (
          <button key={p.label} type="button" className="chip-btn" onClick={() => load(i)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="calc">
        <div className="calc__inputs">
          <section className="panel">
            <h2 className="panel__title">Board</h2>
            <div className="slots">
              {board.map((c, k) => slotButton({ kind: 'board', k }, c))}
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setBoard([null, null, null, null, null])}>
                Vider
              </button>
            </div>
          </section>

          {players.map((p, i) => {
            const r = result && !problems.length ? result : null;
            const hand =
              p.mode === 'cards' && boardCards.length >= 3 && p.cards.every((c) => c !== null)
                ? describeScore(evaluate([...(p.cards as Card[]), ...boardCards]))
                : null;
            return (
              <section key={i} className="panel calc-player">
                <div className="calc-player__head">
                  <h2 className="panel__title">Joueur {i + 1}</h2>
                  <div className="segmented segmented--small" role="radiogroup" aria-label={`Type de main du joueur ${i + 1}`}>
                    {(
                      [
                        ['cards', 'Cartes'],
                        ['range', 'Range'],
                        ['random', 'Aléatoire'],
                      ] as const
                    ).map(([m, l]) => (
                      <button
                        type="button"
                        key={m}
                        role="radio"
                        aria-checked={p.mode === m}
                        className={p.mode === m ? 'on' : ''}
                        onClick={() => setPlayers((ps) => ps.map((q, j) => (j === i ? { ...q, mode: m } : q)))}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {players.length > 2 && (
                    <button
                      type="button"
                      className="btn btn--small btn--ghost"
                      onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}
                      aria-label={`Retirer le joueur ${i + 1}`}
                    >
                      Retirer
                    </button>
                  )}
                </div>
                <div className="calc-player__body">
                  {p.mode === 'cards' && <div className="slots">{p.cards.map((c, k) => slotButton({ kind: 'player', p: i, k }, c))}</div>}
                  {p.mode === 'range' && (
                    <label className="range-input">
                      <input
                        id={`range-${i}`}
                        type="text"
                        value={p.range}
                        placeholder="ex. 99+, AJs+, KQs, AQo+"
                        onChange={(e) => setPlayers((ps) => ps.map((q, j) => (j === i ? { ...q, range: e.target.value } : q)))}
                      />
                      <span className="muted">
                        {parsedRanges[i]?.error ? parsedRanges[i]!.error : `${parsedRanges[i]?.combos.length ?? 0} combinaisons`}
                      </span>
                    </label>
                  )}
                  {p.mode === 'random' && <p className="muted">N’importe quelle main parmi les cartes restantes.</p>}
                  <div className="calc-player__result">
                    {r ? (
                      <>
                        <div className="eq-bar">
                          <span style={{ width: `${r.equity[i] * 100}%` }} />
                        </div>
                        <div className="eq-numbers">
                          <strong>{pctStr(r.equity[i])}</strong>
                          <span className="muted">
                            gagne {pctStr(r.win[i])} · partage {pctStr(r.tie[i])}
                          </span>
                        </div>
                        {hand && <span className="muted">{hand}</span>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          <div className="button-row">
            {players.length < 6 && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setPlayers((ps) => [...ps, { mode: 'random', cards: [null, null], range: '' }])}
              >
                Ajouter un joueur
              </button>
            )}
          </div>
          <div className="calc__status" aria-live="polite">
            {problems.length ? (
              <ul className="problems">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : computing ? (
              <span className="muted">Calcul…</span>
            ) : result ? (
              <span className="muted">
                {result.exact
                  ? `Calcul exact sur ${result.samples.toLocaleString('fr-FR')} boards possibles.`
                  : `Simulation sur ${result.samples.toLocaleString('fr-FR')} donnes (précision ± 0,5 point environ).`}
              </span>
            ) : null}
          </div>
        </div>

        <section className="panel calc__picker">
          <h2 className="panel__title">
            {active
              ? active.kind === 'board'
                ? `Carte du board n° ${active.k + 1}`
                : `Joueur ${active.p + 1}, carte ${active.k + 1}`
              : 'Choisissez un emplacement'}
          </h2>
          <div className="picker">
            {[0, 1, 2, 3].map((s) => (
              <div key={s} className="picker__row">
                {Array.from({ length: 13 }, (_, k) => 12 - k).map((r) => {
                  const c = makeCard(r, s);
                  const taken = used.has(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`picker__card suit-${'shdc'[s]}`}
                      disabled={taken || !active}
                      onClick={() => pickCard(c)}
                      aria-label={`${RANK_LABELS[r]}${SUIT_SYMBOLS[s]}`}
                    >
                      {RANK_LABELS[r]}
                      <small>{SUIT_SYMBOLS[s]}</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="fineprint">Touchez un emplacement puis une carte. Touchez à nouveau une carte placée pour la retirer.</p>
        </section>
      </div>
    </div>
  );
}
