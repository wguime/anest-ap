#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRAÇÃO COMPLETA: Firestore (ANEST v1.0) → Supabase (ANEST v2.0)
 * ============================================================================
 *
 * Migra: authorized_emails, profiles (users+userProfiles), documentos (~30+ collections),
 *        incidentes, denúncias, comunicados
 *
 * Pré-requisitos:
 *   1. Firebase service account: /Users/guilherme/Documents/IA/Qmentum/firebase-service-account.json
 *   2. SUPABASE_SERVICE_ROLE_KEY como variável de ambiente
 *
 * Uso:
 *   cd scripts && npm install
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node migrate-firestore-to-supabase.mjs              # dry-run (padrão)
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node migrate-firestore-to-supabase.mjs --execute     # migração real
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node migrate-firestore-to-supabase.mjs --execute --verbose
 */

import { createRequire } from 'module'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ============================================================================
// CLI Arguments
// ============================================================================

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const VERBOSE = args.includes('--verbose')
const DRY_RUN = !EXECUTE

// ============================================================================
// Firebase Admin Setup
// ============================================================================

const admin = require('firebase-admin')

const serviceAccountPaths = [
  resolve(projectRoot, '..', 'Qmentum', 'firebase-service-account.json'),
  resolve(projectRoot, 'firebase-service-account.json'),
  resolve(projectRoot, 'serviceAccountKey.json'),
]

let initialized = false
for (const p of serviceAccountPaths) {
  if (existsSync(p)) {
    const sa = JSON.parse(readFileSync(p, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: 'anest-ap',
    })
    console.log(`  Firebase: ${p}`)
    initialized = true
    break
  }
}

if (!initialized) {
  console.error('ERRO: Nenhum service account encontrado.')
  console.error('Esperado em:', serviceAccountPaths.join('\n  '))
  process.exit(1)
}

const firestore = admin.firestore()

// ============================================================================
// Supabase Setup (service_role para bypass de RLS)
// ============================================================================

let envVars = {}
const envPath = resolve(projectRoot, '.env.local')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) envVars[m[1].trim()] = m[2].trim()
  })
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('ERRO: VITE_SUPABASE_URL nao encontrado no .env.local')
  process.exit(1)
}
if (!serviceRoleKey) {
  console.error('ERRO: SUPABASE_SERVICE_ROLE_KEY nao definido.')
  console.error('Use: SUPABASE_SERVICE_ROLE_KEY="eyJ..." node migrate-firestore-to-supabase.mjs --execute')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ============================================================================
// Constants
// ============================================================================

const ADMIN_UID = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'
const ADMIN_EMAIL = 'wguime@yahoo.com.br'
const ADMIN_NAME = 'Sistema de Migracao'

// ============================================================================
// Helpers
// ============================================================================

function toISO(ts) {
  if (!ts) return null
  if (ts.toDate) return ts.toDate().toISOString()
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString()
  if (ts instanceof Date) return ts.toISOString()
  if (typeof ts === 'string') return ts
  return null
}

function log(msg) { console.log(`  ${msg}`) }
function logV(msg) { if (VERBOSE) console.log(`    ${msg}`) }

async function getCollection(name) {
  try {
    const snap = await firestore.collection(name).get()
    return snap.empty ? [] : snap.docs
  } catch {
    return []
  }
}

async function upsertBatch(table, rows, opts = {}) {
  if (!rows.length) return { ok: 0, errors: [] }
  const batchSize = opts.batchSize || 50
  const onConflict = opts.onConflict || undefined
  let ok = 0
  const errors = []

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const query = onConflict
      ? supabase.from(table).upsert(batch, { onConflict })
      : supabase.from(table).insert(batch)
    const { data, error } = await query.select('*')
    if (error) {
      errors.push({ batch: i, msg: error.message })
      console.error(`    ERRO ${table} batch ${i}: ${error.message}`)
    } else {
      ok += data?.length || batch.length
    }
  }
  return { ok, errors }
}

// ============================================================================
// TRUNCATION — Clear test data before migration
// ============================================================================

const TRUNCATE_ORDER = [
  'documento_aprovacoes',
  'documento_distribuicao',
  'documento_changelog',
  'documento_versoes',
  'comunicado_acoes_completadas',
  'comunicado_confirmacoes',
  'comunicados',
  'incidentes',
  'documentos',
  // profiles: delete non-admin only
  // authorized_emails: truncate all
]

