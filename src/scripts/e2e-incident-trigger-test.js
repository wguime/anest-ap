#!/usr/bin/env node
/**
 * E2E: valida o trigger tr_incidentes_notify_responsaveis.
 * - Cria incidente de teste (tipo=incidente, source=formulario_publico)
 * - Verifica que notifications foram criadas para admins/coords
 * - Limpa (delete incidente + notifications do teste)
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const envPath = resolve(projectRoot, '.env.local');
const envVars = {};
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});

const { SignJWT } = await import('jose');
const secretKey = new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('=== E2E Trigger Incidentes ===\n');

// 1. Conta admins/coords ativos (devem receber a notification)
const { data: responsaveis, error: errR } = await supabase
  .from('profiles')
  .select('id, nome, is_admin, is_coordenador, role, active')
  .or('is_admin.eq.true,is_coordenador.eq.true,role.eq.coordenador')
  .eq('active', true);
if (errR) { console.error('Erro query responsaveis:', errR); process.exit(1); }
console.log(`Responsáveis ativos (admins/coords): ${responsaveis.length}`);
responsaveis.forEach(r => console.log(`  - ${r.nome} (${r.id.substring(0,10)}...) admin=${r.is_admin} coord=${r.is_coordenador} role=${r.role}`));

// 2. Insere incidente teste (source=formulario_publico para simular fluxo público)
const testProtocol = `INC-TEST-${Date.now().toString().slice(-6)}`;
console.log(`\nInserindo incidente teste ${testProtocol}...`);
const { data: inserted, error: errI } = await supabase
  .from('incidentes')
  .insert({
    protocolo: testProtocol,
    tracking_code: 'TEST-' + Date.now().toString(36).toUpperCase(),
    tipo: 'incidente',
    source: 'formulario_publico',
    status: 'pendente',
    notificante: { tipoIdentificacao: 'anonimo' },
    incidente_data: { descricao: 'TESTE AUTOMATIZADO — ignore' },
  })
  .select('id, protocolo')
  .single();
if (errI) { console.error('Erro insert:', errI); process.exit(1); }
console.log(`Incidente criado: id=${inserted.id}, protocolo=${inserted.protocolo}`);

// 3. Aguarda propagação (trigger é síncrono, mas para garantir replicação)
await new Promise(r => setTimeout(r, 500));

// 4. Verifica notifications criadas
const { data: notifs, error: errN } = await supabase
  .from('notifications')
  .select('id, recipient_id, subject, content, related_entity_type, related_entity_id')
  .eq('related_entity_id', inserted.id);
if (errN) { console.error('Erro query notifications:', errN); process.exit(1); }

console.log(`\nNotifications criadas pelo trigger: ${notifs.length}`);
notifs.forEach((n, i) => {
  console.log(`  ${i+1}. recipient=${n.recipient_id.substring(0,10)}... subject="${n.subject}"`);
  console.log(`     content="${n.content}"`);
});

// 5. Valida
const expectedCount = responsaveis.length;
const actualCount = notifs.length;
const recipientIds = new Set(notifs.map(n => n.recipient_id));
const respIds = new Set(responsaveis.map(r => r.id));
const missing = [...respIds].filter(id => !recipientIds.has(id));
const extra = [...recipientIds].filter(id => !respIds.has(id));

console.log('\n=== Validação ===');
console.log(`Esperado: ${expectedCount} notifications | Atual: ${actualCount}`);
if (missing.length > 0) console.log(`✗ Responsáveis NÃO notificados: ${missing.length}`);
if (extra.length > 0) console.log(`✗ Notifications para não-responsáveis: ${extra.length}`);

// LGPD check: content não deve conter "TESTE AUTOMATIZADO"
const lgpdOk = notifs.every(n => !n.content?.includes('TESTE AUTOMATIZADO'));
console.log(`LGPD: content não vaza descrição: ${lgpdOk ? '✓' : '✗'}`);

// 6. Cleanup
console.log('\nLimpando dados de teste...');
await supabase.from('notifications').delete().eq('related_entity_id', inserted.id);
await supabase.from('incidentes').delete().eq('id', inserted.id);
console.log('✓ Incidente + notifications removidos.');

const passed = actualCount === expectedCount && missing.length === 0 && extra.length === 0 && lgpdOk;
console.log(passed ? '\n✓ Trigger funcionando corretamente.' : '\n✗ Problemas detectados.');
process.exit(passed ? 0 : 1);
