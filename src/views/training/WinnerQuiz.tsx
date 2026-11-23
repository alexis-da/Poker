import { Button, Text } from '@radix-ui/themes';
import { CardRow } from '../../components/PlayingCard';
import { categoryOf, describeScoreLong } from '../../engine/evaluator';
import { generateWinner, type WinnerMode, type WinnerQuestion } from '../../trainers/generators';
import { Feedback, QUIZZES, QuizShell, useOnChange, useQuiz, useQuizFocus } from './QuizShell';

type Answer = number | 'split';

function isRight(q: WinnerQuestion, a: Answer): boolean {
  if (q.winners.length > 1) return a === 'split';
  return a === q.winners[0];
}

export function WinnerQuiz() {
  const meta = QUIZZES[3];
  const [focus, clearFocus] = useQuizFocus('winner');
  const { question: q, answer, answered, correct, submit, next } = useQuiz<WinnerQuestion, Answer>(
    'winner',
    () => generateWinner(Math.random, (focus as WinnerMode | null) ?? undefined),
    isRight,
    (q) => {
      const w = q.players[q.winners[0]];
      const same = q.players.filter((p) => categoryOf(p.score) === categoryOf(w.score)).length > 1;
      return {
        tag: q.winners.length > 1 ? 'partage' : same ? 'kicker' : 'categorie',
        note: q.winners.length > 1 ? `Il y avait partage (${w.handName})` : `${w.name} gagnait avec ${w.handName}`,
      };
    },
  );
  useOnChange(focus, next);
  const split = q.winners.length > 1;
  const top = q.players[q.winners[0]];
  const sameCat = q.players.filter((p) => categoryOf(p.score) === categoryOf(top.score)).length > 1;

  return (
    <QuizShell meta={meta} answered={answered} onNext={next} focus={focus ? { value: focus, onClear: clearFocus } : null}>
      <div className="felt-card felt-card--wide">
        <span className="felt-label">Board</span>
        <CardRow cards={q.board} size="md" highlight={answered ? top.best : undefined} />
        <div className="showdown-grid">
          {q.players.map((p, i) => {
            const isWinner = q.winners.includes(i);
            return (
              <button
                key={p.name}
                type="button"
                className={`showdown-hand ${answered && isWinner ? 'showdown-hand--win' : ''} ${
                  answered && answer === i && !isWinner ? 'showdown-hand--wrong' : ''
                }`}
                onClick={() => submit(i)}
                disabled={answered}
              >
                <Text size="2" weight="bold">
                  {p.name}
                </Text>
                <CardRow cards={p.hole} size="md" highlight={answered ? p.best : undefined} />
                {answered && <Text size="2">{describeScoreLong(p.score)}</Text>}
              </button>
            );
          })}
        </div>
        <Button
          size="3"
          variant={answered && (split || answer === 'split') ? 'solid' : 'soft'}
          color={answered && split ? 'grass' : answered && answer === 'split' ? 'tomato' : 'gray'}
          highContrast={!answered}
          onClick={() => submit('split')}
          disabled={answered && !split && answer !== 'split'}
        >
          Partage du pot
        </Button>
      </div>
      {answered && (
        <Feedback
          correct={!!correct}
          title={
            split
              ? `Partage : ${q.winners.map((w) => q.players[w].name).join(' et ')} ont la même main.`
              : `${top.name} gagne avec ${top.handName}.`
          }
        >
          <Text as="p" size="2">
            Chaque joueur garde les cinq meilleures cartes parmi les sept disponibles (ses deux cartes et les cinq du board) ; elles sont
            mises en évidence ci-dessus.
          </Text>
          {sameCat && !split && (
            <Text as="p" size="2">
              Même catégorie de main : on compare d’abord le rang de la combinaison, puis les cartes restantes (kickers), une par une.
            </Text>
          )}
          {split && (
            <Text as="p" size="2">
              Quand les cinq meilleures cartes sont identiques en rang, le pot est partagé : les couleurs ne départagent jamais.
            </Text>
          )}
        </Feedback>
      )}
    </QuizShell>
  );
}
