import { DataList, Text } from '@radix-ui/themes';
import { CardRow, InlineCards } from '../../components/PlayingCard';
import { hitProbability, ruleOf2And4 } from '../../engine/outs';
import { generateOuts, type OutsQuestion } from '../../trainers/generators';
import { ChoiceButton, Feedback, Hints, QUIZZES, QuizShell, useQuiz } from './QuizShell';

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
        <div className="felt-card">
          <span className="felt-label">{onFlop ? 'Flop' : 'Turn'}</span>
          <CardRow cards={q.board} size="md" placeholders={5} />
          <span className="felt-label">Votre main</span>
          <CardRow cards={q.hole} size="lg" />
          <Text as="p" size="3" weight="medium" className="on-felt">
            Combien d’outs pour toucher une quinte ou une couleur ?
          </Text>
          <div className="choices">
            {q.choices.map((c) => (
              <ChoiceButton
                key={c}
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
              <DataList.Root size="2">
                {q.outs.groups.map((g) => (
                  <DataList.Item key={g.category}>
                    <DataList.Label minWidth="96px">
                      {g.label} ({g.cards.length})
                    </DataList.Label>
                    <DataList.Value>
                      <InlineCards cards={g.cards} />
                    </DataList.Value>
                  </DataList.Item>
                ))}
                <DataList.Item>
                  <DataList.Label minWidth="96px">Carte suivante</DataList.Label>
                  <DataList.Value>
                    {q.correct} / {unseen} = {pct(q.correct / unseen)} · règle du 2 : ≈ {ruleOf2And4(q.correct, 1)} %
                  </DataList.Value>
                </DataList.Item>
                {onFlop && (
                  <DataList.Item>
                    <DataList.Label minWidth="96px">D’ici la river</DataList.Label>
                    <DataList.Value>
                      {pct(hitProbability(q.correct, unseen, 2))} · règle du 4 : ≈ {ruleOf2And4(q.correct, 2)} %
                    </DataList.Value>
                  </DataList.Item>
                )}
              </DataList.Root>
            </Feedback>
          ) : (
            <Hints
              title="Repères"
              items={[
                'Tirage couleur : 13 cartes de la couleur − 4 visibles = 9 outs.',
                'Quinte par les deux bouts : 2 rangs × 4 cartes = 8 outs.',
                'Quinte ventrale : 1 rang × 4 cartes = 4 outs.',
                'Ne comptez pas deux fois une carte qui complète à la fois quinte et couleur.',
              ]}
            />
          )}
        </div>
      </div>
    </QuizShell>
  );
}
