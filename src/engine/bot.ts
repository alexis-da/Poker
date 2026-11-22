import { HAND_TOP_PERCENT, RFI_SETS, type Position } from '../data/charts';
import { equityVsRandom } from './equity';
import { getLegalActions, potTotal, type Action, type GameState } from './game';
import { defaultRng, type Rng } from './random';
import { handClassOf } from './ranges';

/**
 * Bots : préflop, ils s'appuient sur les ranges d'ouverture et sur la force relative
 * de la main ; après le flop, sur l'équité (Monte Carlo) comparée aux cotes du pot,
 * avec une part d'agressivité et de bluff propre à chaque profil.
 */
export interface BotProfile {
  id: string;
  label: string;
  style: string;
  description: string;
  /** Élargit (+) ou resserre (−) les ranges préflop. */
  looseness: number;
  /** Probabilité de miser/relancer plutôt que checker/suivre avec une bonne main. */
  aggression: number;
  /** Fréquence de bluff. */
  bluff: number;
  /** Tendance à payer malgré de mauvaises cotes (0 = discipliné, 1 = station). */
  stickiness: number;
}

export const BOT_PROFILES: BotProfile[] = [
  {
    id: 'roc',
    label: 'Roc',
    style: 'Serré-passif',
    description: 'Joue peu de mains et mise surtout quand il a du jeu. Une relance de sa part est rarement un bluff.',
    looseness: -0.35,
    aggression: 0.3,
    bluff: 0.03,
    stickiness: 0.25,
  },
  {
    id: 'reg',
    label: 'Régulier',
    style: 'Serré-agressif',
    description: 'Proche des ranges standard, mise pour la valeur et c-bet souvent. L’adversaire de référence.',
    looseness: 0,
    aggression: 0.6,
    bluff: 0.12,
    stickiness: 0.4,
  },
  {
    id: 'lag',
    label: 'Agressif',
    style: 'Large-agressif',
    description: 'Ouvre large, relance et bluffe beaucoup. Il faut savoir payer plus léger contre lui.',
    looseness: 0.45,
    aggression: 0.8,
    bluff: 0.26,
    stickiness: 0.45,
  },
  {
    id: 'station',
    label: 'Station',
    style: 'Large-passif',
    description: 'Paye trop souvent et bluffe peu. Misez vos mains fortes pour la valeur, évitez de le bluffer.',
    looseness: 0.55,
    aggression: 0.15,
    bluff: 0.03,
    stickiness: 0.9,
  },
];

export const PROFILE_BY_ID: Record<string, BotProfile> = Object.fromEntries(BOT_PROFILES.map((p) => [p.id, p]));

/** Pourcentage d'ouverture de référence par position. */
export const OPEN_PERCENT: Record<string, number> = { UTG: 15, HJ: 19, CO: 27, BTN: 43, SB: 40, BB: 50, MP: 17 };

export function rfiPosition(pos: string | null, playersInHand: number): Exclude<Position, 'BB'> {
  if (playersInHand === 2) return 'BTN';
  if (pos === 'UTG' || pos === 'HJ' || pos === 'CO' || pos === 'BTN' || pos === 'SB') return pos;
  return 'HJ';
}

/** Nombre de relances préflop (la grosse blind ne compte pas). */
export function preflopRaises(s: GameState): number {
  return s.history.filter((h) => h.street === 'preflop' && h.type === 'raise').length;
}

function roundTo(chips: number, unit: number): number {
  return Math.max(unit, Math.round(chips / unit) * unit);
}

