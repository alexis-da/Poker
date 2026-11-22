import { Card, DataList, Heading, Link, Table, Tabs, Text } from '@radix-ui/themes';
import { CardRow } from '../components/PlayingCard';
import { POSITION_INFO, type Position } from '../data/charts';
import { parseCards } from '../engine/cards';
import { hitProbability } from '../engine/outs';
import { PositionRing } from './training/PreflopQuiz';

/** Probabilité d'obtenir chaque combinaison avec 7 cartes (2 privatives + 5 communes). */
const HANDS = [
  { name: 'Quinte flush royale', cards: 'AhKhQhJhTh', text: 'As, Roi, Dame, Valet, Dix de la même couleur.', p: '0,0032 %' },
  { name: 'Quinte flush', cards: '9s8s7s6s5s', text: 'Cinq cartes consécutives de la même couleur.', p: '0,028 %' },
  { name: 'Carré', cards: 'QdQcQhQs4d', text: 'Quatre cartes de même rang.', p: '0,17 %' },
  { name: 'Full', cards: 'TsTdTc7h7d', text: 'Un brelan et une paire. On le nomme par le brelan : « full aux Dix par les Sept ».', p: '2,6 %' },
  { name: 'Couleur', cards: 'Ad9d7d4d2d', text: 'Cinq cartes de la même couleur, non consécutives. La plus haute carte départage.', p: '3,0 %' },
  { name: 'Quinte', cards: '8c7d6h5s4c', text: 'Cinq cartes consécutives. L’As peut être bas : A-2-3-4-5 est la plus petite quinte.', p: '4,6 %' },
  { name: 'Brelan', cards: '6h6s6dKc2h', text: 'Trois cartes de même rang. Avec une paire servie, on parle de « set ».', p: '4,8 %' },
  { name: 'Double paire', cards: 'JhJcThTs9d', text: 'Deux paires. La plus haute paire départage, puis la seconde, puis le kicker.', p: '23,5 %' },
  { name: 'Paire', cards: 'KsKd9c5h3s', text: 'Deux cartes de même rang, puis trois kickers.', p: '43,8 %' },
  { name: 'Hauteur', cards: 'AsJd8h6c3d', text: 'Aucune combinaison : la carte la plus haute départage.', p: '17,4 %' },
];

const OUTS_ROWS = [
  { draw: 'Paire servie → brelan', outs: 2 },
  { draw: 'Quinte ventrale', outs: 4 },
  { draw: 'Paire → double paire ou brelan', outs: 5 },
  { draw: 'Deux overcards → paire', outs: 6 },
  { draw: 'Quinte par les deux bouts', outs: 8 },
  { draw: 'Tirage couleur', outs: 9 },
  { draw: 'Couleur + ventrale', outs: 12 },
  { draw: 'Couleur + quinte par les deux bouts', outs: 15 },
];

const BET_ROWS = [
  { label: '¼ du pot', f: 0.25 },
  { label: '⅓ du pot', f: 1 / 3 },
  { label: '½ pot', f: 0.5 },
  { label: '⅔ du pot', f: 2 / 3 },
  { label: '¾ du pot', f: 0.75 },
  { label: 'Pot', f: 1 },
  { label: '2 × pot', f: 2 },
];

