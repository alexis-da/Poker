import { useState } from 'react';
import { InlineCards } from '../../components/PlayingCard';
import { RECO_LABELS, type CoachAdvice } from '../../engine/coach';
import { formatBB } from '../../engine/game';
import type { FeedbackEntry } from './session';

interface Props {
  advice: CoachAdvice | null;
  mode: 'visible' | 'apres' | 'off';
  feedback: FeedbackEntry | null;
  heroTurn: boolean;
  bigBlind: number;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function EquityMeter({ equity, required }: { equity: number; required: number | null }) {
  const ok = required === null || equity >= required;
  return (
    <div className="meter" role="img" aria-label={`Équité ${pct(equity)}${required !== null ? `, requise ${pct(required)}` : ''}`}>
      <div className="meter__track">
        <div className={`meter__fill ${ok ? 'meter__fill--ok' : 'meter__fill--short'}`} style={{ width: `${equity * 100}%` }} />
        {required !== null && <div className="meter__mark" style={{ left: `${required * 100}%` }} />}
      </div>
      <div className="meter__legend">
        <span>
          Équité <strong>{pct(equity)}</strong>
        </span>
        {required !== null && (
          <span>
            Requise <strong>{pct(required)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

export function CoachPanel({ advice, mode, feedback, heroTurn, bigBlind }: Props) {
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const key = advice ? `${advice.street}-${advice.toCall}-${advice.pot}` : null;
  const show = mode === 'visible' || (mode === 'apres' && revealedFor === key);

  if (mode === 'off') {
    return (
      <section className="panel coach">
        <h2 className="panel__title">Coach</h2>
        <p className="muted">Le coach est désactivé. Activez-le dans les réglages de la table pour obtenir conseils et corrections.</p>
      </section>
    );
  }

  return (
    <section className="panel coach" aria-live="polite">
      <h2 className="panel__title">Coach</h2>
      {feedback && (
        <div className={`verdict verdict--${feedback.grade.verdict}`}>
          <div className="verdict__head">
            <span className="verdict__pill">
              {feedback.grade.verdict === 'bon' ? 'Bon' : feedback.grade.verdict === 'discutable' ? 'Discutable' : 'Erreur'}
            </span>
            <span className="verdict__title">{feedback.grade.title}</span>
          </div>
          <p className="verdict__detail">
            <span className="muted">Vous : {feedback.action}. </span>
            {feedback.grade.detail}
          </p>
        </div>
      )}

      {heroTurn && advice && !show && (
        <div className="coach__hidden">
          <p>Décidez d’abord : le coach corrigera votre choix. Vous pouvez aussi demander un indice.</p>
          <button type="button" className="btn btn--ghost" onClick={() => setRevealedFor(key)}>
            Voir le conseil
          </button>
        </div>
      )}

      {heroTurn && advice && show && (
        <div className="coach__advice">
          <div className="coach__reco">
            <span className="muted">Conseil</span>
            <strong>
              {RECO_LABELS[advice.recommendation]}
              {advice.raiseTo && advice.recommendation === 'raise' ? ` à ${formatBB(advice.raiseTo, bigBlind)}` : ''}
            </strong>
            {advice.close && <span className="tag tag--warn">serré</span>}
          </div>
          <EquityMeter equity={advice.equity} required={advice.required} />
          <dl className="facts">
            <div>
              <dt>Main</dt>
              <dd>{advice.handName ?? advice.handClass}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{advice.position ?? '—'}</dd>
            </div>
            <div>
              <dt>Pot</dt>
              <dd>{formatBB(advice.pot, bigBlind)}</dd>
            </div>
            <div>
              <dt>À payer</dt>
              <dd>{advice.toCall ? formatBB(advice.toCall, bigBlind) : '—'}</dd>
            </div>
            {advice.outs && (
              <div>
                <dt>Outs</dt>
                <dd>{advice.outs.outs.length}</dd>
              </div>
            )}
          </dl>
          {advice.outs && advice.outs.outs.length > 0 && advice.outs.outs.length <= 15 && (
            <p className="coach__outs">
              <InlineCards cards={advice.outs.outs} />
            </p>
          )}
          <ul className="reasons">
            {advice.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="fineprint">Équité calculée contre des mains aléatoires : un repère, pas une lecture de l’adversaire.</p>
        </div>
      )}

      {!heroTurn && !feedback && <p className="muted">Le coach analysera votre prochaine décision.</p>}
    </section>
  );
}
