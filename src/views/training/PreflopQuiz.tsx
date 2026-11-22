import { useCallback, useEffect, useState } from 'react';
import { CardRow } from '../../components/PlayingCard';
import { RangeGrid } from '../../components/RangeGrid';
import { HAND_TOP_PERCENT, POSITION_INFO, RFI_SETS, type Position } from '../../data/charts';
import { rangePercent } from '../../engine/ranges';
import { generatePreflop, RFI_POSITIONS, type PreflopQuestion, type RfiPosition } from '../../trainers/generators';
import { Feedback, QUIZZES, QuizShell, useQuiz } from './QuizShell';

const RING: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export function PositionRing({ hero }: { hero: Position }) {
  const heroIdx = RING.indexOf(hero);
  return (
    <div className="ring" aria-label={`Vous êtes en ${hero}`}>
      {RING.map((p, i) => {
        const angle = ((90 + ((i - heroIdx) * 360) / 6) * Math.PI) / 180;
        const x = 50 + 40 * Math.cos(angle);
        const y = 50 + 36 * Math.sin(angle);
        const state = i === heroIdx ? 'hero' : i < heroIdx ? 'folded' : 'waiting';
        return (
          <span key={p} className={`ring__seat ring__seat--${state}`} style={{ left: `${x}%`, top: `${y}%` }}>
            {p}
            {p === 'BTN' && <span className="ring__btn">D</span>}
          </span>
        );
      })}
      <span className="ring__label">
        {heroIdx === 0 ? 'Premier à parler' : `${heroIdx} joueur${heroIdx > 1 ? 's' : ''} couché${heroIdx > 1 ? 's' : ''}`}
      </span>
    </div>
  );
}

export function PreflopQuiz() {
  const meta = QUIZZES[0];
  const [filter, setFilter] = useState<RfiPosition | 'all'>('all');
  const generate = useCallback(() => generatePreflop(Math.random, filter === 'all' ? undefined : filter), [filter]);
  const quiz = useQuiz<PreflopQuestion, 'raise' | 'fold'>('preflop', generate, (q, a) => q.correct === a);
  const { question: q, answered, correct, submit, next } = quiz;

  // Nouvelle question quand on change de filtre.
  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') submit('raise');
      if (e.key.toLowerCase() === 'f') submit('fold');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const range = RFI_SETS[q.position];
  const inRange = q.correct === 'raise';
  const top = HAND_TOP_PERCENT[q.handClass];

  return (
    <QuizShell
      meta={meta}
      answered={answered}
      onNext={next}
      toolbar={
        <div className="chip-row" role="group" aria-label="Position travaillée">
          {(['all', ...RFI_POSITIONS] as const).map((p) => (
            <button key={p} type="button" className={`chip-btn ${filter === p ? 'chip-btn--on' : ''}`} onClick={() => setFilter(p)}>
              {p === 'all' ? 'Toutes positions' : p}
            </button>
          ))}
        </div>
      }
    >
      <div className="quiz-grid">
        <div className="quiz-card felt-card">
          <PositionRing hero={q.position} />
          <p className="quiz-prompt">
            Vous êtes <strong>{POSITION_INFO[q.position].name}</strong> ({q.position}), personne n’est entré dans le coup.
          </p>
          <CardRow cards={q.hand} size="lg" />
          <p className="hand-class">{q.handClass}</p>
          <div className="answer-row">
            <button
              type="button"
              className={`btn btn--raise btn--lg ${answered && q.correct === 'raise' ? 'btn--right' : ''}`}
              onClick={() => submit('raise')}
              disabled={answered}
            >
              Ouvrir à 2,5 BB <kbd>R</kbd>
            </button>
            <button
              type="button"
              className={`btn btn--fold btn--lg ${answered && q.correct === 'fold' ? 'btn--right' : ''}`}
              onClick={() => submit('fold')}
              disabled={answered}
            >
              Se coucher <kbd>F</kbd>
            </button>
          </div>
        </div>
        <div className="quiz-side">
          {answered ? (
            <>
              <Feedback
                correct={!!correct}
                title={`${q.handClass} ${inRange ? 'fait partie' : 'ne fait pas partie'} de la range ${q.position}.`}
              >
                <p>
                  La range d’ouverture {q.position} contient environ {rangePercent(range).toFixed(0)} % des mains. {q.handClass} se
                  classe dans le top {top.toFixed(top < 10 ? 1 : 0)} % des mains de départ.
                </p>
                <p className="muted">{POSITION_INFO[q.position].detail}</p>
              </Feedback>
              <RangeGrid range={range} focus={q.handClass} compact label={`Range d’ouverture ${q.position}`} />
            </>
          ) : (
            <div className="hint-card">
              <h2>Repères</h2>
              <ul>
                <li>Plus vous parlez tôt, plus il reste de joueurs susceptibles d’avoir une grosse main.</li>
                <li>Les mains assorties et connectées gagnent de la valeur en fin de parole.</li>
                <li>Les petites paires s’ouvrent partout à 100 BB : elles visent le brelan.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </QuizShell>
  );
}