async function truncateTables() {
  console.log('\n--- Truncando tabelas Supabase (dados de teste) ---\n')

  for (const table of TRUNCATE_ORDER) {
    const { error } = await supabase.from(table).delete().neq('id', '__impossible__')
    if (error) {
      // Some tables use different PK names, try alternatives
      const { error: e2 } = await supabase.from(table).delete().gte('created_at', '1970-01-01')
      if (e2) console.error(`  ERRO truncando ${table}: ${e2.message}`)
      else log(`${table}: truncado`)
    } else {
      log(`${table}: truncado`)
    }
  }

  // profiles: delete non-admin only (preserve admin seeds)
  const { error: profileErr } = await supabase
    .from('profiles')
    .delete()
    .eq('is_admin', false)
  if (profileErr) console.error(`  ERRO truncando profiles: ${profileErr.message}`)
  else log('profiles: truncado (preservando admins)')

  // authorized_emails: delete all (will re-insert)
  const { error: emailErr } = await supabase
    .from('authorized_emails')
    .delete()
    .neq('email', '__impossible__')
  if (emailErr) console.error(`  ERRO truncando authorized_emails: ${emailErr.message}`)
  else log('authorized_emails: truncado')
}

// ============================================================================
// 1. MIGRATE authorized_emails
// ============================================================================

async function migrateAuthorizedEmails() {
  console.log('\n--- 1/6: Migrando authorized_emails ---\n')

  const docs = await getCollection('authorizedEmails')
  // Also try alternative collection name
  const docs2 = await getCollection('authorized_emails')
  const allDocs = [...docs, ...docs2]

  if (!allDocs.length) {
    log('Nenhum email autorizado encontrado no Firestore')
    return { read: 0, written: 0 }
  }

  log(`Lidos: ${allDocs.length} emails`)

  const rows = allDocs.map(doc => {
    const d = doc.data()
    return {
      email: (doc.id || d.email || '').toLowerCase().trim(),
      added_at: toISO(d.addedAt) || new Date().toISOString(),
      added_by: d.addedBy || 'system',
    }
  }).filter(r => r.email && r.email.includes('@'))

  logV(`Validos: ${rows.length}`)

  if (DRY_RUN) return { read: allDocs.length, written: rows.length }

  const { ok, errors } = await upsertBatch('authorized_emails', rows, { onConflict: 'email' })
  log(`Inseridos: ${ok}`)
  return { read: allDocs.length, written: ok, errors }
}

// ============================================================================
// 2. MIGRATE profiles (users + userProfiles)
// ============================================================================

const ROLE_MAP = {
  'administrador': 'colaborador',
  'Administrador': 'colaborador',
  'coordenador': 'colaborador',
  'Coordenador': 'colaborador',
  'socio': 'anestesiologista',
  'anestesiologista': 'anestesiologista',
  'enfermeira': 'enfermeiro',
  'enfermeiro': 'enfermeiro',
  'farmaceutica': 'farmaceutico',
  'farmaceutico': 'farmaceutico',
  'tecnico-enfermagem': 'tec-enfermagem',
  'tec-enfermagem': 'tec-enfermagem',
  'secretaria': 'secretaria',
  'medico-residente': 'medico-residente',
  'residente': 'medico-residente',
  'funcionaria': 'colaborador',
  'colaborador': 'colaborador',
}

function mapRole(v1Role) {
  if (!v1Role) return 'colaborador'
  return ROLE_MAP[v1Role] || ROLE_MAP[v1Role.toLowerCase()] || 'colaborador'
}

function isAdminRole(role) {
  return ['administrador', 'Administrador'].includes(role)
}

function isCoordenadorRole(role) {
  return ['coordenador', 'Coordenador'].includes(role)
}

