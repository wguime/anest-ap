#!/usr/bin/env node

/**
 * Sync Script: Copia documentos do Firestore (ANEST legado) → Supabase (ANEST v2.0)
 *
 * Os documentos PERMANECEM no Firestore — este script apenas copia para o Supabase.
 * Assim o app v2.0 encontra todos os documentos do sistema legado.
 *
 * Pré-requisitos:
 *   1. Firebase CLI logado (firebase login) OU serviceAccountKey.json
 *   2. SUPABASE_SERVICE_ROLE_KEY como variável de ambiente
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/sync-firestore-to-supabase.mjs
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/sync-firestore-to-supabase.mjs --dry-run
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/sync-firestore-to-supabase.mjs --collection auditoria_higiene_maos
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/sync-firestore-to-supabase.mjs --verbose
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
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')
const colIdx = args.indexOf('--collection')
const ONLY_COLLECTION = colIdx !== -1 ? args[colIdx + 1] : null

// ============================================================================
// Firebase Admin Setup (usa Firebase CLI credentials ou serviceAccountKey.json)
// ============================================================================

const admin = require('firebase-admin')

// Tentar serviceAccountKey.json primeiro
const serviceAccountPaths = [
  resolve(projectRoot, 'serviceAccountKey.json'),
  resolve(projectRoot, '..', '..', 'App', 'serviceAccountKey.json'),
  resolve(projectRoot, '..', '..', 'Qmentum', 'App', 'serviceAccountKey.json'),
]

let initialized = false

for (const p of serviceAccountPaths) {
  if (existsSync(p)) {
    const sa = JSON.parse(readFileSync(p, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: 'anest-ap',
    })
    console.log(`Firebase: serviceAccountKey.json (${p})`)
    initialized = true
    break
  }
}

// Fallback: usar Firebase CLI credentials (ADC)
if (!initialized) {
  // Extrair credenciais do Firebase CLI config
  const cliConfigPath = resolve(
    process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json'
  )
  if (existsSync(cliConfigPath)) {
    const cliConfig = JSON.parse(readFileSync(cliConfigPath, 'utf8'))
    const tokens = cliConfig.tokens || {}
    if (tokens.refresh_token) {
      // Criar arquivo ADC temporario
      const adcPath = '/tmp/firebase-adc-sync.json'
      const adcCred = {
        type: 'authorized_user',
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
        refresh_token: tokens.refresh_token,
      }
      const { writeFileSync } = await import('fs')
      writeFileSync(adcPath, JSON.stringify(adcCred))
      process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'anest-ap',
      })
      console.log('Firebase: usando credenciais do Firebase CLI')
      initialized = true
    }
  }

  if (!initialized) {
    console.error('ERRO: Nenhuma credencial Firebase encontrada.')
    console.log('Opcoes:')
    console.log('  1. firebase login (Firebase CLI)')
    console.log('  2. Salvar serviceAccountKey.json na raiz do projeto')
    process.exit(1)
  }
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
  console.log('Use: SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/sync-firestore-to-supabase.mjs')
  console.log('Obtenha em: Supabase Dashboard > Settings > API > service_role key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ============================================================================
// Mapeamento: Colecoes Firestore → Categorias v2.0
// ============================================================================

const COLLECTION_MAP = {
  // ─── Auditorias ───────────────────────────────────────
  auditoria_higiene_maos: {
    categoria: 'auditorias', tipo: 'higiene_maos',
    subcategoria: 'Higiene das Maos', prefix: 'AUD.HIG',
    ropArea: 'Gestao de Riscos', weight: 1.5,
  },
  auditoria_uso_medicamentos: {
    categoria: 'auditorias', tipo: 'uso_medicamentos',
    subcategoria: 'Uso de Medicamentos', prefix: 'AUD.MED',
    ropArea: 'Gestao de Riscos', weight: 1.5,
  },
  auditoria_abreviaturas: {
    categoria: 'auditorias', tipo: 'abreviaturas',
    subcategoria: 'Abreviaturas Perigosas', prefix: 'AUD.ABR',
    ropArea: 'Gestao de Riscos', weight: 1.5,
  },
  politica_gestao_qualidade: {
    categoria: 'auditorias', tipo: 'politica_gestao_qualidade',
    subcategoria: 'Politica de Gestao da Qualidade', prefix: 'AUD.PGQ',
    ropArea: 'Gestao de Riscos', weight: 1.5,
  },
  politica_disclosure: {
    categoria: 'auditorias', tipo: 'politica_disclosure',
    subcategoria: 'Politica de Disclosure', prefix: 'AUD.DIS',
    ropArea: 'Gestao de Riscos', weight: 1.5,
  },
  checklist_cirurgia: {
    categoria: 'auditorias', tipo: 'checklist_cirurgia',
    subcategoria: 'Checklist de Cirurgia Segura', prefix: 'AUD.CHK',
    ropArea: 'Gestao de Riscos', weight: 1.5,
  },

  // ─── Relatorios ───────────────────────────────────────
  relatorio_trimestral: {
    categoria: 'relatorios', tipo: 'trimestral',
    subcategoria: 'Relatorio Trimestral', prefix: 'REL.TRI',
    ropArea: 'Indicadores', weight: 0.8,
  },
  relatorio_incidentes: {
    categoria: 'relatorios', tipo: 'incidentes',
    subcategoria: 'Consolidado de Incidentes', prefix: 'REL.INC',
    ropArea: 'Indicadores', weight: 0.8,
  },
  relatorio_auditorias: {
    categoria: 'relatorios', tipo: 'auditorias',
    subcategoria: 'Relatorio de Auditorias', prefix: 'REL.AUD',
    ropArea: 'Indicadores', weight: 0.8,
  },
  relatorio_indicadores: {
    categoria: 'relatorios', tipo: 'indicadores_qualidade',
    subcategoria: 'Indicadores de Qualidade', prefix: 'REL.IND',
    ropArea: 'Indicadores', weight: 0.8,
  },
  kpi_adesao_protocolos: {
    categoria: 'relatorios', tipo: 'kpi_adesao_protocolos',
    subcategoria: 'KPI - Adesao aos Protocolos', prefix: 'REL.KAP',
    ropArea: 'Indicadores', weight: 0.8,
  },
  kpi_taxa_infeccao: {
    categoria: 'relatorios', tipo: 'kpi_taxa_infeccao',
    subcategoria: 'KPI - Taxa de Infeccao', prefix: 'REL.KTI',
    ropArea: 'Indicadores', weight: 0.8,
  },

  // ─── Biblioteca ───────────────────────────────────────
  biblioteca_documentos: {
    categoria: 'biblioteca', tipo: 'biblioteca_geral',
    subcategoria: 'Biblioteca Geral', prefix: 'BIB.GER',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_mav: {
    categoria: 'biblioteca', tipo: 'medicamentos_alta_vigilancia',
    subcategoria: 'Medicamentos de Alta Vigilancia', prefix: 'BIB.MAV',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_eletrolitos: {
    categoria: 'biblioteca', tipo: 'eletrolitos',
    subcategoria: 'Eletrolitos Concentrados', prefix: 'BIB.ELE',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_heparina: {
    categoria: 'biblioteca', tipo: 'heparina',
    subcategoria: 'Seguranca no Uso da Heparina', prefix: 'BIB.HEP',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_narcoticos: {
    categoria: 'biblioteca', tipo: 'narcoticos',
    subcategoria: 'Seguranca dos Narcoticos', prefix: 'BIB.NAR',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_lista_abreviaturas: {
    categoria: 'biblioteca', tipo: 'lista_abreviaturas',
    subcategoria: 'Lista de Abreviaturas Perigosas', prefix: 'BIB.ABR',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_intoxicacao_anestesicos: {
    categoria: 'biblioteca', tipo: 'intoxicacao_anestesicos_locais',
    subcategoria: 'Intoxicacao por Anestesicos Locais', prefix: 'BIB.IAL',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  doc_manejo_glicemia: {
    categoria: 'biblioteca', tipo: 'manejo_glicemia',
    subcategoria: 'Manejo da Glicemia', prefix: 'BIB.GLI',
    ropArea: 'Vida Profissional', weight: 1.0,
  },

  // ─── Protocolos (→ biblioteca) ────────────────────────
  protocolo_higiene_maos: {
    categoria: 'biblioteca', tipo: 'protocolo_higiene_maos',
    subcategoria: 'Protocolo de Higiene das Maos', prefix: 'BIB.PHM',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  protocolo_prevencao_isc: {
    categoria: 'biblioteca', tipo: 'protocolo_prevencao_isc',
    subcategoria: 'Prevencao de ISC', prefix: 'BIB.ISC',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  protocolo_prevencao_ics: {
    categoria: 'biblioteca', tipo: 'protocolo_prevencao_ics',
    subcategoria: 'Prevencao de ICS', prefix: 'BIB.ICS',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  protocolo_prevencao_pav: {
    categoria: 'biblioteca', tipo: 'protocolo_prevencao_pav',
    subcategoria: 'Prevencao de PAV', prefix: 'BIB.PAV',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  protocolo_prevencao_itu: {
    categoria: 'biblioteca', tipo: 'protocolo_prevencao_itu',
    subcategoria: 'Prevencao de ITU', prefix: 'BIB.ITU',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  protocolo_prevencao_broncoaspiracao: {
    categoria: 'biblioteca', tipo: 'protocolo_prevencao_broncoaspiracao',
    subcategoria: 'Prevencao da Broncoaspiracao', prefix: 'BIB.BRO',
    ropArea: 'Vida Profissional', weight: 1.0,
  },
  protocolo_prevencao_alergia_latex: {
    categoria: 'biblioteca', tipo: 'protocolo_prevencao_alergia_latex',
    subcategoria: 'Prevencao de Alergia ao Latex', prefix: 'BIB.LAT',
    ropArea: 'Vida Profissional', weight: 1.0,
  },

  // ─── Etica (Conciliacao Medicamentosa) ────────────────
  conciliacao_admissao: {
    categoria: 'etica', tipo: 'conciliacao_admissao',
    subcategoria: 'Conciliacao na Admissao', prefix: 'ETI.ADM',
    ropArea: 'Cultura de Seguranca', weight: 1.2,
  },
  conciliacao_transferencia: {
    categoria: 'etica', tipo: 'conciliacao_transferencia',
    subcategoria: 'Conciliacao na Transferencia', prefix: 'ETI.TRA',
    ropArea: 'Cultura de Seguranca', weight: 1.2,
  },
  conciliacao_alta: {
    categoria: 'etica', tipo: 'conciliacao_alta',
    subcategoria: 'Conciliacao na Alta', prefix: 'ETI.ALT',
    ropArea: 'Cultura de Seguranca', weight: 1.2,
  },
  protocolo_institucional: {
    categoria: 'etica', tipo: 'protocolo_institucional',
    subcategoria: 'Protocolo Institucional', prefix: 'ETI.PIN',
    ropArea: 'Cultura de Seguranca', weight: 1.2,
  },
}

// ============================================================================
// Usuario de sistema para created_by
// ============================================================================

const SYSTEM_USER = {
  uid: 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
  name: 'Sistema de Sincronizacao',
  email: 'wguime@yahoo.com.br',
}

// ============================================================================
// Conversao de campos
// ============================================================================

function toISO(ts) {
  if (!ts) return null
  if (ts.toDate) return ts.toDate().toISOString()
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString()
  if (ts instanceof Date) return ts.toISOString()
  if (typeof ts === 'string') return ts
  return null
}

// Contador global para IDs unicos
let globalCounter = 0

function makeId(mapping, collectionName, counter) {
  globalCounter++
  // Usar abreviacao da colecao para garantir unicidade
  const colShort = collectionName
    .replace('auditoria_', 'aud-')
    .replace('politica_', 'pol-')
    .replace('relatorio_', 'rel-')
    .replace('biblioteca_', 'bib-')
    .replace('protocolo_prevencao_', 'ppv-')
    .replace('protocolo_', 'prt-')
    .replace('conciliacao_', 'con-')
    .replace('checklist_', 'chk-')
    .replace('kpi_', 'kpi-')
    .replace('doc_', 'doc-')
    .replace(/_/g, '-')
  return `${colShort}-${String(counter).padStart(3, '0')}`
}

function makeCodigo(mapping, counter) {
  return `${mapping.prefix}.${String(counter).padStart(4, '0')}-01`
}

function convertDoc(fsDoc, collectionName, counter, colName) {
  const d = fsDoc.data()
  const m = COLLECTION_MAP[collectionName]

  const arquivoUrl = d.arquivoURL || d.arquivo?.url || null
  const arquivoNome = d.arquivoNome || d.arquivo?.nome || null
  const arquivoTamanho = d.arquivoTamanho || d.arquivo?.tamanho || null
  const storagePath = d.storagePath || d.arquivo?.storagePath || null

  const createdBy = d.createdBy || SYSTEM_USER.uid
  const createdByName = d.createdByName || d.autorNome || SYSTEM_USER.name
  const createdByEmail = d.createdByEmail || null
  const createdAt = toISO(d.createdAt || d.data) || new Date().toISOString()

  let status = 'ativo'
  if (d.ativo === false) status = 'arquivado'
  if (d.status) status = d.status

  const codigo = d.codigo || makeCodigo(m, counter)

  return {
    id: makeId(m, colName, counter),
    codigo,
    titulo: d.titulo || 'Documento sem titulo',
    descricao: d.descricao || '',
    tipo: m.tipo,
    categoria: m.categoria,
    subcategoria: m.subcategoria,
    status,
    versao_atual: 1,
    setor_id: d.setorId || null,
    setor_nome: d.setorNome || null,
    responsavel: d.responsavel || createdByName,
    responsavel_revisao: d.responsavelRevisao || null,
    arquivo_url: arquivoUrl,
    arquivo_nome: arquivoNome,
    arquivo_tamanho: arquivoTamanho,
    storage_path: storagePath,
    proxima_revisao: null,
    intervalo_revisao_dias: 365,
    rop_area: m.ropArea,
    qmentum_weight: m.weight,
    approval_workflow: JSON.stringify({
      requiredApprovers: [], currentStep: 0, status: 'completed',
    }),
    tags: d.tags || [],
    observacoes: d.observacoes || null,
    view_count: 0,
    download_count: 0,
    created_by: createdBy,
    created_by_name: createdByName,
    created_by_email: createdByEmail,
    updated_by: null,
    updated_by_name: null,
    created_at: createdAt,
    updated_at: createdAt,
    // metadados internos (removidos antes do insert)
    _fs_id: fsDoc.id,
    _fs_col: collectionName,
  }
}

// ============================================================================
// Operacoes Supabase
// ============================================================================

async function insertDocuments(docs) {
  if (!docs.length) return { ok: 0, errs: [] }

  const clean = docs.map(({ _fs_id, _fs_col, ...rest }) => rest)
  const batchSize = 50
  let ok = 0
  const errs = []

  for (let i = 0; i < clean.length; i += batchSize) {
    const batch = clean.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('documentos')
      .upsert(batch, { onConflict: 'id' })
      .select('id')

    if (error) {
      errs.push({ batch: i, msg: error.message })
      console.error(`  ERRO batch ${i}: ${error.message}`)
    } else {
      ok += data.length
    }
  }
  return { ok, errs }
}

async function insertVersions(docs) {
  if (!docs.length) return 0

  const rows = docs.map(d => ({
    documento_id: d.id,
    versao: 1,
    arquivo_url: d.arquivo_url,
    arquivo_nome: d.arquivo_nome,
    arquivo_tamanho: d.arquivo_tamanho,
    storage_path: d.storage_path,
    descricao_alteracao: 'Versao inicial (sincronizada do sistema legado)',
    motivo_alteracao: 'Sincronizacao Firestore para Supabase',
    status: 'ativo',
    created_by: d.created_by,
    created_by_name: d.created_by_name,
    created_at: d.created_at,
  }))

  let ok = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { data, error } = await supabase
      .from('documento_versoes')
      .upsert(batch, { onConflict: 'documento_id,versao' })
      .select('id')
    if (error) console.error(`  ERRO versoes batch ${i}: ${error.message}`)
    else ok += data.length
  }
  return ok
}

async function insertChangelog(docs) {
  if (!docs.length) return 0

  const rows = docs.map(d => ({
    documento_id: d.id,
    action: 'created',
    user_id: SYSTEM_USER.uid,
    user_name: SYSTEM_USER.name,
    user_email: SYSTEM_USER.email,
    changes: JSON.stringify({
      source: 'sync_firestore',
      firestore_collection: d._fs_col,
      firestore_id: d._fs_id,
    }),
    comment: `Documento sincronizado da colecao Firestore "${d._fs_col}"`,
    created_at: d.created_at,
  }))

  let ok = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase.from('documento_changelog').insert(batch)
    if (error) console.error(`  ERRO changelog batch ${i}: ${error.message}`)
    else ok += batch.length
  }
  return ok
}

async function setReviewDates() {
  const { data: active, error } = await supabase
    .from('documentos')
    .select('id, created_at')
    .eq('status', 'ativo')
    .is('proxima_revisao', null)

  if (error || !active?.length) return 0

  let ok = 0
  for (const doc of active) {
    const review = new Date(new Date(doc.created_at).getTime() + 365 * 86400000)
    const { error: e } = await supabase
      .from('documentos')
      .update({ proxima_revisao: review.toISOString() })
      .eq('id', doc.id)
    if (!e) ok++
  }
  return ok
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(70))
  console.log('  SYNC: Firestore (ANEST legado) -> Supabase (ANEST v2.0)')
  console.log('  Os documentos NO FIRESTORE NAO sao alterados.')
  console.log('='.repeat(70))
  if (DRY_RUN) console.log('\n  ** MODO DRY-RUN — nenhum dado sera gravado **\n')

  const collections = ONLY_COLLECTION
    ? [ONLY_COLLECTION]
    : Object.keys(COLLECTION_MAP)

  const stats = {
    total: collections.length, comDocs: 0, vazias: 0,
    lidos: 0, inseridos: 0, versoes: 0, changelog: 0,
    erros: [], porCategoria: {},
  }

  // Fase 1: Ler Firestore
  console.log('\n--- Fase 1: Lendo colecoes do Firestore ---\n')

  const allDocs = []

  for (const col of collections) {
    const mapping = COLLECTION_MAP[col]
    if (!mapping) { console.log(`  SKIP ${col} (sem mapeamento)`); continue }

    process.stdout.write(`  ${col}...`)

    let snapshot
    try { snapshot = await firestore.collection(col).get() }
    catch (e) { console.log(` erro: ${e.message}`); continue }

    if (snapshot.empty) { console.log(' vazia'); stats.vazias++; continue }

    console.log(` ${snapshot.size} doc(s)`)
    stats.comDocs++
    stats.lidos += snapshot.size

    if (!stats.porCategoria[mapping.categoria])
      stats.porCategoria[mapping.categoria] = { n: 0, cols: [] }
    stats.porCategoria[mapping.categoria].n += snapshot.size
    stats.porCategoria[mapping.categoria].cols.push(col)

    let counter = 1
    snapshot.forEach(fsDoc => {
      const mapped = convertDoc(fsDoc, col, counter, col)
      allDocs.push(mapped)
      if (VERBOSE) console.log(`    [${counter}] "${mapped.titulo}" -> ${mapped.id}`)
      counter++
    })
  }

  console.log(`\nTotal de documentos lidos: ${allDocs.length}`)

  if (DRY_RUN) {
    console.log('\n--- Resumo DRY-RUN ---\n')
    for (const [cat, info] of Object.entries(stats.porCategoria))
      console.log(`  ${cat}: ${info.n} doc(s) de ${info.cols.length} colecao(oes)`)
    console.log(`\nTotal: ${allDocs.length} documentos`)
    console.log('\nExecute sem --dry-run para gravar no Supabase.')
    process.exit(0)
  }

  // Fase 2: Inserir no Supabase
  console.log('\n--- Fase 2: Inserindo documentos no Supabase ---\n')
  const { ok, errs } = await insertDocuments(allDocs)
  stats.inseridos = ok
  stats.erros.push(...errs)
  console.log(`  Inseridos: ${ok}`)

  // Fase 3: Versoes
  console.log('\n--- Fase 3: Criando registros de versao ---\n')
  stats.versoes = await insertVersions(allDocs)
  console.log(`  Criados: ${stats.versoes}`)

  // Fase 4: Changelog (audit trail)
  console.log('\n--- Fase 4: Criando changelog (audit trail) ---\n')
  stats.changelog = await insertChangelog(allDocs)
  console.log(`  Criados: ${stats.changelog}`)

  // Fase 5: Datas de revisao
  console.log('\n--- Fase 5: Definindo datas de revisao ---\n')
  const reviewCount = await setReviewDates()
  console.log(`  Atualizados: ${reviewCount} documentos ativos`)

  // Relatorio final
  console.log('\n' + '='.repeat(70))
  console.log('  RELATORIO DE SINCRONIZACAO')
  console.log('='.repeat(70))
  console.log(`\n  Colecoes verificadas:    ${stats.total}`)
  console.log(`  Colecoes com documentos: ${stats.comDocs}`)
  console.log(`  Colecoes vazias:         ${stats.vazias}`)
  console.log(`  Documentos lidos:        ${stats.lidos}`)
  console.log(`  Documentos inseridos:    ${stats.inseridos}`)
  console.log(`  Versoes criadas:         ${stats.versoes}`)
  console.log(`  Entradas no changelog:   ${stats.changelog}`)
  console.log(`  Erros:                   ${stats.erros.length}`)

  console.log('\n  Por categoria:')
  for (const [cat, info] of Object.entries(stats.porCategoria))
    console.log(`    ${cat}: ${info.n} doc(s)`)

  if (stats.erros.length) {
    console.log('\n  Erros:')
    stats.erros.forEach(e => console.log(`    - Batch ${e.batch}: ${e.msg}`))
  }

  console.log('\n  Dados no Firestore: INTACTOS (nenhuma alteracao)')
  console.log('\n' + '='.repeat(70))

  process.exit(stats.erros.length ? 1 : 0)
}

main().catch(err => {
  console.error('\nERRO FATAL:', err)
  process.exit(1)
})
