import { FOCUSABLE, SKILLS, TAG_LABELS, type Focus, type SkillId, type TrainingEvent } from './model';

const DAY = 86_400_000;
/** Fenêtre d'analyse et demi-vie du poids des événements. */
export const WINDOW_DAYS = 30;
const HALF_LIFE_DAYS = 7;

export interface SkillStat {
  skill: SkillId;
  /** Nombre d'événements dans la fenêtre. */
  count: number;
  /** Nombre d'erreurs (les décisions discutables comptent pour moitié). */
  errors: number;
  /** Taux d'erreur brut (0..1) sur la fenêtre. */
  rate: number;
  /** Score de priorité pondéré par la récence (0..1). */
  score: number;
  lastError: number | null;
  /** Variante la plus souvent ratée, si elle se dégage. */
  topTag: string | null;
  quizCount: number;
  playCount: number;
}

export interface Recommendation {
  skill: SkillId;
  kind: 'faiblesse' | 'decouverte';
  score: number;
  reason: string;
  focus: Focus | null;
  route: string;
  action: string;
}

const ALL_SKILLS = Object.keys(SKILLS) as SkillId[];

export function skillStats(events: TrainingEvent[], now: number): Record<SkillId, SkillStat> {
  const out = {} as Record<SkillId, SkillStat>;
  for (const skill of ALL_SKILLS) {
    const evs = events.filter((e) => e.skill === skill && now - e.t <= WINDOW_DAYS * DAY && e.t <= now + DAY);
    let wN = 0;
    let wErr = 0;
    let errors = 0;
    let lastError: number | null = null;
    const tagErrors = new Map<string, number>();
    for (const e of evs) {
      const w = Math.pow(0.5, Math.max(0, now - e.t) / (HALF_LIFE_DAYS * DAY));
      const err = 1 - e.ok;
      wN += w;
      wErr += w * err;
      errors += err;
      if (err > 0) {
        lastError = Math.max(lastError ?? 0, e.t);
        if (e.tag) tagErrors.set(e.tag, (tagErrors.get(e.tag) ?? 0) + err);
      }
    }
    // Taux lissé (a priori 25 % d'erreurs) multiplié par la confiance dans la mesure.
    const smoothed = (wErr + 0.5) / (wN + 2);
    const confidence = wN / (wN + 2);
    let topTag: string | null = null;
    let best = 0;
    for (const [tag, n] of tagErrors) {
      if (n > best) {
        best = n;
        topTag = tag;
      }
    }
    if (topTag && (best < 1.5 || best < errors * 0.4)) topTag = null;
    out[skill] = {
      skill,
      count: evs.length,
      errors,
      rate: evs.length ? errors / evs.length : 0,
      score: errors > 0 ? smoothed * confidence : 0,
      lastError,
      topTag,
      quizCount: evs.filter((e) => e.src === 'quiz').length,
      playCount: evs.filter((e) => e.src === 'jeu').length,
    };
  }
  return out;
}

function plural(n: number, word: string): string {
  const v = Math.round(n * 10) / 10;
  return `${v.toLocaleString('fr-FR')} ${word}${v >= 2 ? 's' : ''}`;
}

function focusFor(skill: SkillId, tag: string | null): Focus | null {
  const quiz = SKILLS[skill].quiz;
  if (!quiz || !tag || !FOCUSABLE[quiz].includes(tag)) return null;
  return { quiz, value: tag };
}

/** Exercices recommandés : d'abord les points faibles récents, puis les compétences jamais travaillées. */
export function recommend(events: TrainingEvent[], now: number, max = 3): Recommendation[] {
  const stats = skillStats(events, now);
  const weak = ALL_SKILLS.map((s) => stats[s])
    .filter((s) => s.errors > 0 && s.score >= 0.18)
    .sort((a, b) => b.score - a.score);
  const recs: Recommendation[] = weak.slice(0, max).map((s) => {
    const where = s.playCount && s.quizCount ? 'décisions et réponses' : s.playCount ? 'décisions en partie' : 'réponses';
    const focusText = s.topTag && TAG_LABELS[s.topTag] ? `, surtout ${TAG_LABELS[s.topTag]}` : '';
    return {
      skill: s.skill,
      kind: 'faiblesse',
      score: s.score,
      reason: `${plural(s.errors, 'erreur')} sur ${s.count} ${where} ces ${WINDOW_DAYS} derniers jours${focusText}.`,
      focus: focusFor(s.skill, s.topTag),
      route: SKILLS[s.skill].route,
      action: SKILLS[s.skill].action,
    };
  });
  if (recs.length < max) {
    // Compétences d'exercices jamais travaillées.
    const untouched = ALL_SKILLS.filter((s) => SKILLS[s].quiz && stats[s].count === 0);
    for (const s of untouched) {
      if (recs.length >= max) break;
      recs.push({
        skill: s,
        kind: 'decouverte',
        score: 0,
        reason: 'Pas encore travaillé : quelques questions pour faire le point.',
        focus: null,
        route: SKILLS[s].route,
        action: SKILLS[s].action,
      });
    }
  }
  return recs;
}

/** Dernières erreurs, de la plus récente à la plus ancienne. */
export function recentMistakes(events: TrainingEvent[], n = 8): TrainingEvent[] {
  return events
    .filter((e) => e.ok < 1)
    .sort((a, b) => b.t - a.t)
    .slice(0, n);
}