async function migrateProfiles() {
  console.log('\n--- 2/6: Migrando profiles (users + userProfiles) ---\n')

  const userDocs = await getCollection('users')
  const profileDocs = await getCollection('userProfiles')

  log(`Firestore: ${userDocs.length} users, ${profileDocs.length} userProfiles`)

  // Build maps by Firebase UID
  const usersMap = new Map()
  for (const doc of userDocs) {
    usersMap.set(doc.id, doc.data())
  }

  const profilesMap = new Map()
  for (const doc of profileDocs) {
    profilesMap.set(doc.id, doc.data())
  }

  // Merge by UID (union of both collections)
  const allUIDs = new Set([...usersMap.keys(), ...profilesMap.keys()])
  log(`UIDs unicos: ${allUIDs.size}`)

  // Build email→UID map for later use
  const emailToUid = new Map()
  const profiles = []
  const adminUIDs = []

  for (const uid of allUIDs) {
    const u = usersMap.get(uid) || {}
    const p = profilesMap.get(uid) || {}

    const nome = u.name || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}`.trim() : '') || u.email || 'Sem nome'
    const email = (u.email || p.email || '').toLowerCase().trim()

    if (!email) {
      logV(`SKIP uid=${uid}: sem email`)
      continue
    }

    emailToUid.set(email, uid)

    const v1Role = u.role || p.role || ''
    const isAdmin = p.isAdmin === true || isAdminRole(v1Role)
    const isCoordenador = p.isCoordenador === true || isCoordenadorRole(v1Role)

    // Merge permissions
    const permissions = {}
    if (u.cardPermissions) permissions.cardPermissions = u.cardPermissions
    if (u.documentCategoryPermissions) permissions.documentCategoryPermissions = u.documentCategoryPermissions
    if (u.customPermissions) permissions.customPermissions = u.customPermissions
    if (p.permissions) Object.assign(permissions, p.permissions)

    profiles.push({
      id: uid,
      nome,
      email,
      role: mapRole(v1Role),
      active: true,
      is_admin: isAdmin,
      is_coordenador: isCoordenador,
      custom_permissions: Object.keys(permissions).length > 0,
      permissions,
      created_at: toISO(u.createdAt || p.createdAt) || new Date().toISOString(),
    })

    if (isAdmin) adminUIDs.push({ uid, email })

    logV(`${uid}: ${nome} (${email}) → role=${mapRole(v1Role)}, admin=${isAdmin}, coord=${isCoordenador}`)
  }

  log(`Profiles a migrar: ${profiles.length}`)
  log(`Admins encontrados: ${adminUIDs.length}`)

  if (DRY_RUN) return { read: allUIDs.size, written: profiles.length, adminUIDs, emailToUid }

  // Upsert profiles
  const { ok: profileOk } = await upsertBatch('profiles', profiles, { onConflict: 'id' })
  log(`Profiles inseridos: ${profileOk}`)

  // Upsert admin_users
  const adminRows = adminUIDs.map(a => ({
    firebase_uid: a.uid,
    email: a.email,
    role: 'admin',
  }))
  const { ok: adminOk } = await upsertBatch('admin_users', adminRows, { onConflict: 'firebase_uid' })
  log(`Admin users atualizados: ${adminOk}`)

  return { read: allUIDs.size, written: profileOk, adminUIDs, emailToUid }
}

// ============================================================================
// 3. MIGRATE documentos (~30+ collections)
// ============================================================================

const COLLECTION_MAP = {
  // ─── Auditorias ───
  auditorias_documentos:       { categoria: 'auditorias', subcategoria: 'auditorias_documentos', prefix: 'AUD' },
  auditoria_higiene_maos:      { categoria: 'auditorias', subcategoria: 'auditoria_higiene_maos', prefix: 'AUD' },
  auditoria_uso_medicamentos:  { categoria: 'auditorias', subcategoria: 'auditoria_uso_medicamentos', prefix: 'AUD' },
  auditoria_abreviaturas:      { categoria: 'auditorias', subcategoria: 'auditoria_abreviaturas', prefix: 'AUD' },
  auditorias_evidencias:       { categoria: 'auditorias', subcategoria: 'auditorias_evidencias', prefix: 'AUD' },
  checklist_documentos:        { categoria: 'auditorias', subcategoria: 'checklist_documentos', prefix: 'AUD' },
  checklist_cirurgia:          { categoria: 'auditorias', subcategoria: 'checklist_cirurgia', prefix: 'AUD' },
  politica_gestao_qualidade:   { categoria: 'auditorias', subcategoria: 'politica_gestao_qualidade', prefix: 'AUD' },
  politica_disclosure:         { categoria: 'auditorias', subcategoria: 'politica_disclosure', prefix: 'AUD' },
  kpi_documentos:              { categoria: 'auditorias', subcategoria: 'kpi_documentos', prefix: 'AUD' },
  kpi_adesao_protocolos:       { categoria: 'auditorias', subcategoria: 'kpi_adesao_protocolos', prefix: 'AUD' },
  kpi_taxa_infeccao:           { categoria: 'auditorias', subcategoria: 'kpi_taxa_infeccao', prefix: 'AUD' },

  // ─── Relatorios ───
  relatorios_documentos:       { categoria: 'relatorios', subcategoria: 'relatorios_documentos', prefix: 'REL' },
  relatorio_trimestral:        { categoria: 'relatorios', subcategoria: 'relatorio_trimestral', prefix: 'REL' },
  relatorio_incidentes:        { categoria: 'relatorios', subcategoria: 'relatorio_incidentes', prefix: 'REL' },
  relatorio_auditorias:        { categoria: 'relatorios', subcategoria: 'relatorio_auditorias', prefix: 'REL' },
  relatorio_indicadores:       { categoria: 'relatorios', subcategoria: 'relatorio_indicadores', prefix: 'REL' },

  // ─── Biblioteca ───
  biblioteca_documentos:       { categoria: 'biblioteca', subcategoria: 'biblioteca_documentos', prefix: 'BIB' },
  doc_lista_abreviaturas:      { categoria: 'biblioteca', subcategoria: 'doc_lista_abreviaturas', prefix: 'BIB' },
  protocolo_institucional:     { categoria: 'biblioteca', subcategoria: 'protocolo_institucional', prefix: 'BIB' },
  desastres_documentos:        { categoria: 'biblioteca', subcategoria: 'desastres_documentos', prefix: 'BIB' },
  organograma_documentos:      { categoria: 'biblioteca', subcategoria: 'organograma_documentos', prefix: 'BIB' },

  // ─── Medicamentos ───
  doc_mav:                     { categoria: 'medicamentos', subcategoria: 'doc_mav', prefix: 'MED' },
  doc_eletrolitos:             { categoria: 'medicamentos', subcategoria: 'doc_eletrolitos', prefix: 'MED' },
  doc_heparina:                { categoria: 'medicamentos', subcategoria: 'doc_heparina', prefix: 'MED' },
  doc_narcoticos:              { categoria: 'medicamentos', subcategoria: 'doc_narcoticos', prefix: 'MED' },
  doc_intoxicacao_anestesicos: { categoria: 'medicamentos', subcategoria: 'doc_intoxicacao_anestesicos', prefix: 'MED' },
  doc_manejo_glicemia:         { categoria: 'medicamentos', subcategoria: 'doc_manejo_glicemia', prefix: 'MED' },
  medicamentos_documentos:     { categoria: 'medicamentos', subcategoria: 'medicamentos_documentos', prefix: 'MED' },
  conciliacao_documentos:      { categoria: 'medicamentos', subcategoria: 'conciliacao_documentos', prefix: 'MED' },
  conciliacao_admissao:        { categoria: 'medicamentos', subcategoria: 'conciliacao_admissao', prefix: 'MED' },
  conciliacao_transferencia:   { categoria: 'medicamentos', subcategoria: 'conciliacao_transferencia', prefix: 'MED' },
  conciliacao_alta:            { categoria: 'medicamentos', subcategoria: 'conciliacao_alta', prefix: 'MED' },

  // ─── Infeccoes ───
  protocolo_higiene_maos:                { categoria: 'infeccoes', subcategoria: 'protocolo_higiene_maos', prefix: 'INF' },
  protocolo_prevencao_isc:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_isc', prefix: 'INF' },
  protocolo_prevencao_ics:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_ics', prefix: 'INF' },
  protocolo_prevencao_pav:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_pav', prefix: 'INF' },
  protocolo_prevencao_itu:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_itu', prefix: 'INF' },
  protocolo_prevencao_broncoaspiracao:    { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_broncoaspiracao', prefix: 'INF' },
  protocolo_prevencao_alergia_latex:      { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_alergia_latex', prefix: 'INF' },
  infeccao_documentos:                   { categoria: 'infeccoes', subcategoria: 'infeccao_documentos', prefix: 'INF' },

  // ─── Etica ───
  etica_dilemas_documentos:             { categoria: 'etica', subcategoria: 'etica_dilemas_documentos', prefix: 'ETI' },
  etica_parecer_uti_documentos:         { categoria: 'etica', subcategoria: 'etica_parecer_uti_documentos', prefix: 'ETI' },
  etica_diretrizes_documentos:          { categoria: 'etica', subcategoria: 'etica_diretrizes_documentos', prefix: 'ETI' },
  etica_parecer_tecnico_documentos:     { categoria: 'etica', subcategoria: 'etica_parecer_tecnico_documentos', prefix: 'ETI' },
  etica_codigo_documentos:              { categoria: 'etica', subcategoria: 'etica_codigo_documentos', prefix: 'ETI' },

  // ─── Comites ───
  comites_documentos:                   { categoria: 'comites', subcategoria: null, prefix: 'COM' },
}

// Derive tipo from collection name
function deriveTipo(collectionName) {
  if (collectionName.startsWith('protocolo_')) return 'Protocolo'
  if (collectionName.startsWith('politica_')) return 'Politica'
  if (collectionName.startsWith('relatorio_')) return 'Relatorio'
  if (collectionName.startsWith('auditoria_') || collectionName.startsWith('auditorias_')) return 'Auditoria'
  if (collectionName.startsWith('checklist_')) return 'Checklist'
  if (collectionName.startsWith('kpi_')) return 'KPI'
  if (collectionName.startsWith('doc_')) return 'Documento'
  if (collectionName.startsWith('etica_')) return 'Documento'
  if (collectionName.startsWith('conciliacao_')) return 'Protocolo'
  return 'Documento'
}

// Build Firebase Storage URL from path
function buildStorageUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`
}

