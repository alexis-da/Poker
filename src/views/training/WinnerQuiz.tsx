import { CardRow } from '../../components/PlayingCard';
import { categoryOf, describeScoreLong } from '../../engine/evaluator';
import { generateWinner, type WinnerQuestion } from '../../trainers/generators';
import { Feedback, QUIZZES, QuizShell, useQuiz } from './QuizShell';

type Answer = number | 'split';

function isRight(q: WinnerQuestion, a: Answer): boolean {
  if (q.winners.length > 1) return a === 'split';
  return a === q.winners[0];
}

export function WinnerQuiz() {
  const meta = QUIZZES[3];
  const { question: q, answer, answered, correct, submit, next } = useQuiz<WinnerQuestion, Answer>(
    'winner',
    () => generateWinner(),
    isRight,
  );
  const split = q.winners.length > 1;
  const top = q.players[q.winners[0]];
  const sameCat = q.players.filter((p) => categoryOf(p.score) === categoryOf(top.score)).length > 1;

  return (
    <QuizShell meta={meta} answered={answered} onNext={next}>
      <div className="quiz-card felt-card felt-card--wide">
        <p className="eyebrow eyebrow--felt">Board</p>
        <CardRow cards={q.board} size="md" highlight={answered ? top.best : undefined} />
        <div className={`showdown-grid showdown-grid--${q.players.length}`}>
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
                <span className="showdown-hand__name">{p.name}</span>
                <CardRow cards={p.hole} size="md" highlight={answered ? p.best : undefined} />
                {answered && <span className="showdown-hand__desc">{describeScoreLong(p.score)}</span>}
              </button>
            );
          })}
        </div>
        <div className="answer-row">
          <button
            type="button"
            className={`btn btn--choice ${answered && split ? 'btn--right' : ''} ${answered && answer === 'split' && !split ? 'btn--wrong' : ''}`}
            onClick={() => submit('split')}
            disabled={answered}
          >
            Partage du pot
          </button>
        </div>
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
          <p>
            Chaque joueur garde les cinq meilleures cartes parmi les sept disponibles (ses deux cartes et les cinq du board) ; elles
            sont mises en évidence ci-dessus.
          </p>
          {sameCat && !split && (
            <p>
              Même catégorie de main : on compare d’abord le rang de la combinaison, puis les cartes restantes (kickers), une par une.
            </p>
          )}
          {split && <p>Quand les cinq meilleures cartes sont identiques en rang, le pot est partagé : les couleurs ne départagent jamais.</p>}
        </Feedback>
      )}
    </QuizShell>
  );
}
