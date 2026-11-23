import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useMemo } from 'react';
import { useTraining } from '../../training/db';
import { startPractice } from '../../training/focus';
import { SKILLS, TAG_LABELS } from '../../training/model';
import { recommend } from '../../training/recommend';

/** Exercices recommandés d'après l'historique d'erreurs. */
export function Recommendations({ max = 3 }: { max?: number }) {
  const { events, status } = useTraining();
  const recs = useMemo(() => recommend(events, Date.now(), max), [events, max]);

  if (status === 'chargement') {
    return (
      <Text size="2" color="gray">
        Chargement de votre historique…
      </Text>
    );
  }
  const anyWeak = recs.some((r) => r.kind === 'faiblesse');
  return (
    <Flex direction="column" gap="3">
      {!anyWeak && (
        <Text size="2" color="gray">
          {events.length === 0
            ? 'Pas encore d’historique : jouez quelques mains avec le coach ou répondez à des exercices, les recommandations se baseront sur vos erreurs.'
            : 'Aucun point faible marqué ces 30 derniers jours. Voici de quoi élargir votre entraînement.'}
        </Text>
      )}
      <div className="recos">
        {recs.map((r) => (
          <Card key={r.skill} size="3" className="reco-card">
            <Flex direction="column" gap="2" height="100%">
              <Flex gap="2" align="center" wrap="wrap">
                <Badge color={r.kind === 'faiblesse' ? 'tomato' : 'gray'} variant="soft">
                  {r.kind === 'faiblesse' ? 'Point faible' : 'À découvrir'}
                </Badge>
                {r.focus && (
                  <Badge color="grass" variant="soft">
                    ciblé : {TAG_LABELS[r.focus.value] ?? r.focus.value}
                  </Badge>
                )}
              </Flex>
              <Heading size="4" as="h3">
                {SKILLS[r.skill].label}
              </Heading>
              <Text size="2" color="gray">
                {r.reason}
              </Text>
              <Flex mt="auto" pt="2">
                <Button
                  variant={r.kind === 'faiblesse' ? 'solid' : 'soft'}
                  color={r.kind === 'faiblesse' ? 'grass' : 'gray'}
                  onClick={() => startPractice(r.route, r.focus)}
                >
                  {r.action} <ArrowRightIcon />
                </Button>
              </Flex>
            </Flex>
          </Card>
        ))}
      </div>
    </Flex>
  );
}