// Global counters per category prefix for codigo generation
const codigoCounters = {}

function nextCodigo(prefix) {
  if (!codigoCounters[prefix]) codigoCounters[prefix] = 0
  codigoCounters[prefix]++
  return `${prefix}-${String(codigoCounters[prefix]).padStart(3, '0')}`
}

async function migrateDocumentos(emailToUid) {
  console.log('\n--- 3/6: Migrando documentos (~30+ collections) ---\n')

  const stats = { read: 0, written: 0, byCategory: {}, byCollection: {}, errors: [] }
  const allRows = []
  const allVersions = []
  const allChangelog = []

  for (const [collectionName, mapping] of Object.entries(COLLECTION_MAP)) {
    const docs = await getCollection(collectionName)

    stats.byCollection[collectionName] = docs.length
    if (!docs.length) {
      logV(`${collectionName}: vazia`)
      continue
    }

    log(`${collectionName}: ${docs.length} doc(s) → ${mapping.categoria}`)
    stats.read += docs.length

    if (!stats.byCategory[mapping.categoria]) stats.byCategory[mapping.categoria] = 0
    stats.byCategory[mapping.categoria] += docs.length

    for (const fsDoc of docs) {
      const d = fsDoc.data()
      const id = `doc-legacy-${fsDoc.id}`

      // Resolve arquivo URL
      const storagePath = d.storagePath || d.arquivo?.storagePath || null
      let arquivoUrl = d.arquivoURL || d.arquivo?.url || d.arquivo || null
      if (typeof arquivoUrl === 'object') arquivoUrl = null
      if (!arquivoUrl && storagePath) arquivoUrl = buildStorageUrl(storagePath)

      const arquivoNome = d.arquivoNome || d.arquivo?.nome || (storagePath ? storagePath.split('/').pop() : null)

      // Resolve created_by UID
      let createdBy = ADMIN_UID
      if (d.autor && emailToUid?.get(d.autor)) {
        createdBy = emailToUid.get(d.autor)
      } else if (d.createdBy) {
        createdBy = d.createdBy
      }

      const createdByName = d.autorNome || d.autor || 'Sistema'
      const createdAt = toISO(d.data || d.createdAt) || new Date().toISOString()

      // For comites_documentos, use comiteId as subcategoria
      const subcategoria = collectionName === 'comites_documentos'
        ? (d.comiteId || 'geral')
        : mapping.subcategoria

      const status = d.ativo === false ? 'arquivado' : 'ativo'
      const codigo = nextCodigo(mapping.prefix)

      const row = {
        id,
        codigo,
        titulo: d.titulo || 'Documento sem titulo',
        descricao: d.descricao || '',
        tipo: deriveTipo(collectionName),
        categoria: mapping.categoria,
        subcategoria,
        status,
        versao_atual: 1,
        setor_id: d.setorId || null,
        setor_nome: d.setorNome || null,
        responsavel: d.responsavel || createdByName,
        responsavel_revisao: null,
        arquivo_url: arquivoUrl,
        arquivo_nome: arquivoNome,
        arquivo_tamanho: d.arquivoTamanho || d.arquivo?.tamanho || null,
        storage_path: storagePath,
        proxima_revisao: null,
        intervalo_revisao_dias: 365,
        rop_area: null,
        qmentum_weight: null,
        approval_workflow: JSON.stringify({ requiredApprovers: [], currentStep: 0, status: 'completed' }),
        tags: d.tags || [],
        observacoes: d.observacoes || null,
        view_count: 0,
        download_count: 0,
        created_by: createdBy,
        created_by_name: createdByName,
        created_by_email: null,
        updated_by: null,
        updated_by_name: null,
        created_at: createdAt,
        updated_at: createdAt,
      }

      allRows.push(row)

      // Version record
      allVersions.push({
        documento_id: id,
        versao: 1,
        arquivo_url: arquivoUrl,
        arquivo_nome: arquivoNome,
        arquivo_tamanho: d.arquivoTamanho || d.arquivo?.tamanho || null,
        storage_path: storagePath,
        descricao_alteracao: 'Versao inicial (migrada do Firestore)',
        motivo_alteracao: 'Migracao v1.0 para v2.0',
        status: 'ativo',
        created_by: createdBy,
        created_by_name: createdByName,
        created_at: createdAt,
      })

      // Changelog record
      allChangelog.push({
        documento_id: id,
        action: 'created',
        user_id: ADMIN_UID,
        user_name: ADMIN_NAME,
        user_email: ADMIN_EMAIL,
        changes: JSON.stringify({
          source: 'migration_v1_to_v2',
          firestore_collection: collectionName,
          firestore_id: fsDoc.id,
        }),
        comment: `Documento migrado da colecao Firestore "${collectionName}"`,
        created_at: createdAt,
      })

      logV(`  ${id}: "${row.titulo}" (${mapping.categoria}/${subcategoria})`)
    }
  }

  log(`\nTotal documentos lidos: ${stats.read}`)
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    log(`  ${cat}: ${count}`)
  }

  if (DRY_RUN) {
    stats.written = allRows.length
    return stats
  }

  // Insert documents
  log('\nInserindo documentos...')
  const { ok: docOk, errors: docErrs } = await upsertBatch('documentos', allRows, { onConflict: 'id' })
  stats.written = docOk
  stats.errors.push(...docErrs)
  log(`Documentos inseridos: ${docOk}`)

  // Insert versions
  log('Inserindo versoes...')
  const { ok: verOk } = await upsertBatch('documento_versoes', allVersions, { onConflict: 'documento_id,versao' })
  log(`Versoes inseridas: ${verOk}`)

  // Insert changelog
  log('Inserindo changelog...')
  const { ok: clOk } = await upsertBatch('documento_changelog', allChangelog)
  log(`Changelog inserido: ${clOk}`)

  // Set review dates for active docs
  log('Definindo datas de revisao...')
  const { data: activeDocs } = await supabase
    .from('documentos')
    .select('id, created_at')
    .like('id', 'doc-legacy-%')
    .eq('status', 'ativo')
    .is('proxima_revisao', null)

  if (activeDocs?.length) {
    let reviewOk = 0
    for (const doc of activeDocs) {
      const review = new Date(new Date(doc.created_at).getTime() + 365 * 86400000)
      const { error } = await supabase
        .from('documentos')
        .update({ proxima_revisao: review.toISOString() })
        .eq('id', doc.id)
      if (!error) reviewOk++
    }
    log(`Datas de revisao definidas: ${reviewOk}`)
  }

  return stats
}

