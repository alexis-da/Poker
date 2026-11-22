import { CardRow } from '../../components/PlayingCard';
import { generateEquity, type EquityQuestion } from '../../trainers/generators';
import { Feedback, QUIZZES, QuizShell, useQuiz } from './QuizShell';

export function EquityQuiz() {
  const meta = QUIZZES[4];
  const { question: q, answer, answered, correct, submit, next } = useQuiz<EquityQuestion, number>(
    'equity',
    () => generateEquity(),
    (q, a) => q.correctIndex === a,
  );
  const eqA = Math.round(q.equity * 1000) / 10;
  const eqB = Math.round((1 - q.equity) * 1000) / 10;
  return (
    <QuizShell meta={meta} answered={answered} onNext={next}>
      <div className="quiz-grid">
        <div className="quiz-card felt-card">
          <p className="eyebrow eyebrow--felt">{q.board.length ? 'Flop' : 'Préflop, tapis engagés'}</p>
          {q.board.length > 0 && <CardRow cards={q.board} size="md" placeholders={5} />}
          <div className="versus">
            <div className="versus__side">
              <span className="versus__label">Main A</span>
              <CardRow cards={q.hands[0]} size="lg" />
            </div>
            <span className="versus__vs">contre</span>
            <div className="versus__side">
              <span className="versus__label">Main B</span>
              <CardRow cards={q.hands[1]} size="lg" />
            </div>
          </div>
          <p className="quiz-question">Quelle est l’équité de la main A ? Choisissez la valeur la plus proche.</p>
          <div className="answer-row answer-row--4">
            {q.choices.map((c, i) => (
              <button
                key={c}
                type="button"
                className={`btn btn--choice ${answered && i === q.correctIndex ? 'btn--right' : ''} ${
                  answered && i === answer && i !== q.correctIndex ? 'btn--wrong' : ''
                }`}
                onClick={() => submit(i)}
                disabled={answered}
              >
                {c} %
              </button>
            ))}
          </div>
        </div>
        <div className="quiz-side">
          {answered ? (
            <Feedback correct={!!correct} title={`Main A : ${eqA.toLocaleString('fr-FR')} % — main B : ${eqB.toLocaleString('fr-FR')} %.`}>
              <div className="split-bar" aria-hidden="true">
                <span style={{ width: `${q.equity * 100}%` }}>A</span>
                <span style={{ width: `${(1 - q.equity) * 100}%` }}>B</span>
              </div>
              {q.matchup && <p>{q.matchup}</p>}
              <p className="muted">
                {q.board.length
                  ? 'Calcul exact sur les 990 turns et rivers possibles.'
                  : 'Estimation sur 12 000 boards simulés (Monte Carlo).'}{' '}
                Les égalités comptent pour moitié.
              </p>
            </Feedback>
          ) : (
            <div className="hint-card">
              <h2>Duels à connaître</h2>
              <ul>
                <li>Paire contre deux cartes supérieures : ≈ 55 / 45.</li>
                <li>Paire contre paire inférieure : ≈ 80 / 20.</li>
                <li>Main dominée (AK contre AQ) : ≈ 70 / 30.</li>
                <li>Deux hautes contre deux basses : ≈ 63 / 37.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </QuizShell>
  );
}
