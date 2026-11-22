import { Button, Callout, Flex, Kbd, SegmentedControl, Text } from '@radix-ui/themes';
import { useCallback, useEffect, useState } from 'react';
import { CardRow } from '../../components/PlayingCard';
import { RangeGrid } from '../../components/RangeGrid';
import { HAND_TOP_PERCENT, POSITION_INFO, RFI_SETS, type Position } from '../../data/charts';
import { rangePercent } from '../../engine/ranges';
import { generatePreflop, RFI_POSITIONS, type PreflopQuestion, type RfiPosition } from '../../trainers/generators';
import { Feedback, Hints, QUIZZES, QuizShell, useQuiz } from './QuizShell';

const RING: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export function PositionRing({ hero }: { hero: Position }) {
  const heroIdx = RING.indexOf(hero);
  return (
    <div className="ring" aria-label={`Vous êtes en ${hero}`}>
      {RING.map((p, i) => {
        const angle = ((90 + ((i - heroIdx) * 360) / 6) * Math.PI) / 180;
        const x = 50 + 40 * Math.cos(angle);
        const y = 50 + 36 * Math.sin(angle);
        const state = i === heroIdx ? 'hero' : i < heroIdx ? 'folded' : 'waiting';
        return (
          <span key={p} className={`ring__seat ring__seat--${state}`} style={{ left: `${x}%`, top: `${y}%` }}>
            {p}
            {p === 'BTN' && <span className="ring__btn">D</span>}
          </span>
        );
      })}
      <span className="ring__label">
        {heroIdx === 0 ? 'Premier à parler' : `${heroIdx} joueur${heroIdx > 1 ? 's' : ''} couché${heroIdx > 1 ? 's' : ''}`}
      </span>
    </div>
  );
}

export function PreflopQuiz() {
  const meta = QUIZZES[0];
  const [filter, setFilter] = useState<RfiPosition | 'all'>('all');
  const generate = useCallback(() => generatePreflop(Math.random, filter === 'all' ? undefined : filter), [filter]);
  const quiz = useQuiz<PreflopQuestion, 'raise' | 'fold'>('preflop', generate, (q, a) => q.correct === a);
  const { question: q, answer, answered, correct, submit, next } = quiz;

  // Nouvelle question quand on change de filtre.
  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') submit('raise');
      if (e.key.toLowerCase() === 'f') submit('fold');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const range = RFI_SETS[q.position];
  const inRange = q.correct === 'raise';
  const top = HAND_TOP_PERCENT[q.handClass];
  const stateOf = (a: 'raise' | 'fold') => (!answered ? 'idle' : q.correct === a ? 'right' : answer === a ? 'wrong' : 'idle');

  return (
    <QuizShell
      meta={meta}
      answered={answered}
      onNext={next}
      toolbar={
        <div className="scroll-x">
        <SegmentedControl.Root value={filter} onValueChange={(v) => setFilter(v as RfiPosition | 'all')} aria-label="Position travaillée">
          <SegmentedControl.Item value="all">Toutes</SegmentedControl.Item>
          {RFI_POSITIONS.map((p) => (
            <SegmentedControl.Item key={p} value={p}>
              {p}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
        </div>
      }
    >
      <div className="quiz-grid">
        <div className="felt-card">
          <PositionRing hero={q.position} />
          <Text as="p" size="3" className="on-felt">
            Vous êtes <strong>{POSITION_INFO[q.position].name}</strong> ({q.position}), personne n’est entré dans le coup.
          </Text>
          <CardRow cards={q.hand} size="lg" />
          <span className="hand-class">{q.handClass}</span>
          <Flex gap="3" wrap="wrap" justify="center" width="100%">
            <Button
              size="4"
              className="answer"
              color={stateOf('raise') === 'wrong' ? 'tomato' : 'grass'}
              variant={stateOf('raise') === 'idle' && answered ? 'soft' : 'solid'}
              onClick={() => submit('raise')}
              disabled={answered && stateOf('raise') === 'idle'}
            >
              Ouvrir à 2,5 BB <Kbd>R</Kbd>
            </Button>
            <Button
              size="4"
              className="answer"
              color={stateOf('fold') === 'right' ? 'grass' : stateOf('fold') === 'wrong' ? 'tomato' : 'gray'}
              variant={stateOf('fold') === 'idle' ? 'soft' : 'solid'}
              onClick={() => submit('fold')}
              disabled={answered && stateOf('fold') === 'idle'}
            >
              Se coucher <Kbd>F</Kbd>
            </Button>
          </Flex>
        </div>
        <div className="quiz-side">
          {answered ? (
            <>
              <Feedback correct={!!correct} title={`${q.handClass} ${inRange ? 'fait partie' : 'ne fait pas partie'} de la range ${q.position}.`}>
                <Text as="p" size="2">
                  La range d’ouverture {q.position} contient environ {rangePercent(range).toFixed(0)} % des mains. {q.handClass} se classe
                  dans le top {top.toFixed(top < 10 ? 1 : 0)} % des mains de départ.
                </Text>
                <Callout.Root size="1" color="gray" variant="surface">
                  <Callout.Text>{POSITION_INFO[q.position].detail}</Callout.Text>
                </Callout.Root>
              </Feedback>
              <RangeGrid range={range} focus={q.handClass} compact label={`Range d’ouverture ${q.position}`} />
            </>
          ) : (
            <Hints
              title="Repères"
              items={[
                'Plus vous parlez tôt, plus il reste de joueurs susceptibles d’avoir une grosse main.',
                'Les mains assorties et connectées gagnent de la valeur en fin de parole.',
                'Les petites paires s’ouvrent partout à 100 BB : elles visent le brelan.',
              ]}
            />
          )}
        </div>
      </div>
    </QuizShell>
  );
}
