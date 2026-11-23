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

// Version en un seul fichier, à coller dans l'éditeur de fonctions du tableau de bord Supabase
// (Edge Functions → Deploy a new function → Via Editor, nom « table »).
await build({
  entryPoints: ['supabase/functions/table/index.ts'],
  outfile: 'supabase/dashboard/table-index.ts',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  legalComments: 'none',
  external: ['npm:*'],
  banner: {
    js: [
      '// @ts-nocheck',
      '// Fonction Supabase « table » en un seul fichier, générée par `npm run build:server` : ne pas modifier.',
      '// À coller dans Edge Functions → Deploy a new function → Via Editor (nom : table).',
    ].join('\n'),
  },
  logLevel: 'info',
});