// ============================================================================
// 4. MIGRATE incidentes
// ============================================================================

async function migrateIncidentes() {
  console.log('\n--- 4/6: Migrando incidentes ---\n')

  const docs = await getCollection('incidentes')
  log(`Lidos: ${docs.length} incidentes`)

  if (!docs.length) return { read: 0, written: 0 }

  const rows = docs.map(fsDoc => {
    const d = fsDoc.data()

    const createdAt = toISO(d.data || d.dataPreenchimento || d.createdAt) || new Date().toISOString()
    const year = new Date(createdAt).getFullYear()
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const trackingCode = `ANEST-${year}-${code}`

    return {
      protocolo: d.numeroProtocolo || null,
      tracking_code: trackingCode,
      tipo: 'incidente',
      status: d.status || 'pendente',
      source: d.fonte || 'app',
      user_id: d.notificadoPor || null,
      notificante: JSON.stringify({
        nome: d.nomeNotificante || null,
        funcao: d.funcaoNotificante || null,
        setor: d.setorNotificante || null,
        contato: d.contatoNotificante || null,
        tipoIdentificacao: d.notificacaoAnonima ? 'anonimo' : 'identificado',
      }),
      incidente_data: JSON.stringify({
        descricaoCurta: d.descricaoCurta || null,
        descricaoDetalhada: d.descricaoDetalhada || null,
        dataOcorrido: toISO(d.dataOcorrido) || null,
        local: d.local || null,
        tipo: d.tipo || null,
        severidade: d.severidade || null,
        causas: d.causas || null,
        dano: d.dano || null,
        danoDescricao: d.danoDescricao || null,
        acoes: d.acoes || null,
        sugestoes: d.sugestoes || null,
        categoriaRisco: d.categoriaRisco || null,
        envolvimentoPaciente: d.envolvimentoPaciente || null,
        nomePaciente: d.nomePaciente || null,
        numeroProntuario: d.numeroProntuario || null,
        idadePaciente: d.idadePaciente || null,
        sexoPaciente: d.sexoPaciente || null,
      }),
      impacto: JSON.stringify({
        faseProcedimento: d.faseProcedimento || null,
        responsavelAcao: d.responsavelAcao || null,
        dataPrevistaImplementacao: toISO(d.dataPrevistaImplementacao) || null,
        necessitaInvestigacao: d.necessitaInvestigacao || null,
        encaminhamentoComissao: d.encaminhamentoComissao || null,
        comunicadoPaciente: d.comunicadoPaciente || null,
        relatadoOrgaoRegulador: d.relatadoOrgaoRegulador || null,
        resultadoFinal: d.resultadoFinal || null,
      }),
      contexto_anest: JSON.stringify({
        tipoAnestesia: d.tipoAnestesia || null,
        monitoramento: d.monitoramento || null,
      }),
      gestao_interna: JSON.stringify({
        responsavel: d.responsavelAcao || null,
        dataResolucao: toISO(d.dataEncerramento) || null,
      }),
      lgpd_consent_at: d.consentimentoUso ? (toISO(d.dataPreenchimento) || createdAt) : null,
      created_at: createdAt,
    }
  })

  logV(`Incidentes processados: ${rows.length}`)

  if (DRY_RUN) return { read: docs.length, written: rows.length }

  const { ok, errors } = await upsertBatch('incidentes', rows)
  log(`Inseridos: ${ok}`)
  return { read: docs.length, written: ok, errors }
}

