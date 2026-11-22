import { useEffect, useState, type ReactNode } from 'react';
import { ChipFace } from '../../components/Chips';
import { recordQuiz, useAppData, type QuizId } from '../../store/store';

export interface QuizMeta {
  id: QuizId;
  route: string;
  title: string;
  short: string;
  description: string;
  skill: string;
}

export const QUIZZES: QuizMeta[] = [
  {
    id: 'preflop',
    route: 'quiz-preflop',
    title: 'Ranges d’ouverture',
    short: 'Préflop',
    description: 'Personne n’a relancé : ouvrir ou se coucher selon votre position ?',
    skill: 'Mémoriser les ranges 6-max',
  },
  {
    id: 'outs',
    route: 'quiz-outs',
    title: 'Compter ses outs',
    short: 'Outs',
    description: 'Combien de cartes complètent votre quinte ou votre couleur ?',
    skill: 'Lire ses tirages vite',
  },
  {
    id: 'potodds',
    route: 'quiz-cotes',
    title: 'Cotes du pot',
    short: 'Cotes',
    description: 'Avec ce tirage et cette mise en face, suivre est-il rentable ?',
    skill: 'Comparer équité et prix',
  },
  {
    id: 'winner',
    route: 'quiz-gagnant',
    title: 'Quelle main gagne ?',
    short: 'Abattage',
    description: 'Lisez le board et désignez le gagnant, kickers compris.',
    skill: 'Lire un abattage sans hésiter',
  },
  {
    id: 'equity',
    route: 'quiz-equite',
    title: 'Estimer l’équité',
    short: 'Équité',
    description: 'Deux mains s’affrontent : quelle part du pot revient à la main A ?',
    skill: 'Connaître les duels classiques',
  },
];

interface ShellProps {
  meta: QuizMeta;
  answered: boolean;
  onNext: () => void;
  children: ReactNode;
  toolbar?: ReactNode;
}

/** Cadre commun des exercices : en-tête, score, bouton « question suivante ». */
export function QuizShell({ meta, answered, onNext, children, toolbar }: ShellProps) {
  const stats = useAppData().quizzes[meta.id];
  const acc = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : null;
  const recent = stats.recent.slice(-20);

  useEffect(() => {
    if (!answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, onNext]);

  return (
    <div className="page quiz">
      <header className="page-head page-head--row">
        <div>
          <p className="eyebrow">
            <a href="#exercices">Exercices</a> · {meta.skill}
          </p>
          <h1>{meta.title}</h1>
          <p className="lede">{meta.description}</p>
        </div>
        <dl className="quiz-score">
          <div>
            <dt>Réussite</dt>
            <dd>{acc === null ? '—' : `${acc} %`}</dd>
          </div>
          <div>
            <dt>Série</dt>
            <dd>{stats.streak}</dd>
          </div>
          <div>
            <dt>Record</dt>
            <dd>{stats.bestStreak}</dd>
          </div>
          <div className="quiz-score__dots" aria-label="20 dernières réponses">
            {recent.map((ok, i) => (
              <span key={i} className={ok ? 'dot dot--ok' : 'dot dot--ko'} />
            ))}
          </div>
        </dl>
      </header>
      {toolbar}
      <div className="quiz__body">{children}</div>
      {answered && (
        <div className="quiz__next">
          <button type="button" id="quiz-next" className="btn btn--primary btn--lg" onClick={onNext} autoFocus>
            Question suivante <kbd>Entrée</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

/** Gère l'état question / réponse d'un exercice. */
export function useQuiz<Q, A>(id: QuizId, generate: () => Q, isCorrect: (q: Q, a: A) => boolean) {
  const [question, setQuestion] = useState<Q>(generate);
  const [answer, setAnswer] = useState<A | null>(null);
  const answered = answer !== null;
  const correct = answered ? isCorrect(question, answer as A) : null;
  const submit = (a: A) => {
    if (answered) return;
    setAnswer(a);
    recordQuiz(id, isCorrect(question, a));
  };
  const next = () => {
    setQuestion(generate());
    setAnswer(null);
  };
  return { question, answer, answered, correct, submit, next };
}

export function Feedback({ correct, title, children }: { correct: boolean; title: string; children: ReactNode }) {
  return (
    <div className={`feedback ${correct ? 'feedback--ok' : 'feedback--ko'}`} role="status">
      <p className="feedback__title">
        <span className="feedback__pill">{correct ? 'Juste' : 'Raté'}</span> {title}
      </p>
      <div className="feedback__body">{children}</div>
    </div>
  );
}

const CHIP_COLORS = ['red', 'blue', 'green', 'black'] as const;

/** Réponse chiffrée présentée comme un jeton de casino. */
export function ChipChoice({
  label,
  index,
  state,
  disabled,
  onClick,
}: {
  label: string;
  index: number;
  state: 'idle' | 'right' | 'wrong';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`chip-choice chip-choice--${state}`} onClick={onClick} disabled={disabled}>
      <ChipFace color={CHIP_COLORS[index % CHIP_COLORS.length]} />
      <span className="chip-choice__label">{label}</span>
    </button>
  );
}
