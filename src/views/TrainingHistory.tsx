import { LightningBoltIcon } from '@radix-ui/react-icons';
import { Badge, Button, Callout, Card, Flex, Heading, IconButton, Table, Text, Tooltip } from '@radix-ui/themes';
import { useMemo, useState } from 'react';
import { clearTraining, useTraining, type BackendKind } from '../training/db';
import { startPractice } from '../training/focus';
import { FOCUSABLE, SKILLS, TAG_LABELS, type SkillId } from '../training/model';
import { recentMistakes, skillStats, WINDOW_DAYS } from '../training/recommend';

const STORAGE: Record<BackendKind, string> = {
  compte: 'Enregistré dans votre compte claude.ai, privé et synchronisé entre vos appareils.',
  appareil: 'Enregistré sur cet appareil, dans la base IndexedDB du navigateur.',
  memoire: 'Non enregistré : ce navigateur refuse le stockage (navigation privée ?).',
};

const when = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `aujourd’hui ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/** Points faibles, erreurs récentes et données de l'historique d'entraînement. */
export function TrainingHistory() {
  const { events, backend, status, error } = useTraining();
  const [confirm, setConfirm] = useState(false);
  const stats = useMemo(() => skillStats(events, Date.now()), [events]);
  const mistakes = useMemo(() => recentMistakes(events, 8), [events]);
  const rows = (Object.keys(SKILLS) as SkillId[])
    .map((s) => stats[s])
    .filter((s) => s.count > 0)
    .sort((a, b) => b.score - a.score || b.errors - a.errors);

  const practice = (skill: SkillId, tag: string | null | undefined) => {
    const info = SKILLS[skill];
    const focus = info.quiz && tag && FOCUSABLE[info.quiz].includes(tag) ? { quiz: info.quiz, value: tag } : null;
    startPractice(info.route, focus);
  };

  return (
    <>
      <section className="section">
        <Heading size="5" as="h2">
          Points faibles · {WINDOW_DAYS} derniers jours
        </Heading>
        {rows.length === 0 ? (
          <Text size="2" color="gray">
            {status === 'chargement'
              ? 'Chargement de votre historique…'
              : 'Rien à analyser pour l’instant : chaque réponse aux exercices et chaque décision jugée par le coach viendra alimenter ce tableau.'}
          </Text>
        ) : (
          <Card size="1" className="table-card">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Compétence</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Essais</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Erreurs</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Taux d’erreur</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Surtout</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    <span className="sr-only">Travailler</span>
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => (
                  <Table.Row key={r.skill} align="center">
                    <Table.RowHeaderCell>{SKILLS[r.skill].label}</Table.RowHeaderCell>
                    <Table.Cell>
                      {r.count}
                      <Text size="1" color="gray">
                        {' '}
                        ({r.playCount} en jeu)
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{r.errors.toLocaleString('fr-FR')}</Table.Cell>
                    <Table.Cell>
                      <Badge color={r.rate >= 0.4 ? 'tomato' : r.rate >= 0.2 ? 'amber' : 'grass'} variant="soft">
                        {Math.round(r.rate * 100)} %
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {r.topTag ? (TAG_LABELS[r.topTag] ?? r.topTag) : '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Tooltip content={SKILLS[r.skill].action}>
                        <IconButton
                          size="1"
                          variant="soft"
                          aria-label={`${SKILLS[r.skill].action} (${SKILLS[r.skill].label})`}
                          onClick={() => practice(r.skill, r.topTag)}
                        >
                          <LightningBoltIcon />
                        </IconButton>
                      </Tooltip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        )}
      </section>

      {mistakes.length > 0 && (
        <section className="section">
          <Heading size="5" as="h2">
            Erreurs récentes
          </Heading>
          <Card size="2">
            <ul className="mistakes">
              {mistakes.map((m, i) => (
                <li key={`${m.t}-${i}`}>
                  <Flex justify="between" align="center" gap="3" wrap="wrap">
                    <Flex direction="column" gap="1" minWidth="0">
                      <Text size="2" weight="medium">
                        {m.note ?? SKILLS[m.skill].label}
                      </Text>
                      <Text size="1" color="gray">
                        {SKILLS[m.skill].label} · {m.src === 'jeu' ? 'en partie' : 'exercice'} · {when(m.t)}
                        {m.ok === 0.5 ? ' · discutable' : ''}
                      </Text>
                    </Flex>
                    <Button size="1" variant="soft" color="gray" onClick={() => practice(m.skill, m.tag)}>
                      S’entraîner
                    </Button>
                  </Flex>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className="section">
        <Heading size="5" as="h2">
          Historique d’entraînement
        </Heading>
        <Card size="3">
          <Flex direction="column" gap="3">
            <Text size="2">
              {events.length.toLocaleString('fr-FR')} réponse{events.length > 1 ? 's' : ''} et décision{events.length > 1 ? 's' : ''}{' '}
              conservée{events.length > 1 ? 's' : ''} (120 derniers jours). {STORAGE[backend]}
            </Text>
            {error && (
              <Callout.Root color="tomato" size="1">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}
            {confirm ? (
              <Flex gap="2" align="center" wrap="wrap">
                <Text size="2">Effacer tout l’historique ? Les recommandations repartiront de zéro.</Text>
                <Button
                  color="tomato"
                  onClick={async () => {
                    await clearTraining();
                    setConfirm(false);
                  }}
                >
                  Effacer
                </Button>
                <Button variant="soft" color="gray" onClick={() => setConfirm(false)}>
                  Annuler
                </Button>
              </Flex>
            ) : (
              <div>
                <Button variant="soft" color="gray" onClick={() => setConfirm(true)} disabled={events.length === 0}>
                  Effacer l’historique
                </Button>
              </div>
            )}
          </Flex>
        </Card>
      </section>
    </>
  );
}
