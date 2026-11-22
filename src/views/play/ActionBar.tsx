import { Button, Card, Kbd, SegmentedControl, Slider, TextField } from '@radix-ui/themes';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import StarBorder from '../../components/reactbits/StarBorder';
import { preflopRaises } from '../../engine/bot';
import type { CoachAdvice } from '../../engine/coach';
import { formatBB, type Action, type GameState, type LegalActions } from '../../engine/game';

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

/** Contour lumineux React Bits autour du bouton conseillé par le coach. */
function Recommended({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <StarBorder
      as="div"
      theme="light"
      radius={14}
      thickness={2}
      color="#46a758"
      trailColor="#a6e3b0"
      backgroundColor="transparent"
      borderColor="rgba(70, 167, 88, 0.35)"
      duration={3.4}
      className="reco"
      title="Conseil du coach"
    >
      {children}
    </StarBorder>
  );
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
      add('⅓', pot / 3);
      add('½', pot / 2);
      add('⅔', (pot * 2) / 3);
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
  const raiseVerb = allIn ? 'Tapis' : isBet ? 'Miser' : 'Relancer à';
  const raiseLabel = `${raiseVerb} ${formatBB(allIn ? legal.maxRaiseTo : raiseTo, bb)}`;
  const callAllIn = legal.toCall >= hero.stack;
  const callVerb = legal.canCheck ? 'Checker' : callAllIn ? 'Suivre tapis' : 'Suivre';
  const callLabel = legal.canCheck ? callVerb : `${callVerb} ${formatBB(legal.toCall, bb)}`;
  const reco = showHint ? advice?.recommendation : null;
  const selected = presets.find((p) => p.to === raiseTo)?.label ?? '';

  const doFold = () => onAction({ type: 'fold' }, 'Se coucher');
  const doCall = () => onAction({ type: legal.canCheck ? 'check' : 'call' }, callLabel);
  const doRaise = () => legal.canRaise && onAction({ type: 'raise', amount: raiseTo }, raiseLabel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.getAttribute('role') === 'slider')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') doFold();
      else if (k === 'c') doCall();
      else if (k === 'r') doRaise();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Card size="3" className="action-bar">
      {legal.canRaise && (
        <div className="action-bar__sizing">
          <SegmentedControl.Root
            size="2"
            value={selected}
            onValueChange={(v) => {
              const p = presets.find((x) => x.label === v);
              if (p) setRaiseTo(p.to);
            }}
            aria-label="Tailles de mise"
          >
            {presets.map((p) => (
              <SegmentedControl.Item key={p.label} value={p.label}>
                {p.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <Slider
            className="action-bar__slider"
            size="2"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            step={1}
            value={[raiseTo]}
            onValueChange={([v]) => setRaiseTo(v)}
            aria-label="Montant de la mise"
          />
          <TextField.Root
            id="raise-bb"
            className="action-bar__amount"
            size="2"
            type="number"
            min={legal.minRaiseTo / bb}
            max={legal.maxRaiseTo / bb}
            step={0.5}
            value={Math.round((raiseTo / bb) * 10) / 10}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value) * bb);
              if (Number.isFinite(v)) setRaiseTo(Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, v)));
            }}
            aria-label="Montant en grosses blinds"
          >
            <TextField.Slot side="right">BB</TextField.Slot>
          </TextField.Root>
        </div>
      )}
      <div className="action-bar__buttons">
        <Recommended on={reco === 'fold'}>
          <Button id="act-fold" size="4" variant="soft" color="gray" onClick={doFold}>
            Se coucher <Kbd size="1">F</Kbd>
          </Button>
        </Recommended>
        <Recommended on={reco === 'call' || reco === 'check'}>
          <Button id="act-call" size="4" variant="solid" color="grass" onClick={doCall}>
            {callVerb}
            {!legal.canCheck && <span className="act-amt">{formatBB(legal.toCall, bb)}</span>}
            <Kbd size="1">C</Kbd>
          </Button>
        </Recommended>
        <Recommended on={reco === 'raise'}>
          <Button id="act-raise" size="4" variant="solid" color="gray" highContrast onClick={doRaise} disabled={!legal.canRaise}>
            {legal.canRaise ? raiseVerb : 'Relance impossible'}
            {legal.canRaise && <span className="act-amt">{formatBB(allIn ? legal.maxRaiseTo : raiseTo, bb)}</span>}
            <Kbd size="1">R</Kbd>
          </Button>
        </Recommended>
      </div>
    </Card>
  );
}
