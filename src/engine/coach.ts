import { HAND_TOP_PERCENT, POSITION_INFO, preflopEquity, RFI_SETS } from '../data/charts';
import { OPEN_PERCENT, preflopRaises, rfiPosition } from './bot';
import { equityVsRandom } from './equity';
import { describeScore, evaluate } from './evaluator';
import { formatBB, getLegalActions, potTotal, type Action, type GameState, type Street } from './game';
import { improvementOuts, requiredEquity, type OutsResult } from './outs';
import { defaultRng, type Rng } from './random';
import { handClassOf } from './ranges';

export type Recommendation = 'fold' | 'check' | 'call' | 'raise';

/** Nature de la décision : ouverture préflop, face à une relance, mise libre ou face à une mise. */
export type Situation = 'open' | 'vs-raise' | 'vs-3bet' | 'bet' | 'facing-bet';

export const RECO_LABELS: Record<Recommendation, string> = {
  fold: 'Se coucher',
  check: 'Checker',
  call: 'Suivre',
  raise: 'Miser / relancer',
};

export interface CoachAdvice {
  street: Street;
  situation: Situation;
  handClass: string;
  handName: string | null;
  position: string | null;
  topPercent: number;
  opponents: number;
  /** Équité contre des mains aléatoires (0..1). */
  equity: number;
  toCall: number;
  pot: number;
  /** Équité nécessaire pour suivre (0..1), null s'il n'y a rien à payer. */
  required: number | null;
  outs: OutsResult | null;
  cardsToCome: 0 | 1 | 2;
  recommendation: Recommendation;
  /** Montant total conseillé en cas de mise / relance (jetons). */
  raiseTo: number | null;
  reasons: string[];
  close: boolean;
}

export type Verdict = 'bon' | 'discutable' | 'erreur';

