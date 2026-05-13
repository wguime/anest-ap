#!/usr/bin/env node
/**
 * Gera supabase/functions/schedule-shift-reminders/_data.ts a partir de
 * src/data/plantao2026.js e src/data/residencia2026.js. Rodar sempre que
 * atualizar as escalas/residentes para manter a Edge Function sincronizada.
 */
import { _readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// Import dinâmico dos dados — precisamos injetar ".js" nos imports internos
// para que Node ESM resolva (Vite aceita sem extensão; Node não).
import { readFileSync as _read, writeFileSync as _write, unlinkSync as _unlink } from 'fs';

function patchImports(srcPath, patched) {
  const raw = _read(srcPath, 'utf8');
  const fixed = raw.replace(/from '\.\/residencia2026'/g, "from './residencia2026.patched.js'");
  _write(patched, fixed);
}

const residenciaSrc = resolve(projectRoot, 'src/data/residencia2026.js');
const residenciaPatched = resolve(projectRoot, 'src/data/residencia2026.patched.js');
const plantaoSrc = resolve(projectRoot, 'src/data/plantao2026.js');
const plantaoPatched = resolve(projectRoot, 'src/data/plantao2026.patched.js');

_write(residenciaPatched, _read(residenciaSrc, 'utf8'));
patchImports(plantaoSrc, plantaoPatched);

try {
  var residencia = await import(residenciaPatched);
  var plantao = await import(plantaoPatched);
} finally {
  try { _unlink(residenciaPatched); } catch {}
  try { _unlink(plantaoPatched); } catch {}
}

const PLANTOES = plantao.PLANTOES_2026;
const FERIADOS = Array.from(plantao.FERIADOS_2026);
const RESIDENTES = residencia.RESIDENTES_2026;

const plantoesLines = Object.entries(PLANTOES)
  .map(([k, v]) => `  '${k}': '${v}',`)
  .join('\n');

const residentesLines = RESIDENTES.map(
  (r) =>
    `  { id: '${r.id}', nome: '${r.nome}', ano: '${r.ano}', email: '${r.email}' },`
).join('\n');

const feriadosLines = FERIADOS.map((d) => `  '${d}',`).join('\n');

const out = `// AUTO-GERADO por src/scripts/generate-edge-function-data.js
// Fonte: src/data/plantao2026.js + src/data/residencia2026.js
// NÃO EDITAR MANUALMENTE. Rode o script para atualizar.

export interface Residente {
  id: string;
  nome: string;
  ano: string;
  email: string;
}

export const PLANTOES_2026: Record<string, string> = {
${plantoesLines}
};

export const FERIADOS_2026 = new Set<string>([
${feriadosLines}
]);

export const RESIDENTES_2026: Residente[] = [
${residentesLines}
];

/** true se dateKey (YYYY-MM-DD) corresponde a sábado, domingo ou feriado. */
export function isPlantao24h(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (dow === 0 || dow === 6) return true;
  return FERIADOS_2026.has(dateKey);
}

export function horarioPlantao(dateKey: string): { inicio: string; setor: string } {
  return isPlantao24h(dateKey)
    ? { inicio: '07:00', setor: 'Plantão Residência (24h)' }
    : { inicio: '19:00', setor: 'Plantão Residência (12h)' };
}

export function findResidente(id: string): Residente | undefined {
  return RESIDENTES_2026.find((r) => r.id === id);
}
`;

const targetPath = resolve(
  projectRoot,
  'supabase/functions/schedule-shift-reminders/_data.ts'
);
writeFileSync(targetPath, out);
console.log(`✓ Gerado: ${targetPath}`);
console.log(`  - PLANTOES_2026: ${Object.keys(PLANTOES).length} entradas`);
console.log(`  - FERIADOS_2026: ${FERIADOS.length} feriados`);
console.log(`  - RESIDENTES_2026: ${RESIDENTES.length} residentes`);
