import { Button, Callout, DataList, Flex, Kbd, Text } from '@radix-ui/themes';
import { useEffect } from 'react';
import { CardRow } from '../../components/PlayingCard';
import { ruleOf2And4 } from '../../engine/outs';
import { generatePotOdds, type PotOddsQuestion } from '../../trainers/generators';
import { EquityMeter } from '../play/CoachPanel';
import { Feedback, Hints, QUIZZES, QuizShell, useOnChange, useQuiz, useQuizFocus } from './QuizShell';

const n = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

export function PotOddsQuiz() {
  const meta = QUIZZES[2];
  const [focus, clearFocus] = useQuizFocus('potodds');
  const { question: q, answer, answered, correct, submit, next } = useQuiz<PotOddsQuestion, 'call' | 'fold'>(
    'potodds',
    () => generatePotOdds(Math.random, (focus as 'tapis' | 'une-carte' | null) ?? undefined),
    (q, a) => q.correct === a,
    (q) => ({
      tag: q.allIn ? 'tapis' : 'une-carte',
      note: `${q.drawName}, ${n(q.bet)} BB à payer dans un pot de ${n(q.pot)} BB : il fallait ${q.correct === 'call' ? 'suivre' : 'se coucher'}`,
    }),
  );
  useOnChange(focus, next);

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
  const stateOf = (a: 'call' | 'fold') => (!answered ? 'idle' : q.correct === a ? 'right' : answer === a ? 'wrong' : 'idle');
  const colorOf = (a: 'call' | 'fold', idle: 'grass' | 'gray') =>
    stateOf(a) === 'right' ? 'grass' : stateOf(a) === 'wrong' ? 'tomato' : idle;

  return (
    <QuizShell meta={meta} answered={answered} onNext={next} focus={focus ? { value: focus, onClear: clearFocus } : null}>
      <div className="quiz-grid">
        <div className="felt-card">
          <span className="felt-label">{q.board.length === 3 ? 'Flop' : 'Turn'}</span>
          <CardRow cards={q.board} size="md" placeholders={5} />
          <CardRow cards={q.hole} size="lg" />
          <div className="felt-facts">
            <div>
              <span>Pot</span>
              <strong>{n(q.pot)} BB</strong>
            </div>
            <div>
              <span>{q.allIn ? 'Tapis adverse' : 'Mise adverse'}</span>
              <strong>{n(q.bet)} BB</strong>
            </div>
            <div>
              <span>Cartes à venir</span>
              <strong>{q.cardsToCome}</strong>
            </div>
          </div>
          <Text as="p" size="2" className="on-felt">
            {q.allIn ? 'Votre adversaire est à tapis : vous verrez le turn et la river.' : 'Considérez uniquement la prochaine carte.'} On
            suppose que vous gagnez seulement si vous touchez votre tirage.
          </Text>
          <Flex gap="3" wrap="wrap" justify="center" width="100%">
            <Button
              size="4"
              className="answer"
              color={colorOf('call', 'grass')}
              variant={answered && stateOf('call') === 'idle' ? 'soft' : 'solid'}
              onClick={() => submit('call')}
              disabled={answered && stateOf('call') === 'idle'}
            >
              Suivre {n(q.bet)} BB <Kbd>C</Kbd>
            </Button>
            <Button
              size="4"
              className="answer"
              color={colorOf('fold', 'gray')}
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
            <Feedback correct={!!correct} title={q.correct === 'call' ? 'Suivre est rentable.' : 'Suivre coûte trop cher.'}>
              <EquityMeter equity={q.equity} required={q.required} />
              <DataList.Root size="2">
                <DataList.Item>
                  <DataList.Label minWidth="90px">Prix</DataList.Label>
                  <DataList.Value>
                    {n(q.bet)} BB pour un pot final de {n(finalPot)} BB : {pct(q.required)} requis (cote de {n(ratio)} contre 1)
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label minWidth="90px">Tirage</DataList.Label>
                  <DataList.Value>
                    {q.drawName}, {outs} outs sur {q.outs.unseen} cartes inconnues
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label minWidth="90px">Équité</DataList.Label>
                  <DataList.Value>
                    {pct(q.equity)} exactement · règle du {q.cardsToCome === 2 ? 4 : 2} : ≈ {ruleOf2And4(outs, q.cardsToCome)} %
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
              {q.correct === 'fold' && !q.allIn && q.required - q.equity < 0.08 && (
                <Callout.Root size="1" color="amber" variant="surface">
                  <Callout.Text>
                    En partie réelle, les cotes implicites (ce que vous gagnerez aux tours suivants si vous touchez) peuvent rendre ce call
                    jouable.
                  </Callout.Text>
                </Callout.Root>
              )}
            </Feedback>
          ) : (
            <Hints
              title="Méthode"
              ordered
              items={[
                'Équité requise = mise à payer ÷ pot final (pot + mise + votre call).',
                'Équité du tirage ≈ outs × 2 pour une carte, × 4 pour deux cartes.',
                'Suivez si votre équité dépasse l’équité requise.',
              ]}
            />
          )}
        </div>
      </div>
    </QuizShell>
  );
}
