import { useAppData } from '../../store/store';
import { QUIZZES } from './QuizShell';

export function TrainingHub() {
  const data = useAppData();
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Cinq exercices · questions illimitées</p>
        <h1>Exercices</h1>
        <p className="lede">
          Des séries courtes pour automatiser les calculs que l’on fait à chaque main. Chaque réponse est corrigée et expliquée.
        </p>
      </header>
      <div className="module-list">
        {QUIZZES.map((q, i) => {
          const s = data.quizzes[q.id];
          const acc = s.attempts ? Math.round((s.correct / s.attempts) * 100) : null;
          return (
            <a key={q.id} href={`#${q.route}`} className="module">
              <span className="module__num">{i + 1}</span>
              <span className="module__body">
                <strong>{q.title}</strong>
                <span>{q.description}</span>
              </span>
              <span className="module__stat">
                {acc === null ? (
                  <span className="muted">Pas encore commencé</span>
                ) : (
                  <>
                    <strong>{acc} %</strong>
                    <span className="muted">
                      {s.attempts} réponse{s.attempts > 1 ? 's' : ''} · record {s.bestStreak}
                    </span>
                  </>
                )}
              </span>
            </a>
          );
        })}
      </div>
      <p className="fineprint">
        Ordre conseillé pour débuter : lecture d’abattage, puis outs, cotes du pot, ranges préflop et estimation d’équité.
      </p>
    </div>
  );
}
