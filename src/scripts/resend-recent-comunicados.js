#!/usr/bin/env node

/**
 * Dispara notificações in-app (tabela `notifications`) para todos os usuários
 * ativos referentes aos últimos 2 comunicados publicados, usando o mesmo
 * formato que `notifyComunicadoPublicado` emite a partir do app.
 *
 * Uso:
 *   node src/scripts/resend-recent-comunicados.js         # dry-run (padrão)
 *   EXECUTE=1 node src/scripts/resend-recent-comunicados.js
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

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
const DRY_RUN = process.env.EXECUTE !== '1';

if (!SUPABASE_URL || !JWT_SECRET || !ANON_KEY) {
  console.error('ERRO: .env.local precisa ter VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_JWT_SECRET');
  process.exit(1);
}

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
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
});

console.log(`=== Reforço de Notificações ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`);

// 1. Últimos 2 comunicados publicados
const { data: recentes, error: errRec } = await supabase
  .from('comunicados')
  .select('id, titulo, tipo, destinatarios, autor_nome, created_at, status')
  .eq('status', 'publicado')
  .order('created_at', { ascending: false })
  .limit(2);

if (errRec) {
  console.error('Erro buscando comunicados:', errRec.message);
  process.exit(1);
}

if (!recentes || recentes.length === 0) {
  console.error('Nenhum comunicado publicado encontrado.');
  process.exit(1);
}

console.log(`Comunicados a notificar (${recentes.length}):`);
recentes.forEach((c, i) => {
  console.log(`  ${i + 1}. [${c.tipo}] ${c.titulo}`);
  console.log(`     id=${c.id} | autor=${c.autor_nome} | ${new Date(c.created_at).toLocaleString('pt-BR')}`);
  console.log(`     destinatarios=${JSON.stringify(c.destinatarios || [])}`);
});
console.log('');

// 2. Todos os usuários ativos
const { data: users, error: errUsers } = await supabase
  .from('profiles')
  .select('id, nome, role, active')
  .eq('active', true);

if (errUsers) {
  console.error('Erro buscando usuários:', errUsers.message);
  process.exit(1);
}

const usuariosAtivos = (users || []).filter(u => u.id);
console.log(`Usuários ativos totais: ${usuariosAtivos.length}\n`);

// Helper para resolver destinatários do comunicado.
// Se destinatarios é array vazio → broadcast (todos ativos).
// Caso contrário → filtra por role.
function resolveRecipients(destinatarios) {
  if (!destinatarios || destinatarios.length === 0) {
    return usuariosAtivos.map(u => u.id);
  }
  return usuariosAtivos.filter(u => destinatarios.includes(u.role)).map(u => u.id);
}

// Helper para mapear prioridade (mesmo que notifyComunicadoPublicado)
function priorityForTipo(tipo) {
  if (tipo === 'Urgente') return 'urgente';
  if (tipo === 'Importante') return 'alta';
  return 'normal';
}

// 3. Para cada comunicado: cria notifications para destinatários
let totalInseridas = 0;
for (const com of recentes) {
  const recipientIds = resolveRecipients(com.destinatarios);
  console.log(`\n> ${com.titulo}`);
  console.log(`  recipients resolvidos: ${recipientIds.length}`);

  if (recipientIds.length === 0) {
    console.log('  (nenhum destinatário — pulando)');
    continue;
  }

  if (DRY_RUN) continue;

  // Checa se já existe notification desse comunicado para cada recipient (evita duplicata)
  const { data: existentes } = await supabase
    .from('notifications')
    .select('recipient_id')
    .eq('related_entity_type', 'comunicado')
    .eq('related_entity_id', com.id);

  const jaNotificados = new Set((existentes || []).map(e => e.recipient_id));
  const novosRecipients = recipientIds.filter(r => !jaNotificados.has(r));
  console.log(`  já notificados anteriormente: ${jaNotificados.size}`);
  console.log(`  a notificar agora: ${novosRecipients.length}`);

  if (novosRecipients.length === 0) continue;

  const priority = priorityForTipo(com.tipo);
  const dismissable = com.tipo !== 'Urgente';
  const rows = novosRecipients.map(rid => ({
    recipient_id: rid,
    category: 'comunicado',
    subject: `${com.tipo || 'Comunicado'}: ${com.titulo}`,
    content: `Novo comunicado publicado: ${com.titulo}`,
    sender_name: 'Sistema de Comunicados',
    priority,
    action_url: 'comunicados',
    action_label: 'Ler Comunicado',
    action_params: { comunicadoId: com.id },
    dismissable,
    related_entity_type: 'comunicado',
    related_entity_id: com.id,
  }));

  const { data: inseridas, error: errNotif } = await supabase
    .from('notifications')
    .insert(rows)
    .select('id');

  if (errNotif) {
    console.error(`  ERRO ao inserir notificações: ${errNotif.message}`);
    continue;
  }

  console.log(`  inseridas: ${inseridas?.length || 0}`);
  totalInseridas += inseridas?.length || 0;
}

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Total de notificações inseridas: ${totalInseridas}`);
if (DRY_RUN) {
  console.log('\nRode com EXECUTE=1 node src/scripts/resend-recent-comunicados.js para efetivar.');
}
