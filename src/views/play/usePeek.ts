import { useEffect, useState, type HTMLAttributes } from 'react';

export type PeekHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture' | 'onContextMenu'
>;

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/**
 * Cartes cachées (écran visible par d'autres joueurs) : votre main reste de dos et se regarde
 * en maintenant le doigt ou la souris dessus, ou la touche V. Tant qu'elle est cachée, tout ce qui
 * trahirait la main (combinaison, coach, conseil) l'est aussi.
 */
export function usePeek(enabled: boolean): { concealed: boolean; peeking: boolean; handlers: PeekHandlers | undefined } {
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setPeeking(false);
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v' && !e.repeat && !typing(e.target)) setPeeking(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') setPeeking(false);
    };
    const hide = () => setPeeking(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [enabled]);

  const handlers: PeekHandlers | undefined = enabled
    ? {
        onPointerDown: (e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          setPeeking(true);
        },
        onPointerUp: () => setPeeking(false),
        onPointerCancel: () => setPeeking(false),
        onLostPointerCapture: () => setPeeking(false),
        // Appui long sur mobile : pas de menu contextuel.
        onContextMenu: (e) => e.preventDefault(),
      }
    : undefined;

  return { concealed: enabled && !peeking, peeking: enabled && peeking, handlers };
}
