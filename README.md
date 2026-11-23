# Coach Hold’em

Application web d’entraînement au **Texas Hold’em No-Limit** (6-max), entièrement en français.
Elle fonctionne dans le navigateur, sans serveur ni compte : les statistiques et l’historique d’entraînement
sont enregistrés sur l’appareil (ou dans votre compte claude.ai quand l’application y est publiée).

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
Parties à élimination, sans recave : un joueur sans jetons quitte la table, et la partie se termine
quand vous n’avez plus de jetons (avec votre place) ou quand vous les avez tous remportés.

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
décisions selon le coach, réussite par exercice, points faibles et erreurs récentes.

**Recommandations** — chaque réponse aux exercices et chaque décision jugée par le coach est enregistrée
dans une petite base de données (compétence, juste/discutable/erreur, variante, date). L’application en
tire les exercices à faire en priorité :

- le score d’une compétence combine son taux d’erreur sur 30 jours, la récence (une erreur perd la moitié
  de son poids en 7 jours) et le nombre d’essais (une erreur isolée ne suffit pas) ;
- quand les erreurs se concentrent sur une variante (UTG, tirages ventraux, kickers, tapis…), l’exercice
  s’ouvre **ciblé** sur cette variante, avec un bandeau « Entraînement ciblé » pour revenir au mélange ;
- les décisions en partie sont classées par situation : ouverture préflop, défense face à une relance,
  cotes du pot face à une mise, mises de valeur et bluffs ;
- les compétences jamais travaillées sont proposées en « À découvrir ».

Les recommandations apparaissent sur l’accueil, en tête des exercices, dans les statistiques
(« Points faibles ») et sous le commentaire du coach après une erreur à la table.

Stockage : IndexedDB du navigateur via [Dexie](https://dexie.org) (Apache-2.0), 120 jours conservés.
Dans la version publiée sur claude.ai, l’historique va dans la base privée de votre compte
(`data/users/<id>`, visible de vous seul), regroupé en un document par jour et par appareil, et
l’historique local existant y est importé à la première ouverture. Il s’efface depuis les statistiques.

## Jeu en ligne

**En ligne** (bouton sur l’accueil et l’écran Jouer) : tables privées de 2 à 6 joueurs avec un code de
5 caractères ou un lien à partager, places libres complétées par des bots si l’hôte le souhaite,
100 BB de départ, parties à élimination, classement final et « Rejouer » pour l’hôte. Chacun se voit
en bas de la table ; le coach et l’enregistrement des erreurs fonctionnent aussi en ligne.

Fonctionnement (Supabase) :

- **Connexion** anonyme avec un simple pseudo (session conservée dans le navigateur, on retrouve sa
  place en rouvrant le lien).
- **Le serveur fait foi** : la fonction `supabase/functions/table` (Deno) mélange avec un tirage
  cryptographique, distribue, valide chaque action et fait jouer les bots. Elle réutilise le moteur
  de l’application (`src/online/service.ts` et `logic.ts`, regroupés dans `service.js` par
  `npm run build:server`).
- **Personne ne voit les cartes des autres** : la base garde l’état complet dans `room_secrets`
  (illisible par les joueurs), publie une vue sans cartes cachées dans `rooms.public`, et chaque joueur
  ne peut lire que sa ligne de `room_hands` (règles d’accès par ligne).
- **Temps réel** : les navigateurs suivent `rooms` et `room_hands` (Supabase Realtime). Les étapes
  automatiques (action d’un bot, 30 s écoulées, main suivante après 5 s) sont demandées par les
  navigateurs présents ; le serveur ne les applique qu’une fois et qu’à leur heure (numéro de version).
- Un joueur qui quitte la table, ou laisse passer deux fois son temps, est joué automatiquement
  (check ou passe) jusqu’à son retour. Les tables inactives depuis 2 jours sont supprimées.

Mise en place d’un projet Supabase :

1. Appliquer `supabase/migrations/20261123100000_jeu_en_ligne.sql` (éditeur SQL ou `supabase db push`).
2. Activer les connexions anonymes (Authentication → Sign In / Providers → Anonymous).
3. Déployer la fonction : `npm run build:server && npx supabase functions deploy table --project-ref <ref>`.
4. Renseigner l’URL du projet et la clé publique `anon` dans `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` (fichier `.env` ou variables du projet Vercel). Ces deux valeurs sont
   publiques : la sécurité repose sur les règles d’accès de la base.

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
d’action. L’écran de jeu tient dans la fenêtre sans défilement : la table, ovale au format 2 : 1, occupe
toute la largeur disponible (jusqu’à 1720 px de page sur grand écran), les joueurs se réduisent avec elle,
et la console d’action reste visible sous la table, de l’écran 1280 × 720 au téléphone. Les mises sont
posées après chaque rendu à l’endroit libre le plus proche de leur joueur, sans recouvrir sièges,
étiquettes, pot ni tableau.

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
src/training/    historique d’entraînement (Dexie ou base du compte) et recommandations
src/online/      jeu en ligne : règles de table, service, client Supabase, suivi en temps réel
supabase/        schéma de la base et fonction « table » (serveur de jeu)
tests/           tests unitaires et simulations de milliers de mains
scripts/         génération de la table préflop, build en page unique
```

La table `src/data/preflopEquity.ts` se régénère avec `npm run gen:preflop`.

## Limites assumées

- Les ranges d’ouverture sont des repères simplifiés inspirés des solveurs (6-max, 100 BB), pas une stratégie optimale.
- L’équité affichée par le coach est calculée contre des mains aléatoires, puis ajustée face aux mises ; c’est un repère pédagogique, pas une lecture de l’adversaire.
- Les bots suivent des heuristiques (ranges, équité, cotes, agressivité) : ils ne s’adaptent pas à votre jeu.