export interface Grade {
  verdict: Verdict;
  title: string;
  detail: string;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function getAdvice(s: GameState, rng: Rng = defaultRng, iterations = 2500): CoachAdvice | null {
  const legal = getLegalActions(s);
  if (!legal || s.toAct === null) return null;
  const i = s.toAct;
  const p = s.players[i];
  const hc = handClassOf(p.hole[0], p.hole[1]);
  const top = HAND_TOP_PERCENT[hc];
  const opponents = s.players.filter((q, j) => j !== i && !q.folded && !q.sittingOut).length;
  const pot = potTotal(s);
  const position = s.positions[i];
  const bb = s.bigBlind;
  const fmt = (c: number) => formatBB(c, bb);
  const reasons: string[] = [];
  const required = legal.toCall > 0 ? requiredEquity(legal.toCall, pot) : null;
  const clampRaise = (to: number) => Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(to)));

  const base = {
    street: s.street,
    handClass: hc,
    position,
    topPercent: top,
    opponents,
    toCall: legal.toCall,
    pot,
    required,
  };

  if (s.street === 'preflop') {
    const equity = preflopEquity(hc, opponents);
    const raises = preflopRaises(s);
    let recommendation: Recommendation = 'fold';
    let raiseTo: number | null = null;
    let close = false;
    reasons.push(`Classement de ${hc} : top ${top.toFixed(top < 10 ? 1 : 0)} % des mains de départ.`);

    if (raises === 0) {
      const limpers = s.history.filter((h) => h.street === 'preflop' && h.type === 'call').length;
      if (position === 'BB' && legal.canCheck) {
        if (top <= 12) {
          recommendation = 'raise';
          raiseTo = clampRaise(bb * (3 + limpers));
          reasons.push('Personne n’a relancé : avec une main forte, relancez les limpers pour la valeur.');
        } else {
          recommendation = 'check';
          reasons.push('Personne n’a relancé : vous voyez le flop gratuitement depuis la grosse blind.');
        }
      } else {
        const rfi = rfiPosition(position, opponents + 1);
        const inChart = RFI_SETS[rfi].has(hc);
        const posName = opponents + 1 === 2 ? 'en tête-à-tête au bouton' : `en ${POSITION_INFO[rfi].short}`;
        if (inChart) {
          recommendation = 'raise';
          raiseTo = clampRaise(bb * (limpers > 0 ? 3.5 + limpers : rfi === 'SB' ? 3 : 2.5));
          reasons.push(
            limpers > 0
              ? `Main dans la range d’ouverture ${posName} : relancez pour isoler ${limpers > 1 ? 'les limpers' : 'le limper'}.`
              : `Main dans la range d’ouverture ${posName} (environ ${OPEN_PERCENT[rfi]} % des mains) : ouvrez à ${fmt(raiseTo)}.`,
          );
          close = top > OPEN_PERCENT[rfi] * 0.85;
        } else {
          recommendation = 'fold';
          reasons.push(`Main hors de la range d’ouverture ${posName} (environ ${OPEN_PERCENT[rfi]} % des mains).`);
          reasons.push('Évitez de limper : relancez ou couchez-vous quand personne n’est entré dans le coup.');
          close = top < OPEN_PERCENT[rfi] * 1.2;
        }
      }
    } else if (raises === 1) {
      const toCallBB = legal.toCall / bb;
      const priceFactor = Math.min(1.4, 3 / Math.max(1, toCallBB));
      const callPct = (position === 'BB' ? 30 : position === 'BTN' || position === 'CO' ? 16 : 11) * priceFactor;
      if (top <= 4) {
        recommendation = 'raise';
        raiseTo = clampRaise(s.currentBet * (position === 'BB' || position === 'SB' ? 4 : 3));
        reasons.push(`Face à une relance, ${hc} est assez forte pour un 3-bet de valeur (à ${fmt(raiseTo)}).`);
      } else if (top <= callPct) {
        recommendation = 'call';
        reasons.push(
          `Face à une relance, ${hc} se défend en suivant ${position === 'BB' ? 'depuis la grosse blind, qui bénéficie d’un bon prix' : 'en position'}.`,
        );
        close = top > callPct * 0.8;
      } else {
        recommendation = 'fold';
        reasons.push(`Face à une relance, ${hc} est trop faible ${position ? `en ${position}` : ''} : la range qui relance vous domine souvent.`);
        close = top < callPct * 1.25;
      }
      if (required !== null) reasons.push(`Il faut ${fmt(legal.toCall)} pour suivre, soit ${pct(required)} d’équité requise.`);
    } else {
      if (top <= 2.6) {
        recommendation = 'raise';
        raiseTo = clampRaise(s.currentBet * 2.3);
        reasons.push('Face à un 3-bet, seules les toutes meilleures mains (QQ+, AK) relancent encore.');
      } else if (top <= 7) {
        recommendation = 'call';
        reasons.push('Face à un 3-bet, cette main peut suivre mais pas relancer.');
        close = true;
      } else {
        recommendation = 'fold';
        reasons.push('Face à un 3-bet, couchez les mains qui ne sont pas dans le haut de votre range.');
      }
    }
    if (recommendation === 'raise' && !legal.canRaise) recommendation = legal.toCall > 0 ? 'call' : 'check';
    if (recommendation === 'fold' && legal.canCheck) recommendation = 'check';
    reasons.push(`Équité contre ${opponents} main${opponents > 1 ? 's' : ''} aléatoire${opponents > 1 ? 's' : ''} : ${pct(equity)}.`);
    const situation: Situation = raises === 0 ? 'open' : raises === 1 ? 'vs-raise' : 'vs-3bet';
    return { ...base, situation, handName: null, equity, outs: null, cardsToCome: 0, recommendation, raiseTo, reasons, close };
  }

  // ——— Après le flop ———
  const handName = describeScore(evaluate([...p.hole, ...s.board]));
  const equity = equityVsRandom(p.hole, s.board, Math.max(1, opponents), iterations, rng);
  const cardsToCome = (s.street === 'flop' ? 2 : s.street === 'turn' ? 1 : 0) as 0 | 1 | 2;
  const outs = cardsToCome > 0 ? improvementOuts(p.hole, s.board) : null;
  const streetRaises = s.history.filter((h) => h.street === s.street && h.type === 'raise').length;
  const adjusted = equity * Math.pow(0.88, streetRaises);
  let recommendation: Recommendation;
  let raiseTo: number | null = null;
  let close = false;
  reasons.push(`Votre main : ${handName}. Équité contre ${opponents} main${opponents > 1 ? 's' : ''} aléatoire${opponents > 1 ? 's' : ''} : ${pct(equity)}.`);
  if (outs && outs.outs.length > 0) {
    const mult = cardsToCome === 2 ? 4 : 2;
    reasons.push(
      `${outs.outs.length} outs pour vous améliorer (${outs.groups.map((g) => `${g.label.toLowerCase()} : ${g.cards.length}`).join(', ')}) ; règle du ${mult} : ≈ ${Math.min(100, outs.outs.length * mult)} %.`,
    );
  }

  if (legal.toCall === 0) {
    if (adjusted > 0.62 && legal.canRaise) {
      recommendation = 'raise';
      raiseTo = clampRaise(pot * 0.66);
      reasons.push(`Main forte : misez pour la valeur, environ deux tiers du pot (${fmt(raiseTo)}).`);
      close = adjusted < 0.68;
    } else if (adjusted > 0.5 && opponents === 1 && legal.canRaise) {
      recommendation = 'raise';
      raiseTo = clampRaise(pot * 0.5);
      reasons.push(`En tête-à-tête, vous êtes souvent devant : une mise d’un demi-pot (${fmt(raiseTo)}) protège votre main.`);
      close = true;
    } else {
      recommendation = 'check';
      reasons.push('Pas assez d’équité pour miser pour la valeur : checkez et voyez la suite à moindre coût.');
      close = adjusted > 0.45;
    }
  } else {
    const req = required ?? 0;
    reasons.push(`Pour suivre ${fmt(legal.toCall)} dans un pot de ${fmt(pot)}, il faut ${pct(req)} d’équité.`);
    if (streetRaises > 0)
      reasons.push('Contre une mise, la main adverse est en moyenne plus forte qu’une main aléatoire : l’équité réelle est plus faible.');
    if (adjusted > Math.max(0.72, req + 0.3) && legal.canRaise) {
      recommendation = 'raise';
      raiseTo = clampRaise(s.currentBet * 3);
      reasons.push(`Vous êtes largement favori : relancez (à ${fmt(raiseTo)}).`);
      close = adjusted < 0.8;
    } else if (adjusted >= req) {
      recommendation = 'call';
      reasons.push(`Votre équité (≈ ${pct(adjusted)} après ajustement) dépasse le prix à payer : suivez.`);
      close = adjusted - req < 0.06;
    } else {
      recommendation = 'fold';
      reasons.push(`Votre équité (≈ ${pct(adjusted)} après ajustement) est inférieure au prix : couchez-vous.`);
      close = req - adjusted < 0.06;
      if (outs && outs.outs.length >= 8 && cardsToCome > 0 && req - adjusted < 0.1) {
        reasons.push('Avec un gros tirage, les cotes implicites (ce que vous gagnerez si vous touchez) peuvent justifier de suivre.');
        close = true;
      }
    }
  }
  const situation: Situation = legal.toCall > 0 ? 'facing-bet' : 'bet';
  return { ...base, situation, handName, equity, outs, cardsToCome, recommendation, raiseTo, reasons, close };
}

