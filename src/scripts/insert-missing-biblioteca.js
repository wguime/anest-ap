#!/usr/bin/env node

/**
 * Insert Missing Biblioteca Documents into Supabase
 *
 * Inserts records into the `documentos` table for documents that exist
 * as files in public/documentos/ but don't yet have Supabase records.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// ============================================================================
// Load environment variables
// ============================================================================

const envPath = resolve(projectRoot, '.env.local');
const envVars = {};
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !JWT_SECRET || !ANON_KEY) {
  console.error('ERRO: Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or SUPABASE_JWT_SECRET');
  process.exit(1);
}

// ============================================================================
// Supabase setup with service_role JWT
// ============================================================================

const { SignJWT } = await import('jose');
const { createClient } = await import('@supabase/supabase-js');

const secretKey = new TextEncoder().encode(JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(secretKey);

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceJWT}`,
    },
  },
});

console.log('Connected to Supabase\n');

// ============================================================================
// Document definitions
// ============================================================================

const FORMULARIOS = [
  { codigo: 'FOR.ANEST.0001-00', titulo: 'Análise Crítica de Eventos com Danos e Óbitos', arquivo: '/documentos/formularios/FOR.ANEST 0001-00 Analise critica de eventos com danos e obitos..pdf' },
  { codigo: 'FOR.RPA.0001', titulo: 'Score de Eberhart - Risco de NVPO em Crianças', arquivo: '/documentos/formularios/FOR.RPA.0001 Score de Eberhart   - Risco de nauseas e vomitos pos-operatorios para criancas.pdf' },
  { codigo: 'FOR.RPA.00012-A', titulo: 'Score de Apfel - Risco de NVPO em Adultos', arquivo: '/documentos/formularios/FOR.RPA.00012 Score de Apfel  - Risco de nauseas e vomitos pos-operatorios (NVPO) - ADULTOS.pdf' },
  { codigo: 'FOR.RPA.0010-00', titulo: 'Avaliação Pré-Anestésica - Internado', arquivo: '/documentos/formularios/FOR.RPA.0010-00 Avaliacao pre anestesica - Internado.pdf' },
  { codigo: 'FOR.RPA.0011-00', titulo: 'Evolução Anestesista - Intraoperatório', arquivo: '/documentos/formularios/FOR.RPA.0011-00 Evolucao anestesista - Intraoperatorio.pdf' },
  { codigo: 'FOR.RPA.00012-B', titulo: 'Evolução ANEST - Intervenções ou Intercorrências', arquivo: '/documentos/formularios/FOR.RPA.00012  EVOLUCAO ANEST - INTERVENCOES OU INTERCORRENCIAS.pdf' },
  { codigo: 'FOR.RPA.0013-00', titulo: 'Evolução Alta da Recuperação Anestésica', arquivo: '/documentos/formularios/FOR.RPA.0013-00 Evolucao alta da recuperacao anestesica.pdf' },
  { codigo: 'FOR.RPA.0014-00', titulo: 'Evolução de Admissão na Recuperação Anestésica', arquivo: '/documentos/formularios/FOR.RPA.0014-00 Evolucao de admissao na recuperacao anestesica.pdf' },
  { codigo: 'XXX.NQS.0037-00-A', titulo: 'Evolução ANEST - Avaliação Pré - Internado (NQS)', arquivo: '/documentos/formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - AVALIACAO PRE - INTERNADO (AG DR.GUILHERME).pdf' },
  { codigo: 'XXX.NQS.0037-00-B', titulo: 'Evolução ANEST - Intraoperatório (NQS)', arquivo: '/documentos/formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - INT RAOPERATORIO (AG. DR.GUILHERME).pdf' },
  { codigo: 'XXX.NQS.0037-00-C', titulo: 'Evolução ANEST - Intervenções ou Intercorrências (NQS)', arquivo: '/documentos/formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - INTERVENCOES OU INTERCORRENCIAS (AG DR.GUILHERME).pdf' },
  { codigo: 'XXX.NQS.0037-00-D', titulo: 'Evolução ANEST - Sala de Recuperação - Admissão (NQS)', arquivo: '/documentos/formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - SALA DE RECUPERACAO - ADMISSAO (AG.DR.GUILHERME).pdf' },
  { codigo: 'XXX.NQS.0037-00-E', titulo: 'Evolução ANEST - Sala de Recuperação - Alta (NQS)', arquivo: '/documentos/formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - SALA DE  RECUPERACAO - ALTA (AG DR.GUILHERME).pdf' },
];

const MANUAIS = [
  { codigo: 'MAN.NQS.0001.00', titulo: 'Manual de Gestão Documental', arquivo: '/documentos/manuais/MAN.NQS.0001.00 Manual de gestao documental^.pdf' },
  { codigo: null, titulo: 'Manual Qmentum - Serviços de Anestesia 2023', arquivo: '/documentos/manuais/2023 - Manual Qmentum - SERVICOS DE ANESTESIA.pdf' },
];

const PROCESSOS = [
  { codigo: 'MAP.ANEST.0001-00', titulo: 'Mapa de Processos - Serviço de Anestesia (SIPOC)', arquivo: '/documentos/processos/MAP.ANEST 0001-00 Mapa de processos servico anestesia (SIPOC).pdf' },
];

const RISCOS = [
  { codigo: null, titulo: 'Mapeamento de Riscos 2024', arquivo: '/documentos/riscos/Mapeamento de Riscos.pdf' },
];

const PLANOS = [
  { codigo: 'PLA.ANEST.0001-00', titulo: 'Plano de Segurança do Paciente', arquivo: '/documentos/plano-seguranca/PLA.ANEST.0001-00 Plano de seguranca do paciente.pdf' },
];

const RELATORIOS = [
  { codigo: null, titulo: 'Relatório de Segurança - 3 Trimestre 2024', arquivo: '/documentos/relatorios/RELAT\u00d3RIO DE SEGURAN\u00c7A 3\u00b0 TRIMESTRE 2024.pdf' },
  { codigo: null, titulo: 'Segurança do Paciente - Serviço de Anestesia ANEST Chapecó', arquivo: '/documentos/relatorios/Seguranca-do-Paciente-Servico-de-Anestesia-ANEST-Chapeco.pdf' },
  { codigo: null, titulo: 'Divisão de Indicadores', arquivo: '/documentos/relatorios/DIVIS\u00c3O INDICADORES.pdf' },
  { codigo: null, titulo: 'Indicadores - Tabela de Resultados', arquivo: '/documentos/indicadores/Indicadores - Tabela Resultados.pdf' },
];

// All groups with their tipo
const GROUPS = [
  { tipo: 'formulario', docs: FORMULARIOS },
  { tipo: 'manual', docs: MANUAIS },
  { tipo: 'processo', docs: PROCESSOS },
  { tipo: 'risco', docs: RISCOS },
  { tipo: 'plano', docs: PLANOS },
  { tipo: 'relatorio', docs: RELATORIOS },
];

// ============================================================================
// Helper: small delay
// ============================================================================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// Main logic
// ============================================================================

let totalInserted = 0;
let totalSkippedExists = 0;
let totalSkippedNoFile = 0;
const timestamp = Date.now();
let globalIndex = 0;

for (const group of GROUPS) {
  const { tipo, docs } = group;
  console.log(`\n=== Processing tipo='${tipo}' (${docs.length} docs) ===\n`);

  for (const doc of docs) {
    globalIndex++;

    // 1. Verify file exists on disk
    const filePath = resolve(projectRoot, 'public', doc.arquivo.replace(/^\//, ''));
    if (!existsSync(filePath)) {
      console.log(`  SKIP (file not found): ${doc.titulo}`);
      console.log(`    Expected: ${filePath}`);
      totalSkippedNoFile++;
      continue;
    }

    // 2. Check if a document with exact titulo already exists (case-insensitive)
    const { data: existing, error: searchErr } = await supabase
      .from('documentos')
      .select('id, titulo')
      .ilike('titulo', doc.titulo)
      .limit(1);

    if (searchErr) {
      console.log(`  ERROR searching for "${doc.titulo}": ${searchErr.message}`);
      continue;
    }

    if (existing && existing.length > 0) {
      console.log(`  SKIP (already exists): "${doc.titulo}" -> matched "${existing[0].titulo}" (${existing[0].id})`);
      totalSkippedExists++;
      continue;
    }

    // 3. Build record
    const now = new Date().toISOString();
    const docId = `doc-v1-${timestamp}-${globalIndex}`;
    const record = {
      id: docId,
      titulo: doc.titulo,
      codigo: doc.codigo || `${tipo.toUpperCase()}-${String(globalIndex).padStart(4, '0')}`,
      tipo: tipo,
      categoria: 'biblioteca',
      subcategoria: null,
      status: 'ativo',
      rop_area: 'Vida Profissional',
      arquivo_url: doc.arquivo,
      arquivo_nome: doc.arquivo.split('/').pop(),
      versao_atual: 1,
      created_by: 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
      created_by_name: 'Sistema',
      created_at: now,
      updated_at: now,
    };

    // 4. Insert
    const { error: insertErr } = await supabase
      .from('documentos')
      .insert(record);

    if (insertErr) {
      console.log(`  ERROR inserting "${doc.titulo}": ${insertErr.message}`);
      continue;
    }

    console.log(`  INSERTED: ${record.id} | tipo=${tipo} | "${doc.titulo}"`);
    totalInserted++;

    // 5. Small delay to avoid rate limiting
    await sleep(100);
  }
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total inserted:          ${totalInserted}`);
console.log(`Skipped (already exist): ${totalSkippedExists}`);
console.log(`Skipped (file missing):  ${totalSkippedNoFile}`);
console.log(`Total processed:         ${globalIndex}`);
console.log('========================================\n');

console.log('Done!');
process.exit(0);