export function decideBot(s: GameState, rng: Rng = defaultRng): Action {
  const i = s.toAct!;
  const p = s.players[i];
  const prof = PROFILE_BY_ID[p.profile ?? 'reg'] ?? BOT_PROFILES[1];
  const legal = getLegalActions(s)!;
  const bbAmt = s.bigBlind;
  const opponents = s.players.filter((q, j) => j !== i && !q.folded && !q.sittingOut).length;
  const pot = potTotal(s);

  const raiseTo = (to: number): Action => {
    if (!legal.canRaise) return legal.toCall > 0 ? { type: 'call' } : { type: 'check' };
    let amt = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(to)));
    // Au-delà de 70 % du tapis, autant faire tapis.
    if (amt - p.bet > 0.7 * p.stack) amt = legal.maxRaiseTo;
    return { type: 'raise', amount: amt };
  };
  const passive = (): Action => (legal.toCall === 0 ? { type: 'check' } : { type: 'fold' });
  const call = (): Action => (legal.toCall === 0 ? { type: 'check' } : { type: 'call' });

  // ——— Préflop ———
  if (s.street === 'preflop') {
    const hc = handClassOf(p.hole[0], p.hole[1]);
    const top = HAND_TOP_PERCENT[hc];
    const raises = preflopRaises(s);
    const pos = s.positions[i];
    const stackBB = (p.stack + p.bet) / bbAmt;
    const widen = 1 + prof.looseness;
    const noise = (rng() - 0.5) * 6;

    // Tapis court : pousser ou se coucher.
    if (stackBB <= 12) {
      const pushPct = (raises === 0 ? 30 : 12) * widen + noise;
      if (top <= pushPct) return raiseTo(legal.maxRaiseTo);
      return passive();
    }

    if (raises === 0) {
      const limpers = s.history.filter((h) => h.street === 'preflop' && h.type === 'call').length;
      if (pos === 'BB') {
        // Option de la BB après des limps.
        if (top <= 12 * widen + noise && rng() < 0.5 + prof.aggression / 2) return raiseTo(bbAmt * (3 + limpers));
        return { type: 'check' };
      }
      const rfi = rfiPosition(pos, opponents + 1);
      const inChart = RFI_SETS[rfi].has(hc);
      const openPct = OPEN_PERCENT[rfi] * widen + noise;
      const opens = prof.looseness === 0 ? inChart || top <= openPct * 0.9 : top <= openPct;
      if (opens) {
        if (rng() < 0.35 + prof.aggression * 0.75) return raiseTo(bbAmt * (limpers > 0 ? 3.5 + limpers : rfi === 'SB' ? 3 : 2.5));
        return call(); // limp
      }
      // Les joueurs passifs limpent parfois des mains jouables.
      if (prof.aggression < 0.4 && top <= openPct * 1.6 && rng() < 0.4) return call();
      if (pos === 'SB' && legal.toCall <= bbAmt / 2 && top <= 60 * widen && rng() < 0.3 + prof.looseness) return call();
      return passive();
    }

    const toCallBB = legal.toCall / bbAmt;
    if (raises === 1) {
      const threeBetPct = 4 * (1 + prof.looseness * 0.8) * (0.6 + prof.aggression);
      if (top <= threeBetPct + noise / 3) return raiseTo(s.currentBet * (pos === 'BB' || pos === 'SB' ? 4 : 3));
      // Bluff 3-bet occasionnel avec des assorties.
      if (hc.endsWith('s') && top <= 35 && rng() < prof.bluff * 0.5) return raiseTo(s.currentBet * 3);
      const priceFactor = Math.min(1.4, 3 / Math.max(1, toCallBB));
      let callPct = (pos === 'BB' ? 30 : pos === 'BTN' || pos === 'CO' ? 16 : 11) * priceFactor;
      callPct *= 1 + prof.looseness + prof.stickiness * 0.4;
      if (top <= callPct + noise) return call();
      return passive();
    }
    // Face à un 3-bet ou plus.
    if (top <= 2.6 * (1 + prof.looseness * 0.5)) return raiseTo(s.currentBet * 2.3);
    const callPct = (raises === 2 ? 7 : 3.5) * (1 + prof.looseness * 0.5 + prof.stickiness * 0.4);
    if (top <= callPct + noise / 4 && toCallBB < stackBB * 0.45) return call();
    return passive();
  }

  // ——— Après le flop ———
  let equity = equityVsRandom(p.hole, s.board, Math.max(1, opponents), 450, rng);
  const streetRaises = s.history.filter((h) => h.street === s.street && h.type === 'raise').length;
  // Face à de l'agressivité, les ranges adverses sont plus fortes que des mains aléatoires.
  const caution = Math.pow(0.86 + prof.stickiness * 0.1, streetRaises);
  equity = equity * caution + (rng() - 0.5) * 0.06;
  const potOdds = legal.toCall / (pot + legal.toCall);
  const wasAggressor = s.preflopAggressor === i;

  if (legal.toCall === 0) {
    if (equity > 0.68 && rng() < 0.45 + prof.aggression * 0.5) return raiseTo(roundTo(pot * (rng() < 0.5 ? 0.66 : 0.75), bbAmt / 2));
    if (equity > 0.52 && rng() < prof.aggression * 0.7) return raiseTo(roundTo(pot * 0.5, bbAmt / 2));
    if (s.street === 'flop' && wasAggressor && opponents <= 2 && rng() < 0.35 + prof.aggression * 0.35)
      return raiseTo(roundTo(pot * 0.33, bbAmt / 2));
    if (rng() < prof.bluff * (opponents === 1 ? 1 : 0.5)) return raiseTo(roundTo(pot * 0.6, bbAmt / 2));
    return { type: 'check' };
  }

  if (equity > 0.78 && rng() < prof.aggression) return raiseTo(s.currentBet * 3);
  const threshold = potOdds * (1.1 - prof.stickiness * 0.35);
  if (equity >= threshold) return { type: 'call' };
  if (s.street !== 'river' && streetRaises === 1 && rng() < prof.bluff * 0.3) return raiseTo(s.currentBet * 2.8);
  return { type: 'fold' };
}
