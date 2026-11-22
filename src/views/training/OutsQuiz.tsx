import { CardRow, InlineCards } from '../../components/PlayingCard';
import { hitProbability, ruleOf2And4 } from '../../engine/outs';
import { generateOuts, type OutsQuestion } from '../../trainers/generators';
import { ChipChoice, Feedback, QUIZZES, QuizShell, useQuiz } from './QuizShell';

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

export function OutsQuiz() {
  const meta = QUIZZES[1];
  const { question: q, answer, answered, correct, submit, next } = useQuiz<OutsQuestion, number>(
    'outs',
    () => generateOuts(),
    (q, a) => q.correct === a,
  );
  const onFlop = q.board.length === 3;
  const unseen = q.outs.unseen;
  return (
    <QuizShell meta={meta} answered={answered} onNext={next}>
      <div className="quiz-grid">
        <div className="quiz-card felt-card">
          <p className="eyebrow eyebrow--felt">{onFlop ? 'Flop' : 'Turn'}</p>
          <CardRow cards={q.board} size="md" placeholders={5} />
          <p className="quiz-prompt">Votre main</p>
          <CardRow cards={q.hole} size="lg" />
          <p className="quiz-question">Combien d’outs pour toucher une quinte ou une couleur ?</p>
          <div className="chip-row-answers">
            {q.choices.map((c, i) => (
              <ChipChoice
                key={c}
                index={i}
                label={String(c)}
                state={answered && c === q.correct ? 'right' : answered && c === answer ? 'wrong' : 'idle'}
                disabled={answered}
                onClick={() => submit(c)}
              />
            ))}
          </div>
        </div>
        <div className="quiz-side">
          {answered ? (
            <Feedback correct={!!correct} title={`${q.drawName} : ${q.correct} outs.`}>
              {q.outs.groups.map((g) => (
                <p key={g.category}>
                  <strong>{g.label}</strong> ({g.cards.length}) : <InlineCards cards={g.cards} />
                </p>
              ))}
              <p>
                Prochaine carte : {q.correct} / {unseen} = <strong>{pct(q.correct / unseen)}</strong> (règle du 2 : ≈{' '}
                {ruleOf2And4(q.correct, 1)} %).
              </p>
              {onFlop && (
                <p>
                  D’ici la rivière : <strong>{pct(hitProbability(q.correct, unseen, 2))}</strong> (règle du 4 : ≈{' '}
                  {ruleOf2And4(q.correct, 2)} %).
                </p>
              )}
            </Feedback>
          ) : (
            <div className="hint-card">
              <h2>Repères</h2>
              <ul>
                <li>Tirage couleur : 13 cartes de la couleur − 4 visibles = 9 outs.</li>
                <li>Quinte par les deux bouts : 2 rangs × 4 cartes = 8 outs.</li>
                <li>Quinte ventrale : 1 rang × 4 cartes = 4 outs.</li>
                <li>Ne comptez pas deux fois une carte qui complète à la fois quinte et couleur.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </QuizShell>
  );
}
