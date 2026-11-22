import { gridClass, type HandClass } from '../engine/ranges';

interface Props {
  range: Set<HandClass>;
  /** Main à entourer (exercice). */
  focus?: HandClass | null;
  onCellClick?: (hc: HandClass) => void;
  onCellHover?: (hc: HandClass | null) => void;
  compact?: boolean;
  label?: string;
}

/** Grille 13 × 13 des mains de départ : paires sur la diagonale, assorties en haut à droite. */
export function RangeGrid({ range, focus, onCellClick, onCellHover, compact, label }: Props) {
  const rows = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hc = gridClass(r, c);
      const inRange = range.has(hc);
      const kind = r === c ? 'pair' : r < c ? 'suited' : 'offsuit';
      const cls = `rg-cell rg-${kind} ${inRange ? 'rg-in' : ''} ${focus === hc ? 'rg-focus' : ''}`;
      rows.push(
        onCellClick ? (
          <button
            key={hc}
            type="button"
            className={cls}
            onClick={() => onCellClick(hc)}
            onMouseEnter={() => onCellHover?.(hc)}
            onFocus={() => onCellHover?.(hc)}
            aria-pressed={inRange}
            aria-label={`${hc}${inRange ? ', dans la range' : ''}`}
          >
            {hc}
          </button>
        ) : (
          <span
            key={hc}
            className={cls}
            onMouseEnter={() => onCellHover?.(hc)}
            onMouseLeave={() => onCellHover?.(null)}
            title={hc}
          >
            {hc}
          </span>
        ),
      );
    }
  }
  return (
    <div
      className={`range-grid ${compact ? 'range-grid--compact' : ''}`}
      role="group"
      aria-label={label ?? 'Grille des mains de départ'}
      onMouseLeave={() => onCellHover?.(null)}
    >
      {rows}
    </div>
  );
}