// ============================================================================
// 5. MIGRATE denuncias → incidentes (tipo='denuncia')
// ============================================================================

async function migrateDenuncias() {
  console.log('\n--- 5/6: Migrando denuncias ---\n')

  const docs = await getCollection('denuncias')
  log(`Lidos: ${docs.length} denuncias`)

  if (!docs.length) return { read: 0, written: 0 }

  const rows = docs.map(fsDoc => {
    const d = fsDoc.data()

    const createdAt = toISO(d.data || d.dataPreenchimento || d.createdAt) || new Date().toISOString()
    const year = new Date(createdAt).getFullYear()
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const trackingCode = `ANEST-${year}-${code}`

    return {
      protocolo: d.numeroProtocolo || null,
      tracking_code: trackingCode,
      tipo: 'denuncia',
      status: d.status || 'pendente',
      source: 'app',
      user_id: d.denunciadoPor || d.userId || null,
      denunciante: JSON.stringify({
        nome: d.nomeDenunciante || null,
        funcao: d.funcaoDenunciante || null,
        unidade: d.unidadeDenunciante || null,
        contato: d.contatoDenunciante || null,
        tipoIdentificacao: d.anonimo ? 'anonimo' : 'identificado',
        desejaSerInformado: d.desejaSerInformado || false,
      }),
      denuncia_data: JSON.stringify({
        tipo: d.tipo || null,
        dataOcorrido: toISO(d.dataOcorrido) || null,
        horaOcorrido: d.horaOcorrido || null,
        local: d.local || null,
        nomeEnvolvidos: d.nomeEnvolvidos || null,
        cargoEnvolvidos: d.cargoEnvolvidos || null,
        descricao: d.descricao || null,
        testemunhas: d.testemunhas || null,
        impacto: d.impacto || null,
        medidasTomadas: d.medidasTomadas || null,
      }),
      attachments: JSON.stringify(d.anexos || []),
      lgpd_consent_at: d.consentimentoUso ? (toISO(d.dataPreenchimento) || createdAt) : null,
      created_at: createdAt,
    }
  })

  if (DRY_RUN) return { read: docs.length, written: rows.length }

  const { ok, errors } = await upsertBatch('incidentes', rows)
  log(`Inseridos: ${ok}`)
  return { read: docs.length, written: ok, errors }
}