const GLOSSARY: [string, string][] = [
  ['3-bet', 'Deuxième relance préflop (la grosse blind compte comme la première mise). Le 4-bet est la relance suivante.'],
  ['Abattage (showdown)', 'Moment où les joueurs restants retournent leurs cartes pour désigner le gagnant.'],
  ['Blinds', 'Mises obligatoires : la petite blind (SB) et la grosse blind (BB) relancent l’action à chaque main.'],
  ['Board', 'Les cinq cartes communes : flop (trois cartes), turn (quatrième) et river (cinquième).'],
  ['C-bet', 'Mise de continuation : le relanceur préflop mise à nouveau au flop.'],
  ['Check', 'Parler sans miser quand personne n’a misé sur le tour en cours (« parole »).'],
  ['Cotes du pot', 'Rapport entre ce qu’il faut payer et ce que l’on peut gagner. Elles donnent l’équité minimale pour suivre.'],
  ['Cotes implicites', 'Jetons supplémentaires que l’on espère gagner aux tours suivants si l’on touche son tirage.'],
  ['Équité', 'Part du pot qui vous revient en moyenne si toutes les cartes étaient distribuées sans autre mise.'],
  ['EV (espérance)', 'Gain moyen d’une décision si elle était répétée un grand nombre de fois. Une bonne décision a une EV positive.'],
  ['Kicker', 'Carte d’accompagnement qui départage deux mains de même combinaison (paire d’As kicker Roi contre kicker Dame).'],
  ['Limp', 'Se contenter de payer la grosse blind préflop au lieu de relancer.'],
  ['Nuts', 'La meilleure main possible sur un board donné (« le jeu max »).'],
  ['Outs', 'Cartes encore dans le paquet qui amélioreraient votre main, en général jusqu’à la main gagnante.'],
  ['Overcard', 'Carte privative plus haute que toutes les cartes du board.'],
  ['PFR', 'Pourcentage de mains relancées préflop. Avec le VPIP, il décrit le style d’un joueur.'],
  ['Position', 'Ordre de parole. Parler en dernier (« en position ») donne un avantage d’information.'],
  ['Range', 'Ensemble des mains qu’un joueur peut avoir dans une situation donnée.'],
  ['Set', 'Brelan formé avec une paire servie et une carte du board, plus difficile à repérer qu’un brelan avec une paire au board.'],
  ['Tapis (all-in)', 'Mettre tous ses jetons au milieu. Un joueur à tapis ne peut plus être forcé à se coucher.'],
  ['Tilt', 'Perte de lucidité après un coup malheureux, qui pousse à jouer trop de mains ou à payer trop.'],
  ['Value bet', 'Mise faite pour être payée par des mains moins fortes que la vôtre.'],
  ['VPIP', 'Pourcentage de mains où le joueur met volontairement des jetons préflop (hors blinds obligatoires).'],
];

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

function P({ children }: { children: React.ReactNode }) {
  return (
    <Text as="p" size="3">
      {children}
    </Text>
  );
}

