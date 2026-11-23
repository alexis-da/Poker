/**
 * Modèle de l'historique d'entraînement : chaque réponse aux exercices et chaque décision
 * jugée par le coach devient un événement rattaché à une compétence.
 */

export type SkillId = 'preflop-open' | 'preflop-defense' | 'pot-odds' | 'outs' | 'showdown' | 'equity' | 'value';

/** Exercice ciblé : quel exercice ouvrir et sur quelle variante. */
export type FocusQuiz = 'preflop' | 'outs' | 'potodds' | 'winner' | 'equity';

export interface Focus {
  quiz: FocusQuiz;
  /** Variante : position (UTG…), type de tirage, « tapis », « kicker », « flop »… */
  value: string;
}

export interface TrainingEvent {
  /** Horodatage (ms). */
  t: number;
  src: 'quiz' | 'jeu';
  skill: SkillId;
  /** 1 = juste / bonne décision, 0,5 = discutable, 0 = erreur. */
  ok: 0 | 0.5 | 1;
  /** Détail servant à cibler l'exercice (position, type de tirage…). */
  tag?: string;
  /** Résumé lisible de l'erreur. */
  note?: string;
}

export interface SkillInfo {
  label: string;
  /** Page à ouvrir pour travailler la compétence. */
  route: string;
  action: string;
  quiz?: FocusQuiz;
}

export const SKILLS: Record<SkillId, SkillInfo> = {
  'preflop-open': { label: 'Ouvertures préflop', route: 'quiz-preflop', action: 'Exercice : ranges d’ouverture', quiz: 'preflop' },
  'preflop-defense': { label: 'Défense face à une relance', route: 'ranges', action: 'Revoir les tableaux de ranges' },
  'pot-odds': { label: 'Cotes du pot', route: 'quiz-cotes', action: 'Exercice : cotes du pot', quiz: 'potodds' },
  outs: { label: 'Compter ses outs', route: 'quiz-outs', action: 'Exercice : compter ses outs', quiz: 'outs' },
  showdown: { label: 'Lecture d’abattage', route: 'quiz-gagnant', action: 'Exercice : quelle main gagne ?', quiz: 'winner' },
  equity: { label: 'Équité des duels', route: 'quiz-equite', action: 'Exercice : estimer l’équité', quiz: 'equity' },
  value: { label: 'Mises de valeur et bluffs', route: 'apprendre', action: 'Relire la leçon Stratégie' },
};

/** Libellés des variantes ciblables, pour l'affichage. */
export const TAG_LABELS: Record<string, string> = {
  UTG: 'en UTG',
  HJ: 'en HJ',
  CO: 'au cutoff',
  BTN: 'au bouton',
  SB: 'en petite blind',
  BB: 'en grosse blind',
  couleur: 'les tirages couleur',
  'quinte-ouverte': 'les quintes par les deux bouts',
  ventrale: 'les quintes ventrales',
  combo: 'les doubles tirages',
  tapis: 'face à un tapis',
  'une-carte': 'avec une carte à venir',
  kicker: 'les kickers',
  partage: 'les partages',
  categorie: 'le classement des combinaisons',
  preflop: 'les duels préflop',
  flop: 'les duels au flop',
  tirage: 'avec un tirage',
  'main-faite': 'avec une main faite',
  passif: 'quand il fallait miser',
  bluff: 'les bluffs',
};

/** Variantes que chaque exercice sait cibler. */
export const FOCUSABLE: Record<FocusQuiz, string[]> = {
  preflop: ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
  outs: ['couleur', 'quinte-ouverte', 'ventrale', 'combo'],
  potodds: ['tapis', 'une-carte'],
  winner: ['kicker', 'partage', 'categorie'],
  equity: ['preflop', 'flop'],
};
