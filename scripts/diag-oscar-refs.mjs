/**
 * Read-only: varre o Supabase atrás de referências ao UID/e-mail ANTIGOS do
 * Oscar Morais, para saber o que seria órfanado se a conta velha for excluída.
 *
 * A lista de tabelas vem das migrations do repo (o OpenAPI do PostgREST responde
 * 401 para JWT custom HS256). Para cada tabela, testa as colunas candidatas a
 * guardar um firebase uid — coluna inexistente devolve 42703 e é ignorada.
 *
 * Uso: node scripts/diag-oscar-refs.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  console.error('ERR: env faltando em .env.local');
  process.exit(1);
}

const jwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const OLD_UID = '0PIwC4DeeMggzMK2JTqW0nmEYHj1';
const NEW_UID = 'qasYnJpQ01QrVjRO7Og5rBNRlVu2';
const OLD_EMAIL = 'oscarmorais@hotmail.com';

const TABLES = `admin_users api_tokens auditoria_execucoes auditoria_templates aulas_captions
authorized_emails autoavaliacao_rop bulk_import_jobs caption_jobs cateteres_peridural
cateteres_peridural_followup cirurgias_particulares cirurgias_particulares_check_log
comunicado_acoes_completadas comunicado_confirmacoes comunicados documento_api_rate_limit
documento_approval_steps documento_aprovacoes documento_changelog documento_changelog_archive
documento_conflict_queue documento_conflict_queue_audit documento_distribuicao documento_versoes
documentos educacao_categorias educacao_downloads_audit escala_anestesista_alias escala_cirurgica
escala_cirurgica_aviso escala_cirurgica_aviso_confirmacao escala_cirurgica_aviso_tempo
escala_cirurgica_caso escala_cirurgica_evento escala_plantao_p4_diario ferias_marcacoes_vistas
ferias_movimentacoes ferias_violacoes_vistas incident_notification_settings incidentes
kpi_dados_mensais lgpd_solicitacoes messages noticias notifications permission_audit_log
planos_acao profiles qmentum_category_weights retention_policies rop_areas rop_changelog
rop_daily_challenges rop_questions rop_subdivisoes rop_user_attempts tags token_blocklist
trocas_cirurgicas unimed_tuss_codigos user_activity_day user_starred_items video_captions`
  .split(/\s+/)
  .filter(Boolean);

const UID_COLS = [
  'id', 'user_id', 'owner_id', 'created_by', 'updated_by', 'changed_by', 'added_by',
  'actor_id', 'target_user_id', 'autor_id', 'responsavel_id', 'assigned_to',
  'anestesista_id', 'firebase_uid', 'recipient_id', 'sender_id', 'from_user_id',
  'to_user_id', 'aprovador_id', 'solicitante_id', 'reportado_por', 'criado_por',
];

const hits = [];
for (const table of TABLES) {
  for (const col of UID_COLS) {
    for (const [rotulo, uid] of [['ANTIGO', OLD_UID], ['NOVO', NEW_UID]]) {
      const { count, error } = await supa
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(col, uid);
      if (error) break; // coluna (ou tabela) inexistente → pula p/ a próxima coluna
      if (count > 0) hits.push({ rotulo, table, col, count });
    }
  }
}

console.log('═══ Referências por UID ═══');
if (!hits.length) console.log('  (nenhuma)');
for (const h of hits) console.log(`  ${h.rotulo.padEnd(6)} ${h.table}.${h.col} → ${h.count}`);

console.log('\n═══ Referências ao e-mail ANTIGO ═══');
let emailHits = 0;
for (const table of TABLES) {
  for (const col of ['email', 'user_email', 'recipient_email', 'autor_email']) {
    const { count, error } = await supa
      .from(table)
      .select('*', { count: 'exact', head: true })
      .ilike(col, OLD_EMAIL);
    if (error) continue;
    if (count > 0) { console.log(`  ${table}.${col} → ${count}`); emailHits += count; }
  }
}
if (!emailHits) console.log('  (nenhuma)');
