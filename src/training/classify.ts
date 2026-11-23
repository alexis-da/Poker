import type { CoachAdvice, Grade } from '../engine/coach';
import type { Action } from '../engine/game';
import type { SkillId, TrainingEvent } from './model';

const STREET_FR: Record<string, string> = { preflop: 'préflop', flop: 'flop', turn: 'turn', river: 'river' };

/** Transforme une décision jugée par le coach en événement d'entraînement. */
export function classifyDecision(advice: CoachAdvice, action: Action, grade: Grade, t = Date.now()): TrainingEvent {
  const ok = grade.verdict === 'bon' ? 1 : grade.verdict === 'discutable' ? 0.5 : 0;
  const played = action.type === 'call' && advice.toCall === 0 ? 'check' : action.type;
  let skill: SkillId;
  let tag: string | undefined;
  switch (advice.situation) {
    case 'open':
      skill = 'preflop-open';
      tag = advice.position ?? undefined;
      break;
    case 'vs-raise':
    case 'vs-3bet':
      skill = 'preflop-defense';
      tag = advice.position ?? undefined;
      break;
    case 'facing-bet':
      if (advice.recommendation === 'raise' && (played === 'call' || played === 'check')) {
        skill = 'value';
        tag = 'passif';
      } else {
        skill = 'pot-odds';
        tag = advice.outs && advice.outs.outs.length >= 8 ? 'tirage' : 'main-faite';
      }
      break;
    default:
      skill = 'value';
      tag = played === 'raise' ? 'bluff' : 'passif';
  }
  const hand = advice.handName ?? advice.handClass;
  return {
    t,
    src: 'jeu',
    skill,
    ok,
    tag,
    note: ok === 1 ? undefined : `${grade.title} · ${STREET_FR[advice.street] ?? advice.street} · ${hand}`,
  };
}