// ============================================================================
// 6. MIGRATE comunicados
// ============================================================================

function mapComunicadoTipo(prioridade) {
  if (!prioridade) return 'Geral'
  const p = prioridade.toLowerCase()
  if (p === 'alta' || p === 'urgente') return 'Urgente'
  if (p === 'media' || p === 'importante') return 'Importante'
  if (p === 'baixa' || p === 'informativo') return 'Informativo'
  return 'Geral'
}

async function migrateComunicados(emailToUid) {
  console.log('\n--- 6/6: Migrando comunicados ---\n')

  const docs = await getCollection('comunicados')
  log(`Lidos: ${docs.length} comunicados`)

  if (!docs.length) return { read: 0, written: 0 }

  const rows = docs.map(fsDoc => {
    const d = fsDoc.data()

    // Resolve autor UID
    let autorId = ADMIN_UID
    if (d.autorEmail && emailToUid?.get(d.autorEmail.toLowerCase())) {
      autorId = emailToUid.get(d.autorEmail.toLowerCase())
    } else if (d.autorId) {
      autorId = d.autorId
    }

    return {
      id: `com-${fsDoc.id.slice(0, 8)}`,
      tipo: mapComunicadoTipo(d.prioridade || d.tipo),
      titulo: d.titulo || 'Comunicado sem titulo',
      conteudo: d.conteudo || '',
      status: 'publicado',
      rop_area: d.categoria || 'geral',
      autor_id: autorId,
      autor_nome: d.autorNome || 'Sistema',
      arquivado: d.ativo === false,
      created_at: toISO(d.data || d.createdAt) || new Date().toISOString(),
    }
  })

  if (DRY_RUN) return { read: docs.length, written: rows.length }

  const { ok, errors } = await upsertBatch('comunicados', rows, { onConflict: 'id' })
  log(`Inseridos: ${ok}`)
  return { read: docs.length, written: ok, errors }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(72))
  console.log('  MIGRACAO COMPLETA: Firestore (v1.0) → Supabase (v2.0)')
  console.log('  Firestore: SOMENTE LEITURA — nenhum dado sera alterado')
  console.log('='.repeat(72))

  if (DRY_RUN) {
    console.log('\n  ** MODO DRY-RUN (padrao) — nenhum dado sera gravado **')
    console.log('  Use --execute para gravar no Supabase.\n')
  } else {
    console.log('\n  ** MODO EXECUTE — dados serao gravados no Supabase **\n')
  }

  // Step 0: Truncate (only in execute mode)
  if (!DRY_RUN) {
    await truncateTables()
  }

  // Step 1: authorized_emails
  const emailResult = await migrateAuthorizedEmails()

  // Step 2: profiles
  const profileResult = await migrateProfiles()
  const emailToUid = profileResult.emailToUid

  // Step 3: documentos
  const docResult = await migrateDocumentos(emailToUid)

  // Step 4: incidentes
  const incResult = await migrateIncidentes()

  // Step 5: denuncias
  const denResult = await migrateDenuncias()

  // Step 6: comunicados
  const comResult = await migrateComunicados(emailToUid)

  // ============================================================================
  // RELATORIO FINAL
  // ============================================================================

  console.log('\n' + '='.repeat(72))
  console.log('  RELATORIO DE MIGRACAO')
  console.log('='.repeat(72))

  const report = [
    ['authorized_emails', emailResult],
    ['profiles', profileResult],
    ['documentos', docResult],
    ['incidentes', incResult],
    ['denuncias', denResult],
    ['comunicados', comResult],
  ]

  let totalRead = 0
  let totalWritten = 0
  let totalErrors = 0

  console.log('')
  for (const [name, result] of report) {
    const read = result.read || 0
    const written = result.written || 0
    const errs = result.errors?.length || 0
    const match = read === written ? 'OK' : `DIVERGENCIA (${read} lidos vs ${written} escritos)`
    console.log(`  ${name.padEnd(22)} Lidos: ${String(read).padStart(4)}  Escritos: ${String(written).padStart(4)}  ${errs ? `Erros: ${errs}` : match}`)
    totalRead += read
    totalWritten += written
    totalErrors += errs
  }

  console.log(`\n  ${'TOTAL'.padEnd(22)} Lidos: ${String(totalRead).padStart(4)}  Escritos: ${String(totalWritten).padStart(4)}  Erros: ${totalErrors}`)

  if (docResult.byCategory) {
    console.log('\n  Documentos por categoria:')
    for (const [cat, count] of Object.entries(docResult.byCategory)) {
      console.log(`    ${cat}: ${count}`)
    }
  }

  if (docResult.byCollection) {
    const nonEmpty = Object.entries(docResult.byCollection).filter(([, c]) => c > 0)
    const empty = Object.entries(docResult.byCollection).filter(([, c]) => c === 0)
    console.log(`\n  Collections com dados: ${nonEmpty.length}`)
    console.log(`  Collections vazias: ${empty.length}`)
    if (VERBOSE && empty.length) {
      console.log('    Vazias:', empty.map(([n]) => n).join(', '))
    }
  }

  if (profileResult.adminUIDs?.length) {
    console.log('\n  Admins:')
    for (const a of profileResult.adminUIDs) {
      console.log(`    ${a.uid} (${a.email})`)
    }
  }

  console.log(`\n  Firestore: INTACTO (nenhuma alteracao)`)
  console.log(`  Modo: ${DRY_RUN ? 'DRY-RUN (nenhum dado gravado)' : 'EXECUTE (dados gravados)'}`)
  console.log('\n' + '='.repeat(72))

  if (DRY_RUN) {
    console.log('\n  Para executar a migracao real:')
    console.log('  SUPABASE_SERVICE_ROLE_KEY="eyJ..." node migrate-firestore-to-supabase.mjs --execute\n')
  }

  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\nERRO FATAL:', err)
  process.exit(1)
})
