#!/usr/bin/env node
/**
 * Smoke da RPC `rpc_publicar_escala_turno` em PRODUÇÃO, sem deixar rastro.
 *
 * Roda a publicação duas vezes numa data sintética (2099-01-01) dentro de uma
 * função temporária que termina em EXCEÇÃO — o Postgres desfaz tudo (escala,
 * casos, eventos) e o resultado volta no texto do erro. É a única forma de
 * exercitar PL/pgSQL do repositório (não há suíte de banco) e a trava que
 * FALHA sem a migration 20260905150000:
 *   - o rastro (trocaCom, assumidaPor, observação, duplicidade) sobrevive à
 *     republicação de quem segue na ordem; a liberação zera (dono 05/09);
 *   - a posição assumida preservada re-aponta o caso do dono antigo;
 *   - quem sai da ordem tem o rastro removido com motivo `reset_publicacao`;
 *   - a decisão declarada NA publicação sai com motivo `publicacao`.
 *
 * Uso: node scripts/smoke-rpc-publicar-escala.mjs   (lê SUPABASE_ACCESS_TOKEN de .env.local)
 * Nunca imprime o token. Sai com código 1 em qualquer asserção falha.
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
  let body = null
  try { body = JSON.parse(text) } catch { body = text }
  return { ok: r.ok, status: r.status, body }
}

// quem publica: um admin real (a RPC exige can_write_escala_cirurgica); só o uid, nunca dado sensível
const quem = await query('select a.firebase_uid as uid from public.admin_users a order by a.firebase_uid limit 1')
const UID = quem.body?.[0]?.uid
if (!UID) { console.error('❌ não achei um admin para assinar o smoke', quem.status); process.exit(1) }

const SQL = `
create or replace function pg_temp.smoke_publicacao(p_uid text) returns void language plpgsql as $$
declare
  v_r jsonb; v_id uuid; v_out jsonb;
  v_over2 jsonb; v_lib2 jsonb; v_casos2 jsonb; v_ev2 jsonb;
  v_over3 jsonb; v_ev3 jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);

  -- 1) publica com DECISÕES da conferência: ANA trocou com CARLA; BETO trabalha nos dois
  v_r := public.rpc_publicar_escala_turno('2099-01-01','unimed','matutino',
    '{"ordem_liberacao":["ANA","BETO"],"ajuda_externa":[]}'::jsonb,
    '[{"sala":"S1","hora":"08:00","anestesista":"BETO","anestesista_user_id":"smk-beto","paciente_iniciais":"A.B."}]'::jsonb,
    '{"smk-ana":{"trocaCom":{"uid":"smk-carla","nome":"CARLA X"}},"smk-beto":{"duplicidade":"intencional"}}'::jsonb,
    null);
  v_id := (v_r->'header'->>'id')::uuid;

  -- a fila marca: ANA liberada; BETO assumido por CARLA (recibo de = BETO); observação na linha
  update public.escala_cirurgica set
    liberacoes = liberacoes || '{"matutino:smk-ana":{"liberadoEm":"2099-01-01T10:00:00Z"}}'::jsonb,
    linha_overrides = jsonb_set(linha_overrides, '{matutino:smk-beto}',
      (linha_overrides->'matutino:smk-beto')
      || '{"assumidaPor":{"uid":"smk-carla","nome":"CARLA X","de":{"uid":"smk-beto","nome":"BETO Y"},"casoIds":[]},"observacao":"recado"}'::jsonb)
  where id = v_id;

  -- 2) REPUBLICA o mesmo turno com preservação — a foto ainda traz BETO no caso
  perform public.rpc_publicar_escala_turno('2099-01-01','unimed','matutino',
    '{"ordem_liberacao":["ANA","BETO"],"ajuda_externa":[]}'::jsonb,
    '[{"sala":"S1","hora":"08:00","anestesista":"BETO","anestesista_user_id":"smk-beto","paciente_iniciais":"A.B."}]'::jsonb,
    null,
    '{"campos":["trocaCom","assumidaPor","observacao","duplicidade"],"linhas":[{"chave":"smk-ana","candidatas":["ANA"]},{"chave":"smk-beto","candidatas":["BETO"]}]}'::jsonb);
  select e.linha_overrides, e.liberacoes into v_over2, v_lib2 from public.escala_cirurgica e where e.id = v_id;
  select coalesce(jsonb_agg(jsonb_build_object('anestesista', c.anestesista, 'uid', c.anestesista_user_id)), '[]') into v_casos2
    from public.escala_cirurgica_caso c where c.escala_id = v_id;
  select coalesce(jsonb_agg(jsonb_build_object('para', e.status_para, 'chave', e.anestesista, 'motivo', e.detalhe->>'motivo') order by e.em, e.id), '[]') into v_ev2
    from public.escala_cirurgica_evento e where e.escala_id = v_id and e.tipo = 'troca';

  -- 3) republica SEM ANA na ordem: o rastro dela some, rotulado como reset da publicação
  perform public.rpc_publicar_escala_turno('2099-01-01','unimed','matutino',
    '{"ordem_liberacao":["BETO"],"ajuda_externa":[]}'::jsonb, '[]'::jsonb, null,
    '{"campos":["trocaCom","assumidaPor"],"linhas":[{"chave":"smk-beto"}]}'::jsonb);
  select e.linha_overrides into v_over3 from public.escala_cirurgica e where e.id = v_id;
  select coalesce(jsonb_agg(jsonb_build_object('para', e.status_para, 'chave', e.anestesista, 'motivo', e.detalhe->>'motivo') order by e.em, e.id), '[]') into v_ev3
    from public.escala_cirurgica_evento e where e.escala_id = v_id and e.tipo = 'troca';

  v_out := jsonb_build_object('over2', v_over2, 'lib2', v_lib2, 'casos2', v_casos2, 'ev2', v_ev2, 'over3', v_over3, 'ev3', v_ev3);
  raise exception 'SMOKE_RESULT %', v_out::text using errcode = 'P0001';
end $$;
select pg_temp.smoke_publicacao('${UID}');
`

const r = await query(SQL)
const msg = typeof r.body === 'string' ? r.body : (r.body?.message || JSON.stringify(r.body))
const m = /SMOKE_RESULT (\{[\s\S]*\})/.exec(msg || '')
if (!m) {
  console.error('❌ o smoke não devolveu resultado (a migration está aplicada?)')
  console.error(String(msg).slice(0, 600))
  process.exit(1)
}
const out = JSON.parse(m[1])

const falhas = []
const check = (cond, rotulo) => { if (cond) console.log(`✅ ${rotulo}`); else { console.log(`❌ ${rotulo}`); falhas.push(rotulo) } }

const ana2 = out.over2?.['matutino:smk-ana'] || {}
const beto2 = out.over2?.['matutino:smk-beto'] || {}
check(ana2.trocaCom?.uid === 'smk-carla', 'republicar preserva trocaCom de quem segue na ordem')
check(beto2.duplicidade === 'intencional', 'republicar preserva duplicidade intencional')
check(beto2.observacao === 'recado', 'republicar preserva a observação da linha')
check(beto2.assumidaPor?.uid === 'smk-carla' && beto2.assumidaPor?.de?.uid === 'smk-beto', 'republicar preserva assumidaPor com o recibo do dono')
check(!('matutino:smk-ana' in (out.lib2 || {})), 'republicar ZERA a liberação (regra 23/07, dono 05/09)')
check(out.casos2?.length === 1 && out.casos2[0].uid === 'smk-carla' && out.casos2[0].anestesista === 'CARLA', 'posição assumida preservada re-aponta o caso do dono antigo')
check(Array.isArray(beto2.assumidaPor?.casoIds) && beto2.assumidaPor.casoIds.length === 1, 'casoIds do assumidaPor recebe o id novo')
check(typeof ana2.por === 'string' && typeof ana2.em === 'string', 'override mesclado sai carimbado por/em')
const decl = (out.ev2 || []).find((e) => e.para === 'troca_declarada' && e.chave === 'matutino:smk-ana')
check(decl?.motivo === 'publicacao', 'troca declarada NA publicação sai com motivo publicacao')
check(!('matutino:smk-ana' in (out.over3 || {})), 'quem saiu da ordem perde o rastro na republicação')
const desf = (out.ev3 || []).find((e) => e.para === 'troca_desfeita' && e.chave === 'matutino:smk-ana')
check(desf?.motivo === 'reset_publicacao', 'o rastro apagado pela republicação sai rotulado reset_publicacao')
check(out.over3?.['matutino:smk-beto']?.assumidaPor?.uid === 'smk-carla', 'quem seguiu na ordem mantém a posição assumida na 3ª publicação')

if (falhas.length) { console.error(`\n${falhas.length} asserção(ões) falharam`); process.exit(1) }
console.log('\n✅ smoke ok — nada ficou gravado (a função terminou em exceção; transação desfeita)')
