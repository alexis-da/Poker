import { useId } from 'react';

/**
 * Jetons de casino dessinés en SVG : piles en perspective, une colonne par valeur.
 * Les montants sont en jetons du moteur (1 BB = 10 jetons).
 */
interface Denom {
  value: number;
  base: string;
  dark: string;
  edge: string;
}

const DENOMS: Denom[] = [
  { value: 1000, base: '#1d1b22', dark: '#0c0b10', edge: '#e5c07b' },
  { value: 250, base: '#6c3fb0', dark: '#43236f', edge: '#f3efe6' },
  { value: 100, base: '#1c8a52', dark: '#0f5532', edge: '#f3efe6' },
  { value: 50, base: '#d0342c', dark: '#82201b', edge: '#f3efe6' },
  { value: 10, base: '#2563c9', dark: '#173d7c', edge: '#f3efe6' },
  { value: 5, base: '#f1ede3', dark: '#b7ae9c', edge: '#d0342c' },
  { value: 1, base: '#9aa4a8', dark: '#5d666a', edge: '#f3efe6' },
];

export function breakdown(amount: number): { denom: Denom; count: number }[] {
  let rest = Math.max(0, Math.round(amount));
  const out: { denom: Denom; count: number }[] = [];
  for (const d of DENOMS) {
    const n = Math.floor(rest / d.value);
    if (n > 0) {
      out.push({ denom: d, count: n });
      rest -= n * d.value;
    }
  }
  return out;
}

interface StackProps {
  amount: number;
  /** Largeur d'un jeton en px. */
  size?: number;
  maxColumns?: number;
  maxPerColumn?: number;
  className?: string;
}

export function ChipStack({ amount, size = 22, maxColumns = 3, maxPerColumn = 9, className = '' }: StackProps) {
  const uid = useId().replace(/:/g, '');
  const cols = breakdown(amount).slice(0, maxColumns);
  if (cols.length === 0) return null;
  const w = size;
  const rx = w / 2;
  const ry = w * 0.3;
  const thick = Math.max(2.4, w * 0.13);
  const counts = cols.map((c) => Math.min(maxPerColumn, c.count));
  const tallest = Math.max(...counts);
  const gap = w * 0.12;
  const width = cols.length * w + (cols.length - 1) * gap;
  const height = ry * 2 + tallest * thick + 1;
  return (
    <svg
      className={`chip-stack ${className}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`g${uid}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {cols.map(({ denom }, ci) => {
        const x = ci * (w + gap);
        const n = counts[ci];
        const chips = [];
        for (let k = 0; k < n; k++) {
          const cy = height - ry - thick - k * thick;
          const top = k === n - 1;
          chips.push(
            <g key={k}>
              <ellipse cx={x + rx} cy={cy + thick} rx={rx} ry={ry} fill={denom.dark} />
              <rect x={x} y={cy} width={w} height={thick} fill={denom.dark} />
              {[0.12, 0.42, 0.72].map((f) => (
                <rect key={f} x={x + w * f} y={cy + 0.4} width={w * 0.14} height={thick - 0.8} fill={denom.edge} opacity="0.9" />
              ))}
              <ellipse cx={x + rx} cy={cy} rx={rx} ry={ry} fill={denom.base} />
              {top && (
                <>
                  <ellipse
                    cx={x + rx}
                    cy={cy}
                    rx={rx * 0.86}
                    ry={ry * 0.86}
                    fill="none"
                    stroke={denom.edge}
                    strokeWidth={Math.max(1.2, w * 0.09)}
                    strokeDasharray={`${w * 0.16} ${w * 0.16}`}
                  />
                  <ellipse cx={x + rx} cy={cy} rx={rx * 0.52} ry={ry * 0.52} fill={denom.base} stroke={denom.edge} strokeWidth="0.8" strokeOpacity="0.6" />
                  <ellipse cx={x + rx} cy={cy} rx={rx} ry={ry} fill={`url(#g${uid})`} />
                </>
              )}
            </g>,
          );
        }
        return <g key={denom.value}>{chips}</g>;
      })}
    </svg>
  );
}

/** Jeton vu de dessus, utilisé comme bouton de réponse dans les exercices. */
export function ChipFace({ color = 'red' }: { color?: 'red' | 'blue' | 'green' | 'black' | 'purple' }) {
  const d = { red: DENOMS[3], blue: DENOMS[4], green: DENOMS[2], black: DENOMS[0], purple: DENOMS[1] }[color];
  return (
    <svg className="chip-face" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill={d.dark} />
      <circle cx="50" cy="50" r="46" fill={d.base} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x="45"
          y="4"
          width="10"
          height="15"
          rx="2"
          fill={d.edge}
          transform={`rotate(${i * 45} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="31" fill={d.dark} opacity="0.35" />
      <circle cx="50" cy="50" r="29" fill={d.base} stroke={d.edge} strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}
