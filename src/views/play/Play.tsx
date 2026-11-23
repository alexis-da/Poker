import { ArrowRightIcon, ExitIcon } from '@radix-ui/react-icons';
import {
  Badge,
  Button,
  Card,
  Flex,
  Heading,
  Kbd,
  RadioCards,
  SegmentedControl,
  Select,
  Switch,
  Text,
} from '@radix-ui/themes';
import { useEffect, useMemo, useState } from 'react';
import { BOT_PROFILES, decideBot, PROFILE_BY_ID } from '../../engine/bot';
import { getAdvice, gradeDecision } from '../../engine/coach';
import { getLegalActions, type Action } from '../../engine/game';
import { useSettings } from '../../store/store';
import { classifyDecision } from '../../training/classify';
import { ActionBar } from './ActionBar';
import { CoachPanel } from './CoachPanel';
import { botAct, heroAct, leaveTable, newTable, nextHand, placeLabel, replay, useSession } from './session';
import { PROFILE_COLOR, Table } from './Table';

const SPEED_MS = { lent: 1500, normal: 850, rapide: 320 };
const STREET_FR = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Abattage' } as const;

function Setup() {
  const [settings, setSettings] = useSettings();
  const [profiles, setProfiles] = useState('mix');
  return (
    <div className="page">
      <header className="page-head">
        <Text size="2" color="gray">
          Table 6-max · No-Limit Hold’em · blinds 0,5 / 1 BB
        </Text>
        <Heading size="8">Jouer une session</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          Affrontez des bots au style marqué. Le coach analyse chacune de vos décisions : équité, cotes du pot, outs et ranges
          préflop.
        </Text>
      </header>
      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          newTable({ opponents: settings.opponents, startingBB: settings.startingBB, profiles });
          window.scrollTo({ top: 0 });
        }}
      >
        <Card size="3">
          <Flex direction="column" gap="5">
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Adversaires
              </Text>
              <SegmentedControl.Root
                size="2"
                value={String(settings.opponents)}
                onValueChange={(v) => setSettings({ opponents: Number(v) })}
                aria-label="Nombre d’adversaires"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <SegmentedControl.Item key={n} value={String(n)}>
                    {n === 1 ? '1 · tête-à-tête' : n}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Tapis de départ
              </Text>
              <SegmentedControl.Root
                size="2"
                value={String(settings.startingBB)}
                onValueChange={(v) => setSettings({ startingBB: Number(v) })}
                aria-label="Tapis de départ"
              >
                {[40, 100, 200].map((n) => (
                  <SegmentedControl.Item key={n} value={String(n)}>
                    {n} BB
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Style des bots
              </Text>
              <RadioCards.Root value={profiles} onValueChange={setProfiles} columns={{ initial: '1', sm: '2', md: '3' }} aria-label="Style des bots">
                <RadioCards.Item value="mix">
                  <Flex direction="column" width="100%" gap="1">
                    <Text weight="bold">Mélange</Text>
                    <Text size="2" color="gray">
                      Un profil au hasard par siège, comme à une vraie table.
                    </Text>
                  </Flex>
                </RadioCards.Item>
                {BOT_PROFILES.map((p) => (
                  <RadioCards.Item key={p.id} value={p.id}>
                    <Flex direction="column" width="100%" gap="1">
                      <Flex gap="2" align="center" wrap="wrap">
                        <Text weight="bold">{p.label}</Text>
                        <Badge color={PROFILE_COLOR[p.id]} variant="soft">
                          {p.style}
                        </Badge>
                      </Flex>
                      <Text size="2" color="gray">
                        {p.description}
                      </Text>
                    </Flex>
                  </RadioCards.Item>
                ))}
              </RadioCards.Root>
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Coach
              </Text>
              <SegmentedControl.Root
                size="2"
                value={settings.coachMode}
                onValueChange={(v) => setSettings({ coachMode: v as typeof settings.coachMode })}
                aria-label="Mode du coach"
              >
                <SegmentedControl.Item value="visible">Conseils visibles</SegmentedControl.Item>
                <SegmentedControl.Item value="apres">Correction après coup</SegmentedControl.Item>
                <SegmentedControl.Item value="off">Désactivé</SegmentedControl.Item>
              </SegmentedControl.Root>
            </Flex>
            <Flex direction="column" gap="2" align="start">
              <Button size="4" type="submit">
                S’asseoir à la table
              </Button>
              <Text size="2" color="gray">
                Partie à élimination, sans recave : un joueur sans jetons quitte la table. La partie se termine quand vous n’avez plus
                de jetons ou quand vous les avez tous remportés.
              </Text>
            </Flex>
          </Flex>
        </Card>
      </form>
      <Card size="3" asChild className="path online-entry">
        <a href="#en-ligne">
          <Flex justify="between" align="center" gap="3">
            <Flex direction="column" gap="1">
              <Heading size="4" as="h2">
                Jouer en ligne avec des amis
              </Heading>
              <Text size="2" color="gray">
                Une table privée de 2 à 6 joueurs, un lien à partager, et des bots pour compléter si vous le souhaitez.
              </Text>
            </Flex>
            <ArrowRightIcon className="module__arrow" />
          </Flex>
        </a>
      </Card>
    </div>
  );
}

function TableSettings() {
  const [settings, setSettings] = useSettings();
  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center" gap="3">
        <Text size="2">Coach</Text>
        <Select.Root value={settings.coachMode} onValueChange={(v) => setSettings({ coachMode: v as typeof settings.coachMode })}>
          <Select.Trigger aria-label="Mode du coach" />
          <Select.Content>
            <Select.Item value="visible">Conseils visibles</Select.Item>
            <Select.Item value="apres">Correction après coup</Select.Item>
            <Select.Item value="off">Désactivé</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>
      <Flex justify="between" align="center" gap="3">
        <Text size="2">Vitesse des bots</Text>
        <Select.Root value={settings.botSpeed} onValueChange={(v) => setSettings({ botSpeed: v as typeof settings.botSpeed })}>
          <Select.Trigger aria-label="Vitesse des bots" />
          <Select.Content>
            <Select.Item value="lent">Lente</Select.Item>
            <Select.Item value="normal">Normale</Select.Item>
            <Select.Item value="rapide">Rapide</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>
      <Flex justify="between" align="center" gap="3">
        <Text size="2">Cartes</Text>
        <Select.Root value={settings.cardStyle} onValueChange={(v) => setSettings({ cardStyle: v as typeof settings.cardStyle })}>
          <Select.Trigger aria-label="Style de cartes" />
          <Select.Content>
            <Select.Item value="lisible">Gros index</Select.Item>
            <Select.Item value="illustre">Illustrées</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>
      <Text as="label" size="2">
        <Flex justify="between" align="center" gap="3">
          Jeu 4 couleurs
          <Switch id="four-color" checked={settings.fourColor} onCheckedChange={(v) => setSettings({ fourColor: v })} />
        </Flex>
      </Text>
      <Text as="label" size="2">
        <Flex justify="between" align="center" gap="3">
          Main suivante automatique
          <Switch id="auto-next" checked={settings.autoNext} onCheckedChange={(v) => setSettings({ autoNext: v })} />
        </Flex>
      </Text>
    </Flex>
  );
}