/** Compare l'action jouée au conseil du coach. */
export function gradeDecision(advice: CoachAdvice, action: Action): Grade {
  const played: Recommendation =
    action.type === 'call' && advice.toCall === 0 ? 'check' : (action.type as Recommendation);
  const reco = advice.recommendation;
  const recoLabel = RECO_LABELS[reco].toLowerCase();
  if (played === reco) {
    return { verdict: 'bon', title: 'Bonne décision', detail: advice.reasons[advice.reasons.length - 1] ?? '' };
  }
  if (played === 'fold' && advice.toCall === 0) {
    return {
      verdict: 'erreur',
      title: 'Erreur : vous pouviez checker',
      detail: 'Ne vous couchez jamais quand checker est gratuit : vous abandonnez le pot sans raison.',
    };
  }
  if (advice.close) {
    return {
      verdict: 'discutable',
      title: 'Décision serrée',
      detail: `Le coach préférait ${recoLabel}, mais les deux options se valent à peu près ici.`,
    };
  }
  const eq = advice.street === 'preflop' ? null : advice.equity;
  if (played === 'call' && reco === 'fold') {
    return {
      verdict: 'erreur',
      title: 'Suivi trop cher',
      detail:
        advice.required !== null
          ? `Il fallait ${pct(advice.required)} d’équité pour suivre${eq !== null ? ` et vous n’aviez qu’environ ${pct(eq)} contre des mains aléatoires` : ''}.`
          : 'Main trop faible pour continuer.',
    };
  }
  if (played === 'fold' && reco === 'call') {
    return {
      verdict: 'erreur',
      title: 'Abandon trop rapide',
      detail:
        advice.required !== null
          ? `Le pot vous offrait une bonne cote : ${pct(advice.required)} d’équité suffisaient${eq !== null ? ` et vous en aviez environ ${pct(eq)}` : ''}.`
          : 'Votre main valait au moins un call.',
    };
  }
  if (played === 'fold' && reco === 'raise') {
    return { verdict: 'erreur', title: 'Main forte abandonnée', detail: 'Cette main était assez forte pour relancer : ne la jetez pas.' };
  }
  if (reco === 'raise' && (played === 'call' || played === 'check')) {
    return {
      verdict: 'discutable',
      title: 'Un peu passif',
      detail: 'Avec cette main, miser ou relancer rapporte plus : vous laissez l’adversaire voir des cartes à bas prix.',
    };
  }
  if (played === 'raise' && (reco === 'check' || reco === 'call')) {
    return {
      verdict: 'discutable',
      title: 'Agressif',
      detail:
        eq !== null && eq < 0.35
          ? 'Mise en bluff : elle peut fonctionner contre un adversaire prudent, mais elle coûte cher face à une station.'
          : `Le coach préférait ${recoLabel} : votre mise grossit le pot sans être nettement favori.`,
    };
  }
  if (played === 'raise' && reco === 'fold') {
    return {
      verdict: advice.street === 'preflop' ? 'discutable' : 'erreur',
      title: advice.street === 'preflop' ? 'Relance hors range' : 'Bluff risqué',
      detail:
        advice.street === 'preflop'
          ? 'Cette main ne fait pas partie de la range conseillée : la relancer coûte des jetons sur la durée.'
          : 'Vous relancez avec une main faible face à une mise : un bluff coûteux s’il est payé.',
    };
  }
  if (played === 'call' && reco === 'check') {
    return { verdict: 'bon', title: 'Bonne décision', detail: 'Rien à payer : vous checkez.' };
  }
  if (played === 'check' && reco === 'fold') {
    return { verdict: 'bon', title: 'Bonne décision', detail: 'Checker gratuitement est toujours mieux que se coucher.' };
  }
  return { verdict: 'discutable', title: 'À revoir', detail: `Le coach conseillait plutôt : ${recoLabel}.` };
}
