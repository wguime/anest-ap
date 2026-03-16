#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION SCRIPT: Firebase Firestore → Supabase (ANEST v1.0 → v2.0)
 * ============================================================================
 *
 * Features:
 *   - Dry-run by default (reads all collections, shows counts, no inserts)
 *   - Asks for [Y/n] confirmation before inserting
 *   - Uses upsert (idempotent — can run multiple times without duplicates)
 *   - Logs results: inserted / updated / errors per table
 *   - Generates final report in console
 *
 * Pre-requisites:
 *   1. Firebase CLI logged in (Application Default Credentials)
 *   2. npm install (firebase-admin, @supabase/supabase-js, jose, dotenv)
 *   3. .env.local with VITE_SUPABASE_URL, SUPABASE_JWT_SECRET
 *
 * Usage:
 *   node migrate-firebase-to-supabase.js                 # dry-run
 *   node migrate-firebase-to-supabase.js --verbose        # dry-run verbose
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { createHash } from 'crypto';

// Dynamic imports for CJS modules
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ============================================================================
// CLI Arguments
// ============================================================================

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// ============================================================================
// Load environment variables from .env.local
// ============================================================================

const envPaths = [
  resolve(projectRoot, '.env.local'),
  resolve(projectRoot, 'web', '.env.local'),
];

const envVars = {};
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=][^=]*)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim();
        if (!envVars[key]) envVars[key] = val;  // first found wins
      }
    });
  }
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL) {
  console.error('ERRO: VITE_SUPABASE_URL not found in .env.local or environment');
  process.exit(1);
}
if (!SUPABASE_ANON_KEY) {
  console.error('ERRO: VITE_SUPABASE_ANON_KEY not found in .env.local or environment');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('ERRO: SUPABASE_JWT_SECRET not found in .env.local or environment');
  process.exit(1);
}

// ============================================================================
// Firebase Firestore REST API Setup (uses Firebase CLI OAuth token)
// ============================================================================

import https from 'https';

const FIREBASE_TOOLS_CONFIG = resolve(
  process.env.HOME || process.env.USERPROFILE,
  '.config/configstore/firebase-tools.json'
);

let FIREBASE_TOKEN;
try {
  const fbConfig = JSON.parse(readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8'));
  FIREBASE_TOKEN = fbConfig.tokens?.access_token;
} catch (e) {
  console.error('ERRO: Nao foi possivel ler o token do Firebase CLI.');
  console.error('Execute "firebase login" primeiro.');
  process.exit(1);
}

if (!FIREBASE_TOKEN) {
  console.error('ERRO: Token de acesso nao encontrado em firebase-tools.json.');
  console.error('Execute "firebase login" para autenticar.');
  process.exit(1);
}

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/anest-ap/databases/(default)/documents';

console.log('  Firebase: REST API com token OAuth (project: anest-ap)');

// ============================================================================
// Supabase Setup — generate service_role JWT with jose
// ============================================================================

const { SignJWT } = await import('jose');
const { createClient } = await import('@supabase/supabase-js');

async function generateServiceRoleJWT() {
  const secretKey = new TextEncoder().encode(JWT_SECRET);

  const jwt = await new SignJWT({
    iss: 'supabase',
    ref: 'vjzrahruvjffyyqyhjny',
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secretKey);

  return jwt;
}

const serviceRoleJWT = await generateServiceRoleJWT();
console.log('  Supabase: service_role JWT generated via jose');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleJWT}`,
    },
  },
});

// ============================================================================
// Constants
// ============================================================================

const ADMIN_UID = 'pPdKZ75E9zNdPnLz50qisPiHfJw1';
const ADMIN_EMAIL = 'wguime@yahoo.com.br';
const ADMIN_NAME = 'Sistema de Migracao';
const BATCH_SIZE = 500;

// ============================================================================
// Helpers
// ============================================================================

function toISO(ts) {
  if (!ts) return null;
  // REST API returns timestamps as ISO strings directly
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // firebase-admin Timestamp objects (legacy support)
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === 'number') return new Date(ts).toISOString();
  return null;
}

function log(msg) { console.log(`  ${msg}`); }
function logV(msg) { if (VERBOSE) console.log(`    ${msg}`); }

/**
 * Generate a deterministic UUID v5-like hash from a string.
 * Ensures upserts work correctly across multiple runs.
 */
function deterministicId(prefix, seed) {
  const hash = createHash('sha256').update(seed).digest('hex');
  // Format as UUID-like: 8-4-4-4-12
  const uuid = [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
  return `${prefix}-${uuid}`;
}

/**
 * Generate a deterministic UUID from a seed (for tables with uuid PK).
 */
function deterministicUUID(seed) {
  const hash = createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16), // version 4
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variant
    hash.slice(20, 32),
  ].join('-');
}

/**
 * Fetch all documents from a Firestore collection via REST API.
 * Returns array of { id(), data() } objects matching firebase-admin interface.
 */
async function getCollection(name) {
  try {
    const allDocs = [];
    let pageToken = null;

    do {
      const url = `${FIRESTORE_BASE}/${name}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
      const result = await httpGet(url);
      const docs = result.documents || [];
      for (const doc of docs) {
        const docId = doc.name.split('/').pop();
        const parsed = parseFirestoreDoc(doc.fields || {});
        allDocs.push({
          id: docId,
          data: () => parsed,
        });
      }
      pageToken = result.nextPageToken || null;
    } while (pageToken);

    return allDocs;
  } catch (err) {
    logV(`Collection "${name}" error: ${err.message}`);
    return [];
  }
}

