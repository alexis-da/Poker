// Regroupe les règles du jeu en ligne (src/online/service.ts + moteur) en un module ESM
// importé par la fonction Supabase « table » (Deno). À relancer après toute modification du moteur.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/online/service.ts'],
  outfile: 'supabase/functions/table/service.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  legalComments: 'none',
  banner: { js: '// Fichier généré par `npm run build:server` à partir de src/online et src/engine : ne pas modifier.' },
  logLevel: 'info',
});
