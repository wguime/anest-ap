/**
 * Dedupe .env.production: mantém apenas a ÚLTIMA definição de cada VAR.
 * Útil quando um `echo X=true >> .env.production` foi executado múltiplas vezes.
 *
 * Uso: node scripts/dedupe-env-flag.mjs
 *
 * Não imprime valores — só nomes de chaves afetadas.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
const path = '.env.production'
if (!existsSync(path)) {
  console.error('.env.production não encontrado')
  process.exit(1)
}
const lines = readFileSync(path, 'utf8').split('\n')
const seen = new Map() // key -> last line index
const dupes = []

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^([A-Z][A-Z0-9_]*)=/i)
  if (!m) continue
  const key = m[1]
  if (seen.has(key)) dupes.push(key)
  seen.set(key, i)
}

if (dupes.length === 0) {
  console.log('✅ no duplicates')
  process.exit(0)
}

const keepLines = new Set([...seen.values()])
const kept = lines.filter((_, i) => {
  // mantém comments + linhas vazias + linhas que NÃO definem var ou são a última definição
  const m = lines[i].match(/^([A-Z][A-Z0-9_]*)=/i)
  if (!m) return true
  return keepLines.has(i)
})

writeFileSync(path, kept.join('\n'))
console.log(`✅ deduplicated keys: ${[...new Set(dupes)].join(', ')}`)
