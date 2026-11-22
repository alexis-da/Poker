import { useEffect } from 'react';
import { CardRow } from '../../components/PlayingCard';
import { ruleOf2And4 } from '../../engine/outs';
import { generatePotOdds, type PotOddsQuestion } from '../../trainers/generators';
import { EquityMeter } from '../play/CoachPanel';
import { Feedback, QUIZZES, QuizShell, useQuiz } from './QuizShell';

const n = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

export function PotOddsQuiz() {
  const meta = QUIZZES[2];
  const { question: q, answered, correct, submit, next } = useQuiz<PotOddsQuestion, 'call' | 'fold'>(
    'potodds',
    () => generatePotOdds(),
    (q, a) => q.correct === a,
  );

  useEffect(() => {
    if (answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c') submit('call');
      if (e.key.toLowerCase() === 'f') submit('fold');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const outs = q.outs.outs.length;
  const finalPot = q.pot + 2 * q.bet;
  const ratio = (q.pot + q.bet) / q.bet;

  return (
    <QuizShell meta={meta} answered={answered} onNext={next}>
      <div className="quiz-grid">
        <div className="quiz-card felt-card">
          <p className="eyebrow eyebrow--felt">{q.board.length === 3 ? 'Flop' : 'Turn'}</p>
          <CardRow cards={q.board} size="md" placeholders={5} />
          <CardRow cards={q.hole} size="lg" />
          <dl className="odds-facts">
            <div>
              <dt>Pot</dt>
              <dd>{n(q.pot)} BB</dd>
            </div>
            <div>
              <dt>{q.allIn ? 'Tapis adverse' : 'Mise adverse'}</dt>
              <dd>{n(q.bet)} BB</dd>
            </div>
            <div>
              <dt>Cartes à venir</dt>
              <dd>{q.cardsToCome}</dd>
            </div>
          </dl>
          <p className="quiz-question">
            {q.allIn
              ? 'Votre adversaire est à tapis : vous verrez le turn et la river.'
              : 'Considérez uniquement la prochaine carte.'}{' '}
            On suppose que vous gagnez seulement si vous touchez votre tirage.
          </p>
          <div className="answer-row">
            <button
              type="button"
              className={`btn btn--call btn--lg ${answered && q.correct === 'call' ? 'btn--right' : ''}`}
              onClick={() => submit('call')}
              disabled={answered}
            >
              Suivre {n(q.bet)} BB <kbd>C</kbd>
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
            <Feedback correct={!!correct} title={q.correct === 'call' ? 'Suivre est rentable.' : 'Suivre coûte trop cher.'}>
              <EquityMeter equity={q.equity} required={q.required} />
              <ol className="steps">
                <li>
                  <strong>Prix :</strong> vous payez {n(q.bet)} BB pour un pot final de {n(q.pot)} + {n(q.bet)} + {n(q.bet)} ={' '}
                  {n(finalPot)} BB, soit {n(q.bet)} / {n(finalPot)} = <strong>{pct(q.required)}</strong> d’équité requise (cote de{' '}
                  {n(ratio)} contre 1).
                </li>
                <li>
                  <strong>Tirage :</strong> {q.drawName.toLowerCase()}, {outs} outs sur {q.outs.unseen} cartes inconnues.
                </li>
                <li>
                  <strong>Équité :</strong> {pct(q.equity)} exactement (règle du {q.cardsToCome === 2 ? 4 : 2} : ≈{' '}
                  {ruleOf2And4(outs, q.cardsToCome)} %).
                </li>
                <li>
                  {pct(q.equity)} {q.equity >= q.required ? '≥' : '<'} {pct(q.required)} :{' '}
                  <strong>{q.correct === 'call' ? 'on suit' : 'on se couche'}</strong>.
                </li>
              </ol>
              {q.correct === 'fold' && !q.allIn && q.required - q.equity < 0.08 && (
                <p className="muted">
                  En partie réelle, les cotes implicites (ce que vous gagnerez aux tours suivants si vous touchez) peuvent rendre ce
                  call jouable.
                </p>
              )}
            </Feedback>
          ) : (
            <div className="hint-card">
              <h2>Méthode</h2>
              <ol>
                <li>Équité requise = mise à payer ÷ pot final (pot + mise + votre call).</li>
                <li>Équité du tirage ≈ outs × 2 pour une carte, × 4 pour deux cartes.</li>
                <li>Suivez si votre équité dépasse l’équité requise.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </QuizShell>
  );
}
