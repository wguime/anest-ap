#!/usr/bin/env node
/**
 * Lista cateteres sem notificação para nenhum destinatário ativo,
 * para diagnosticar por que ficaram órfãos.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
readFileSync(resolve('.env.local'), 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([^#=][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
})

const { default: postgres } = await import('postgres')
const sql = postgres({
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: 'postgres.vjzrahruvjffyyqyhjny',
  password: env.SUPABASE_DB_PASSWORD,
  ssl: 'require',
  prepare: false,
  max: 1,
})

try {
  // Encontra cateteres órfãos (criados após o backfill que rodou em
  // 2026-04-23 ~17h)
  const orphans = await sql`
    SELECT id, paciente, hospital, created_at, data_insercao, status, created_by, created_by_name
    FROM public.cateteres_peridural
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.related_entity_type = 'cateter-peridural'
        AND n.related_entity_id::uuid = public.cateteres_peridural.id
    )
    ORDER BY created_at DESC;
  `

  console.log(`Cateteres sem notificação: ${orphans.length}\n`)
  for (const c of orphans) {
    console.log(`  id=${c.id}`)
    console.log(`    paciente=${c.paciente} | hospital=${c.hospital} | status=${c.status}`)
    console.log(`    criado=${c.created_at?.toISOString?.()} por ${c.created_by_name} (${c.created_by})`)
    console.log()
  }

  // Followups órfãos
  const orphanFu = await sql`
    SELECT f.id, f.cateter_id, f.dia_po, f.created_at, f.avaliado_por_nome, c.paciente
    FROM public.cateteres_peridural_followup f
    LEFT JOIN public.cateteres_peridural c ON c.id = f.cateter_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.related_entity_type = 'cateter-peridural-evolucao'
        AND n.related_entity_id::uuid = f.id
    )
    ORDER BY f.created_at DESC;
  `

  console.log(`Followups (evoluções) sem notificação: ${orphanFu.length}\n`)
  for (const f of orphanFu) {
    console.log(`  id=${f.id}  paciente=${f.paciente}  PO${f.dia_po}  ${f.created_at?.toISOString?.()} por ${f.avaliado_por_nome}`)
  }

  // Cateteres retirados sem notif
  const orphanRet = await sql`
    SELECT id, paciente, data_retirada, motivo_retirada, updated_by_name
    FROM public.cateteres_peridural
    WHERE status = 'retirado'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_entity_type = 'cateter-peridural-retirada'
          AND n.related_entity_id::uuid = public.cateteres_peridural.id
      )
    ORDER BY data_retirada DESC;
  `
  console.log(`\nRetiradas sem notificação: ${orphanRet.length}\n`)
  for (const r of orphanRet) {
    console.log(`  id=${r.id}  paciente=${r.paciente}  retirada=${r.data_retirada?.toISOString?.()}  por ${r.updated_by_name}`)
  }
} finally {
  await sql.end()
}
