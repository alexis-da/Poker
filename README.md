# Coach Hold’em

Application web d’entraînement au **Texas Hold’em No-Limit** (6-max), entièrement en français.
Elle fonctionne dans le navigateur, sans serveur ni compte : les statistiques sont enregistrées sur l’appareil.

## Fonctionnalités

**Jouer** — une table de 2 à 6 joueurs contre des bots aux styles marqués :

| Profil | Style | Comment le battre |
| --- | --- | --- |
| Roc | serré-passif | ses mises signifient une main forte |
| Régulier | serré-agressif | adversaire de référence, c-bet souvent |
| Agressif | large-agressif | payez plus léger, laissez-le bluffer |
| Station | large-passif | misez pour la valeur, ne le bluffez pas |

Le **coach** analyse chaque décision : équité (Monte Carlo), cotes du pot, outs et règle du 2/4,
ranges d’ouverture préflop. Trois modes : conseils visibles, correction après coup, désactivé.
Chaque action est notée *bon / discutable / erreur* avec une explication.
Règles complètes : blinds, relance minimale, tapis partiels, pots annexes, mises non suivies rendues.

**Exercices** (questions illimitées, corrigées et expliquées)
1. Ranges d’ouverture par position
2. Compter ses outs (tirages quinte et couleur)
3. Cotes du pot : suivre ou se coucher
4. Quelle main gagne ? (lecture d’abattage, kickers, partages)
5. Estimer l’équité de duels classiques

**Outils** — calculateur d’équité (2 à 6 joueurs, cartes, ranges ou mains aléatoires, calcul exact
au flop et après) et tableaux de ranges 13 × 13 avec éditeur de range.

**Leçons** — règles, classement des combinaisons avec probabilités, positions, cotes et outs,
principes de stratégie, glossaire.

**Statistiques** — mains jouées, gain net et BB/100, VPIP, PFR, courbe de gains, qualité des
décisions selon le coach, réussite par exercice.

## Interface

L’interface est construite avec des bibliothèques conçues par des designers :

- **[Radix Themes](https://www.radix-ui.com/themes)** (MIT) pour tous les composants d’interface :
  onglets, boutons, cartes, curseur, contrôles segmentés, listes de données, tableaux.
  Thème clair, accent vert « grass », gris « sand », grands arrondis ; icônes Radix Icons.
- **[React Bits](https://github.com/DavidHDev/react-bits)** (MIT + Commons Clause) pour quelques effets,
  copiés dans `src/components/reactbits/` avec leur licence : `SpotlightCard` (panneau du coach),
  `StarBorder` (bouton conseillé), `Counter` (chiffres à rouleaux), `GlareHover` (reflet sur les cartes).
  Les composants peuvent être utilisés librement dans l’application, mais pas revendus seuls.
- Polices **Geist** et **Geist Mono** (Google Fonts).
- **Mode sombre** : menu en haut à droite (thème du système, clair ou sombre). En mode « système »,
  l’application suit le réglage de l’appareil, ou celui de la page qui l’héberge (`data-theme` sur `<html>`).

L’écran de jeu garde les codes de lisibilité des salles en ligne : cartes à gros index en 4 couleurs,
tapis en gros chiffres, mises devant chaque joueur, barre de temps sous le joueur qui parle, gros boutons
d’action. Sur téléphone, la table et la console d’action tiennent sur un seul écran.

Deux styles de cartes (réglage à la table) :
- **Gros index** (par défaut), dessinées par l’application, avec ou sans jeu 4 couleurs ;
- **Illustrées** : « Vectorized Playing Cards 1.3 » de Chris Aguilar, sous licence
  **LGPL-3.0**, récupérées via le paquet npm `cardsJS`. Les fichiers SVG sont dans
  `public/cards/` avec leur licence (`COPYING.LESSER.txt`, `COPYING.txt`, `README.txt`) ;
  seules les métadonnées Inkscape ont été retirées et un `viewBox` ajouté.

## Démarrer

```bash
npm install
npm run dev          # serveur de développement (http://localhost:5173)
npm test             # tests du moteur (Vitest)
npm run build        # application de production dans dist/
npm run build:single # une seule page HTML autonome dans dist-artifact/coach-holdem.html
```

Raccourcis à la table : `F` se coucher, `C` checker / suivre, `R` relancer, `Espace` main suivante.

## Organisation du code

```
src/engine/      moteur pur, testé
  cards.ts         cartes (entiers 0–51) et libellés français
  evaluator.ts     évaluateur 5 à 7 cartes, descriptions (« Full aux Rois par les Sept »)
  equity.ts        équité exacte ou Monte Carlo, mains connues / ranges / aléatoires
  ranges.ts        notation des ranges (« 22+, A2s+, KTs+ »), grille 13 × 13
  game.ts          déroulé d’une main de NLHE (enchères, tapis, pots annexes, abattage)
  bot.ts           décisions des bots selon leur profil
  coach.ts         conseils et notation des décisions du joueur
  outs.ts          outs, probabilités, règle du 2 et du 4
src/data/        ranges d’ouverture 6-max et table d’équité préflop (169 mains × 1 à 5 adversaires)
src/trainers/    générateurs de questions des exercices
src/views/       écrans (React)
src/store/       statistiques et réglages (localStorage)
tests/           tests unitaires et simulations de milliers de mains
scripts/         génération de la table préflop, build en page unique
```

La table `src/data/preflopEquity.ts` se régénère avec `npm run gen:preflop`.

## Limites assumées

- Les ranges d’ouverture sont des repères simplifiés inspirés des solveurs (6-max, 100 BB), pas une stratégie optimale.
- L’équité affichée par le coach est calculée contre des mains aléatoires, puis ajustée face aux mises ; c’est un repère pédagogique, pas une lecture de l’adversaire.
- Les bots suivent des heuristiques (ranges, équité, cotes, agressivité) : ils ne s’adaptent pas à votre jeu.
