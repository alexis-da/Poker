import { useEffect, useState } from 'react';
import { useSettings } from './store/store';

export type Resolved = 'light' | 'dark';

/** Thème « système » : celui imposé par la page hôte (data-theme sur <html>), sinon celui de l'appareil. */
function readSystem(): Resolved {
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useSystemAppearance(): Resolved {
  const [value, setValue] = useState<Resolved>(() => (typeof window === 'undefined' ? 'light' : readSystem()));
  useEffect(() => {
    const update = () => setValue(readSystem());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return value;
}

/** Thème effectivement affiché, en tenant compte du choix de l'utilisateur. */
export function useAppearance(): Resolved {
  const [settings] = useSettings();
  const system = useSystemAppearance();
  return settings.appearance === 'system' ? system : settings.appearance;
}

/**
 * Reporte le choix explicite sur <html> (classes app-light / app-dark) pour que les couleurs
 * hors composants Radix (fond de page, barre du haut) suivent, et met à jour la couleur du navigateur.
 */
export function useAppearanceEffects(resolved: Resolved) {
  const [settings] = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('app-dark', settings.appearance === 'dark');
    root.classList.toggle('app-light', settings.appearance === 'light');
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = resolved === 'dark' ? '#111110' : '#fdfdfc';
  }, [settings.appearance, resolved]);
}
