import { RANK_LABELS, rankOf, SUIT_NAMES_FR, SUIT_SYMBOLS, suitOf, type Card } from '../engine/cards';

const SUIT_CLASS = ['s', 'h', 'd', 'c'];

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

interface Props {
  card?: Card | null;
  size?: CardSize;
  faceDown?: boolean;
  highlight?: boolean;
  dim?: boolean;
  /** Délai d'animation de distribution, en ms. */
  dealDelay?: number;
  className?: string;
}

export function PlayingCard({ card, size = 'md', faceDown, highlight, dim, dealDelay, className = '' }: Props) {
  const style = dealDelay !== undefined ? { animationDelay: `${dealDelay}ms` } : undefined;
  if (faceDown || card === undefined || card === null) {
    return (
      <span
        className={`pcard pcard--${size} pcard--back ${dealDelay !== undefined ? 'pcard--deal' : ''} ${className}`}
        style={style}
        aria-label="Carte cachée"
        role="img"
      />
    );
  }
  const r = rankOf(card);
  const s = suitOf(card);
  return (
    <span
      className={`pcard pcard--${size} suit-${SUIT_CLASS[s]} ${highlight ? 'pcard--hl' : ''} ${dim ? 'pcard--dim' : ''} ${
        dealDelay !== undefined ? 'pcard--deal' : ''
      } ${className}`}
      style={style}
      role="img"
      aria-label={`${RANK_LABELS[r]} de ${SUIT_NAMES_FR[s]}`}
    >
      <span className="pcard__rank">{RANK_LABELS[r]}</span>
      <span className="pcard__suit">{SUIT_SYMBOLS[s]}</span>
    </span>
  );
}

export function CardRow({
  cards,
  size = 'md',
  highlight,
  placeholders = 0,
}: {
  cards: Card[];
  size?: CardSize;
  highlight?: Card[];
  placeholders?: number;
}) {
  return (
    <span className="card-row">
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} highlight={highlight?.includes(c)} dim={highlight && !highlight.includes(c)} />
      ))}
      {Array.from({ length: Math.max(0, placeholders - cards.length) }, (_, i) => (
        <span key={`ph${i}`} className={`pcard pcard--${size} pcard--slot`} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Texte en ligne avec symboles colorés : « A♠ K♥ ». */
export function InlineCards({ cards }: { cards: Card[] }) {
  return (
    <span className="inline-cards">
      {cards.map((c) => (
        <span key={c} className={`inline-card suit-${SUIT_CLASS[suitOf(c)]}`}>
          {RANK_LABELS[rankOf(c)]}
          {SUIT_SYMBOLS[suitOf(c)]}
        </span>
      ))}
    </span>
  );
}
