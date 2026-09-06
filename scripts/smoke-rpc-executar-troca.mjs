#!/usr/bin/env node
/**
 * Smoke da RPC `rpc_escala_executar_troca` em PRODUÇÃO, sem deixar rastro.
 *
 * Cria duas escalas sintéticas (2099-02-01), executa um swap dos dois lados,
 * repete para provar a idempotência e força uma falha para provar o "tudo ou
 * nada" — tudo dentro de uma função que termina em EXCEÇÃO, então o Postgres
 * desfaz a transação inteira e nada fica gravado.
 *
 * É a trava que FALHA sem a migration 20260905220000. Não há suíte de PL/pgSQL
 * no repositório; esta é a cobertura do SQL.
 *
 * Uso: node scripts/smoke-rpc-executar-troca.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const PAT = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN
const REF = process.env.VITE_SUPABASE_PROJECT_REF || env.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny'
if (!PAT) { console.error('❌ SUPABASE_ACCESS_TOKEN ausente'); process.exit(1) }

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await r.text()
  try { return { ok: r.ok, body: JSON.parse(text) } } catch { return { ok: r.ok, body: text } }
}

const admin = await query('select a.firebase_uid as uid from public.admin_users a order by a.firebase_uid limit 1')
const UID = admin.body?.[0]?.uid
if (!UID) { console.error('❌ não achei um admin para assinar o smoke'); process.exit(1) }

const J = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`
const SQL = `
create or replace function pg_temp.smoke_troca(p_uid text) returns void language plpgsql as $$
declare
  vA uuid; vB uuid; c1 uuid; c2 uuid;
  r1 jsonb; r2 jsonb; oA jsonb; oB jsonb; casos jsonb; erro text := 'sem erro';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);
  perform public.rpc_publicar_escala_turno('2099-02-01','unimed','matutino',
    ${J({ ordem_liberacao: ['ANA', 'BETO'], ajuda_externa: [] })},
    ${J([{ sala: 'S1', hora: '08:00', anestesista: 'ANA', anestesista_user_id: 'smk-ana', paciente_iniciais: 'A.B.' }])});
  perform public.rpc_publicar_escala_turno('2099-02-01','hro','matutino',
    ${J({ ordem_liberacao: ['CARLA'], ajuda_externa: [] })},
    ${J([{ sala: 'S2', hora: '08:00', anestesista: 'CARLA', anestesista_user_id: 'smk-carla', paciente_iniciais: 'C.D.' }])});
  select id into vA from public.escala_cirurgica where data='2099-02-01' and hospital='unimed';
  select id into vB from public.escala_cirurgica where data='2099-02-01' and hospital='hro';
  select id into c1 from public.escala_cirurgica_caso where escala_id=vA limit 1;
  select id into c2 from public.escala_cirurgica_caso where escala_id=vB limit 1;
  update public.escala_cirurgica set linha_overrides = ${J({ 'matutino:smk-ana': { trocaCom: { uid: 'smk-carla', nome: 'CARLA' } } })} where id = vA;

  r1 := public.rpc_escala_executar_troca(jsonb_build_array(
    jsonb_build_object('escala_id', vA, 'chave', 'matutino:smk-ana', 'para_uid', 'smk-carla', 'para_apelido', 'CARLA',
      'caso_ids', jsonb_build_array(c1),
      'assumida_por', ${J({ uid: 'smk-carla', nome: 'CARLA X', de: { uid: 'smk-ana', nome: 'ANA Y' }, tipo: 'entre_hospitais', casoIds: [] })}),
    jsonb_build_object('escala_id', vB, 'chave', 'matutino:smk-carla', 'para_uid', 'smk-ana', 'para_apelido', 'ANA',
      'caso_ids', jsonb_build_array(c2),
      'assumida_por', ${J({ uid: 'smk-ana', nome: 'ANA Y', de: { uid: 'smk-carla', nome: 'CARLA X' }, tipo: 'entre_hospitais', casoIds: [] })})
  ), '[]'::jsonb);
  select e.linha_overrides into oA from public.escala_cirurgica e where e.id=vA;
  select e.linha_overrides into oB from public.escala_cirurgica e where e.id=vB;
  select jsonb_agg(jsonb_build_object('id',c.id,'a',c.anestesista,'u',c.anestesista_user_id) order by c.sala) into casos
    from public.escala_cirurgica_caso c where c.escala_id in (vA,vB);

  r2 := public.rpc_escala_executar_troca(jsonb_build_array(
    jsonb_build_object('escala_id', vA, 'chave', 'matutino:smk-ana', 'para_uid', 'smk-carla', 'para_apelido', 'CARLA',
      'caso_ids', jsonb_build_array(c1),
      'assumida_por', ${J({ uid: 'smk-carla', nome: 'CARLA X', de: { uid: 'smk-ana', nome: 'ANA Y' }, casoIds: [] })})
  ), '[]'::jsonb);

  begin
    perform public.rpc_escala_executar_troca(jsonb_build_array(
      jsonb_build_object('escala_id', vB, 'chave', 'matutino:smk-nova', 'para_uid', 'smk-x', 'para_apelido', 'X',
        'caso_ids', '[]'::jsonb, 'assumida_por', ${J({ uid: 'smk-x', nome: 'X', de: { uid: null, nome: '' }, casoIds: [] })}),
      jsonb_build_object('escala_id', '00000000-0000-0000-0000-000000000000', 'chave', 'matutino:zzz',
        'para_uid', 'smk-y', 'para_apelido', 'Y', 'caso_ids', '[]'::jsonb,
        'assumida_por', ${J({ uid: 'smk-y', nome: 'Y', de: { uid: null, nome: '' }, casoIds: [] })})
    ), '[]'::jsonb);
  exception when others then erro := sqlerrm; end;

  raise exception 'SMOKE_RESULT %', jsonb_build_object(
    'r1', r1, 'r2', r2, 'oA', oA, 'oB', oB, 'casos', casos, 'erro', erro,
    'oB_pos_falha', (select e.linha_overrides from public.escala_cirurgica e where e.id=vB))::text
    using errcode = 'P0001';
end $$;
select pg_temp.smoke_troca('${UID}');
`

const r = await query(SQL)
const msg = typeof r.body === 'string' ? r.body : (r.body?.message || JSON.stringify(r.body))
const m = /SMOKE_RESULT (\{[\s\S]*\})/.exec(msg || '')
if (!m) {
  console.error('❌ o smoke não devolveu resultado (a migration 20260905220000 está aplicada?)')
  console.error(String(msg).slice(0, 700))
  process.exit(1)
}
const out = JSON.parse(m[1])
const falhas = []
const check = (c, rot) => { console.log(`${c ? '✅' : '❌'} ${rot}`); if (!c) falhas.push(rot) }
const aA = out.oA?.['matutino:smk-ana'] || {}
const aB = out.oB?.['matutino:smk-carla'] || {}
check(aA.assumidaPor?.uid === 'smk-carla' && aA.assumidaPor?.de?.uid === 'smk-ana', 'lado A: assumidaPor com o recibo do dono')
check(aB.assumidaPor?.uid === 'smk-ana', 'lado B: a recíproca sai na mesma transação')
check(!('trocaCom' in aA), 'a declaração sai quando a troca vira fato')
check(typeof aA.por === 'string' && typeof aA.assumidaPor?.por === 'string', 'por/em carimbados pelo servidor, dentro e fora')
check((out.casos || []).every((c) => (c.a === 'CARLA' && c.u === 'smk-carla') || (c.a === 'ANA' && c.u === 'smk-ana')), 'os casos dos dois hospitais mudam de dono juntos')
check(out.r1?.pulados === 0 && out.r1?.lados === 2, 'a 1ª execução não pula nada')
check(out.r2?.pulados === 1, 'repetir pula o lado já assumido (idempotência D10)')
check(/escala_nao_encontrada/.test(out.erro || ''), 'lado inválido derruba a chamada inteira')
check(!('matutino:smk-nova' in (out.oB_pos_falha || {})), 'TUDO OU NADA: o lado bom da chamada que falhou não fica gravado')
check(!!out.r1?.escalas && Array.isArray(out.r1?.casos), 'devolve o estado resultante (escalas e casos) para o chamador')

if (falhas.length) { console.error(`\n${falhas.length} asserção(ões) falharam`); process.exit(1) }
console.log('\n✅ smoke ok — nada ficou gravado (a função terminou em exceção; transação desfeita)')