export function Learn() {
  return (
    <div className="page learn">
      <header className="page-head">
        <Text size="2" color="gray">
          Leçons
        </Text>
        <Heading size="8">Apprendre le Hold’em</Heading>
        <Text as="p" size="3" color="gray" className="lede">
          L’essentiel pour comprendre chaque décision : règles, combinaisons, position et mathématiques du pot.
        </Text>
      </header>
      <Tabs.Root defaultValue="regles">
        <Tabs.List className="learn__tabs">
          <Tabs.Trigger value="regles">Règles</Tabs.Trigger>
          <Tabs.Trigger value="mains">Combinaisons</Tabs.Trigger>
          <Tabs.Trigger value="positions">Positions</Tabs.Trigger>
          <Tabs.Trigger value="cotes">Cotes et outs</Tabs.Trigger>
          <Tabs.Trigger value="strategie">Stratégie</Tabs.Trigger>
          <Tabs.Trigger value="glossaire">Glossaire</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="regles">
          <article className="prose">
            <Heading size="5" as="h2">
              Déroulé d’une main
            </Heading>
            <ol className="steps-list">
              <li>
                <Text size="3">
                  <strong>Blinds.</strong> Les deux joueurs à gauche du bouton posent la petite blind (½ BB) et la grosse blind (1 BB).
                </Text>
              </li>
              <li>
                <Text size="3">
                  <strong>Préflop.</strong> Chacun reçoit deux cartes privatives. Le joueur à gauche de la grosse blind parle en premier.
                </Text>
              </li>
              <li>
                <Text size="3">
                  <strong>Flop.</strong> Trois cartes communes sont retournées. Nouveau tour d’enchères, en commençant par le premier joueur
                  actif à gauche du bouton.
                </Text>
              </li>
              <li>
                <Text size="3">
                  <strong>Turn.</strong> Une quatrième carte commune, puis un tour d’enchères.
                </Text>
              </li>
              <li>
                <Text size="3">
                  <strong>River.</strong> La cinquième carte commune, puis le dernier tour d’enchères.
                </Text>
              </li>
              <li>
                <Text size="3">
                  <strong>Abattage.</strong> Les joueurs restants montrent leurs cartes. Chacun forme la meilleure main de cinq cartes parmi
                  ses deux cartes et les cinq du board.
                </Text>
              </li>
            </ol>
            <Heading size="5" as="h2">
              Les actions
            </Heading>
            <DataList.Root size="3" orientation={{ initial: 'vertical', sm: 'horizontal' }}>
              <DataList.Item>
                <DataList.Label minWidth="140px">Se coucher</DataList.Label>
                <DataList.Value>Abandonner la main et les jetons déjà misés.</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="140px">Checker</DataList.Label>
                <DataList.Value>Passer la parole sans miser, possible seulement si personne n’a misé sur ce tour.</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="140px">Suivre</DataList.Label>
                <DataList.Value>Payer la mise en cours.</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="140px">Miser, relancer</DataList.Label>
                <DataList.Value>
                  Augmenter la mise. En No-Limit, une relance doit être au moins égale à la relance précédente : face à une mise de 3 BB
                  portée à 9 BB (+6), la relance suivante est d’au moins 15 BB.
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="140px">Tapis</DataList.Label>
                <DataList.Value>
                  Miser tous ses jetons. Un joueur à tapis ne peut gagner que la part du pot qu’il a pu couvrir : le reste forme un pot
                  annexe entre les autres joueurs.
                </DataList.Value>
              </DataList.Item>
            </DataList.Root>
            <P>En tête-à-tête, le bouton pose la petite blind, parle en premier préflop puis en dernier sur les tours suivants.</P>
          </article>
        </Tabs.Content>

        <Tabs.Content value="mains">
          <article className="prose">
            <Heading size="5" as="h2">
              Classement des combinaisons
            </Heading>
            <P>De la plus forte à la plus faible, avec la probabilité de la toucher sur sept cartes.</P>
            <ol className="hand-ranks">
              {HANDS.map((h) => (
                <li key={h.name}>
                  <Card size="2">
                    <div className="hand-ranks__row">
                      <CardRow cards={parseCards(h.cards)} size="sm" />
                      <div>
                        <Text as="p" size="3" weight="bold">
                          {h.name}
                        </Text>
                        <Text as="p" size="2" color="gray">
                          {h.text}
                        </Text>
                      </div>
                      <span className="hand-ranks__p">{h.p}</span>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
            <Text as="p" size="2" color="gray">
              Les couleurs (pique, cœur, carreau, trèfle) ont toutes la même valeur et ne départagent jamais.
            </Text>
          </article>
        </Tabs.Content>

        <Tabs.Content value="positions">
          <article className="prose">
            <Heading size="5" as="h2">
              Pourquoi la position compte
            </Heading>
            <P>
              Après le flop, le joueur le plus proche à gauche du bouton parle en premier et le bouton parle en dernier. Parler après ses
              adversaires permet de voir leur action avant de décider : c’est pourquoi on joue plus de mains au bouton qu’en début de
              parole.
            </P>
            <div className="positions">
              <div className="positions__felt">
                <PositionRing hero="CO" />
              </div>
              <DataList.Root size="2" orientation="vertical">
                {(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as Position[]).map((p) => (
                  <DataList.Item key={p}>
                    <DataList.Label>
                      {p} · {POSITION_INFO[p].name}
                    </DataList.Label>
                    <DataList.Value>{POSITION_INFO[p].detail}</DataList.Value>
                  </DataList.Item>
                ))}
              </DataList.Root>
            </div>
            <P>
              Retrouvez les ranges d’ouverture conseillées dans <Link href="#ranges">Tableaux de ranges</Link> et entraînez-vous avec{' '}
              <Link href="#quiz-preflop">l’exercice préflop</Link>.
            </P>
          </article>
        </Tabs.Content>

        <Tabs.Content value="cotes">
          <article className="prose">
            <Heading size="5" as="h2">
              Cotes du pot
            </Heading>
            <P>
              Pour savoir si suivre est rentable, comparez votre équité à l’équité requise :{' '}
              <strong>équité requise = mise à payer ÷ (pot + mise adverse + votre call)</strong>.
            </P>
            <P>Exemple : le pot fait 10 BB et l’adversaire mise 5 BB. Vous payez 5 pour un pot final de 20 : il vous faut 25 % d’équité.</P>
            <Card size="1" className="table-card">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Mise adverse</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Équité requise pour suivre</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {BET_ROWS.map((r) => (
                    <Table.Row key={r.label}>
                      <Table.RowHeaderCell>{r.label}</Table.RowHeaderCell>
                      <Table.Cell>{pct(r.f / (1 + 2 * r.f))}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
            <Heading size="5" as="h2">
              Outs et règle du 2 et du 4
            </Heading>
            <P>
              Multipliez vos outs par 2 pour estimer la probabilité de toucher à la carte suivante, par 4 pour deux cartes (du flop à la
              river, si vous êtes à tapis). La règle surestime un peu au-delà de 8 outs avec deux cartes.
            </P>
            <Card size="1" className="table-card">
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Tirage</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Outs</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Une carte</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Deux cartes</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {OUTS_ROWS.map((r) => (
                    <Table.Row key={r.draw}>
                      <Table.RowHeaderCell>{r.draw}</Table.RowHeaderCell>
                      <Table.Cell>{r.outs}</Table.Cell>
                      <Table.Cell>{pct(hitProbability(r.outs, 46, 1))}</Table.Cell>
                      <Table.Cell>{pct(hitProbability(r.outs, 47, 2))}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
            <P>
              Mettez-le en pratique avec les exercices <Link href="#quiz-outs">Compter ses outs</Link> et{' '}
              <Link href="#quiz-cotes">Cotes du pot</Link>.
            </P>
          </article>
        </Tabs.Content>

        <Tabs.Content value="strategie">
          <article className="prose">
            <Heading size="5" as="h2">
              Les principes qui rapportent
            </Heading>
            <ol className="steps-list">
              {[
                ['Jouez serré, jouez agressif.', 'Moins de mains, mais jouées en relançant. Une relance gagne de deux façons : l’adversaire se couche, ou vous avez la meilleure main.'],
                ['Ouvrez par une relance, pas un limp.', 'Personne n’a relancé ? Relancez à 2,5 BB ou couchez-vous.'],
                ['Respectez la position.', 'Élargissez vos ranges vers le bouton, resserrez-les en début de parole et depuis la petite blind.'],
                ['Misez pour la valeur.', 'Avec une main forte, misez pour être payé par moins bien, surtout contre les joueurs qui suivent trop.'],
                ['Payez avec les bonnes cotes.', 'Un tirage vaut un call quand votre équité dépasse le prix ; sinon, couchez-vous.'],
                ['Adaptez-vous à l’adversaire.', 'Bluffez les joueurs prudents, pas les stations. Payez plus léger contre les agressifs.'],
                ['Jugez la décision, pas le résultat.', 'Une bonne décision peut perdre une main. Sur des milliers de mains, ce sont les décisions qui comptent.'],
              ].map(([t, d]) => (
                <li key={t}>
                  <Text size="3">
                    <strong>{t}</strong> {d}
                  </Text>
                </li>
              ))}
            </ol>
            <Heading size="5" as="h2">
              Les profils de la table
            </Heading>
            <DataList.Root size="3" orientation={{ initial: 'vertical', sm: 'horizontal' }}>
              <DataList.Item>
                <DataList.Label minWidth="200px">Roc · serré-passif</DataList.Label>
                <DataList.Value>Ses mises signifient presque toujours une main forte : couchez vos mains moyennes face à lui.</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="200px">Régulier · serré-agressif</DataList.Label>
                <DataList.Value>Le style de référence. Il c-bet souvent : ne lâchez pas tous vos flops ratés.</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="200px">Agressif · large-agressif</DataList.Label>
                <DataList.Value>Relance et bluffe beaucoup : laissez-le miser avec vos bonnes mains et payez plus large.</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="200px">Station · large-passif</DataList.Label>
                <DataList.Value>Paye trop : misez gros pour la valeur, ne bluffez presque jamais.</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </article>
        </Tabs.Content>

        <Tabs.Content value="glossaire">
          <article className="prose prose--wide">
            <Heading size="5" as="h2">
              Glossaire
            </Heading>
            <div className="glossary">
              {GLOSSARY.map(([t, d]) => (
                <div key={t}>
                  <Text as="p" size="3" weight="bold">
                    {t}
                  </Text>
                  <Text as="p" size="2" color="gray">
                    {d}
                  </Text>
                </div>
              ))}
            </div>
          </article>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