/**
 * HTTP GET helper that returns parsed JSON.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'Authorization': 'Bearer ' + FIREBASE_TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 404) {
          resolve({ documents: [] });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Parse Firestore REST API document fields into plain JS objects.
 * Handles: stringValue, integerValue, doubleValue, booleanValue,
 *          timestampValue, nullValue, mapValue, arrayValue, referenceValue
 */
function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue; // ISO string
  if ('nullValue' in val) return null;
  if ('referenceValue' in val) return val.referenceValue;
  if ('mapValue' in val) return parseFirestoreDoc(val.mapValue.fields || {});
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('geoPointValue' in val) return val.geoPointValue;
  if ('bytesValue' in val) return val.bytesValue;
  return null;
}

function parseFirestoreDoc(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = parseFirestoreValue(val);
  }
  return obj;
}

/**
 * Upsert rows in batches of BATCH_SIZE.
 * Returns { inserted, updated, errors }.
 */
async function upsertBatch(table, rows, opts = {}) {
  if (!rows.length) return { inserted: 0, updated: 0, errors: [] };

  const batchSize = opts.batchSize || BATCH_SIZE;
  const onConflict = opts.onConflict || undefined;
  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    let query;
    if (onConflict) {
      query = supabase.from(table).upsert(batch, {
        onConflict,
        ignoreDuplicates: false,
      });
    } else {
      query = supabase.from(table).upsert(batch);
    }

    const { data, error, count } = await query.select('*');

    if (error) {
      errors.push({ batch: Math.floor(i / batchSize) + 1, message: error.message, detail: error.details });
      console.error(`    ERRO ${table} batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      if (error.details) console.error(`      Detail: ${error.details}`);
    } else {
      const n = data?.length || batch.length;
      inserted += n;
    }
  }

  return { inserted, updated, errors };
}

function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== 'n');
    });
  });
}

// ============================================================================
// ROLE MAPPING
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
};

function mapRole(v1Role) {
  if (!v1Role) return 'colaborador';
  return ROLE_MAP[v1Role] || ROLE_MAP[v1Role.toLowerCase()] || 'colaborador';
}

// ============================================================================
// DOCUMENT COLLECTION MAPPING
// 29 Firebase collections → 1 Supabase `documentos` table
// ============================================================================

const COLLECTION_MAP = {
  // --- Auditorias ---
  auditoria_higiene_maos:      { categoria: 'auditorias', subcategoria: 'auditoria_higiene_maos' },
  auditoria_uso_medicamentos:  { categoria: 'auditorias', subcategoria: 'auditoria_uso_medicamentos' },
  auditoria_abreviaturas:      { categoria: 'auditorias', subcategoria: 'auditoria_abreviaturas' },
  politica_gestao_qualidade:   { categoria: 'auditorias', subcategoria: 'politica_gestao_qualidade' },
  politica_disclosure:         { categoria: 'auditorias', subcategoria: 'politica_disclosure' },

  // --- Relatorios ---
  relatorio_trimestral:        { categoria: 'relatorios', subcategoria: 'relatorio_trimestral' },
  relatorio_incidentes:        { categoria: 'relatorios', subcategoria: 'relatorio_incidentes' },
  relatorio_auditorias:        { categoria: 'relatorios', subcategoria: 'relatorio_auditorias' },
  relatorio_indicadores:       { categoria: 'relatorios', subcategoria: 'relatorio_indicadores' },

  // --- Biblioteca ---
  biblioteca_documentos:       { categoria: 'biblioteca', subcategoria: null },

  // --- Medicamentos ---
  doc_mav:                     { categoria: 'medicamentos', subcategoria: 'doc_mav' },
  doc_eletrolitos:             { categoria: 'medicamentos', subcategoria: 'doc_eletrolitos' },
  doc_heparina:                { categoria: 'medicamentos', subcategoria: 'doc_heparina' },
  doc_narcoticos:              { categoria: 'medicamentos', subcategoria: 'doc_narcoticos' },
  doc_intoxicacao_anestesicos: { categoria: 'medicamentos', subcategoria: 'doc_intoxicacao_anestesicos' },
  doc_manejo_glicemia:         { categoria: 'medicamentos', subcategoria: 'doc_manejo_glicemia' },
  doc_lista_abreviaturas:      { categoria: 'medicamentos', subcategoria: 'doc_lista_abreviaturas' },
  conciliacao_admissao:        { categoria: 'medicamentos', subcategoria: 'conciliacao_admissao' },
  conciliacao_transferencia:   { categoria: 'medicamentos', subcategoria: 'conciliacao_transferencia' },
  conciliacao_alta:            { categoria: 'medicamentos', subcategoria: 'conciliacao_alta' },

  // --- Infeccoes ---
  protocolo_higiene_maos:                { categoria: 'infeccoes', subcategoria: 'protocolo_higiene_maos' },
  protocolo_prevencao_isc:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_isc' },
  protocolo_prevencao_ics:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_ics' },
  protocolo_prevencao_pav:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_pav' },
  protocolo_prevencao_itu:               { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_itu' },
  protocolo_prevencao_broncoaspiracao:    { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_broncoaspiracao' },
  protocolo_prevencao_alergia_latex:      { categoria: 'infeccoes', subcategoria: 'protocolo_prevencao_alergia_latex' },
  protocolo_institucional:               { categoria: 'infeccoes', subcategoria: 'protocolo_institucional' },
  checklist_cirurgia:                    { categoria: 'infeccoes', subcategoria: 'checklist_cirurgia' },

  // --- Etica ---
  etica_dilemas_documentos:             { categoria: 'etica', subcategoria: 'etica_dilemas_documentos' },
  etica_parecer_uti_documentos:         { categoria: 'etica', subcategoria: 'etica_parecer_uti_documentos' },
  etica_diretrizes_documentos:          { categoria: 'etica', subcategoria: 'etica_diretrizes_documentos' },
  etica_parecer_tecnico_documentos:     { categoria: 'etica', subcategoria: 'etica_parecer_tecnico_documentos' },
  etica_codigo_documentos:              { categoria: 'etica', subcategoria: 'etica_codigo_documentos' },

  // --- Comites ---
  comites_documentos:                   { categoria: 'comites', subcategoria: 'comites_documentos' },
  desastres_documentos:                 { categoria: 'comites', subcategoria: 'desastres_documentos' },
  organograma_documentos:               { categoria: 'comites', subcategoria: 'organograma_documentos' },
};

// Legacy collections (may have duplicate data — migrate to appropriate categories)
const LEGACY_COLLECTION_MAP = {
  auditorias_documentos:       { categoria: 'auditorias', subcategoria: 'auditorias_documentos' },
  auditorias_evidencias:       { categoria: 'auditorias', subcategoria: 'auditorias_evidencias' },
  relatorios_documentos:       { categoria: 'relatorios', subcategoria: 'relatorios_documentos' },
  relatorios_seguranca:        { categoria: 'relatorios', subcategoria: 'relatorios_seguranca' },
  medicamentos_documentos:     { categoria: 'medicamentos', subcategoria: 'medicamentos_documentos' },
  infeccao_documentos:         { categoria: 'infeccoes', subcategoria: 'infeccao_documentos' },
  conciliacao_documentos:      { categoria: 'medicamentos', subcategoria: 'conciliacao_documentos' },
  checklist_documentos:        { categoria: 'infeccoes', subcategoria: 'checklist_documentos' },
  kpi_documentos:              { categoria: 'relatorios', subcategoria: 'kpi_documentos' },
  kpi_taxa_infeccao:           { categoria: 'relatorios', subcategoria: 'kpi_taxa_infeccao' },
  kpi_adesao_protocolos:       { categoria: 'relatorios', subcategoria: 'kpi_adesao_protocolos' },
  kpi_eventos_adversos:        { categoria: 'relatorios', subcategoria: 'kpi_eventos_adversos' },
  kpi_satisfacao_paciente:     { categoria: 'relatorios', subcategoria: 'kpi_satisfacao_paciente' },
  kpi_tempo_atendimento:       { categoria: 'relatorios', subcategoria: 'kpi_tempo_atendimento' },
  kpi_seguranca_medicamentosa: { categoria: 'relatorios', subcategoria: 'kpi_seguranca_medicamentosa' },
  reuniao_documentos:          { categoria: 'comites', subcategoria: 'reuniao_documentos' },
};

// Merge primary + legacy collections
const ALL_COLLECTIONS = { ...COLLECTION_MAP, ...LEGACY_COLLECTION_MAP };

// Categoria prefix for codigo generation
const CATEG_PREFIX = {
  auditorias: 'AUDI',
  relatorios: 'RELA',
  biblioteca: 'BIBL',
  medicamentos: 'MEDI',
  infeccoes: 'INFE',
  etica: 'ETIC',
  comites: 'COMI',
};

// Global counters for codigo generation (per categoria)
const codigoCounters = {};

function nextCodigo(categoria) {
  const prefix = CATEG_PREFIX[categoria] || categoria.slice(0, 4).toUpperCase();
  if (!codigoCounters[prefix]) codigoCounters[prefix] = 0;
  codigoCounters[prefix]++;
  return `DOC-${prefix}-${String(codigoCounters[prefix]).padStart(4, '0')}`;
}

// Derive document tipo from collection name
function deriveTipo(collectionName) {
  if (collectionName.startsWith('protocolo_')) return 'Protocolo';
  if (collectionName.startsWith('politica_')) return 'Politica';
  if (collectionName.startsWith('relatorio_')) return 'Relatorio';
  if (collectionName.startsWith('auditoria_') || collectionName.startsWith('auditorias_')) return 'Auditoria';
  if (collectionName.startsWith('checklist_')) return 'Checklist';
  if (collectionName.startsWith('kpi_')) return 'KPI';
  if (collectionName.startsWith('doc_')) return 'Documento';
  if (collectionName.startsWith('etica_')) return 'Documento';
  if (collectionName.startsWith('conciliacao_')) return 'Protocolo';
  if (collectionName.startsWith('reuniao_')) return 'Documento';
  if (collectionName.startsWith('desastres_')) return 'Documento';
  if (collectionName.startsWith('organograma_')) return 'Documento';
  return 'Documento';
}

// Build Firebase Storage URL from path
function buildStorageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`;
}

// Comunicado tipo mapping
function mapComunicadoTipo(raw) {
  if (!raw) return 'Geral';
  const t = raw.toLowerCase().trim();
  if (t === 'urgente' || t === 'alta') return 'Urgente';
  if (t === 'importante' || t === 'media') return 'Importante';
  if (t === 'informativo' || t === 'baixa') return 'Informativo';
  if (t === 'evento') return 'Evento';
  return 'Geral';
}

// ============================================================================
// SECTION A: Migrate users + userProfiles → profiles
// ============================================================================

async function migrateProfiles() {
  console.log('\n--- A. Migrando profiles (users + userProfiles) ---\n');

  const userDocs = await getCollection('users');
  const profileDocs = await getCollection('userProfiles');

  log(`Firestore: ${userDocs.length} users, ${profileDocs.length} userProfiles`);

  // Build maps by Firebase UID
  const usersMap = new Map();
  for (const doc of userDocs) usersMap.set(doc.id, doc.data());

  const profilesMap = new Map();
  for (const doc of profileDocs) profilesMap.set(doc.id, doc.data());

  // Merge by UID (union of both collections)
  const allUIDs = new Set([...usersMap.keys(), ...profilesMap.keys()]);
  log(`UIDs unicos: ${allUIDs.size}`);

  const emailToUid = new Map();
  const profiles = [];
  const adminUIDs = [];

  for (const uid of allUIDs) {
    const u = usersMap.get(uid) || {};
    const p = profilesMap.get(uid) || {};

    const nome = u.name
      || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}`.trim() : '')
      || u.email
      || 'Sem nome';
    const email = (u.email || p.email || '').toLowerCase().trim();

    if (!email) {
      logV(`SKIP uid=${uid}: sem email`);
      continue;
    }

    emailToUid.set(email, uid);

    const v1Role = u.role || p.role || '';
    const isAdmin = p.isAdmin === true
      || ['administrador', 'Administrador'].includes(v1Role);
    const isCoordenador = p.isCoordenador === true
      || ['coordenador', 'Coordenador'].includes(v1Role);

    // Merge permissions
    const permissions = {};
    if (u.cardPermissions) permissions.cardPermissions = u.cardPermissions;
    if (u.documentCategoryPermissions) permissions.documentCategoryPermissions = u.documentCategoryPermissions;
    if (u.customPermissions) permissions.customPermissions = u.customPermissions;
    if (p.permissions) Object.assign(permissions, p.permissions);

    profiles.push({
      id: uid,
      nome,
      email,
      role: mapRole(v1Role),
      active: u.active !== false,
      is_admin: isAdmin,
      is_coordenador: isCoordenador,
      custom_permissions: Object.keys(permissions).length > 0,
      permissions,
      created_at: toISO(u.createdAt || p.createdAt) || new Date().toISOString(),
    });

    if (isAdmin) adminUIDs.push({ uid, email });

    logV(`${uid}: ${nome} (${email}) → role=${mapRole(v1Role)}, admin=${isAdmin}, coord=${isCoordenador}`);
  }

  log(`Profiles a migrar: ${profiles.length}`);
  log(`Admins encontrados: ${adminUIDs.length}`);
  adminUIDs.forEach(a => logV(`  Admin: ${a.uid} (${a.email})`));

  return { profiles, emailToUid, adminUIDs, read: allUIDs.size };
}

// ============================================================================
// SECTION B: Migrate authorized_emails
// ============================================================================

async function migrateAuthorizedEmails() {
  console.log('\n--- B. Migrando authorized_emails ---\n');

  const docs1 = await getCollection('authorizedEmails');
  const docs2 = await getCollection('authorized_emails');
  const allDocs = [...docs1, ...docs2];

  if (!allDocs.length) {
    log('Nenhum email autorizado encontrado no Firestore');
    return { rows: [], read: 0 };
  }

  log(`Lidos: ${allDocs.length} emails`);

  // Deduplicate by email
  const seen = new Set();
  const rows = [];
  for (const doc of allDocs) {
    const d = doc.data();
    const email = (doc.id || d.email || '').toLowerCase().trim();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);

    rows.push({
      email,
      added_at: toISO(d.addedAt || d.added_at || d.createdAt) || new Date().toISOString(),
      added_by: d.addedBy || d.added_by || 'system',
    });
  }

  log(`Validos (deduplicados): ${rows.length}`);
  return { rows, read: allDocs.length };
}

// ============================================================================
// SECTION C: Migrate comunicados
// ============================================================================

async function migrateComunicados(emailToUid) {
  console.log('\n--- C. Migrando comunicados ---\n');

  const docs = await getCollection('comunicados');
  log(`Lidos: ${docs.length} comunicados`);

  if (!docs.length) return { rows: [], read: 0 };

  const rows = docs.map(fsDoc => {
    const d = fsDoc.data();

    // Resolve autor UID
    let autorId = ADMIN_UID;
    if (d.autorId) {
      autorId = d.autorId;
    } else if (d.autorEmail && emailToUid?.get(d.autorEmail.toLowerCase())) {
      autorId = emailToUid.get(d.autorEmail.toLowerCase());
    }

    const id = `com-${deterministicUUID(`comunicado-${fsDoc.id}`).slice(0, 8)}`;

    return {
      id,
      tipo: mapComunicadoTipo(d.tipo || d.prioridade),
      titulo: d.titulo || 'Comunicado sem titulo',
      conteudo: d.conteudo || '',
      status: 'publicado',
      rop_area: d.categoria || 'geral',
      autor_id: autorId,
      autor_nome: d.autorNome || d.autor || 'Sistema',
      link: d.link || null,
      anexos: d.anexos || [],
      arquivado: d.ativo === false,
      created_at: toISO(d.createdAt || d.data) || new Date().toISOString(),
      updated_at: toISO(d.updatedAt || d.createdAt || d.data) || new Date().toISOString(),
    };
  });

  return { rows, read: docs.length };
}

// ============================================================================
// SECTION D: Migrate document collections → documentos
// ============================================================================

async function migrateDocumentos(emailToUid) {
  console.log('\n--- D. Migrando documentos (collections → documentos) ---\n');

  const stats = { read: 0, byCategory: {}, byCollection: {} };
  const allRows = [];
  const allVersions = [];
  const allChangelog = [];

  // Track seen Firebase doc IDs for deduplication across legacy collections
  const seenDocIds = new Set();

  for (const [collectionName, mapping] of Object.entries(ALL_COLLECTIONS)) {
    const docs = await getCollection(collectionName);

    stats.byCollection[collectionName] = docs.length;
    if (!docs.length) {
      logV(`${collectionName}: vazia (skip)`);
      continue;
    }

    log(`${collectionName}: ${docs.length} doc(s) → ${mapping.categoria}/${mapping.subcategoria || '-'}`);
    stats.read += docs.length;

    if (!stats.byCategory[mapping.categoria]) stats.byCategory[mapping.categoria] = 0;
    stats.byCategory[mapping.categoria] += docs.length;

    for (const fsDoc of docs) {
      const d = fsDoc.data();
      const firebaseId = fsDoc.id;

      // Deduplicate: skip if we already have this Firebase doc ID
      if (seenDocIds.has(firebaseId)) {
        logV(`  SKIP duplicate: ${firebaseId} (already in another collection)`);
        continue;
      }
      seenDocIds.add(firebaseId);

      const id = deterministicId('doc', `${collectionName}:${firebaseId}`);
      const codigo = nextCodigo(mapping.categoria);

      // Resolve arquivo URL
      const storagePath = d.storagePath || d.arquivo?.storagePath || null;
      let arquivoUrl = d.arquivoURL || d.arquivo?.url || d.arquivo || null;
      if (typeof arquivoUrl === 'object') arquivoUrl = null;
      if (!arquivoUrl && storagePath) arquivoUrl = buildStorageUrl(storagePath);

      const arquivoNome = d.arquivoNome || d.arquivo?.nome || (storagePath ? storagePath.split('/').pop() : null);

      // Resolve created_by UID
      let createdBy = ADMIN_UID;
      let createdByEmail = null;
      if (d.createdBy) {
        createdBy = d.createdBy;
      } else if (d.autorEmail && emailToUid?.get(d.autorEmail.toLowerCase())) {
        createdBy = emailToUid.get(d.autorEmail.toLowerCase());
        createdByEmail = d.autorEmail.toLowerCase();
      } else if (d.autor && emailToUid?.get(d.autor.toLowerCase?.())) {
        createdBy = emailToUid.get(d.autor.toLowerCase());
        createdByEmail = d.autor.toLowerCase();
      }

      const createdByName = d.autorNome || d.autor || 'Sistema';
      const createdAt = toISO(d.data || d.createdAt) || new Date().toISOString();
      const status = d.ativo === false ? 'arquivado' : 'ativo';

      const row = {
        id,
        codigo,
        titulo: d.titulo || d.nome || 'Documento sem titulo',
        descricao: d.descricao || '',
        tipo: deriveTipo(collectionName),
        categoria: mapping.categoria,
        subcategoria: mapping.subcategoria,
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
        created_by_email: createdByEmail,
        updated_by: null,
        updated_by_name: null,
        created_at: createdAt,
        updated_at: createdAt,
      };

      allRows.push(row);

      // Version record
      allVersions.push({
        id: deterministicUUID(`version-${id}-v1`),
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
      });

      // Changelog record
      allChangelog.push({
        id: deterministicUUID(`changelog-${id}-created`),
        documento_id: id,
        action: 'created',
        user_id: ADMIN_UID,
        user_name: ADMIN_NAME,
        user_email: ADMIN_EMAIL,
        changes: JSON.stringify({
          source: 'migration_v1_to_v2',
          firestore_collection: collectionName,
          firestore_id: firebaseId,
        }),
        comment: `Documento migrado da colecao Firestore "${collectionName}"`,
        created_at: createdAt,
      });

      logV(`  ${id}: "${row.titulo}" (${mapping.categoria}/${mapping.subcategoria || '-'})`);
    }
  }

  log(`\nTotal documentos lidos: ${stats.read} (deduplicados: ${allRows.length})`);
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    log(`  ${cat}: ${count}`);
  }

  return { documentos: allRows, versoes: allVersions, changelog: allChangelog, stats };
}

// ============================================================================
// SECTION E: Migrate incidentes + denuncias → incidentes
// ============================================================================

async function migrateIncidentes() {
  console.log('\n--- E. Migrando incidentes + denuncias ---\n');

  // --- Incidentes ---
  const incDocs = await getCollection('incidentes');
  log(`Lidos: ${incDocs.length} incidentes`);

  const incRows = incDocs.map(fsDoc => {
    const d = fsDoc.data();
    const createdAt = toISO(d.data || d.dataPreenchimento || d.createdAt) || new Date().toISOString();

    return {
      id: deterministicUUID(`incidente-${fsDoc.id}`),
      protocolo: d.numeroProtocolo || null,
      tracking_code: null, // let the DB trigger generate it
      tipo: 'incidente',
      status: normalizeIncidentStatus(d.status),
      source: d.fonte || d.source || 'app',
      user_id: d.notificadoPor || d.userId || null,
      notificante: {
        nome: d.nomeNotificante || null,
        funcao: d.funcaoNotificante || null,
        setor: d.setorNotificante || null,
        contato: d.contatoNotificante || null,
        tipoIdentificacao: d.notificacaoAnonima ? 'anonimo' : 'identificado',
      },
      incidente_data: {
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
      },
      impacto: {
        dano: d.dano || null,
        severidade: d.severidade || null,
        categoriaRisco: d.categoriaRisco || null,
      },
      contexto_anest: {
        tipoAnestesia: d.tipoAnestesia || null,
        monitoramento: d.monitoramento || null,
        faseProcedimento: d.faseProcedimento || null,
      },
      gestao_interna: {
        responsavel: d.responsavelAcao || null,
        dataResolucao: toISO(d.dataEncerramento) || null,
        parecer: d.parecer || null,
        acaoCorretiva: d.acaoCorretiva || null,
      },
      lgpd_consent_at: d.consentimentoUso ? (toISO(d.dataPreenchimento) || createdAt) : null,
      created_at: createdAt,
    };
  });

  // --- Denuncias ---
  const denDocs = await getCollection('denuncias');
  log(`Lidos: ${denDocs.length} denuncias`);

  const denRows = denDocs.map(fsDoc => {
    const d = fsDoc.data();
    const createdAt = toISO(d.data || d.dataPreenchimento || d.createdAt) || new Date().toISOString();

    return {
      id: deterministicUUID(`denuncia-${fsDoc.id}`),
      protocolo: d.numeroProtocolo || null,
      tracking_code: null, // let the DB trigger generate it
      tipo: 'denuncia',
      status: normalizeIncidentStatus(d.status),
      source: 'app',
      user_id: d.denunciadoPor || d.userId || null,
      denunciante: {
        nome: d.nomeDenunciante || null,
        funcao: d.funcaoDenunciante || null,
        unidade: d.unidadeDenunciante || null,
        contato: d.contatoDenunciante || null,
        tipoIdentificacao: d.anonimo ? 'anonimo' : 'identificado',
        desejaSerInformado: d.desejaSerInformado || false,
      },
      denuncia_data: {
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
      },
      attachments: d.anexos || [],
      lgpd_consent_at: d.consentimentoUso ? (toISO(d.dataPreenchimento) || createdAt) : null,
      created_at: createdAt,
    };
  });

  const allRows = [...incRows, ...denRows];
  log(`Total incidentes + denuncias: ${allRows.length}`);

  return { rows: allRows, readInc: incDocs.length, readDen: denDocs.length };
}

function normalizeIncidentStatus(status) {
  if (!status) return 'pendente';
  const s = status.toLowerCase().trim();
  const valid = ['pendente', 'em_analise', 'em_andamento', 'resolvido', 'encerrado', 'arquivado'];
  if (valid.includes(s)) return s;
  if (s === 'aberto' || s === 'novo') return 'pendente';
  if (s === 'em andamento') return 'em_andamento';
  if (s === 'em analise' || s === 'em análise') return 'em_analise';
  if (s === 'fechado' || s === 'concluido' || s === 'concluído') return 'encerrado';
  return 'pendente';
}

// ============================================================================
// SECTION F: Migrate KPIs → kpi_dados_mensais
// ============================================================================

async function migrateKPIs() {
  console.log('\n--- F. Migrando KPI dados mensais ---\n');

  // Try multiple possible collection names
  const kpiCollections = [
    'kpi_dados',
    'kpi_dados_mensais',
    'indicadores',
    'indicadores_dados',
  ];

  let allDocs = [];
  for (const name of kpiCollections) {
    const docs = await getCollection(name);
    if (docs.length > 0) {
      log(`Collection "${name}": ${docs.length} docs`);
      allDocs.push(...docs.map(d => ({ ...d.data(), _id: d.id, _collection: name })));
    }
  }

  // Also check subcollections under kpi_* collections (individual KPI types)
  const kpiTypeCollections = [
    'kpi_taxa_infeccao',
    'kpi_adesao_protocolos',
    'kpi_eventos_adversos',
    'kpi_satisfacao_paciente',
    'kpi_tempo_atendimento',
    'kpi_seguranca_medicamentosa',
  ];

  for (const name of kpiTypeCollections) {
    const docs = await getCollection(name);
    if (docs.length > 0) {
      // These may be documents, not KPI data entries.
      // Check if they have value/valor fields (KPI data) vs titulo fields (documents)
      for (const doc of docs) {
        const d = doc.data();
        if (d.valor !== undefined || d.value !== undefined) {
          allDocs.push({ ...d, _id: doc.id, _collection: name });
        }
        // Documents from these collections are already handled in LEGACY_COLLECTION_MAP
      }
    }
  }

  if (!allDocs.length) {
    log('Nenhum dado KPI encontrado');
    return { rows: [], read: 0 };
  }

  log(`Total KPI entries encontrados: ${allDocs.length}`);

  const rows = [];
  for (const d of allDocs) {
    const indicadorId = d.indicadorId || d.indicador_id || d.kpiId || d._id;
    if (!indicadorId) {
      logV(`SKIP KPI sem indicador_id`);
      continue;
    }

    const valor = d.valor ?? d.value ?? null;
    if (valor === null) {
      logV(`SKIP KPI ${indicadorId}: sem valor`);
      continue;
    }

    // Infer ano/mes from dataAtualizacao or document data
    let ano, mes;
    const dataRef = toISO(d.dataAtualizacao || d.data || d.createdAt);
    if (dataRef) {
      const date = new Date(dataRef);
      ano = d.ano || date.getFullYear();
      mes = d.mes || (date.getMonth() + 1);
    } else {
      ano = d.ano || new Date().getFullYear();
      mes = d.mes || 1;
    }

    rows.push({
      id: deterministicUUID(`kpi-${indicadorId}-${ano}-${mes}`),
      indicador_id: indicadorId,
      ano,
      mes,
      valor: typeof valor === 'number' ? valor : parseFloat(valor) || 0,
      numerador: d.numerador || null,
      denominador: d.denominador || null,
      observacao: d.observacao || d.observacoes || null,
      fonte: d.fonte || 'migracao_v1',
      coletado_por: d.atualizadoPor || d.coletadoPor || ADMIN_UID,
      coletado_por_nome: d.atualizadoPorNome || d.coletadoPorNome || ADMIN_NAME,
      created_at: dataRef || new Date().toISOString(),
    });

    logV(`KPI: ${indicadorId} ${ano}/${mes} = ${valor}`);
  }

  log(`KPI entries validos: ${rows.length}`);
  return { rows, read: allDocs.length };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(72));
  console.log('  MIGRACAO: Firebase Firestore → Supabase');
  console.log('  Firebase: SOMENTE LEITURA — nenhum dado sera alterado');
  console.log('='.repeat(72));

  // ──────────────────────────────────────────────
  // PHASE 1: DRY-RUN — Read all data from Firestore
  // ──────────────────────────────────────────────

  console.log('\n  ** FASE 1: DRY-RUN — Lendo todos os dados do Firestore **\n');

  const profileResult = await migrateProfiles();
  const emailResult = await migrateAuthorizedEmails();
  const comunicadoResult = await migrateComunicados(profileResult.emailToUid);
  const docResult = await migrateDocumentos(profileResult.emailToUid);
  const incidenteResult = await migrateIncidentes();
  const kpiResult = await migrateKPIs();

  // ──────────────────────────────────────────────
  // DRY-RUN REPORT
  // ──────────────────────────────────────────────

  console.log('\n' + '='.repeat(72));
  console.log('  RELATORIO DRY-RUN');
  console.log('='.repeat(72));

  const summary = [
    { table: 'profiles',          read: profileResult.read,                  toWrite: profileResult.profiles.length },
    { table: 'authorized_emails', read: emailResult.read,                    toWrite: emailResult.rows.length },
    { table: 'comunicados',       read: comunicadoResult.read,               toWrite: comunicadoResult.rows.length },
    { table: 'documentos',        read: docResult.stats.read,                toWrite: docResult.documentos.length },
    { table: 'documento_versoes', read: docResult.stats.read,                toWrite: docResult.versoes.length },
    { table: 'documento_changelog', read: docResult.stats.read,              toWrite: docResult.changelog.length },
    { table: 'incidentes',        read: incidenteResult.readInc + incidenteResult.readDen, toWrite: incidenteResult.rows.length },
    { table: 'kpi_dados_mensais', read: kpiResult.read,                      toWrite: kpiResult.rows.length },
  ];

  console.log('');
  let totalRead = 0, totalToWrite = 0;
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(24)} Lidos: ${String(s.read).padStart(5)}  A gravar: ${String(s.toWrite).padStart(5)}`);
    totalRead += s.read;
    totalToWrite += s.toWrite;
  }
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  ${'TOTAL'.padEnd(24)} Lidos: ${String(totalRead).padStart(5)}  A gravar: ${String(totalToWrite).padStart(5)}`);

  if (Object.keys(docResult.stats.byCategory).length > 0) {
    console.log('\n  Documentos por categoria:');
    for (const [cat, count] of Object.entries(docResult.stats.byCategory)) {
      console.log(`    ${cat}: ${count}`);
    }
  }

  const nonEmpty = Object.entries(docResult.stats.byCollection).filter(([, c]) => c > 0);
  const empty = Object.entries(docResult.stats.byCollection).filter(([, c]) => c === 0);
  console.log(`\n  Collections com dados: ${nonEmpty.length}`);
  console.log(`  Collections vazias: ${empty.length}`);
  if (VERBOSE && empty.length) {
    console.log('    Vazias: ' + empty.map(([n]) => n).join(', '));
  }

  if (profileResult.adminUIDs.length) {
    console.log('\n  Admins encontrados:');
    for (const a of profileResult.adminUIDs) {
      console.log(`    ${a.uid} (${a.email})`);
    }
  }

  console.log('\n  Incidentes: ' + incidenteResult.readInc + ' | Denuncias: ' + incidenteResult.readDen);

  console.log('\n' + '='.repeat(72));

  if (totalToWrite === 0) {
    console.log('\n  Nenhum dado para migrar. Encerrando.\n');
    process.exit(0);
  }

  // ──────────────────────────────────────────────
  // PHASE 2: Confirmation
  // ──────────────────────────────────────────────

  console.log('');
  const confirmed = await askConfirmation(
    `  Deseja gravar ${totalToWrite} registros no Supabase? [Y/n] `
  );

  if (!confirmed) {
    console.log('\n  Migracao cancelada pelo usuario.\n');
    process.exit(0);
  }

  // ──────────────────────────────────────────────
  // PHASE 3: EXECUTE — Write to Supabase
  // ──────────────────────────────────────────────

  console.log('\n  ** FASE 2: EXECUTE — Gravando no Supabase **\n');

  const results = {};
  let totalInserted = 0;
  let totalErrors = 0;

  // --- A. Profiles ---
  console.log('\n  [1/7] Inserindo profiles...');
  const profileRes = await upsertBatch('profiles', profileResult.profiles, { onConflict: 'id' });
  results.profiles = profileRes;
  totalInserted += profileRes.inserted;
  totalErrors += profileRes.errors.length;
  log(`Profiles: ${profileRes.inserted} inseridos, ${profileRes.errors.length} erros`);

  // --- Admin users ---
  console.log('\n  [1b] Atualizando admin_users...');
  const adminRows = profileResult.adminUIDs.map(a => ({
    firebase_uid: a.uid,
    email: a.email,
    role: 'admin',
  }));
  if (adminRows.length > 0) {
    const adminRes = await upsertBatch('admin_users', adminRows, { onConflict: 'firebase_uid' });
    log(`Admin users: ${adminRes.inserted} inseridos`);
  }

  // --- B. Authorized emails ---
  console.log('\n  [2/7] Inserindo authorized_emails...');
  const emailRes = await upsertBatch('authorized_emails', emailResult.rows, { onConflict: 'email' });
  results.authorized_emails = emailRes;
  totalInserted += emailRes.inserted;
  totalErrors += emailRes.errors.length;
  log(`Authorized emails: ${emailRes.inserted} inseridos, ${emailRes.errors.length} erros`);

  // --- C. Comunicados ---
  console.log('\n  [3/7] Inserindo comunicados...');
  const comRes = await upsertBatch('comunicados', comunicadoResult.rows, { onConflict: 'id' });
  results.comunicados = comRes;
  totalInserted += comRes.inserted;
  totalErrors += comRes.errors.length;
  log(`Comunicados: ${comRes.inserted} inseridos, ${comRes.errors.length} erros`);

  // --- D. Documentos ---
  console.log('\n  [4/7] Inserindo documentos...');
  const docRes = await upsertBatch('documentos', docResult.documentos, { onConflict: 'id' });
  results.documentos = docRes;
  totalInserted += docRes.inserted;
  totalErrors += docRes.errors.length;
  log(`Documentos: ${docRes.inserted} inseridos, ${docRes.errors.length} erros`);

  // --- D2. Versoes ---
  console.log('\n  [5/7] Inserindo documento_versoes...');
  const verRes = await upsertBatch('documento_versoes', docResult.versoes, { onConflict: 'id' });
  results.documento_versoes = verRes;
  totalInserted += verRes.inserted;
  totalErrors += verRes.errors.length;
  log(`Versoes: ${verRes.inserted} inseridas, ${verRes.errors.length} erros`);

  // --- D3. Changelog ---
  console.log('\n  [5b] Inserindo documento_changelog...');
  const clRes = await upsertBatch('documento_changelog', docResult.changelog, { onConflict: 'id' });
  results.documento_changelog = clRes;
  totalInserted += clRes.inserted;
  totalErrors += clRes.errors.length;
  log(`Changelog: ${clRes.inserted} inseridos, ${clRes.errors.length} erros`);

  // --- E. Incidentes ---
  console.log('\n  [6/7] Inserindo incidentes...');
  const incRes = await upsertBatch('incidentes', incidenteResult.rows, { onConflict: 'id' });
  results.incidentes = incRes;
  totalInserted += incRes.inserted;
  totalErrors += incRes.errors.length;
  log(`Incidentes: ${incRes.inserted} inseridos, ${incRes.errors.length} erros`);

  // --- F. KPI dados ---
  console.log('\n  [7/7] Inserindo kpi_dados_mensais...');
  const kpiRes = await upsertBatch('kpi_dados_mensais', kpiResult.rows, { onConflict: 'id' });
  results.kpi_dados_mensais = kpiRes;
  totalInserted += kpiRes.inserted;
  totalErrors += kpiRes.errors.length;
  log(`KPI dados: ${kpiRes.inserted} inseridos, ${kpiRes.errors.length} erros`);

  // --- Set review dates for active docs ---
  console.log('\n  [Extra] Definindo datas de revisao para documentos ativos...');
  try {
    const { data: activeDocs } = await supabase
      .from('documentos')
      .select('id, created_at')
      .like('id', 'doc-%')
      .eq('status', 'ativo')
      .is('proxima_revisao', null);

    if (activeDocs?.length) {
      let reviewOk = 0;
      for (const doc of activeDocs) {
        const review = new Date(new Date(doc.created_at).getTime() + 365 * 86400000);
        const { error } = await supabase
          .from('documentos')
          .update({ proxima_revisao: review.toISOString() })
          .eq('id', doc.id);
        if (!error) reviewOk++;
      }
      log(`Datas de revisao definidas: ${reviewOk} de ${activeDocs.length}`);
    } else {
      log('Nenhum documento ativo sem data de revisao');
    }
  } catch (err) {
    log(`Erro ao definir datas de revisao: ${err.message}`);
  }

  // ──────────────────────────────────────────────
  // FINAL REPORT
  // ──────────────────────────────────────────────

  console.log('\n' + '='.repeat(72));
  console.log('  RELATORIO FINAL DE MIGRACAO');
  console.log('='.repeat(72));

  console.log('');
  const finalReport = [
    ['profiles',            results.profiles],
    ['authorized_emails',   results.authorized_emails],
    ['comunicados',         results.comunicados],
    ['documentos',          results.documentos],
    ['documento_versoes',   results.documento_versoes],
    ['documento_changelog', results.documento_changelog],
    ['incidentes',          results.incidentes],
    ['kpi_dados_mensais',   results.kpi_dados_mensais],
  ];

  for (const [name, res] of finalReport) {
    const inserted = res?.inserted || 0;
    const errs = res?.errors?.length || 0;
    const status = errs > 0 ? `ERROS: ${errs}` : 'OK';
    console.log(`  ${name.padEnd(24)} Inseridos: ${String(inserted).padStart(5)}  ${status}`);
  }

  console.log(`\n  ${'─'.repeat(50)}`);
  console.log(`  TOTAL INSERIDOS: ${totalInserted}`);
  console.log(`  TOTAL ERROS: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log('\n  DETALHES DOS ERROS:');
    for (const [name, res] of finalReport) {
      if (res?.errors?.length > 0) {
        console.log(`\n  ${name}:`);
        for (const err of res.errors) {
          console.log(`    Batch ${err.batch}: ${err.message}`);
          if (err.detail) console.log(`      ${err.detail}`);
        }
      }
    }
  }

  console.log(`\n  Firestore: INTACTO (nenhuma alteracao)`);
  console.log(`  Supabase: ${totalInserted} registros gravados`);
  console.log('\n' + '='.repeat(72) + '\n');

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nERRO FATAL:', err);
  process.exit(1);
});
