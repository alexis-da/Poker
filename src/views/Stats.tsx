import { useState } from 'react';
import { resetStats, useAppData } from '../store/store';
import { QUIZZES } from './training/QuizShell';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

function Curve({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <p className="muted chart-empty">La courbe de gains apparaîtra après quelques mains jouées.</p>;
  }
  const data = [0, ...points];
  const w = 640;
  const h = 200;
  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const last = data[data.length - 1];
  const ticks = [min, 0, max].filter((v, i, arr) => arr.indexOf(v) === i);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Gains cumulés : ${last} BB sur ${points.length} mains`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__zero' : 'chart__grid'} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="chart__label">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <path d={area} className={last >= 0 ? 'chart__area chart__area--pos' : 'chart__area chart__area--neg'} />
        <path d={line} className="chart__line" fill="none" />
        <circle cx={x(data.length - 1)} cy={y(last)} r="4" className="chart__dot" />
        <text x={w - pad.r} y={h - 6} textAnchor="end" className="chart__label">
          {points.length} mains
        </text>
      </svg>
    </div>
  );
}

export function Stats() {
  const { play, quizzes } = useAppData();
  const [confirm, setConfirm] = useState<'play' | 'quizzes' | null>(null);
  const coachTotal = play.coach.bon + play.coach.discutable + play.coach.erreur;
  const bb100 = play.hands ? (play.netBB / play.hands) * 100 : 0;
  const tiles = [
    { label: 'Mains jouées', value: play.hands.toLocaleString('fr-FR') },
    {
      label: 'Gain net',
      value: `${play.netBB > 0 ? '+' : ''}${play.netBB.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB`,
      tone: play.netBB >= 0 ? 'pos' : 'neg',
    },
    { label: 'BB / 100 mains', value: play.hands ? bb100.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—' },
    { label: 'VPIP', value: pct(play.vpip, play.hands), hint: 'Mains jouées volontairement. Repère 6-max : 22 à 28 %.' },
    { label: 'PFR', value: pct(play.pfr, play.hands), hint: 'Mains relancées préflop. Repère : 17 à 23 %.' },
    { label: 'Flops vus', value: pct(play.sawFlop, play.hands) },
    { label: 'Abattages gagnés', value: pct(play.showdownsWon, play.showdowns), hint: `${play.showdowns} abattages` },
    { label: 'Plus gros pot', value: `${play.biggestPotBB.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB` },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Enregistrées sur cet appareil</p>
        <h1>Statistiques</h1>
        <p className="lede">Vos résultats aux tables et dans les exercices, pour savoir quoi travailler ensuite.</p>
      </header>

      <section className="section">
        <h2>Aux tables</h2>
        <div className="tiles">
          {tiles.map((t) => (
            <div key={t.label} className="tile">
              <span className="tile__label">{t.label}</span>
              <span className={`tile__value ${t.tone ?? ''}`}>{t.value}</span>
              {t.hint && <span className="tile__hint">{t.hint}</span>}
            </div>
          ))}
        </div>
        <Curve points={play.curve} />
      </section>

      <section className="section">
        <h2>Décisions jugées par le coach</h2>
        {coachTotal === 0 ? (
          <p className="muted">Jouez quelques mains avec le coach activé pour voir la qualité de vos décisions.</p>
        ) : (
          <>
            <div className="stack-bar" role="img" aria-label="Répartition des décisions">
              {(['bon', 'discutable', 'erreur'] as const).map((k) =>
                play.coach[k] ? (
                  <span key={k} className={`stack-bar__seg stack-bar__seg--${k}`} style={{ flexGrow: play.coach[k] }}>
                    {Math.round((play.coach[k] / coachTotal) * 100)} %
                  </span>
                ) : null,
              )}
            </div>
            <ul className="legend">
              <li>
                <span className="swatch swatch--bon" /> Bonnes : {play.coach.bon}
              </li>
              <li>
                <span className="swatch swatch--discutable" /> Discutables : {play.coach.discutable}
              </li>
              <li>
                <span className="swatch swatch--erreur" /> Erreurs : {play.coach.erreur}
              </li>
            </ul>
          </>
        )}
      </section>

      <section className="section">
        <h2>Exercices</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Exercice</th>
                <th>Réponses</th>
                <th>Réussite</th>
                <th>Record de série</th>
                <th>20 dernières</th>
              </tr>
            </thead>
            <tbody>
              {QUIZZES.map((q) => {
                const s = quizzes[q.id];
                return (
                  <tr key={q.id}>
                    <td>
                      <a href={`#${q.route}`}>{q.title}</a>
                    </td>
                    <td>{s.attempts}</td>
                    <td>{pct(s.correct, s.attempts)}</td>
                    <td>{s.bestStreak}</td>
                    <td>
                      <span className="dots">
                        {s.recent.slice(-20).map((ok, i) => (
                          <span key={i} className={ok ? 'dot dot--ok' : 'dot dot--ko'} />
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Réinitialiser</h2>
        {confirm ? (
          <div className="inline-confirm">
            <span>Effacer définitivement les statistiques {confirm === 'play' ? 'de jeu' : 'des exercices'} ?</span>
            <button
              type="button"
              className="btn btn--small btn--danger"
              onClick={() => {
                resetStats(confirm);
                setConfirm(null);
              }}
            >
              Effacer
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirm(null)}>
              Annuler
            </button>
          </div>
        ) : (
          <div className="button-row">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm('play')}>
              Effacer les stats de jeu
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm('quizzes')}>
              Effacer les stats d’exercices
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
