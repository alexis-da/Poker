import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Badge, Card, Flex, Heading, Progress, Text } from '@radix-ui/themes';
import { useAppData } from '../../store/store';
import { QUIZZES } from './QuizShell';

export function TrainingHub() {
  const data = useAppData();
  return (
    <div className="page">
      <header className="page-head">
        <Text size="2" color="gray">
          Cinq exercices · questions illimitées
        </Text>
        <Heading size="8">Exercices</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          Des séries courtes pour automatiser les calculs que l’on fait à chaque main. Chaque réponse est corrigée et expliquée.
        </Text>
      </header>
      <div className="module-grid">
        {QUIZZES.map((q) => {
          const s = data.quizzes[q.id];
          const acc = s.attempts ? Math.round((s.correct / s.attempts) * 100) : null;
          return (
            <Card key={q.id} size="3" asChild className="module">
              <a href={`#${q.route}`}>
                <Flex direction="column" gap="3" height="100%">
                  <Flex justify="between" align="center" gap="2">
                    <Badge color="gray" variant="soft">
                      {q.short}
                    </Badge>
                    {acc !== null && (
                      <Text size="1" color="gray">
                        record {s.bestStreak}
                      </Text>
                    )}
                  </Flex>
                  <Heading size="5" as="h2">
                    {q.title}
                  </Heading>
                  <Text size="2" color="gray">
                    {q.description}
                  </Text>
                  <Flex direction="column" gap="2" mt="auto">
                    <Flex justify="between" align="baseline">
                      <Text size="2" weight="medium">
                        {acc === null ? 'Pas encore commencé' : `${acc} % de réussite`}
                      </Text>
                      <ArrowRightIcon className="module__arrow" />
                    </Flex>
                    <Progress value={acc ?? 0} size="1" color={acc === null ? 'gray' : acc >= 70 ? 'grass' : 'amber'} aria-label="Réussite" />
                  </Flex>
                </Flex>
              </a>
            </Card>
          );
        })}
      </div>
      <Text as="p" size="2" color="gray">
        Ordre conseillé pour débuter : lecture d’abattage, puis outs, cotes du pot, ranges préflop et estimation d’équité.
      </Text>
    </div>
  );
}
