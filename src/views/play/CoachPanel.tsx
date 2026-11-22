import { CheckCircledIcon, CrossCircledIcon, ExclamationTriangleIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import { Badge, Button, Callout, DataList, Flex, Progress, Text } from '@radix-ui/themes';
import { useState } from 'react';
import { InlineCards } from '../../components/PlayingCard';
import Counter from '../../components/reactbits/Counter';
import SpotlightCard from '../../components/reactbits/SpotlightCard';
import { RECO_LABELS, type CoachAdvice } from '../../engine/coach';
import { formatBB } from '../../engine/game';
import type { FeedbackEntry } from './session';

interface Props {
  advice: CoachAdvice | null;
  mode: 'visible' | 'apres' | 'off';
  feedback: FeedbackEntry | null;
  heroTurn: boolean;
  bigBlind: number;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Grand chiffre à rouleaux (React Bits Counter) suivi d'une barre Radix. */
export function BigStat({
  label,
  value,
  color,
  suffix = '%',
}: {
  label: string;
  value: number;
  color: 'grass' | 'tomato' | 'gray';
  suffix?: string;
}) {
  return (
    <div className="big-stat">
      <Text size="1" color="gray">
        {label}
      </Text>
      <span className="big-stat__value">
        <Counter value={value} locale="fr-FR" fontSize={44} fontWeight={600} suffix={<span className="big-stat__suffix">{suffix}</span>} />
      </span>
      <Progress value={Math.min(100, value)} color={color} size="2" aria-label={label} />
    </div>
  );
}

/** Équité comparée à l'équité requise (exercices). */
export function EquityMeter({ equity, required }: { equity: number; required: number | null }) {
  return (
    <div className="stat-pair">
      <BigStat label="Votre équité" value={Math.round(equity * 100)} color={required === null || equity >= required ? 'grass' : 'tomato'} />
      {required !== null && <BigStat label="Équité requise" value={Math.round(required * 100)} color="gray" />}
    </div>
  );
}

const VERDICT_UI = {
  bon: { color: 'grass' as const, icon: CheckCircledIcon, label: 'Bon' },
  discutable: { color: 'amber' as const, icon: ExclamationTriangleIcon, label: 'Discutable' },
  erreur: { color: 'tomato' as const, icon: CrossCircledIcon, label: 'Erreur' },
};

export function CoachPanel({ advice, mode, feedback, heroTurn, bigBlind }: Props) {
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const key = advice ? `${advice.street}-${advice.toCall}-${advice.pot}` : null;
  const show = mode === 'visible' || (mode === 'apres' && revealedFor === key);

  return (
    <SpotlightCard theme="light" spotlightColor="rgba(70, 167, 88, 0.16)" className="coach" aria-live="polite">
      <Flex justify="between" align="center" mb="3">
        <Text size="2" weight="bold">
          Coach
        </Text>
        {advice && heroTurn && show && (
          <Text size="1" color="gray">
            {advice.street === 'preflop' ? 'Préflop' : advice.street === 'flop' ? 'Flop' : advice.street === 'turn' ? 'Turn' : 'River'}
            {advice.toCall > 0 ? ` · face à ${formatBB(advice.toCall, bigBlind)}` : ''}
          </Text>
        )}
      </Flex>

      {mode === 'off' && (
        <Text as="p" size="2" color="gray">
          Le coach est désactivé. Activez-le dans les réglages de la table pour obtenir conseils et corrections.
        </Text>
      )}

      {mode !== 'off' && feedback && (
        <Callout.Root color={VERDICT_UI[feedback.grade.verdict].color} variant="surface" size="1" mb="4">
          <Callout.Icon>
            {(() => {
              const I = VERDICT_UI[feedback.grade.verdict].icon;
              return <I />;
            })()}
          </Callout.Icon>
          <Callout.Text>
            <strong>{feedback.grade.title}.</strong> {feedback.grade.detail}
            <br />
            <Text size="1" color="gray">
              Vous : {feedback.action}
            </Text>
          </Callout.Text>
        </Callout.Root>
      )}

      {mode !== 'off' && heroTurn && advice && !show && (
        <Flex direction="column" gap="3" align="start">
          <Text as="p" size="2" color="gray">
            Décidez d’abord : le coach corrigera votre choix. Vous pouvez aussi demander un indice.
          </Text>
          <Button variant="soft" onClick={() => setRevealedFor(key)}>
            <LightningBoltIcon /> Voir le conseil
          </Button>
        </Flex>
      )}

      {mode !== 'off' && heroTurn && advice && show && (
        <div className="coach__advice">
          <Callout.Root color="grass" variant="surface" size="2">
            <Callout.Text>
              Conseil : <strong>{RECO_LABELS[advice.recommendation].toLowerCase()}</strong>
              {advice.raiseTo && advice.recommendation === 'raise' ? ` à ${formatBB(advice.raiseTo, bigBlind)}` : ''}
              {advice.close && (
                <>
                  {' '}
                  <Badge color="amber" variant="soft">
                    serré
                  </Badge>
                </>
              )}
            </Callout.Text>
          </Callout.Root>
          <EquityMeter equity={advice.equity} required={advice.required} />
          <DataList.Root size="2">
            <DataList.Item>
              <DataList.Label minWidth="90px">Main</DataList.Label>
              <DataList.Value>{advice.handName ?? `${advice.handClass} · top ${Math.round(advice.topPercent)} %`}</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label minWidth="90px">Position</DataList.Label>
              <DataList.Value>{advice.position ?? '—'}</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label minWidth="90px">Pot</DataList.Label>
              <DataList.Value>
                {formatBB(advice.pot, bigBlind)}
                {advice.toCall > 0 ? ` · ${formatBB(advice.toCall, bigBlind)} à payer` : ''}
              </DataList.Value>
            </DataList.Item>
            {advice.outs && (
              <DataList.Item>
                <DataList.Label minWidth="90px">Outs</DataList.Label>
                <DataList.Value>
                  {advice.outs.outs.length === 0 ? (
                    'aucun'
                  ) : (
                    <span className="coach__outs">
                      {advice.outs.outs.length}
                      {advice.outs.outs.length <= 15 && <InlineCards cards={advice.outs.outs} />}
                    </span>
                  )}
                </DataList.Value>
              </DataList.Item>
            )}
          </DataList.Root>
          <ul className="reasons">
            {advice.reasons.map((r) => (
              <li key={r}>
                <Text size="2">{r}</Text>
              </li>
            ))}
          </ul>
          <Text size="1" color="gray">
            Équité calculée contre des mains au hasard : un repère, pas une lecture de l’adversaire.
          </Text>
        </div>
      )}

      {mode !== 'off' && !heroTurn && !feedback && (
        <Text as="p" size="2" color="gray">
          Le coach analysera votre prochaine décision.
        </Text>
      )}
    </SpotlightCard>
  );
}

export { pct };
