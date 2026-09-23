#!/usr/bin/env node
/**
 * Smoke da REPUBLICAÇÃO que preserva andamento e casos manuais (migration
 * 20260923160000, dono 23/09), em PRODUÇÃO e sem deixar rastro: publica, marca
 * (terminada, iniciada+término), adiciona urgência manual e republica numa data
 * sintética (2099-01-02) dentro de uma função que termina em EXCEÇÃO.
 *
 * Trava: (1) cirurgia igual (sala+hora+iniciais) volta com o status e o carimbo
 * originais; (2) a que mudou de hora volta agendada; (3) o caso manual continua;
 * (4) a republicação NÃO grava evento de status (o andamento vai no INSERT).
 *
 * Uso: node scripts/smoke-rpc-republicar-andamento.mjs  (lê SUPABASE_ACCESS_TOKEN de .env.local)
 * Nunca imprime o token. Sai com código 1 em qualquer asserção falha.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const p of [`${ROOT}/.env.local`]) {
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/); if (m && !env[m[1].trim()]) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const PAT = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN
const REF = env.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny'
if (!PAT) { console.error('token ausente'); process.exit(1) }
const query = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t } return { ok: r.ok, status: r.status, body: b }
}
const hash = async () => (await query(`select md5(pg_get_functiondef('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) h`)).body?.[0]?.h
const antes = await hash()
const who = (await query('select a.firebase_uid as uid from public.admin_users a order by a.firebase_uid limit 1')).body?.[0]?.uid
const SQL = `create or replace function pg_temp.ensaio(p_uid text) returns void language plpgsql as $t$
declare v_r jsonb; v_id uuid; v_ev_antes int; v_ev_depois int; v_casos jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);
  v_r := public.rpc_publicar_escala_turno('2099-01-02','unimed','matutino',
    '{"ordem_liberacao":["ANA"],"ajuda_externa":[]}'::jsonb,
    '[{"sala":"S1","hora":"08:00","anestesista":"ANA","paciente_iniciais":"A.B."},{"sala":"S1","hora":"10:00","anestesista":"ANA","paciente_iniciais":"C.D."},{"sala":"S2","hora":"08:00","anestesista":"ANA","paciente_iniciais":"E.F."}]'::jsonb, null, null);
  v_id := (v_r->'header'->>'id')::uuid;
  update public.escala_cirurgica_caso set status_cirurgia='terminada', status_atualizado_em='2099-01-02T11:00:00Z', status_atualizado_por='smk'
   where escala_id=v_id and sala='S1' and hora='08:00';
  update public.escala_cirurgica_caso set status_cirurgia='iniciada', status_extra='atrasada', termino_previsto='11:00'
   where escala_id=v_id and sala='S2';
  insert into public.escala_cirurgica_caso (escala_id,sala,ordem,hora,anestesista,paciente_iniciais,tipo,turno,origem,gravidade)
   values (v_id,'S5',0,'09:00','ANA','G.H.','urgencia','matutino','manual','urgente');
  select count(*) into v_ev_antes from public.escala_cirurgica_evento where escala_id=v_id and tipo='status';
  perform public.rpc_publicar_escala_turno('2099-01-02','unimed','matutino',
    '{"ordem_liberacao":["ANA"],"ajuda_externa":[]}'::jsonb,
    '[{"sala":"S1","hora":"08:00","anestesista":"ANA","paciente_iniciais":"A.B."},{"sala":"S1","hora":"10:00","anestesista":"ANA","paciente_iniciais":"C.D."},{"sala":"S2","hora":"09:00","anestesista":"ANA","paciente_iniciais":"E.F."}]'::jsonb, null, null);
  select count(*) into v_ev_depois from public.escala_cirurgica_evento where escala_id=v_id and tipo='status';
  select jsonb_agg(jsonb_build_object('sala',sala,'hora',hora,'status',status_cirurgia,'extra',status_extra,'termino',termino_previsto,'origem',origem,'por',status_atualizado_por) order by sala,hora) into v_casos
    from public.escala_cirurgica_caso where escala_id=v_id;
  raise exception 'ENSAIO %', jsonb_build_object('casos', v_casos, 'ev_antes', v_ev_antes, 'ev_depois', v_ev_depois)::text using errcode='P0001';
end $t$;
select pg_temp.ensaio('${who}');`
const r = await query(SQL)
const msg = typeof r.body === 'string' ? r.body : (r.body?.message || JSON.stringify(r.body))
const m = /ENSAIO (\{[\s\S]*\})/.exec(msg || '')
const depois = await hash()
if (antes !== depois) { console.error('❌ a definição da função mudou durante o smoke'); process.exit(1) }
if (!m) { console.error('❌ o smoke não devolveu resultado (a migration 20260923160000 está aplicada?)'); console.error(String(msg).slice(0, 600)); process.exit(1) }
const out = JSON.parse(m[1])
const caso = (sala, hora) => (out.casos || []).find((c) => c.sala === sala && c.hora === hora) || {}
const falhas = []
const check = (cond, rotulo) => { if (cond) console.log(`✅ ${rotulo}`); else { console.log(`❌ ${rotulo}`); falhas.push(rotulo) } }
check(caso('S1', '08:00').status === 'terminada' && caso('S1', '08:00').por === 'smk', 'cirurgia igual volta TERMINADA, com o carimbo original')
check(caso('S1', '10:00').status === 'agendada', 'cirurgia sem andamento segue agendada')
check(caso('S2', '09:00').status === 'agendada', 'cirurgia que mudou de hora na foto volta agendada')
check(caso('S5', '09:00').origem === 'manual', 'caso adicionado à mão sobrevive à republicação')
check(out.ev_antes === out.ev_depois, 'republicar não grava evento de status')
if (falhas.length) { console.log(`\n❌ ${falhas.length} falha(s)`); process.exit(1) }
console.log('\n✅ smoke ok — nada ficou gravado (a função terminou em exceção; transação desfeita)')
