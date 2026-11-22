/**
 * Transforme dist-artifact/index.html (sortie de `vite build --mode artifact`) en une page
 * autonome : styles et script de l'application en ligne, React chargé depuis cdnjs.
 * Sortie : dist-artifact/coach-holdem.html
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../dist-artifact/index.html', import.meta.url), 'utf8');

const pick = (re, label) => {
  const m = src.match(re);
  if (!m) throw new Error(`Bloc introuvable : ${label}`);
  return m[1];
};

const title = pick(/<title>([\s\S]*?)<\/title>/, 'title');
const css = pick(/<style[^>]*>([\s\S]*?)<\/style>/, 'style');
const js = pick(/<script[^>]*>([\s\S]*?)<\/script>/, 'script');
const fonts = pick(/(<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com[^>]*>)/, 'fonts').replace(/\s+/g, ' ');

const page = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Entraînement au Texas Hold'em No-Limit : jeu contre des bots avec coach, exercices, calculateur d'équité.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(new URL('../dist-artifact/coach-holdem.html', import.meta.url), page);
console.log(`dist-artifact/coach-holdem.html (${(page.length / 1024).toFixed(0)} Ko)`);
