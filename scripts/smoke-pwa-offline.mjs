/**
 * Smoke test PWA offline — Sprint 10 / F6.2.
 *
 * Valida o componente client-side da fila offline (IndexedDB + processor)
 * via Vitest com fake-indexeddb. NÃO testa cache-hit do Service Worker
 * (exige browser real — verificação manual está documentada no PR #22).
 *
 * Uso:
 *   node scripts/smoke-pwa-offline.mjs
 *
 * Exits 0 em sucesso, 1 em falha. Compatível com CI.
 */
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'src/__tests__/services/offlineQueue.test.js', '--reporter=verbose'],
  { cwd: projectRoot, stdio: 'inherit' }
)

if (result.status !== 0) {
  console.error('\n❌ smoke-pwa-offline FAILED — vitest exit', result.status)
  process.exit(result.status ?? 1)
}

console.log('\n✅ smoke-pwa-offline OK')
