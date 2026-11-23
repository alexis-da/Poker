import { Text } from '@radix-ui/themes';
import { CardRow } from '../../components/PlayingCard';
import { generateEquity, type EquityQuestion } from '../../trainers/generators';
import { ChoiceButton, Feedback, Hints, QUIZZES, QuizShell, useOnChange, useQuiz, useQuizFocus } from './QuizShell';

export function EquityQuiz() {
  const meta = QUIZZES[4];
  const [focus, clearFocus] = useQuizFocus('equity');
  const { question: q, answer, answered, correct, submit, next } = useQuiz<EquityQuestion, number>(
    'equity',
    () => generateEquity(Math.random, (focus as 'preflop' | 'flop' | null) ?? undefined),
    (q, a) => q.correctIndex === a,
    (q, a) => ({
      tag: q.board.length ? 'flop' : 'preflop',
      note: `Équité de la main A : ${Math.round(q.equity * 100)} % (réponse ${q.choices[a]} %)`,
    }),
  );
  useOnChange(focus, next);
  const eqA = Math.round(q.equity * 1000) / 10;
  const eqB = Math.round((1 - q.equity) * 1000) / 10;
  return (
    <QuizShell meta={meta} answered={answered} onNext={next} focus={focus ? { value: focus, onClear: clearFocus } : null}>
      <div className="quiz-grid">
        <div className="felt-card">
          <span className="felt-label">{q.board.length ? 'Flop' : 'Préflop, tapis engagés'}</span>
          {q.board.length > 0 && <CardRow cards={q.board} size="md" placeholders={5} />}
          <div className="versus">
            <div className="versus__side">
              <span className="felt-label">Main A</span>
              <CardRow cards={q.hands[0]} size="lg" />
            </div>
            <span className="versus__vs">contre</span>
            <div className="versus__side">
              <span className="felt-label">Main B</span>
              <CardRow cards={q.hands[1]} size="lg" />
            </div>
          </div>
          <Text as="p" size="3" weight="medium" className="on-felt">
            Quelle est l’équité de la main A ? Choisissez la valeur la plus proche.
          </Text>
          <div className="choices">
            {q.choices.map((c, i) => (
              <ChoiceButton
                key={c}
                label={`${c} %`}
                state={answered && i === q.correctIndex ? 'right' : answered && i === answer ? 'wrong' : 'idle'}
                disabled={answered}
                onClick={() => submit(i)}
              />
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
              {q.matchup && (
                <Text as="p" size="2">
                  {q.matchup}
                </Text>
              )}
              <Text as="p" size="1" color="gray">
                {q.board.length ? 'Calcul exact sur les 990 turns et rivers possibles.' : 'Estimation sur 12 000 boards simulés (Monte Carlo).'}{' '}
                Les égalités comptent pour moitié.
              </Text>
            </Feedback>
          ) : (
            <Hints
              title="Duels à connaître"
              items={[
                'Paire contre deux cartes supérieures : ≈ 55 / 45.',
                'Paire contre paire inférieure : ≈ 80 / 20.',
                'Main dominée (AK contre AQ) : ≈ 70 / 30.',
                'Deux hautes contre deux basses : ≈ 63 / 37.',
              ]}
            />
          )}
        </div>
      </div>
    </QuizShell>
  );
}
