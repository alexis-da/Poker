import { useState } from 'react';
import { RangeGrid } from '../../components/RangeGrid';
import { HAND_TOP_PERCENT, POSITION_INFO, preflopEquity, RFI_RANGES, RFI_SETS } from '../../data/charts';
import { comboCount, parseRange, rangeComboCount, rangePercent, rangeToString, type HandClass } from '../../engine/ranges';
import { RFI_POSITIONS, type RfiPosition } from '../../trainers/generators';

type Tab = RfiPosition | 'custom';

export function RangeViewer() {
  const [tab, setTab] = useState<Tab>('UTG');
  const [custom, setCustom] = useState<Set<HandClass>>(() => parseRange('22+, A2s+, KTs+, QTs+, JTs, ATo+, KJo+'));
  const [text, setText] = useState(() => rangeToString(custom));
  const [hover, setHover] = useState<HandClass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const range = tab === 'custom' ? custom : RFI_SETS[tab];
  const notation = tab === 'custom' ? rangeToString(custom) : RFI_RANGES[tab];

  const toggle = (hc: HandClass) => {
    const next = new Set(custom);
    if (next.has(hc)) next.delete(hc);
    else next.add(hc);
    setCustom(next);
    setText(rangeToString(next));
    setError(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.getElementById('range-notation') as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Outil · 6-max, 100 BB</p>
        <h1>Tableaux de ranges</h1>
        <p className="lede">
          Les mains à ouvrir quand personne n’a relancé avant vous, position par position. Construisez aussi votre propre range
          case par case.
        </p>
      </header>

      <div className="chip-row" role="tablist" aria-label="Position">
        {RFI_POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={tab === p}
            className={`chip-btn ${tab === p ? 'chip-btn--on' : ''}`}
            onClick={() => setTab(p)}
          >
            {p} · {rangePercent(RFI_SETS[p]).toFixed(0)} %
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'custom'}
          className={`chip-btn ${tab === 'custom' ? 'chip-btn--on' : ''}`}
          onClick={() => setTab('custom')}
        >
          Ma range
        </button>
      </div>

      <div className="ranges">
        <div className="ranges__grid">
          <RangeGrid
            range={range}
            focus={hover}
            onCellClick={tab === 'custom' ? toggle : undefined}
            onCellHover={setHover}
            label={tab === 'custom' ? 'Ma range' : `Range d’ouverture ${tab}`}
          />
          <ul className="legend">
            <li>
              <span className="swatch swatch--pair" /> Paires
            </li>
            <li>
              <span className="swatch swatch--suited" /> Assorties (au-dessus de la diagonale)
            </li>
            <li>
              <span className="swatch swatch--offsuit" /> Dépareillées (en dessous)
            </li>
          </ul>
        </div>
        <div className="ranges__info">
          <section className="panel">
            <h2 className="panel__title">{tab === 'custom' ? 'Ma range' : `${POSITION_INFO[tab].name} (${tab})`}</h2>
            {tab !== 'custom' && <p>{POSITION_INFO[tab].detail}</p>}
            <dl className="facts">
              <div>
                <dt>Mains</dt>
                <dd>{rangePercent(range).toFixed(1).replace('.', ',')} %</dd>
              </div>
              <div>
                <dt>Combinaisons</dt>
                <dd>
                  {rangeComboCount(range)} / 1326
                </dd>
              </div>
              <div>
                <dt>Classes</dt>
                <dd>{range.size} / 169</dd>
              </div>
            </dl>
            {tab === 'custom' ? (
              <label className="range-input">
                <span>Notation</span>
                <input
                  id="range-notation"
                  type="text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    try {
                      setCustom(parseRange(e.target.value));
                      setError(null);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                />
                {error && <span className="neg">{error}</span>}
              </label>
            ) : (
              <label className="range-input">
                <span>Notation</span>
                <input id="range-notation" type="text" readOnly value={notation} />
              </label>
            )}
            <div className="button-row">
              <button type="button" className="btn btn--small btn--ghost" onClick={copy}>
                {copied ? 'Copié' : 'Copier la notation'}
              </button>
              {tab === 'custom' && (
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => {
                    setCustom(new Set());
                    setText('');
                  }}
                >
                  Tout effacer
                </button>
              )}
            </div>
            {tab === 'custom' && <p className="fineprint">Touchez une case pour l’ajouter ou la retirer. La notation se colle dans le calculateur d’équité.</p>}
          </section>
          <section className="panel">
            <h2 className="panel__title">{hover ?? 'Survolez une main'}</h2>
            {hover ? (
              <dl className="facts">
                <div>
                  <dt>Combinaisons</dt>
                  <dd>{comboCount(hover)}</dd>
                </div>
                <div>
                  <dt>Classement</dt>
                  <dd>top {HAND_TOP_PERCENT[hover].toFixed(HAND_TOP_PERCENT[hover] < 10 ? 1 : 0)} %</dd>
                </div>
                <div>
                  <dt>Contre 1 main</dt>
                  <dd>{Math.round(preflopEquity(hover, 1) * 100)} %</dd>
                </div>
                <div>
                  <dt>Contre 5 mains</dt>
                  <dd>{Math.round(preflopEquity(hover, 5) * 100)} %</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">Nombre de combinaisons, rang parmi les 169 mains et équité contre des mains aléatoires.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
