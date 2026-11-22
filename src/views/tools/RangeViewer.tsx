import { CopyIcon } from '@radix-ui/react-icons';
import { Button, Card, DataList, Flex, Heading, SegmentedControl, Text, TextField } from '@radix-ui/themes';
import { useState } from 'react';
import { RangeGrid } from '../../components/RangeGrid';
import { HAND_TOP_PERCENT, POSITION_INFO, preflopEquity, RFI_RANGES, RFI_SETS } from '../../data/charts';
import { comboCount, parseRange, rangeComboCount, rangePercent, rangeToString, type HandClass } from '../../engine/ranges';
import { RFI_POSITIONS, type RfiPosition } from '../../trainers/generators';

type Tab = RfiPosition | 'custom';

export function RangeViewer() {
  const [tab, setTab] = useState<Tab>('UTG');
  const [custom, setCustom] = useState<Set<HandClass>>(() => parseRange('22+, A2s+, KTs+, QTs+, JTs, ATo+, KJo+'));
  const [text, setText] = useState(() => rangeToString(custom));
  const [hover, setHover] = useState<HandClass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const range = tab === 'custom' ? custom : RFI_SETS[tab];
  const notation = tab === 'custom' ? rangeToString(custom) : RFI_RANGES[tab];

  const toggle = (hc: HandClass) => {
    const next = new Set(custom);
    if (next.has(hc)) next.delete(hc);
    else next.add(hc);
    setCustom(next);
    setText(rangeToString(next));
    setError(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.getElementById('range-notation') as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <Text size="2" color="gray">
          Outil · 6-max, 100 BB
        </Text>
        <Heading size="8">Tableaux de ranges</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          Les mains à ouvrir quand personne n’a relancé avant vous, position par position. Construisez aussi votre propre range case
          par case.
        </Text>
      </header>

      <div className="scroll-x">
        <SegmentedControl.Root value={tab} onValueChange={(v) => setTab(v as Tab)} aria-label="Position">
          {RFI_POSITIONS.map((p) => (
            <SegmentedControl.Item key={p} value={p}>
              {p} · {rangePercent(RFI_SETS[p]).toFixed(0)} %
            </SegmentedControl.Item>
          ))}
          <SegmentedControl.Item value="custom">Ma range</SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>

      <div className="ranges">
        <Card size="3" className="ranges__grid">
          <RangeGrid
            range={range}
            focus={hover}
            onCellClick={tab === 'custom' ? toggle : undefined}
            onCellHover={setHover}
            label={tab === 'custom' ? 'Ma range' : `Range d’ouverture ${tab}`}
          />
          <Flex gap="4" wrap="wrap" mt="3">
            <Text size="2" color="gray">
              <span className="swatch swatch--pair" /> Paires
            </Text>
            <Text size="2" color="gray">
              <span className="swatch swatch--suited" /> Assorties (au-dessus de la diagonale)
            </Text>
            <Text size="2" color="gray">
              <span className="swatch swatch--offsuit" /> Dépareillées (en dessous)
            </Text>
          </Flex>
        </Card>
        <div className="ranges__info">
          <Card size="3">
            <Heading size="4" as="h2" mb="2">
              {tab === 'custom' ? 'Ma range' : `${POSITION_INFO[tab].name} (${tab})`}
            </Heading>
            {tab !== 'custom' && (
              <Text as="p" size="2" color="gray" mb="3">
                {POSITION_INFO[tab].detail}
              </Text>
            )}
            <DataList.Root size="2" mb="4">
              <DataList.Item>
                <DataList.Label minWidth="120px">Mains</DataList.Label>
                <DataList.Value>{rangePercent(range).toFixed(1).replace('.', ',')} %</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="120px">Combinaisons</DataList.Label>
                <DataList.Value>{rangeComboCount(range)} / 1326</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="120px">Classes</DataList.Label>
                <DataList.Value>{range.size} / 169</DataList.Value>
              </DataList.Item>
            </DataList.Root>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Notation
              </Text>
              <TextField.Root
                id="range-notation"
                value={tab === 'custom' ? text : notation}
                readOnly={tab !== 'custom'}
                onChange={(e) => {
                  if (tab !== 'custom') return;
                  setText(e.target.value);
                  try {
                    setCustom(parseRange(e.target.value));
                    setError(null);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
                aria-label="Notation de la range"
              />
              {error && (
                <Text size="1" color="tomato">
                  {error}
                </Text>
              )}
              <Flex gap="2" wrap="wrap">
                <Button size="2" variant="soft" color="gray" onClick={copy}>
                  <CopyIcon /> {copied ? 'Copié' : 'Copier la notation'}
                </Button>
                {tab === 'custom' && (
                  <Button
                    size="2"
                    variant="soft"
                    color="gray"
                    onClick={() => {
                      setCustom(new Set());
                      setText('');
                    }}
                  >
                    Tout effacer
                  </Button>
                )}
              </Flex>
              {tab === 'custom' && (
                <Text size="1" color="gray">
                  Touchez une case pour l’ajouter ou la retirer. La notation se colle dans le calculateur d’équité.
                </Text>
              )}
            </Flex>
          </Card>
          <Card size="3">
            <Heading size="4" as="h2" mb="2">
              {hover ?? 'Survolez une main'}
            </Heading>
            {hover ? (
              <DataList.Root size="2">
                <DataList.Item>
                  <DataList.Label minWidth="120px">Combinaisons</DataList.Label>
                  <DataList.Value>{comboCount(hover)}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label minWidth="120px">Classement</DataList.Label>
                  <DataList.Value>top {HAND_TOP_PERCENT[hover].toFixed(HAND_TOP_PERCENT[hover] < 10 ? 1 : 0)} %</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label minWidth="120px">Contre 1 main</DataList.Label>
                  <DataList.Value>{Math.round(preflopEquity(hover, 1) * 100)} %</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label minWidth="120px">Contre 5 mains</DataList.Label>
                  <DataList.Value>{Math.round(preflopEquity(hover, 5) * 100)} %</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            ) : (
              <Text size="2" color="gray">
                Nombre de combinaisons, rang parmi les 169 mains et équité contre des mains aléatoires.
              </Text>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
