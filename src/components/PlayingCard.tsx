import type { CSSProperties } from 'react';
import { RANK_LABELS, rankOf, SUIT_NAMES_FR, SUIT_SYMBOLS, suitOf, type Card } from '../engine/cards';
import { useAppData } from '../store/store';

/**
 * Deux styles de cartes :
 *  - « lisible » (par défaut) : gros index et jeu 4 couleurs, comme dans les salles en ligne ;
 *  - « illustre » : cartes « Vectorized Playing Cards 1.3 » de Chris Aguilar (LGPL-3.0),
 *    servies depuis public/cards/ (voir public/cards/README.txt).
 */
const RANK_CODES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_CODES = ['S', 'H', 'D', 'C'];
const SUIT_CLASS = ['s', 'h', 'd', 'c'];
const BASE = import.meta.env.BASE_URL;

export const cardImage = (c: Card) => `${BASE}cards/${RANK_CODES[rankOf(c)]}${SUIT_CODES[suitOf(c)]}.svg`;
export const CARD_BACK = `${BASE}cards/Red_Back.svg`;

export function cardName(c: Card): string {
  return `${RANK_LABELS[rankOf(c)]} de ${SUIT_NAMES_FR[suitOf(c)]}`;
}

/** Précharge les cartes illustrées pendant un moment d'inactivité. */
export function preloadCards() {
  const run = () => {
    for (let c = 0; c < 52; c++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = cardImage(c);
    }
    const back = new Image();
    back.src = CARD_BACK;
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run);
  else window.setTimeout(run, 800);
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  card?: Card | null;
  size?: CardSize;
  /** Dos visible. Si la carte est connue, elle se retourne quand faceDown repasse à false. */
  faceDown?: boolean;
  highlight?: boolean;
  dim?: boolean;
  /** Délai de l'animation de distribution, en ms. */
  dealDelay?: number;
  tilt?: number;
  className?: string;
}

function IndexFace({ card }: { card: Card }) {
  const s = suitOf(card);
  return (
    <span className={`pcard__face pcard__face--index suit-${SUIT_CLASS[s]}`}>
      <span className="pc-rank">{RANK_LABELS[rankOf(card)]}</span>
      <span className="pc-suit">{SUIT_SYMBOLS[s]}</span>
      <span className="pc-pip">{SUIT_SYMBOLS[s]}</span>
    </span>
  );
}

export function PlayingCard({ card, size = 'md', faceDown, highlight, dim, dealDelay, tilt, className = '' }: Props) {
  const { cardStyle } = useAppData().settings;
  const illustrated = cardStyle === 'illustre';
  const known = card !== undefined && card !== null;
  const down = faceDown || !known;
  const style: CSSProperties & Record<string, string> = {};
  if (dealDelay !== undefined) style.animationDelay = `${dealDelay}ms`;
  if (tilt) style['--tilt'] = `${tilt}deg`;
  const cls = [
    'pcard',
    `pcard--${size}`,
    illustrated ? 'pcard--art' : 'pcard--index',
    down ? 'is-down' : '',
    highlight ? 'pcard--hl' : '',
    dim ? 'pcard--dim' : '',
    dealDelay !== undefined ? 'pcard--deal' : '',
    tilt ? 'pcard--tilt' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} style={style} role="img" aria-label={down ? 'Carte cachée' : cardName(card!)}>
      <span className="pcard__inner">
        {known &&
          (illustrated ? (
            <img className="pcard__face" src={cardImage(card!)} alt="" draggable={false} />
          ) : (
            <IndexFace card={card!} />
          ))}
        {illustrated ? (
          <img className="pcard__back" src={CARD_BACK} alt="" draggable={false} />
        ) : (
          <span className="pcard__back pcard__back--pattern" />
        )}
      </span>
    </span>
  );
}

export function CardRow({
  cards,
  size = 'md',
  highlight,
  placeholders = 0,
  fan = false,
}: {
  cards: Card[];
  size?: CardSize;
  highlight?: Card[];
  placeholders?: number;
  /** Cartes en éventail, comme tenues en main. */
  fan?: boolean;
}) {
  return (
    <span className={`card-row ${fan ? 'card-row--fan' : ''}`}>
      {cards.map((c, i) => (
        <PlayingCard
          key={c}
          card={c}
          size={size}
          highlight={highlight?.includes(c)}
          dim={highlight && !highlight.includes(c)}
          tilt={fan ? (i - (cards.length - 1) / 2) * 7 : undefined}
        />
      ))}
      {Array.from({ length: Math.max(0, placeholders - cards.length) }, (_, i) => (
        <span key={`ph${i}`} className={`pcard pcard--${size} pcard--slot`} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Carte réduite à son index (rang + couleur) pour le texte et les sélecteurs. */
export function IndexCard({ card }: { card: Card }) {
  return (
    <span className={`index-card suit-${SUIT_CLASS[suitOf(card)]}`} aria-label={cardName(card)}>
      <b>{RANK_LABELS[rankOf(card)]}</b>
      <i>{SUIT_SYMBOLS[suitOf(card)]}</i>
    </span>
  );
}

/** Texte en ligne : « A♠ K♥ ». */
export function InlineCards({ cards }: { cards: Card[] }) {
  return (
    <span className="inline-cards">
      {cards.map((c) => (
        <IndexCard key={c} card={c} />
      ))}
    </span>
  );
}
