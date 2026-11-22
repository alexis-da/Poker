import React, { useEffect, useMemo, useState } from 'react';
import type { CoachAdvice } from '../../engine/coach';
import { formatBB, type Action, type GameState, type LegalActions } from '../../engine/game';
import { preflopRaises } from '../../engine/bot';

interface Props {
  game: GameState;
  legal: LegalActions;
  advice: CoachAdvice | null;
  showHint: boolean;
  onAction: (action: Action, label: string) => void;
}

interface Preset {
  label: string;
  to: number;
}

export function ActionBar({ game, legal, advice, showHint, onAction }: Props) {
  const bb = game.bigBlind;
  const hero = game.players[game.toAct!];
  const presets = useMemo<Preset[]>(() => {
    const out: Preset[] = [];
    const pot = legal.pot;
    const add = (label: string, to: number) => {
      const v = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(to)));
      if (!out.some((p) => p.to === v)) out.push({ label, to: v });
    };
    if (game.street === 'preflop') {
      if (preflopRaises(game) === 0) {
        add('2,5 BB', 2.5 * bb);
        add('3 BB', 3 * bb);
        add('4 BB', 4 * bb);
      } else {
        add('×3', game.currentBet * 3);
        add('×4', game.currentBet * 4);
      }
    } else if (game.currentBet === 0) {
      add('⅓ pot', pot / 3);
      add('½ pot', pot / 2);
      add('⅔ pot', (pot * 2) / 3);
      add('Pot', pot);
    } else {
      add('×2,5', game.currentBet * 2.5);
      add('×3', game.currentBet * 3);
      add('Pot', game.currentBet + pot + legal.toCall);
    }
    add('Tapis', legal.maxRaiseTo);
    return out;
  }, [game, legal, bb]);

  const defaultTo = advice?.raiseTo ?? presets[0]?.to ?? legal.minRaiseTo;
  const [raiseTo, setRaiseTo] = useState(defaultTo);
  useEffect(() => setRaiseTo(defaultTo), [defaultTo, game.toAct, game.street, game.handNumber]);

  const isBet = game.currentBet === 0;
  const allIn = raiseTo >= legal.maxRaiseTo;
  const raiseLabel = allIn ? `Tapis ${formatBB(legal.maxRaiseTo, bb)}` : `${isBet ? 'Miser' : 'Relancer à'} ${formatBB(raiseTo, bb)}`;
  const callAllIn = legal.toCall >= hero.stack;
  const callLabel = legal.canCheck
    ? 'Checker'
    : callAllIn
      ? `Suivre tapis ${formatBB(legal.toCall, bb)}`
      : `Suivre ${formatBB(legal.toCall, bb)}`;

  const reco = showHint ? advice?.recommendation : null;

  const doFold = () => onAction({ type: 'fold' }, 'Se coucher');
  const doCall = () => onAction({ type: legal.canCheck ? 'check' : 'call' }, callLabel);
  const doRaise = () => legal.canRaise && onAction({ type: 'raise', amount: raiseTo }, raiseLabel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') doFold();
      else if (k === 'c') doCall();
      else if (k === 'r') doRaise();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pct = legal.maxRaiseTo > legal.minRaiseTo ? ((raiseTo - legal.minRaiseTo) / (legal.maxRaiseTo - legal.minRaiseTo)) * 100 : 100;
  const callVerb = legal.canCheck ? 'Checker' : callAllIn ? 'Suivre tapis' : 'Suivre';
  const raiseVerb = allIn ? 'Tapis' : isBet ? 'Miser' : 'Relancer à';

  return (
    <div className="action-bar">
      {legal.canRaise && (
        <div className="action-bar__sizing">
          <div className="presets" role="group" aria-label="Tailles de mise">
            {presets.map((p) => (
              <button
                type="button"
                key={p.label}
                className={`preset ${raiseTo === p.to ? 'preset--on' : ''}`}
                onClick={() => setRaiseTo(p.to)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="sizing-input">
            <input
              id="raise-slider"
              className="slider"
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={1}
              value={raiseTo}
              style={{ '--pct': `${pct}%` } as React.CSSProperties}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              aria-label="Montant de la mise"
            />
            <label className="bb-input">
              <input
                id="raise-bb"
                type="number"
                min={legal.minRaiseTo / bb}
                max={legal.maxRaiseTo / bb}
                step={0.5}
                value={Math.round((raiseTo / bb) * 10) / 10}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value) * bb);
                  if (Number.isFinite(v)) setRaiseTo(Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, v)));
                }}
              />
              <span>BB</span>
            </label>
          </div>
        </div>
      )}
      <div className="action-bar__buttons">
        <button
          type="button"
          id="act-fold"
          className={`act act--fold ${reco === 'fold' ? 'act--reco' : ''}`}
          onClick={doFold}
        >
          <span className="act__verb">Se coucher</span>
          <kbd>F</kbd>
        </button>
        <button
          type="button"
          id="act-call"
          className={`act act--call ${reco === 'call' || reco === 'check' ? 'act--reco' : ''}`}
          onClick={doCall}
        >
          <span className="act__verb">{callVerb}</span>
          {!legal.canCheck && <span className="act__amt">{formatBB(legal.toCall, bb)}</span>}
          <kbd>C</kbd>
        </button>
        <button
          type="button"
          id="act-raise"
          className={`act act--raise ${reco === 'raise' ? 'act--reco' : ''}`}
          onClick={doRaise}
          disabled={!legal.canRaise}
        >
          <span className="act__verb">{legal.canRaise ? raiseVerb : 'Relance impossible'}</span>
          {legal.canRaise && <span className="act__amt">{formatBB(allIn ? legal.maxRaiseTo : raiseTo, bb)}</span>}
          <kbd>R</kbd>
        </button>
      </div>
    </div>
  );
}
