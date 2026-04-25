#!/usr/bin/env node

/**
 * Backfill de notificações de cateteres peridurais que sumiram do DB
 * devido ao bug resolvido em 257b302 (insert.batch falhava por UNIQUE
 * conflict → nada era persistido e o otimista local era perdido no
 * próximo refetch).
 *
 * Para cada cateter (e seus eventos — novo, evolução PO, retirada),
 * cria a notificação faltante para cada anestesiologista/residente
 * ativo, preservando o timestamp original (data_insercao, created_at
 * do followup, data_retirada) para ordenação cronológica correta.
 *
 * Usa .upsert com ignoreDuplicates — rodar múltiplas vezes é seguro,
 * destinatários que já recebem não recebem de novo.
 *
 * Uso:
 *   node src/scripts/backfill-cateter-notifications.js         # dry-run
 *   EXECUTE=1 node src/scripts/backfill-cateter-notifications.js
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')

const envPath = resolve(projectRoot, '.env.local')
const envVars = {}
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) envVars[m[1].trim()] = m[2].trim()
  })
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET
const DRY_RUN = process.env.EXECUTE !== '1'

if (!SUPABASE_URL || !JWT_SECRET || !ANON_KEY) {
  console.error('ERRO: .env.local precisa ter VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_JWT_SECRET')
  process.exit(1)
}

const { SignJWT } = await import('jose')
const { createClient } = await import('@supabase/supabase-js')

const secretKey = new TextEncoder().encode(JWT_SECRET)
const serviceJWT = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(secretKey)

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
})

console.log(`=== Backfill Notificações Cateter ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`)

// 1. Destinatários: anestesistas + residentes ativos
const { data: recipients, error: errR } = await supabase
  .from('profiles')
  .select('id, nome, role, active')
  .eq('active', true)
  .in('role', ['anestesiologista', 'medico-residente'])

if (errR) {
  console.error('Erro buscando profiles:', errR.message)
  process.exit(1)
}

const recipientIds = (recipients || []).map((r) => r.id).filter(Boolean)
console.log(`Destinatários ativos (anestesistas + residentes): ${recipientIds.length}\n`)

if (recipientIds.length === 0) {
  console.error('Nenhum destinatário. Abortando.')
  process.exit(1)
}

// 2. Cateteres + followups
const { data: cateteres, error: errC } = await supabase
  .from('cateteres_peridural')
  .select('id, paciente, hospital, data_insercao, status, data_retirada, created_at')
  .order('created_at', { ascending: false })

if (errC) {
  console.error('Erro buscando cateteres:', errC.message)
  process.exit(1)
}

console.log(`Cateteres encontrados: ${cateteres?.length || 0}\n`)

const { data: followups } = await supabase
  .from('cateteres_peridural_followup')
  .select('id, cateter_id, dia_po, created_at')

console.log(`Followups encontrados: ${followups?.length || 0}\n`)

// Helper: iniciais do paciente (2 letras max)
function pacienteIniciais(nome) {
  if (!nome) return ''
  const parts = nome.trim().split(/\s+/).filter(
    (p) => p.length > 2 && !['de', 'da', 'do', 'das', 'dos'].includes(p.toLowerCase())
  )
  const first = parts[0]?.[0] || ''
  const last = parts[parts.length - 1]?.[0] || ''
  return (first + last).toUpperCase()
}

function localSuffix(hospital) {
  return hospital ? ` — ${hospital.toUpperCase()}` : ''
}

// 3. Montar rows para upsert (todos eventos × todos destinatários)
const rows = []

for (const cat of cateteres || []) {
  const iniciais = pacienteIniciais(cat.paciente)
  const suf = localSuffix(cat.hospital)
  const pacSuf = iniciais ? ` (paciente ${iniciais})` : ''

  // NOVO CATETER
  for (const rid of recipientIds) {
    rows.push({
      recipient_id: rid,
      category: 'cateter',
      subject: 'Novo cateter peridural registrado',
      content: `Cateter peridural inserido${pacSuf}${suf}.`,
      sender_name: 'Gestão de Cateteres',
      priority: 'alta',
      action_url: 'cateterDetalhe',
      action_label: 'Ver Cateter',
      action_params: { cateterId: cat.id },
      dismissable: true,
      related_entity_type: 'cateter-peridural',
      related_entity_id: cat.id,
      created_at: cat.data_insercao || cat.created_at,
    })
  }

  // RETIRADA (apenas se status retirado)
  if (cat.status === 'retirado' && cat.data_retirada) {
    for (const rid of recipientIds) {
      rows.push({
        recipient_id: rid,
        category: 'cateter',
        subject: 'Cateter peridural retirado',
        content: `Cateter peridural retirado${pacSuf}${suf}.`,
        sender_name: 'Gestão de Cateteres',
        priority: 'normal',
        action_url: 'cateterDetalhe',
        action_label: 'Ver Cateter',
        action_params: { cateterId: cat.id },
        dismissable: true,
        related_entity_type: 'cateter-peridural-retirada',
        related_entity_id: cat.id,
        created_at: cat.data_retirada,
      })
    }
  }
}

// EVOLUÇÕES PO
for (const fu of followups || []) {
  const cat = (cateteres || []).find((c) => c.id === fu.cateter_id)
  if (!cat) continue
  const iniciais = pacienteIniciais(cat.paciente)
  const suf = localSuffix(cat.hospital)
  const pacSuf = iniciais ? ` para cateter (paciente ${iniciais})` : ''
  const diaLabel = fu.dia_po ? ` — ${fu.dia_po}º PO` : ''

  for (const rid of recipientIds) {
    rows.push({
      recipient_id: rid,
      category: 'cateter',
      subject: 'Evolução de cateter peridural',
      content: `Nova evolução registrada${pacSuf}${diaLabel}${suf}.`,
      sender_name: 'Gestão de Cateteres',
      priority: 'normal',
      action_url: 'cateterDetalhe',
      action_label: 'Ver Cateter',
      action_params: { cateterId: cat.id },
      dismissable: true,
      related_entity_type: 'cateter-peridural-evolucao',
      related_entity_id: fu.id,
      created_at: fu.created_at,
    })
  }
}

console.log(`Rows candidatas (eventos × destinatários): ${rows.length}`)

// 4. Upsert — ignoreDuplicates preserva linhas que já existiam
if (DRY_RUN) {
  console.log('\n[DRY-RUN] Nada foi gravado. Rode com EXECUTE=1 para efetivar.')
  // Amostra
  console.log('\nAmostra das primeiras 3 rows:')
  rows.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.category}] ${r.subject}`)
    console.log(`     recipient=${r.recipient_id} | entity=${r.related_entity_type}/${r.related_entity_id}`)
    console.log(`     created_at=${r.created_at}`)
  })
  process.exit(0)
}

// O UNIQUE index em notifications é parcial (WHERE related_entity_id IS
// NOT NULL), e Supabase upsert não reconhece partial indexes. Então
// fazemos dedup manual: busca existentes por (entity_type, entity_id)
// e filtra antes de inserir.

const entityPairs = new Map() // key: `${type}:${id}` → Set<recipient_id> já existente
const uniqueEntities = [
  ...new Map(
    rows.map((r) => [`${r.related_entity_type}:${r.related_entity_id}`, [r.related_entity_type, r.related_entity_id]])
  ).values(),
]

console.log(`\nEntidades únicas a verificar: ${uniqueEntities.length}`)

// Busca em lotes por related_entity_id, paginando para superar o limite
// default de 1000 rows do Supabase REST.
const ENTITY_CHUNK = 200
const PAGE_SIZE = 1000
for (let i = 0; i < uniqueEntities.length; i += ENTITY_CHUNK) {
  const chunk = uniqueEntities.slice(i, i + ENTITY_CHUNK)
  const entityIds = chunk.map(([_, id]) => id)

  let from = 0
  while (true) {
    const { data: existing, error: errEx } = await supabase
      .from('notifications')
      .select('related_entity_type, related_entity_id, recipient_id')
      .in('related_entity_id', entityIds)
      .range(from, from + PAGE_SIZE - 1)

    if (errEx) {
      console.error(`ERRO buscando existentes (lote ${i}, page ${from}):`, errEx.message)
      break
    }

    for (const row of existing || []) {
      const key = `${row.related_entity_type}:${row.related_entity_id}`
      if (!entityPairs.has(key)) entityPairs.set(key, new Set())
      entityPairs.get(key).add(row.recipient_id)
    }

    if (!existing || existing.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
}

const newRows = rows.filter((r) => {
  const key = `${r.related_entity_type}:${r.related_entity_id}`
  const recipients = entityPairs.get(key)
  return !recipients || !recipients.has(r.recipient_id)
})

console.log(`Rows filtradas (só as que faltam): ${newRows.length}`)
console.log(`Rows já existentes (skipped): ${rows.length - newRows.length}`)

if (newRows.length === 0) {
  console.log('\nNada a inserir. Tudo já está no DB.')
  process.exit(0)
}

// Executar em lotes de 500 para evitar payload grande
const BATCH_SIZE = 500
let totalInserted = 0

for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
  const chunk = newRows.slice(i, i + BATCH_SIZE)
  const { data, error } = await supabase
    .from('notifications')
    .insert(chunk)
    .select('id')

  if (error) {
    console.error(`ERRO no lote ${i}-${i + chunk.length}:`, error.message)
    continue
  }

  totalInserted += data?.length || 0
  console.log(`  lote ${i}-${i + chunk.length}: inseridas=${data?.length || 0}`)
}

console.log(`\n✓ Total inseridas: ${totalInserted}`)
