/**
 * RELATÓRIO DE ADESÃO — cópia pronta no servidor (dono 09/11/2026), migration 20261109233000
 * rodando num Postgres em memória (PGlite).
 *
 * O relatório era recalculado a cada chamada (192/dia, mediana 2,4 s). Agora o cálculo é interno
 * (`_calc`), um cron grava o resultado ao fim de cada turno e a função que o app chama devolve a linha gravada — mesmo
 * nome, mesmo JSON. O que trava aqui: quem chama recebe a CÓPIA (não recalcula), cópia velha ou
 * janela fora de 30/60 calcula na hora, o acesso continua conferido, o `_calc` e a tabela não ficam
 * abertos ao app, rodar a migration duas vezes não clona a função errada, e o rollback devolve tudo.
 *
 * O corpo do relatório aqui é um substituto com o MESMO bloco de acesso do que está no ar: a
 * migration clona a definição que encontrar, e é esse recorte que precisa funcionar.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync('supabase/migrations/20261109233000_escala_adesao_snapshot.sql', 'utf8')
const ROLLBACK = readFileSync('scripts/rollback-20261109233000-adesao-snapshot.sql', 'utf8')

let db
const um = async (sql) => (await db.query(sql)).rows[0]
const relatorio = async (dias) => (await um(`select public.escala_adesao_relatorio(${dias}) as r`)).r
const calculos = async () => Number((await um('select count(*) as n from public.contagem_calc')).n)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create table public.sessao (uid text);
    insert into public.sessao values ('u-ativo');
    create function public.firebase_uid() returns text language sql as $$ select uid from public.sessao limit 1 $$;
    create table public.profiles (id text primary key, active boolean default true);
    insert into public.profiles values ('u-ativo', true), ('u-inativo', false);
    -- conta quantas vezes o CÁLCULO rodou (o que a cópia pronta existe para evitar)
    create table public.contagem_calc (dias integer, em timestamptz default now());

    create or replace function public.escala_adesao_relatorio(p_dias integer default 30)
    returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public'
    as $function$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 30), 7), 90);
  v_result jsonb;
begin
  -- Qualquer usuário ATIVO logado (decisão do dono: todos veem tudo).
  if public.firebase_uid() is null
     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  insert into public.contagem_calc (dias) values (v_dias);
  if v_dias > 0 then
    v_result := jsonb_build_object('dias', v_dias, 'n', (select count(*) from public.contagem_calc));
  end if;
  return v_result;
end;
$function$;
    grant execute on function public.escala_adesao_relatorio(integer) to authenticated;
  `)
  await db.exec(MIGRATION.slice(0, MIGRATION.indexOf('-- Conferência')))
}, 60000)

afterAll(async () => { await db?.close() })

describe('relatório de adesão — cópia pronta', () => {
  it('o cron roda ao fim de cada turno: 7h10, 13h10 e 19h10 de Brasília', () => {
    expect(MIGRATION).toContain("'escala-adesao-snapshot', '10 10,16,22 * * *'")
  })

  it('a migration grava as duas janelas e tira o bloco de acesso só do cálculo interno', async () => {
    const { rows } = await db.query('select dias from public.escala_adesao_snapshot order by dias')
    expect(rows.map((r) => r.dias)).toEqual([30, 60])
    const calc = (await um(`select pg_get_functiondef('public.escala_adesao_relatorio_calc(integer)'::regprocedure) as d`)).d
    expect(calc).not.toContain('acesso negado')
    // o `if` seguinte do corpo continua inteiro: o recorte parou no 1º `end if;`
    expect(calc).toContain('if v_dias > 0 then')
    const pub = (await um(`select pg_get_functiondef('public.escala_adesao_relatorio(integer)'::regprocedure) as d`)).d
    expect(pub).toContain('acesso negado')
    expect(pub).toContain('escala_adesao_snapshot')
  })

  it('quem chama recebe a cópia: dez chamadas não recalculam nada', async () => {
    const antes = await calculos()
    const a = await relatorio(30)
    for (let i = 0; i < 9; i++) expect(await relatorio(30)).toEqual(a)
    expect((await relatorio(60)).dias).toBe(60)
    expect(await calculos()).toBe(antes)
  })

  it('cópia do turno anterior ainda vale (12 h é o intervalo normal da noite); com mais de 14 h, cron parado, calcula na hora', async () => {
    await db.exec(`update public.escala_adesao_snapshot set gerado_em = now() - interval '12 hours 30 minutes' where dias = 30`)
    const antes = await calculos()
    await relatorio(30)
    expect(await calculos()).toBe(antes)
    await db.exec(`update public.escala_adesao_snapshot set gerado_em = now() - interval '14 hours 1 minute' where dias = 30`)
    await relatorio(30)
    expect(await calculos()).toBe(antes + 1)
    await db.exec('select public.escala_adesao_snapshot_atualizar()')
  })

  it('janela fora de 30/60 calcula na hora, como antes', async () => {
    const antes = await calculos()
    expect((await relatorio(7)).dias).toBe(7)
    expect(await calculos()).toBe(antes + 1)
  })

  it('regravar a cópia atualiza o que todos leem', async () => {
    const velho = await relatorio(30)
    await db.exec('select public.escala_adesao_snapshot_atualizar()')
    const novo = await relatorio(30)
    expect(novo.n).toBeGreaterThan(velho.n)
  })

  it('usuário inativo ou sem login continua recusado, mesmo com a cópia pronta', async () => {
    await db.exec(`update public.sessao set uid = 'u-inativo'`)
    await expect(relatorio(30)).rejects.toThrow(/acesso negado/)
    await db.exec('update public.sessao set uid = null')
    await expect(relatorio(30)).rejects.toThrow(/acesso negado/)
    await db.exec(`update public.sessao set uid = 'u-ativo'`)
  })

  it('o cálculo interno, quem grava e a tabela não ficam abertos ao app', async () => {
    const p = await um(`select
      has_function_privilege('authenticated', 'public.escala_adesao_relatorio_calc(integer)', 'execute') as calc,
      has_function_privilege('anon', 'public.escala_adesao_relatorio_calc(integer)', 'execute') as calc_anon,
      has_function_privilege('authenticated', 'public.escala_adesao_snapshot_atualizar()', 'execute') as gravar,
      has_table_privilege('authenticated', 'public.escala_adesao_snapshot', 'select') as tabela,
      has_function_privilege('authenticated', 'public.escala_adesao_relatorio(integer)', 'execute') as publica`)
    expect(p).toEqual({ calc: false, calc_anon: false, gravar: false, tabela: false, publica: true })
  })

  it('rodar a migration de novo não clona a função errada', async () => {
    await db.exec(MIGRATION.slice(0, MIGRATION.indexOf('-- Conferência')))
    const calc = (await um(`select pg_get_functiondef('public.escala_adesao_relatorio_calc(integer)'::regprocedure) as d`)).d
    expect(calc).not.toContain('escala_adesao_snapshot')
    expect(calc).toContain('contagem_calc')
    expect((await relatorio(30)).dias).toBe(30)
  })

  it('rollback devolve o cálculo ao nome público, com o acesso, e remove a cópia', async () => {
    await db.exec(ROLLBACK)
    expect((await um(`select to_regprocedure('public.escala_adesao_relatorio_calc(integer)') as f`)).f).toBeNull()
    expect((await um(`select to_regclass('public.escala_adesao_snapshot') as t`)).t).toBeNull()
    const antes = await calculos()
    expect((await relatorio(30)).dias).toBe(30)
    expect(await calculos()).toBe(antes + 1)
    await db.exec(`update public.sessao set uid = 'u-inativo'`)
    await expect(relatorio(30)).rejects.toThrow(/acesso negado/)
  })
})
