import type { Focus, FocusQuiz } from './model';

/** Exercice ciblé demandé depuis une recommandation, lu par l'exercice à son ouverture. */
let pending: Focus | null = null;

export function setFocus(focus: Focus | null) {
  pending = focus;
}

export function takeFocus(quiz: FocusQuiz): string | null {
  if (pending && pending.quiz === quiz) {
    const v = pending.value;
    pending = null;
    return v;
  }
  return null;
}

/** Ouvre la page qui travaille une compétence, en ciblant la variante si possible. */
export function startPractice(route: string, focus: Focus | null) {
  setFocus(focus);
  if (window.location.hash === `#${route}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = route;
}
