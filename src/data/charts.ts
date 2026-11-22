import { ALL_CLASSES, comboCount, parseRange, type HandClass } from '../engine/ranges';
import { PREFLOP_EQUITY } from './preflopEquity';

/** Positions d'une table 6-max, dans l'ordre de parole préflop. */
export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const POSITION_INFO: Record<Position, { name: string; short: string; detail: string }> = {
  UTG: {
    name: 'Under the Gun',
    short: 'UTG',
    detail: 'Premier à parler préflop. Cinq joueurs parlent après vous : ouvrez serré.',
  },
  HJ: {
    name: 'Hijack',
    short: 'HJ',
    detail: 'Deux places avant le bouton. Un peu plus large que UTG.',
  },
  CO: {
    name: 'Cutoff',
    short: 'CO',
    detail: 'Juste avant le bouton. Position forte : on ouvre plus d’un quart des mains.',
  },
  BTN: {
    name: 'Bouton',
    short: 'BTN',
    detail: 'Meilleure place : vous parlez en dernier après le flop. Ouvrez large.',
  },
  SB: {
    name: 'Petite blind',
    short: 'SB',
    detail: 'Déjà ½ BB investie, mais vous serez hors de position après le flop.',
  },
  BB: {
    name: 'Grosse blind',
    short: 'BB',
    detail: 'Dernier à parler préflop. Défend large grâce au prix réduit.',
  },
};

/**
 * Ranges d'ouverture (« raise first in ») simplifiées pour le 6-max à 100 BB,
 * inspirées des sorties de solveurs. Elles servent de repère d'entraînement,
 * pas de vérité absolue.
 */
export const RFI_RANGES: Record<Exclude<Position, 'BB'>, string> = {
  UTG: '22+, A2s+, K9s+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  HJ: '22+, A2s+, K8s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, ATo+, KJo+, QJo',
  CO: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo',
  BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o',
  SB: '22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o',
};

export const RFI_SETS: Record<Exclude<Position, 'BB'>, Set<HandClass>> = {
  UTG: parseRange(RFI_RANGES.UTG),
  HJ: parseRange(RFI_RANGES.HJ),
  CO: parseRange(RFI_RANGES.CO),
  BTN: parseRange(RFI_RANGES.BTN),
  SB: parseRange(RFI_RANGES.SB),
};

/** Les 169 mains triées de la plus forte à la plus faible (équité contre une main aléatoire). */
export const HANDS_BY_STRENGTH: HandClass[] = ALL_CLASSES.slice().sort(
  (a, b) => PREFLOP_EQUITY[b][0] - PREFLOP_EQUITY[a][0],
);

/**
 * Pour chaque main : pourcentage cumulé des combinaisons au moins aussi fortes.
 * AA ≈ 0,45 % (top 0,45 % des mains), 72o ≈ 100 %.
 */
export const HAND_TOP_PERCENT: Record<HandClass, number> = (() => {
  const out: Record<HandClass, number> = {};
  let cum = 0;
  for (const hc of HANDS_BY_STRENGTH) {
    cum += comboCount(hc);
    out[hc] = (cum / 1326) * 100;
  }
  return out;
})();

/** Équité préflop contre n adversaires aléatoires (1 à 5). */
export function preflopEquity(hc: HandClass, opponents: number): number {
  const i = Math.min(5, Math.max(1, opponents)) - 1;
  return PREFLOP_EQUITY[hc][i];
}
