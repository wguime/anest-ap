/**
 * CAPTURA PARA O APRENDIZADO (dono 25/09/2026, itens 1 e 2) — migration
 * 20260925220000_escala_captura_aprendizado.sql, rodada num Postgres em memória.
 *
 * Travas:
 *  - estimativa: cada término informado de uma cirurgia vira linha, INCLUSIVE o que
 *    "terminada" zera (valor_de = a última estimativa antes do fim) — antes se perdia;
 *  - estimativa_total: o tempo total da pessoa (linha_overrides[turno:chave].termino);
 *  - alocacao: o caso como foi gravado (publicação ou manual), sem dado de paciente;
 *  - realocacao: troca de anestesista no caso;
 *  - ordem: ordem de liberação por turno (array legado = matutino);
 *  - NADA vai para `escala_cirurgica_evento`, que o relatório de adesão conta como ação;
 *  - falha da captura nunca bloqueia a escrita clínica.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATION = 'supabase/migrations/20260925220000_escala_captura_aprendizado.sql'
let db

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    -- ator do JWT, controlado pelo teste
    create function public.firebase_uid() returns text language sql
      as $$ select coalesce(current_setting('teste.uid', true), '') $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql as $$ select true $$;
    create function public.is_admin() returns boolean language sql as $$ select current_setting('teste.admin', true) = '1' $$;
    create table public.escala_cirurgica (
      id uuid primary key default gen_random_uuid(), data date, hospital text, status text,
      ordem_liberacao jsonb, liberacoes jsonb, linha_overrides jsonb, updated_at timestamptz);
    create table public.escala_cirurgica_caso (
      id uuid primary key default gen_random_uuid(), escala_id uuid, sala text, ordem int,
      hora text, tempo_estimado text, termino_previsto text, termino_previsto_por text,
      paciente_iniciais text, idade text, procedimento text, convenio text, cirurgiao text,
      anestesista text, anestesista_user_id text, residente_user_id text, bloco text,
      is_continuacao boolean default false, sem_anestesista boolean default false, tipo text,
      gravidade text, turno text, status_cirurgia text default 'agendada', status_extra text,
      origem text not null default 'importacao');
    -- a tabela que a adesão conta: nada da captura pode cair aqui
    create table public.escala_cirurgica_evento (id uuid primary key default gen_random_uuid(), tipo text, por text);
  `)
  await db.exec(readFileSync(MIGRATION, 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`truncate escala_cirurgica, escala_cirurgica_caso, escala_cirurgica_captura, escala_cirurgica_evento;
    select set_config('teste.uid', '', false);`)
})

const escala = async (extra = {}) => {
  const { rows } = await db.query(
    `insert into escala_cirurgica (data, hospital, status, ordem_liberacao, linha_overrides)
     values ('2026-09-25', 'unimed', 'publicada', $1::jsonb, $2::jsonb) returning id`,
    [JSON.stringify(extra.ordem ?? { matutino: ['A', 'B'] }), JSON.stringify(extra.overrides ?? {})])
  return rows[0].id
}
const caso = async (escalaId, extra = {}) => {
  const { rows } = await db.query(
    `insert into escala_cirurgica_caso (escala_id, sala, ordem, hora, procedimento, cirurgiao,
       anestesista, anestesista_user_id, paciente_iniciais, idade, turno, bloco, origem)
     values ($1, 'Sala 3', 1, '16:00', 'OSTEOSSINTESE', 'Carlos Fogaca', $2, $3, 'X.Y.', '40a',
       'vespertino', 'normal', $4) returning id`,
    [escalaId, extra.anestesista ?? 'KLISMAN', extra.uid ?? 'uid-klisman', extra.origem ?? 'importacao'])
  return rows[0].id
}
// `seq` é a ordem de gravação: na mesma transação o `em` empata
const capturas = async (tipo) => (await db.query(
  'select * from escala_cirurgica_captura where tipo = $1 order by seq', [tipo])).rows

describe('alocacao — o caso como foi gravado', () => {
  it('grava sala, cirurgião, anestesista e o contexto; sem nenhum dado de paciente', async () => {
    const e = await escala()
    const id = await caso(e)
    const [a] = await capturas('alocacao')
    expect(a).toMatchObject({
      caso_id: id, escala_id: e, hospital: 'unimed', turno: 'vespertino', sala: 'Sala 3',
      cirurgiao: 'Carlos Fogaca', procedimento: 'OSTEOSSINTESE', anestesista: 'KLISMAN',
      anestesista_user_id: 'uid-klisman', hora: '16:00',
    })
    expect(a.detalhe).toMatchObject({ ordem: 1, bloco: 'normal', origem: 'importacao', publicacao: false })
    const { rows: cols } = await db.query(`select column_name from information_schema.columns
      where table_name = 'escala_cirurgica_captura'`)
    const nomes = cols.map((c) => c.column_name)
    expect(nomes).not.toContain('paciente_iniciais')
    expect(nomes).not.toContain('idade')
    expect(JSON.stringify(a)).not.toContain('X.Y.')
    expect(JSON.stringify(a)).not.toContain('40a')
  })

  it('marca o que a PUBLICAÇÃO gravou (GUC anest.publicacao), separado do caso manual', async () => {
    const e = await escala()
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('anest.publicacao', '1', true)`)
      await tx.query(`insert into escala_cirurgica_caso (escala_id, sala, turno) values ($1, 'Sala 1', 'matutino')`, [e])
    })
    await caso(e, { origem: 'manual' })
    const a = await capturas('alocacao')
    expect(a.map((x) => x.detalhe.publicacao)).toEqual([true, false])
    expect(a[1].detalhe.origem).toBe('manual')
  })
})

describe('estimativa — cada término informado de uma cirurgia', () => {
  it('grava de → para e o autor do JWT; o zerar do "terminada" guarda a última estimativa', async () => {
    const e = await escala()
    const id = await caso(e)
    await db.query(`select set_config('teste.uid', 'uid-plantonista', false)`)
    await db.query(`update escala_cirurgica_caso set termino_previsto = '16:30' where id = $1`, [id])
    await db.query(`update escala_cirurgica_caso set termino_previsto = '17:10' where id = $1`, [id])
    await db.query(`update escala_cirurgica_caso set status_cirurgia = 'terminada', termino_previsto = null where id = $1`, [id])
    const est = await capturas('estimativa')
    expect(est.map((x) => [x.valor_de, x.valor_para])).toEqual([[null, '16:30'], ['16:30', '17:10'], ['17:10', null]])
    expect(est.every((x) => x.por === 'uid-plantonista')).toBe(true)
    expect(est[2].detalhe).toMatchObject({ status: 'terminada', statusDe: 'agendada' })
  })

  it('outra coluna mudando (sala, status) não inventa estimativa', async () => {
    const e = await escala()
    const id = await caso(e)
    await db.query(`update escala_cirurgica_caso set sala = 'Sala 4', status_cirurgia = 'iniciada' where id = $1`, [id])
    expect(await capturas('estimativa')).toHaveLength(0)
  })
})

describe('realocacao — troca de anestesista no caso', () => {
  it('quem saiu e quem entrou, com os logins', async () => {
    const e = await escala()
    const id = await caso(e)
    await db.query(`update escala_cirurgica_caso set anestesista = 'PAULO', anestesista_user_id = 'uid-paulo' where id = $1`, [id])
    const [r] = await capturas('realocacao')
    expect(r).toMatchObject({ caso_id: id, valor_de: 'KLISMAN', valor_para: 'PAULO' })
    expect(r.detalhe).toMatchObject({ deUid: 'uid-klisman', paraUid: 'uid-paulo' })
  })
})

describe('estimativa_total — o tempo total da pessoa', () => {
  it('só quando o `termino` da chave muda; outros campos da linha não contam', async () => {
    const e = await escala()
    const set = (o) => db.query(`update escala_cirurgica set linha_overrides = $1::jsonb where id = $2`, [JSON.stringify(o), e])
    await set({ 'vespertino:uid-klisman': { termino: '17:30', por: 'uid-klisman' } })
    await set({ 'vespertino:uid-klisman': { termino: '17:30', por: 'uid-klisman', observacao: 'sai mais cedo' } })
    await set({ 'vespertino:uid-klisman': { observacao: 'sai mais cedo' }, legado: 'Sala 2' })
    const t = await capturas('estimativa_total')
    expect(t.map((x) => [x.anestesista, x.turno, x.valor_de, x.valor_para])).toEqual([
      ['vespertino:uid-klisman', 'vespertino', null, '17:30'],
      ['vespertino:uid-klisman', 'vespertino', '17:30', null],
    ])
    // sem JWT, o autor vem do `por` gravado na própria linha
    expect(t[0].por).toBe('uid-klisman')
  })
})

describe('ordem — a ordem de liberação publicada, por turno', () => {
  it('só o turno que mudou; array legado vale como matutino', async () => {
    const e = await escala({ ordem: ['A', 'B'] })
    await db.query(`update escala_cirurgica set ordem_liberacao = $1::jsonb where id = $2`,
      [JSON.stringify({ matutino: ['A', 'B'], vespertino: ['C', 'D'] }), e])
    const o = await capturas('ordem')
    expect(o).toHaveLength(1)
    expect(o[0].turno).toBe('vespertino')
    expect(o[0].detalhe.para).toEqual(['C', 'D'])
    expect(o[0].detalhe.de ?? null).toBeNull()
  })
})

describe('isolamento e segurança', () => {
  it('nenhuma função nova escreve em escala_cirurgica_evento (a adesão conta tudo de lá como ação)', async () => {
    const { rows } = await db.query(`select p.proname, pg_get_functiondef(p.oid) def from pg_proc p
      where p.proname in ('captura_escala_caso_insert', 'captura_escala_caso_update', 'captura_escala_linha')`)
    expect(rows).toHaveLength(3)
    for (const r of rows) expect(r.def).not.toContain('escala_cirurgica_evento')
    const e = await escala()
    const id = await caso(e)
    await db.query(`update escala_cirurgica_caso set termino_previsto = '18:00' where id = $1`, [id])
    expect((await db.query('select count(*)::int n from escala_cirurgica_evento')).rows[0].n).toBe(0)
  })

  it('cliente não escreve nem trunca a captura; a leitura é só de admin (dado de desempenho de pessoa)', async () => {
    const { rows } = await db.query(`select
      has_table_privilege('authenticated', 'public.escala_cirurgica_captura', 'insert') ins,
      has_table_privilege('authenticated', 'public.escala_cirurgica_captura', 'truncate') trunc,
      has_table_privilege('authenticated', 'public.escala_cirurgica_captura', 'select') sel,
      has_table_privilege('anon', 'public.escala_cirurgica_captura', 'select') anon_sel,
      (select qual from pg_policies where tablename = 'escala_cirurgica_captura' and cmd = 'SELECT') qual`)
    expect(rows[0]).toMatchObject({ ins: false, trunc: false, sel: true, anon_sel: false })
    expect(rows[0].qual).toContain('is_admin')
  })

  it('aplicar a migration de novo não duplica trigger, policy nem captura', async () => {
    await db.exec(readFileSync(MIGRATION, 'utf8'))
    const { rows } = await db.query(`select
      (select count(*)::int from pg_trigger where tgname like 'tr_escala%captura%') triggers,
      (select count(*)::int from pg_policies where tablename = 'escala_cirurgica_captura') policies`)
    expect(rows[0]).toMatchObject({ triggers: 3, policies: 1 })
    const e = await escala()
    await caso(e)
    expect(await capturas('alocacao')).toHaveLength(1)
  })

  it('a captura falhando NUNCA impede a escrita clínica', async () => {
    const e = await escala()
    const id = await caso(e)
    await db.exec('alter table escala_cirurgica_captura rename to captura_fora')
    try {
      await db.query(`update escala_cirurgica_caso set termino_previsto = '19:00' where id = $1`, [id])
      const { rows } = await db.query('select termino_previsto from escala_cirurgica_caso where id = $1', [id])
      expect(rows[0].termino_previsto).toBe('19:00')
    } finally {
      await db.exec('alter table captura_fora rename to escala_cirurgica_captura')
    }
  })
})
