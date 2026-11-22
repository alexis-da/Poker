import { useState } from 'react';
import { CardRow } from '../components/PlayingCard';
import { POSITION_INFO, type Position } from '../data/charts';
import { parseCards } from '../engine/cards';
import { hitProbability } from '../engine/outs';
import { PositionRing } from './training/PreflopQuiz';

type Section = 'regles' | 'mains' | 'positions' | 'cotes' | 'strategie' | 'glossaire';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'regles', label: 'Règles' },
  { id: 'mains', label: 'Combinaisons' },
  { id: 'positions', label: 'Positions' },
  { id: 'cotes', label: 'Cotes et outs' },
  { id: 'strategie', label: 'Stratégie' },
  { id: 'glossaire', label: 'Glossaire' },
];

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

export function Learn() {
  const [section, setSection] = useState<Section>('regles');
  return (
    <div className="page learn">
      <header className="page-head">
        <p className="eyebrow">Leçons</p>
        <h1>Apprendre le Hold’em</h1>
        <p className="lede">L’essentiel pour comprendre chaque décision : règles, combinaisons, position et mathématiques du pot.</p>
      </header>
      <div className="chip-row" role="tablist" aria-label="Chapitres">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className={`chip-btn ${section === s.id ? 'chip-btn--on' : ''}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'regles' && (
        <article className="prose">
          <h2>Déroulé d’une main</h2>
          <ol className="timeline">
            <li>
              <strong>Blinds.</strong> Les deux joueurs à gauche du bouton posent la petite blind (½ BB) et la grosse blind (1 BB).
            </li>
            <li>
              <strong>Préflop.</strong> Chacun reçoit deux cartes privatives. Le joueur à gauche de la grosse blind parle en premier.
            </li>
            <li>
              <strong>Flop.</strong> Trois cartes communes sont retournées. Nouveau tour d’enchères, en commençant par le premier
              joueur actif à gauche du bouton.
            </li>
            <li>
              <strong>Turn.</strong> Une quatrième carte commune, puis un tour d’enchères.
            </li>
            <li>
              <strong>River.</strong> La cinquième carte commune, puis le dernier tour d’enchères.
            </li>
            <li>
              <strong>Abattage.</strong> Les joueurs restants montrent leurs cartes. Chacun forme la meilleure main de cinq cartes
              parmi ses deux cartes et les cinq du board.
            </li>
          </ol>
          <h2>Les actions</h2>
          <dl className="defs">
            <div>
              <dt>Se coucher</dt>
              <dd>Abandonner la main et les jetons déjà misés.</dd>
            </div>
            <div>
              <dt>Checker</dt>
              <dd>Passer la parole sans miser, possible seulement si personne n’a misé sur ce tour.</dd>
            </div>
            <div>
              <dt>Suivre</dt>
              <dd>Payer la mise en cours.</dd>
            </div>
            <div>
              <dt>Miser / relancer</dt>
              <dd>
                Augmenter la mise. En No-Limit, une relance doit être au moins égale à la relance précédente : face à une mise de 3 BB
                portée à 9 BB (+6), la relance suivante est d’au moins 15 BB.
              </dd>
            </div>
            <div>
              <dt>Tapis</dt>
              <dd>
                Miser tous ses jetons. Un joueur à tapis ne peut gagner que la part du pot qu’il a pu couvrir : le reste forme un pot
                annexe entre les autres joueurs.
              </dd>
            </div>
          </dl>
          <p>
            En tête-à-tête, le bouton pose la petite blind, parle en premier préflop puis en dernier sur les tours suivants.
          </p>
        </article>
      )}

      {section === 'mains' && (
        <article className="prose">
          <h2>Classement des combinaisons</h2>
          <p>De la plus forte à la plus faible, avec la probabilité de la toucher sur sept cartes.</p>
          <ol className="hand-ranks">
            {HANDS.map((h) => (
              <li key={h.name}>
                <CardRow cards={parseCards(h.cards)} size="sm" />
                <div>
                  <strong>{h.name}</strong>
                  <span>{h.text}</span>
                </div>
                <span className="hand-ranks__p">{h.p}</span>
              </li>
            ))}
          </ol>
          <p className="muted">Les couleurs (pique, cœur, carreau, trèfle) ont toutes la même valeur et ne départagent jamais.</p>
        </article>
      )}

      {section === 'positions' && (
        <article className="prose">
          <h2>Pourquoi la position compte</h2>
          <p>
            Après le flop, le joueur le plus proche à gauche du bouton parle en premier et le bouton parle en dernier. Parler après
            ses adversaires permet de voir leur action avant de décider : c’est pourquoi on joue plus de mains au bouton qu’en début
            de parole.
          </p>
          <div className="positions">
            <PositionRing hero="CO" />
            <dl className="defs">
              {(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as Position[]).map((p) => (
                <div key={p}>
                  <dt>
                    {p} · {POSITION_INFO[p].name}
                  </dt>
                  <dd>{POSITION_INFO[p].detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p>
            Retrouvez les ranges d’ouverture conseillées dans <a href="#ranges">Tableaux de ranges</a> et entraînez-vous avec{' '}
            <a href="#quiz-preflop">l’exercice préflop</a>.
          </p>
        </article>
      )}

      {section === 'cotes' && (
        <article className="prose">
          <h2>Cotes du pot</h2>
          <p>
            Pour savoir si suivre est rentable, comparez votre équité à l’équité requise :
            <br />
            <strong>équité requise = mise à payer ÷ (pot + mise adverse + votre call)</strong>.
          </p>
          <p>
            Exemple : le pot fait 10 BB et l’adversaire mise 5 BB. Vous payez 5 pour un pot final de 20 : il vous faut 25 %
            d’équité.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taille de la mise adverse</th>
                  <th>Équité requise pour suivre</th>
                </tr>
              </thead>
              <tbody>
                {BET_ROWS.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{pct(r.f / (1 + 2 * r.f))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Outs et règle du 2 et du 4</h2>
          <p>
            Multipliez vos outs par 2 pour estimer la probabilité de toucher à la carte suivante, par 4 pour deux cartes (du flop à la
            river, si vous êtes à tapis). La règle surestime un peu au-delà de 8 outs avec deux cartes.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tirage</th>
                  <th>Outs</th>
                  <th>Une carte (turn → river)</th>
                  <th>Deux cartes (flop → river)</th>
                </tr>
              </thead>
              <tbody>
                {OUTS_ROWS.map((r) => (
                  <tr key={r.draw}>
                    <td>{r.draw}</td>
                    <td>{r.outs}</td>
                    <td>{pct(hitProbability(r.outs, 46, 1))}</td>
                    <td>{pct(hitProbability(r.outs, 47, 2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Mettez-le en pratique avec les exercices <a href="#quiz-outs">Compter ses outs</a> et{' '}
            <a href="#quiz-cotes">Cotes du pot</a>.
          </p>
        </article>
      )}

      {section === 'strategie' && (
        <article className="prose">
          <h2>Les principes qui rapportent</h2>
          <ol className="principles">
            <li>
              <strong>Jouez serré, jouez agressif.</strong> Moins de mains, mais jouées en relançant. Une relance gagne de deux façons
              : l’adversaire se couche, ou vous avez la meilleure main.
            </li>
            <li>
              <strong>Ouvrez par une relance, pas un limp.</strong> Personne n’a relancé ? Relancez à 2,5 BB ou couchez-vous.
            </li>
            <li>
              <strong>Respectez la position.</strong> Élargissez vos ranges vers le bouton, resserrez-les en début de parole et depuis
              la petite blind.
            </li>
            <li>
              <strong>Misez pour la valeur.</strong> Avec une main forte, misez pour être payé par moins bien, surtout contre les
              joueurs qui suivent trop.
            </li>
            <li>
              <strong>Payez avec les bonnes cotes.</strong> Un tirage vaut un call quand votre équité dépasse le prix ; sinon,
              couchez-vous.
            </li>
            <li>
              <strong>Adaptez-vous à l’adversaire.</strong> Bluffez les joueurs prudents, pas les stations. Payez plus léger contre les
              agressifs.
            </li>
            <li>
              <strong>Jugez la décision, pas le résultat.</strong> Une bonne décision peut perdre une main. Sur des milliers de mains,
              ce sont les décisions qui comptent.
            </li>
          </ol>
          <h2>Les profils de la table</h2>
          <dl className="defs">
            <div>
              <dt>Roc (serré-passif)</dt>
              <dd>Ses mises signifient presque toujours une main forte : couchez vos mains moyennes face à lui.</dd>
            </div>
            <div>
              <dt>Régulier (serré-agressif)</dt>
              <dd>Le style de référence. C-bet souvent : ne lâchez pas tous vos flops ratés.</dd>
            </div>
            <div>
              <dt>Agressif (large-agressif)</dt>
              <dd>Relance et bluffe beaucoup : laissez-le miser avec vos bonnes mains et payez plus large.</dd>
            </div>
            <div>
              <dt>Station (large-passif)</dt>
              <dd>Paye trop : misez gros pour la valeur, ne bluffez presque jamais.</dd>
            </div>
          </dl>
        </article>
      )}

      {section === 'glossaire' && (
        <article className="prose">
          <h2>Glossaire</h2>
          <dl className="defs defs--glossary">
            {GLOSSARY.map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}
    </div>
  );
}
