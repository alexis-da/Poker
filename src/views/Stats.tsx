import { Button, Card, Flex, Heading, Link, Table, Text } from '@radix-ui/themes';
import { useState } from 'react';
import Counter from '../components/reactbits/Counter';
import { resetStats, useAppData } from '../store/store';
import { QUIZZES } from './training/QuizShell';
import { TrainingHistory } from './TrainingHistory';

const pctNum = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

function Curve({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <Card size="3" className="chart-empty">
        <Text size="2" color="gray">
          La courbe de gains apparaîtra après quelques mains jouées.
        </Text>
      </Card>
    );
  }
  const data = [0, ...points];
  const w = 640;
  const h = 200;
  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const last = data[data.length - 1];
  const ticks = [min, 0, max].filter((v, i, arr) => arr.indexOf(v) === i);
  return (
    <Card size="3" className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Gains cumulés : ${last} BB sur ${points.length} mains`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__zero' : 'chart__grid'} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="chart__label">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <path d={area} className={last >= 0 ? 'chart__area chart__area--pos' : 'chart__area chart__area--neg'} />
        <path d={line} className="chart__line" fill="none" />
        <circle cx={x(data.length - 1)} cy={y(last)} r="4" className="chart__dot" />
        <text x={w - pad.r} y={h - 6} textAnchor="end" className="chart__label">
          {points.length} mains
        </text>
      </svg>
    </Card>
  );
}

export function Stats() {
  const { play, quizzes } = useAppData();
  const [confirm, setConfirm] = useState<'play' | 'quizzes' | null>(null);
  const coachTotal = play.coach.bon + play.coach.discutable + play.coach.erreur;
  const bb100 = play.hands ? (play.netBB / play.hands) * 100 : null;
  const tiles: { label: string; value: number | null; suffix: string; decimals: number; hint?: string; tone?: string }[] = [
    { label: 'Mains jouées', value: play.hands, suffix: '', decimals: 0 },
    { label: 'Gain net', value: play.netBB, suffix: ' BB', decimals: 1, tone: play.netBB >= 0 ? 'pos' : 'neg' },
    { label: 'BB / 100 mains', value: bb100 === null ? null : Math.round(bb100 * 10) / 10, suffix: '', decimals: 1 },
    { label: 'VPIP', value: pctNum(play.vpip, play.hands), suffix: ' %', decimals: 0, hint: 'Mains jouées volontairement. Repère 6-max : 22 à 28 %.' },
    { label: 'PFR', value: pctNum(play.pfr, play.hands), suffix: ' %', decimals: 0, hint: 'Mains relancées préflop. Repère : 17 à 23 %.' },
    { label: 'Flops vus', value: pctNum(play.sawFlop, play.hands), suffix: ' %', decimals: 0 },
    { label: 'Abattages gagnés', value: pctNum(play.showdownsWon, play.showdowns), suffix: ' %', decimals: 0, hint: `${play.showdowns} abattages` },
    { label: 'Plus gros pot', value: play.biggestPotBB, suffix: ' BB', decimals: 1 },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <Text size="2" color="gray">
          Enregistrées sur cet appareil
        </Text>
        <Heading size="8">Statistiques</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          Vos résultats aux tables et dans les exercices, pour savoir quoi travailler ensuite.
        </Text>
      </header>

      <section className="section">
        <Heading size="5" as="h2">
          Aux tables
        </Heading>
        <div className="tiles">
          {tiles.map((t) => (
            <Card key={t.label} size="3" className="tile">
              <Text size="2" color="gray">
                {t.label}
              </Text>
              <span className={`tile__value ${t.tone ?? ''}`}>
                {t.value === null ? (
                  '—'
                ) : (
                  <Counter value={t.value} decimals={Number.isInteger(t.value) ? 0 : t.decimals} locale="fr-FR" fontSize={32} fontWeight={600} suffix={t.suffix} />
                )}
              </span>
              {t.hint && (
                <Text size="1" color="gray">
                  {t.hint}
                </Text>
              )}
            </Card>
          ))}
        </div>
        <Curve points={play.curve} />
      </section>

      <section className="section">
        <Heading size="5" as="h2">
          Décisions jugées par le coach
        </Heading>
        {coachTotal === 0 ? (
          <Text size="2" color="gray">
            Jouez quelques mains avec le coach activé pour voir la qualité de vos décisions.
          </Text>
        ) : (
          <Card size="3">
            <div className="stack-bar" role="img" aria-label="Répartition des décisions">
              {(['bon', 'discutable', 'erreur'] as const).map((k) =>
                play.coach[k] ? (
                  <span key={k} className={`stack-bar__seg stack-bar__seg--${k}`} style={{ flexGrow: play.coach[k] }}>
                    {Math.round((play.coach[k] / coachTotal) * 100)} %
                  </span>
                ) : null,
              )}
            </div>
            <Flex gap="5" wrap="wrap" mt="3">
              <Text size="2">
                <span className="swatch swatch--bon" /> Bonnes : {play.coach.bon}
              </Text>
              <Text size="2">
                <span className="swatch swatch--discutable" /> Discutables : {play.coach.discutable}
              </Text>
              <Text size="2">
                <span className="swatch swatch--erreur" /> Erreurs : {play.coach.erreur}
              </Text>
            </Flex>
          </Card>
        )}
      </section>

      <section className="section">
        <Heading size="5" as="h2">
          Exercices
        </Heading>
        <Card size="1" className="table-card">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Exercice</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Réponses</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Réussite</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Record de série</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>20 dernières</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {QUIZZES.map((q) => {
                const s = quizzes[q.id];
                const p = pctNum(s.correct, s.attempts);
                return (
                  <Table.Row key={q.id}>
                    <Table.RowHeaderCell>
                      <Link href={`#${q.route}`}>{q.title}</Link>
                    </Table.RowHeaderCell>
                    <Table.Cell>{s.attempts}</Table.Cell>
                    <Table.Cell>{p === null ? '—' : `${p} %`}</Table.Cell>
                    <Table.Cell>{s.bestStreak}</Table.Cell>
                    <Table.Cell>
                      <span className="dots">
                        {s.recent.slice(-20).map((ok, i) => (
                          <span key={i} className={ok ? 'dot dot--ok' : 'dot dot--ko'} />
                        ))}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Card>
      </section>

      <TrainingHistory />

      <section className="section">
        <Heading size="5" as="h2">
          Réinitialiser
        </Heading>
        {confirm ? (
          <Flex gap="2" align="center" wrap="wrap">
            <Text size="2">Effacer définitivement les statistiques {confirm === 'play' ? 'de jeu' : 'des exercices'} ?</Text>
            <Button
              color="tomato"
              onClick={() => {
                resetStats(confirm);
                setConfirm(null);
              }}
            >
              Effacer
            </Button>
            <Button variant="soft" color="gray" onClick={() => setConfirm(null)}>
              Annuler
            </Button>
          </Flex>
        ) : (
          <Flex gap="3" wrap="wrap">
            <Button variant="soft" color="gray" onClick={() => setConfirm('play')}>
              Effacer les stats de jeu
            </Button>
            <Button variant="soft" color="gray" onClick={() => setConfirm('quizzes')}>
              Effacer les stats d’exercices
            </Button>
          </Flex>
        )}
      </section>
    </div>
  );
}
