/**
 * Génère src/data/preflopEquity.ts : équité de chacune des 169 mains de départ
 * contre 1 à 5 mains aléatoires (Monte Carlo). Lancer avec : npm run gen:preflop
 */
import { writeFileSync } from 'node:fs';
import { computeEquity, type EquityPlayer } from '../src/engine/equity';
import { seededRng } from '../src/engine/random';
import { ALL_CLASSES, combosOf } from '../src/engine/ranges';

const rng = seededRng(20261122);
const rows: string[] = [];
const t0 = Date.now();
for (const hc of ALL_CLASSES) {
  const combo = combosOf(hc)[0];
  const values: number[] = [];
  for (let opp = 1; opp <= 5; opp++) {
    const players: EquityPlayer[] = [{ cards: [combo[0], combo[1]] }];
    for (let i = 0; i < opp; i++) players.push(null);
    const iterations = opp === 1 ? 60000 : 30000;
    values.push(computeEquity(players, [], { iterations, rng }).equity[0]);
  }
  rows.push(`  "${hc}": [${values.map((v) => v.toFixed(4)).join(', ')}],`);
}
const out = `// Fichier généré par scripts/gen-preflop.ts — ne pas modifier à la main.
// Équité préflop de chaque main contre 1, 2, 3, 4 et 5 mains aléatoires.
export const PREFLOP_EQUITY: Record<string, readonly [number, number, number, number, number]> = {
${rows.join('\n')}
};
`;
writeFileSync(new URL('../src/data/preflopEquity.ts', import.meta.url), out);
console.log(`OK en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
