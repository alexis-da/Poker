import { Badge, Button, Card, Flex, Heading, Kbd, Link, Text } from '@radix-ui/themes';
import { useEffect, useState, type ReactNode } from 'react';
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
        <div className="page-head__text">
          <Text size="2" color="gray">
            <Link href="#exercices">Exercices</Link> · {meta.skill}
          </Text>
          <Heading size="8">{meta.title}</Heading>
          <Text as="p" size="3" color="gray">
            {meta.description}
          </Text>
        </div>
        <Card size="2" className="quiz-score">
          <div>
            <Text size="1" color="gray">
              Réussite
            </Text>
            <strong>{acc === null ? '—' : `${acc} %`}</strong>
          </div>
          <div>
            <Text size="1" color="gray">
              Série
            </Text>
            <strong>{stats.streak}</strong>
          </div>
          <div>
            <Text size="1" color="gray">
              Record
            </Text>
            <strong>{stats.bestStreak}</strong>
          </div>
          {recent.length > 0 && (
            <span className="dots" aria-label="20 dernières réponses">
              {recent.map((ok, i) => (
                <span key={i} className={ok ? 'dot dot--ok' : 'dot dot--ko'} />
              ))}
            </span>
          )}
        </Card>
      </header>
      {toolbar}
      <div className="quiz__body">{children}</div>
      {answered && (
        <Flex justify="center">
          <Button id="quiz-next" size="4" onClick={onNext} autoFocus>
            Question suivante <Kbd>Entrée</Kbd>
          </Button>
        </Flex>
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
    <Card size="3" className={`feedback ${correct ? 'feedback--ok' : 'feedback--ko'}`} role="status">
      <Flex gap="2" align="center" wrap="wrap" mb="3">
        <Badge size="2" color={correct ? 'grass' : 'tomato'} variant="solid">
          {correct ? 'Juste' : 'Raté'}
        </Badge>
        <Text weight="bold" size="3">
          {title}
        </Text>
      </Flex>
      <div className="feedback__body">{children}</div>
    </Card>
  );
}

/** Réponse à choix (nombre, pourcentage). */
export function ChoiceButton({
  label,
  state,
  disabled,
  onClick,
}: {
  label: string;
  state: 'idle' | 'right' | 'wrong';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="4"
      className={`choice choice--${state}`}
      variant={state === 'idle' ? 'surface' : 'solid'}
      color={state === 'right' ? 'grass' : state === 'wrong' ? 'tomato' : 'gray'}
      highContrast={state === 'idle'}
      onClick={onClick}
      disabled={disabled && state === 'idle'}
    >
      {label}
    </Button>
  );
}

export function Hints({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <Card size="3" variant="surface" className="hints">
      <Text as="p" size="2" weight="bold" mb="2">
        {title}
      </Text>
      <List className="hints__list">
        {items.map((it) => (
          <li key={it}>
            <Text size="2" color="gray">
              {it}
            </Text>
          </li>
        ))}
      </List>
    </Card>
  );
}
