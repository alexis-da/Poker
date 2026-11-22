import { useEffect, useMemo, useRef, useState } from 'react';
import { BOT_PROFILES, decideBot, PROFILE_BY_ID } from '../../engine/bot';
import { getAdvice, gradeDecision } from '../../engine/coach';
import { describeScore, evaluate } from '../../engine/evaluator';
import { formatBB, getLegalActions, type Action } from '../../engine/game';
import { useSettings } from '../../store/store';
import { ActionBar } from './ActionBar';
import { CoachPanel } from './CoachPanel';
import { botAct, heroAct, leaveTable, newTable, nextHand, rebuy, useSession } from './session';
import { Table } from './Table';

const SPEED_MS = { lent: 1500, normal: 850, rapide: 320 };

function Setup() {
  const [settings, setSettings] = useSettings();
  const [profiles, setProfiles] = useState('mix');
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Table 6-max · No-Limit Hold’em · blinds 0,5 / 1 BB</p>
        <h1>Jouer une session</h1>
        <p className="lede">
          Affrontez des bots au style marqué. Le coach analyse chacune de vos décisions : équité, cotes du pot, outs et
          ranges préflop.
        </p>
      </header>
      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          newTable({ opponents: settings.opponents, startingBB: settings.startingBB, profiles });
          window.scrollTo({ top: 0 });
        }}
      >
        <fieldset className="setup__group">
          <legend>Adversaires</legend>
          <div className="segmented" role="radiogroup" aria-label="Nombre d’adversaires">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                role="radio"
                aria-checked={settings.opponents === n}
                className={settings.opponents === n ? 'on' : ''}
                onClick={() => setSettings({ opponents: n })}
              >
                {n === 1 ? '1 (tête-à-tête)' : n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="setup__group">
          <legend>Tapis de départ</legend>
          <div className="segmented" role="radiogroup" aria-label="Tapis de départ">
            {[40, 100, 200].map((n) => (
              <button
                type="button"
                key={n}
                role="radio"
                aria-checked={settings.startingBB === n}
                className={settings.startingBB === n ? 'on' : ''}
                onClick={() => setSettings({ startingBB: n })}
              >
                {n} BB
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="setup__group">
          <legend>Style des bots</legend>
          <div className="profile-pick">
            <button type="button" className={`profile-card ${profiles === 'mix' ? 'on' : ''}`} onClick={() => setProfiles('mix')}>
              <strong>Mélange</strong>
              <span>Un profil au hasard par siège, comme à une vraie table.</span>
            </button>
            {BOT_PROFILES.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`profile-card ${profiles === p.id ? 'on' : ''}`}
                onClick={() => setProfiles(p.id)}
              >
                <strong>
                  {p.label} <em>{p.style}</em>
                </strong>
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="setup__group">
          <legend>Coach</legend>
          <div className="segmented" role="radiogroup" aria-label="Mode du coach">
            {(
              [
                ['visible', 'Conseils visibles'],
                ['apres', 'Correction après coup'],
                ['off', 'Désactivé'],
              ] as const
            ).map(([v, l]) => (
              <button
                type="button"
                key={v}
                role="radio"
                aria-checked={settings.coachMode === v}
                className={settings.coachMode === v ? 'on' : ''}
                onClick={() => setSettings({ coachMode: v })}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn btn--primary btn--lg">
          S’asseoir à la table
        </button>
      </form>
    </div>
  );
}

function TableSettings() {
  const [settings, setSettings] = useSettings();
  return (
    <div className="table-settings">
      <label>
        Coach
        <select
          id="coach-mode"
          value={settings.coachMode}
          onChange={(e) => setSettings({ coachMode: e.target.value as typeof settings.coachMode })}
        >
          <option value="visible">Conseils visibles</option>
          <option value="apres">Correction après coup</option>
          <option value="off">Désactivé</option>
        </select>
      </label>
      <label>
        Vitesse des bots
        <select id="bot-speed" value={settings.botSpeed} onChange={(e) => setSettings({ botSpeed: e.target.value as typeof settings.botSpeed })}>
          <option value="lent">Lente</option>
          <option value="normal">Normale</option>
          <option value="rapide">Rapide</option>
        </select>
      </label>
      <label className="check">
        <input id="auto-next" type="checkbox" checked={settings.autoNext} onChange={(e) => setSettings({ autoNext: e.target.checked })} />
        Main suivante automatique
      </label>
    </div>
  );
}

export function Play() {
  const session = useSession();
  const [settings] = useSettings();
  const game = session.game;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);

  const heroIndex = game ? game.players.findIndex((p) => p.isHuman) : -1;
  const heroTurn = !!game && !game.result && game.toAct === heroIndex;
  const legal = game && heroTurn ? getLegalActions(game) : null;
  const advice = useMemo(
    () => (game && heroTurn && settings.coachMode !== 'off' ? getAdvice(game) : null),
    [game, heroTurn, settings.coachMode],
  );

  // Les bots jouent avec un léger délai.
  const thinking = game && !game.result && game.toAct !== null && !game.players[game.toAct].isHuman ? game.toAct : null;
  useEffect(() => {
    if (!game || thinking === null) return;
    const delay = SPEED_MS[settings.botSpeed] * (0.7 + Math.random() * 0.6);
    const t = window.setTimeout(() => botAct(decideBot(game)), delay);
    return () => window.clearTimeout(t);
  }, [game, thinking, settings.botSpeed]);

  // Main suivante automatique.
  const heroBroke = !!game && game.players[heroIndex].stack <= 0;
  useEffect(() => {
    if (!game?.result || !settings.autoNext || heroBroke) return;
    const t = window.setTimeout(() => nextHand(), 3200);
    return () => window.clearTimeout(t);
  }, [game, settings.autoNext, heroBroke]);

  // Espace ou Entrée : main suivante.
  useEffect(() => {
    if (!game?.result || heroBroke) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON')) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nextHand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, heroBroke]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.log.length]);

  if (!game) return <Setup />;

  const hero = game.players[heroIndex];
  const heroHand =
    hero.hole.length === 2 && game.board.length >= 3 ? describeScore(evaluate([...hero.hole, ...game.board])) : null;

  const onHeroAction = (action: Action, label: string) => {
    const grade = advice && settings.coachMode !== 'off' ? gradeDecision(advice, action) : null;
    heroAct(action, grade, label);
  };

  const opponents = game.players.filter((p) => !p.isHuman);

  return (
    <div className="play">
      <div className="play__main">
        <div className="play__bar">
          <div className="play__meta">
            <span>Main n° {game.handNumber}</span>
            <span className={session.netBB >= 0 ? 'pos' : 'neg'}>
              Session {session.netBB >= 0 ? '+' : '−'}
              {Math.abs(session.netBB).toLocaleString('fr-FR')} BB
            </span>
          </div>
          {confirmLeave ? (
            <div className="inline-confirm">
              <span>Quitter la table ?</span>
              <button
                type="button"
                className="btn btn--small btn--danger"
                onClick={() => {
                  setConfirmLeave(false);
                  leaveTable();
                }}
              >
                Quitter
              </button>
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmLeave(false)}>
                Rester
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmLeave(true)}>
              Quitter la table
            </button>
          )}
        </div>

        <Table game={game} thinking={thinking} />

        <div className="hero-strip">
          <div className="hero-strip__info">
            <span className="hero-strip__pos">{game.positions[heroIndex] ?? '—'}</span>
            <span>
              {heroHand ? (
                <>
                  Votre main : <strong>{heroHand}</strong>
                </>
              ) : hero.folded ? (
                'Vous êtes couché'
              ) : (
                'Préflop'
              )}
            </span>
            <span className="muted">Tapis {formatBB(hero.stack, game.bigBlind)}</span>
          </div>
        </div>

        {heroTurn && legal ? (
          <ActionBar
            game={game}
            legal={legal}
            advice={settings.coachMode === 'visible' ? advice : null}
            showHint={settings.coachMode === 'visible'}
            onAction={onHeroAction}
          />
        ) : game.result ? (
          <div className="action-bar action-bar--result">
            {session.notice && <p className="notice">{session.notice}</p>}
            {heroBroke ? (
              <button type="button" className="btn btn--primary btn--lg" onClick={rebuy}>
                Recaver {session.config.startingBB} BB
              </button>
            ) : (
              <button type="button" id="next-hand" className="btn btn--primary btn--lg" onClick={nextHand}>
                Main suivante <kbd>Espace</kbd>
              </button>
            )}
          </div>
        ) : (
          <div className="action-bar action-bar--wait">
            {thinking !== null ? `${game.players[thinking].name} réfléchit…` : 'Distribution…'}
            {hero.folded && <span className="muted"> · vous êtes couché, la main continue</span>}
          </div>
        )}
      </div>

      <aside className="play__side">
        <CoachPanel
          advice={advice}
          mode={settings.coachMode}
          feedback={session.feedback}
          heroTurn={heroTurn}
          bigBlind={game.bigBlind}
        />
        <section className="panel">
          <h2 className="panel__title">Historique de la main</h2>
          <ol className="hand-log" ref={logRef}>
            {game.log.map((l, i) => (
              <li key={i} className={`log--${l.kind}`}>
                {l.text}
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <h2 className="panel__title">Adversaires</h2>
          <ul className="opponents">
            {opponents.map((p) => {
              const prof = p.profile ? PROFILE_BY_ID[p.profile] : null;
              return (
                <li key={p.id}>
                  <strong>{p.name}</strong> <span className="tag">{prof?.label}</span>
                  <span className="muted"> {prof?.style}</span>
                </li>
              );
            })}
          </ul>
          <p className="fineprint">
            Session : {session.hands} main{session.hands > 1 ? 's' : ''} · coach {session.coach.bon} bon, {session.coach.discutable}{' '}
            discutable, {session.coach.erreur} erreur{session.coach.erreur > 1 ? 's' : ''}
          </p>
        </section>
        <section className="panel">
          <h2 className="panel__title">Réglages</h2>
          <TableSettings />
          <p className="fineprint">Raccourcis : F se coucher · C checker / suivre · R relancer · Espace main suivante.</p>
        </section>
      </aside>
    </div>
  );
}