export function Play() {
  const session = useSession();
  const [settings] = useSettings();
  const game = session.game;
  const [confirmLeave, setConfirmLeave] = useState(false);

  const heroIndex = game ? game.players.findIndex((p) => p.isHuman) : -1;
  const heroTurn = !!game && !game.result && game.toAct === heroIndex;
  const legal = game && heroTurn ? getLegalActions(game) : null;
  const advice = useMemo(
    () => (game && heroTurn && settings.coachMode !== 'off' ? getAdvice(game) : null),
    [game, heroTurn, settings.coachMode],
  );

  // Les bots jouent avec un léger délai.
  const thinking = game && !game.result && game.toAct !== null && !game.players[game.toAct].isHuman ? game.toAct : null;
  const thinkMs = useMemo(
    () => Math.round(SPEED_MS[settings.botSpeed] * (0.7 + Math.random() * 0.6)),
    // Un nouveau délai à chaque nouvel état de la partie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, settings.botSpeed],
  );
  useEffect(() => {
    if (!game || thinking === null) return;
    const t = window.setTimeout(() => botAct(decideBot(game)), thinkMs);
    return () => window.clearTimeout(t);
  }, [game, thinking, thinkMs]);

  // Main suivante automatique.
  const over = session.over;
  useEffect(() => {
    if (!game?.result || !settings.autoNext || over) return;
    const t = window.setTimeout(() => nextHand(), 3200);
    return () => window.clearTimeout(t);
  }, [game, settings.autoNext, over]);

  // Espace ou Entrée : main suivante.
  useEffect(() => {
    if (!game?.result || over) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON')) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nextHand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, over]);

  if (!game) return <Setup />;

  const hero = game.players[heroIndex];
  const onHeroAction = (action: Action, label: string) => {
    const grade = advice && settings.coachMode !== 'off' ? gradeDecision(advice, action) : null;
    const event = advice && grade ? classifyDecision(advice, action, grade) : null;
    heroAct(action, grade, label, event);
  };
  const opponents = game.players.filter((p) => !p.isHuman);
  const street = STREET_FR[game.street];
  const title = over
    ? over.won
      ? 'Partie gagnée'
      : 'Partie terminée'
    : game.result
    ? 'Main terminée'
    : heroTurn
      ? `${street}, à vous de parler`
      : hero.folded
        ? `${street} · vous êtes couché`
        : street;

  return (
    <div className="play">
      <div className="play__main">
        <div className="play__bar">
          <div>
            <Text size="2" color="gray">
              Main n° {game.handNumber} · blinds 0,5 / 1 BB · {game.players.filter((p) => !p.sittingOut).length} joueurs
            </Text>
            <Heading size="6" className="play__title">
              {title}
            </Heading>
          </div>
          {confirmLeave ? (
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="2">Quitter la table ?</Text>
              <Button
                size="2"
                color="tomato"
                onClick={() => {
                  setConfirmLeave(false);
                  leaveTable();
                }}
              >
                Quitter
              </Button>
              <Button size="2" variant="soft" color="gray" onClick={() => setConfirmLeave(false)}>
                Rester
              </Button>
            </Flex>
          ) : (
            <Button size="2" variant="soft" color="gray" onClick={() => setConfirmLeave(true)} aria-label="Quitter la table">
              <ExitIcon /> <span className="hide-phone">Quitter la table</span>
            </Button>
          )}
        </div>

        <div className="table-area">
          <Table game={game} thinking={thinking} thinkMs={thinkMs} />
        </div>

        <div className="console">
          {heroTurn && legal ? (
            <ActionBar
              game={game}
              legal={legal}
              advice={settings.coachMode === 'visible' ? advice : null}
              showHint={settings.coachMode === 'visible'}
              onAction={onHeroAction}
            />
          ) : game.result ? (
            <Card size="3" className="action-bar action-bar--result">
              {session.notice && (
                <Text as="p" size="2" color="amber">
                  {session.notice}
                </Text>
              )}
              {over ? (
                <Flex direction="column" gap="3" align="center">
                  <Heading size="5" as="h2">
                    {over.won
                      ? `Vous remportez la partie en ${over.hands} main${over.hands > 1 ? 's' : ''}`
                      : `Vous terminez ${placeLabel(over.place)} sur ${over.players}`}
                  </Heading>
                  <Text size="2" color="gray">
                    {over.won
                      ? 'Vous avez pris tous les jetons de la table.'
                      : `Vous n’avez plus de jetons après ${over.hands} main${over.hands > 1 ? 's' : ''}. Pas de recave : la partie s’arrête ici.`}
                  </Text>
                  <Flex gap="3" wrap="wrap" justify="center">
                    <Button size="3" id="replay" onClick={replay}>
                      Nouvelle partie
                    </Button>
                    <Button size="3" variant="soft" color="gray" onClick={leaveTable}>
                      Changer les réglages
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Button size="4" id="next-hand" onClick={nextHand}>
                  Main suivante <Kbd>Espace</Kbd>
                </Button>
              )}
            </Card>
          ) : (
            <Card size="3" className="action-bar action-bar--wait">
              <Text size="2" color="gray">
                {thinking !== null ? `${game.players[thinking].name} réfléchit…` : 'Distribution…'}
              </Text>
            </Card>
          )}
        </div>
      </div>

      <aside className="play__side">
        <CoachPanel
          advice={advice}
          mode={settings.coachMode}
          feedback={session.feedback}
          heroTurn={heroTurn}
          bigBlind={game.bigBlind}
        />
        <Card size="3">
          <Text as="p" size="2" weight="bold" mb="3">
            Adversaires
          </Text>
          <Flex direction="column" gap="2">
            {opponents.map((p) => {
              const prof = p.profile ? PROFILE_BY_ID[p.profile] : null;
              const out = session.eliminations.find((e) => e.name === p.name && !e.isHuman);
              return (
                <Flex key={p.id} justify="between" align="center" gap="2">
                  <Text size="2" weight="medium" color={out ? 'gray' : undefined}>
                    {p.name}
                  </Text>
                  {out ? (
                    <Badge color="gray" variant="outline">
                      Hors jeu · {placeLabel(out.place)}
                    </Badge>
                  ) : (
                    prof && (
                      <Badge color={PROFILE_COLOR[prof.id]} variant="soft">
                        {prof.label} · {prof.style}
                      </Badge>
                    )
                  )}
                </Flex>
              );
            })}
          </Flex>
          <Text as="p" size="1" color="gray" mt="3">
            Session : {session.hands} main{session.hands > 1 ? 's' : ''} · coach {session.coach.bon} bon, {session.coach.discutable}{' '}
            discutable, {session.coach.erreur} erreur{session.coach.erreur > 1 ? 's' : ''}
          </Text>
        </Card>
        <Card size="3">
          <Text as="p" size="2" weight="bold" mb="3">
            Réglages
          </Text>
          <TableSettings />
          <Text as="p" size="1" color="gray" mt="3">
            Raccourcis : <Kbd>F</Kbd> se coucher · <Kbd>C</Kbd> checker / suivre · <Kbd>R</Kbd> relancer · <Kbd>Espace</Kbd> main
            suivante.
          </Text>
        </Card>
      </aside>
    </div>
  );
}
