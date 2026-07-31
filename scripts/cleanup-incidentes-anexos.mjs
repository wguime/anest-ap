#!/usr/bin/env node
/**
 * cleanup-incidentes-anexos.mjs — rota service-role de retenção/eliminação
 * do bucket privado `incidentes-anexos` (pendência da auditoria LGPD 30/07).
 *
 * O bucket não tem policy de DELETE de propósito (evidência imutável) e
 * pg_cron não remove o objeto físico do Storage — exclusão só por aqui.
 *
 * Casos cobertos (path = pasta/<protocolo-sanitizado>/<uuid>.<ext>):
 *   1. ÓRFÃOS — pasta de protocolo sem NENHUMA linha em `incidentes`
 *      (submit abortado após upload). Excluídos com --apply se >7 dias.
 *   2. ANONIMIZADOS — linha com anonymized_at preenchido (retenção 20a via
 *      rpc_aplicar_retencao_incidentes, ou anonimização manual Art. 12):
 *      a linha já perdeu attachments e o owner foi anulado; a exclusão
 *      FÍSICA do arquivo acontece aqui, com --apply.
 *   3. --protocolo <P> — eliminação de um protocolo específico a pedido do
 *      DPO (Art. 18), com --apply.
 *   Linhas com retain_until vencido e ainda NÃO anonimizadas são apenas
 *   reportadas (o cron lgpd-retencao-incidentes é quem anonimiza).
 *
 * Uso:
 *   node scripts/cleanup-incidentes-anexos.mjs                     # dry-run (relatório)
 *   node scripts/cleanup-incidentes-anexos.mjs --apply --por <uid-ou-email>
 *   node scripts/cleanup-incidentes-anexos.mjs --protocolo DEN-... --apply --por <uid>
 *
 * --por identifica QUEM executou (vai para permission_audit_log.changed_by;
 * audit-trail rule: nunca 'system' anônimo). Exige SUPABASE_SERVICE_ROLE_KEY
 * no ambiente ou em .env.local (o script consome, nunca imprime).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}

const URL = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('❌ Faltam SUPABASE_URL/VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.')
  console.error('   A service role key NÃO fica no repo: copie do dashboard (Settings → API)')
  console.error('   e rode: SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-incidentes-anexos.mjs')
  process.exit(1)
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const POR = args.includes('--por') ? args[args.indexOf('--por') + 1] : null
const PROTOCOLO = args.includes('--protocolo') ? args[args.indexOf('--protocolo') + 1] : null
if (APPLY && !POR) {
  console.error('❌ --apply exige --por <uid-ou-email> (audit trail: quem executou).')
  process.exit(1)
}

const BUCKET = 'incidentes-anexos'
const PASTAS = ['denuncias', 'denuncias-anon', 'incidentes', 'incidentes-anon']
const ORFAO_MIN_DIAS = 7
const sanitize = (p) => String(p || '').replace(/[^a-zA-Z0-9-]/g, '')

const supabase = createClient(URL, KEY)

async function listAll() {
  const objetos = [] // { path, pasta, protocolo, createdAt }
  for (const pasta of PASTAS) {
    const { data: subpastas, error } = await supabase.storage.from(BUCKET)
      .list(pasta, { limit: 1000 })
    if (error) throw new Error(`list(${pasta}): ${error.message}`)
    for (const sub of subpastas || []) {
      if (sub.id) continue // arquivo solto na raiz da pasta (não esperado)
      const prefix = `${pasta}/${sub.name}`
      const { data: files, error: e2 } = await supabase.storage.from(BUCKET)
        .list(prefix, { limit: 1000 })
      if (e2) throw new Error(`list(${prefix}): ${e2.message}`)
      for (const f of files || []) {
        if (!f.id) continue
        objetos.push({
          path: `${prefix}/${f.name}`,
          pasta,
          protocolo: sub.name,
          createdAt: f.created_at ? new Date(f.created_at) : null,
        })
      }
    }
  }
  return objetos
}

async function main() {
  console.log(`🔍 ${APPLY ? 'APPLY' : 'DRY-RUN'} — bucket ${BUCKET}${PROTOCOLO ? ` — protocolo ${PROTOCOLO}` : ''}`)

  const objetos = await listAll()
  console.log(`   ${objetos.length} objeto(s) no bucket`)

  const { data: rows, error } = await supabase
    .from('incidentes')
    .select('protocolo, anonymized_at, retain_until')
  if (error) throw new Error(`select incidentes: ${error.message}`)
  const porProtocolo = new Map(rows.map((r) => [sanitize(r.protocolo), r]))

  const agora = Date.now()
  const orfaos = [], orfaosRecentes = [], anonimizados = [], vencidos = [], ativos = [], doProtocolo = []

  for (const obj of objetos) {
    if (PROTOCOLO && obj.protocolo === sanitize(PROTOCOLO)) { doProtocolo.push(obj); continue }
    const row = porProtocolo.get(obj.protocolo)
    if (!row) {
      const idadeDias = obj.createdAt ? (agora - obj.createdAt.getTime()) / 86400000 : 0
      ;(idadeDias >= ORFAO_MIN_DIAS ? orfaos : orfaosRecentes).push(obj)
    } else if (row.anonymized_at) {
      anonimizados.push(obj)
    } else if (row.retain_until && new Date(row.retain_until) < new Date()) {
      vencidos.push(obj)
    } else {
      ativos.push(obj)
    }
  }

  const rel = (label, list) => console.log(`   ${label}: ${list.length}${list.length ? '\n' + list.map((o) => `     - ${o.path}`).join('\n') : ''}`)
  rel('✅ ativos (ficam)', ativos)
  rel(`🧹 órfãos >${ORFAO_MIN_DIAS}d (sem linha em incidentes)`, orfaos)
  rel('⏳ órfãos recentes (aguardam janela)', orfaosRecentes)
  rel('🔒 anonimizados (exclusão física devida)', anonimizados)
  rel('⚠️  retain_until vencido SEM anonimizar (cron pendente — só reporta)', vencidos)
  if (PROTOCOLO) rel(`🎯 protocolo ${PROTOCOLO}`, doProtocolo)

  const alvo = PROTOCOLO ? doProtocolo : [...orfaos, ...anonimizados]
  if (!APPLY) {
    console.log(`\nDry-run: ${alvo.length} objeto(s) seriam excluídos. Rode com --apply --por <uid> para executar.`)
    return
  }
  if (alvo.length === 0) { console.log('\nNada a excluir.'); return }

  for (let i = 0; i < alvo.length; i += 100) {
    const lote = alvo.slice(i, i + 100).map((o) => o.path)
    const { error: remErr } = await supabase.storage.from(BUCKET).remove(lote)
    if (remErr) throw new Error(`remove: ${remErr.message}`)
  }
  console.log(`\n🗑️  ${alvo.length} objeto(s) excluído(s).`)

  const { error: audErr } = await supabase.from('permission_audit_log').insert({
    target_user_id: 'incidentes',
    changed_by: POR,
    action: 'lgpd_anexos_cleanup',
    new_value: {
      modo: PROTOCOLO ? `protocolo:${PROTOCOLO}` : 'rotina',
      excluidos: alvo.map((o) => o.path),
      orfaos: orfaos.length,
      anonimizados: anonimizados.length,
      base_legal: 'LGPD Art. 15/16 + política de retenção do módulo (docs/lgpd-retencao.md)',
    },
  })
  if (audErr) console.error(`⚠️  exclusão OK, mas falha no audit log: ${audErr.message}`)
  else console.log('🧾 registrado em permission_audit_log (lgpd_anexos_cleanup).')
}

main().catch((err) => { console.error('❌', err.message); process.exit(1) })
