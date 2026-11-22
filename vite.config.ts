import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * - `npm run dev` / `npm run build` : application classique (dossier dist/).
 * - `npm run build:single` : une seule page HTML autonome (dist-artifact/), React chargé
 *   depuis un CDN, pratique pour partager l'application en un fichier.
 */
export default defineConfig(({ mode }) => {
  if (mode === 'artifact') {
    return {
      base: './',
      plugins: [viteSingleFile()],
      esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
      build: {
        outDir: 'dist-artifact',
        rollupOptions: {
          external: ['react', 'react-dom', 'react-dom/client'],
          output: {
            format: 'iife',
            globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
          },
        },
      },
    };
  }
  return {
    base: './',
    plugins: [react()],
    test: { globals: true, include: ['tests/**/*.test.ts'] },
  };
});
