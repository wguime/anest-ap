/**
 * DESFAZER A TROCA NUMA TRANSAÇÃO, A LIBERAÇÃO SEGUE A PESSOA (10/11/2026) — migration
 * 20261110121000_escala_desfazer_troca_transacional.sql, num Postgres em memória (com o
 * trigger de rastro de 20261110120000 por baixo, para provar que mover a marca não vira
 * "liberação" no log).
 *
 * Recortes reais de 21/10/2026, HRO à tarde (horários em UTC, como o banco guarda):
 *  - Fernando assume a 14ª do Klisman às 14:01, é liberado nela às 15:02 e a troca é
 *    desfeita às 16:40. O desfazer do navegador deixava a marca na vaga: o Klisman
 *    voltava "Liberado" com a cirurgia devolvida e o Fernando voltava à fila — os dois
 *    foram re-liberados à mão como "fora do rodapé".
 *  - Melo (12ª) ⇄ Cury (6ª) às 18:37, liberação na 12ª, desfeita às 18:38.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const LOG = 'supabase/migrations/20261110120000_escala_log_liberacao_sem_marcador_repasse.sql'
const MIGRATION = 'supabase/migrations/20261110121000_escala_desfazer_troca_transacional.sql'
const ROLLBACK = 'scripts/rollback-20261110121000-desfazer-troca-transacional.sql'
let db

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.firebase_uid() returns text language sql
      as $$ select coalesce(current_setting('teste.uid', true), '') $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql
      as $$ select coalesce(current_setting('teste.pode', true), '1') = '1' $$;
    create table public.escala_cirurgica (
      id uuid primary key, data date, hospital text, ordem_liberacao jsonb,
      liberacoes jsonb, linha_overrides jsonb, updated_at timestamptz);
    create table public.escala_cirurgica_caso (
      id uuid primary key, escala_id uuid, anestesista text, anestesista_user_id text,
      sem_anestesista boolean default false, status_cirurgia text default 'agendada');
    create table public.escala_cirurgica_evento (
      id uuid primary key default gen_random_uuid(), tipo text, escala_id uuid, data date, hospital text,
      anestesista text, status_para text, detalhe jsonb, por text, em timestamptz default now());
  `)
  await db.exec(readFileSync(LOG, 'utf8'))
  await db.exec(`create trigger tr_escala_evento_liberacao after update on public.escala_cirurgica
    for each row when (old.liberacoes is distinct from new.liberacoes) execute function public.log_escala_liberacao();`)
  await db.exec(readFileSync(MIGRATION, 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })

const HRO = '00000000-0000-0000-0000-0000000000a1'
const UNI = '00000000-0000-0000-0000-0000000000b2'
const C_HRO = '00000000-0000-0000-0000-00000000c001' // cirurgia do Klisman no HRO, com o Fernando durante a troca
const C_UNI = '00000000-0000-0000-0000-00000000c002' // cirurgia do Fernando na Unimed, com o Klisman
const C_CURY = '00000000-0000-0000-0000-00000000c003'

const semear = async ({ hroOver = {}, hroLib = {}, uniOver = {}, uniLib = {}, casos = [] } = {}) => {
  await db.exec(`truncate escala_cirurgica, escala_cirurgica_caso, escala_cirurgica_evento;
    select set_config('teste.uid', 'uid-fernando', false); select set_config('teste.pode', '1', false);`)
  await db.query(`insert into escala_cirurgica (id, data, hospital, ordem_liberacao, liberacoes, linha_overrides) values
    ($1, '2026-10-21', 'hro', '{}'::jsonb, $3::jsonb, $4::jsonb), ($2, '2026-10-21', 'unimed', '{}'::jsonb, $5::jsonb, $6::jsonb)`,
  [HRO, UNI, JSON.stringify(hroLib), JSON.stringify(hroOver), JSON.stringify(uniLib), JSON.stringify(uniOver)])
  for (const c of casos) {
    await db.query('insert into escala_cirurgica_caso (id, escala_id, anestesista, anestesista_user_id) values ($1, $2, $3, $4)', c)
  }
}
const desfazer = async (lados) => (await db.query('select public.rpc_escala_desfazer_troca($1::jsonb) r', [JSON.stringify(lados)])).rows[0].r
const escala = async (id) => (await db.query('select liberacoes, linha_overrides from escala_cirurgica where id = $1', [id])).rows[0]
const caso = async (id) => (await db.query('select anestesista, anestesista_user_id from escala_cirurgica_caso where id = $1', [id])).rows[0]
const eventosLiberacao = async () => (await db.query(`select anestesista, status_para, por, detalhe from escala_cirurgica_evento where tipo = 'liberacao' order by anestesista`)).rows

// 21/10: Fernando (Unimed, 8ª) ⇄ Klisman (HRO, 14ª), executada 13:59/14:01 BRT
const fernandoKlisman = () => semear({
  hroOver: { 'vespertino:uid-klisman': {
    observacao: 'Sala 3 ate 16h',
    assumidaPor: { uid: 'uid-fernando', nome: 'Fernando Henrique Machado', tipo: 'assuncao', de: { uid: 'uid-klisman', nome: 'Klisman' }, casoIds: [C_HRO], por: 'uid-fernando', em: '2026-10-21T17:01:00.000Z' },
    por: 'uid-fernando', em: '2026-10-21T17:01:00.000Z' } },
  hroLib: { 'vespertino:uid-klisman': { liberadoEm: '2026-10-21T18:02:00.000Z', por: 'uid-marilio' } }, // 15:02 BRT: quem saiu foi o Fernando
  uniOver: { 'vespertino:uid-fernando': {
    assumidaPor: { uid: 'uid-klisman', nome: 'Klisman Drescher Hilleshein', tipo: 'assuncao', casoIds: [C_UNI], por: 'uid-fernando', em: '2026-10-21T16:59:00.000Z' },
    por: 'uid-fernando', em: '2026-10-21T16:59:00.000Z' } },
  casos: [[C_HRO, HRO, 'FERNANDO', 'uid-fernando'], [C_UNI, UNI, 'KLISMAN', 'uid-klisman']],
})
const LADOS_FK = [
  { escala_id: HRO, chave: 'vespertino:uid-klisman', caso_ids: [C_HRO], para_uid: 'uid-klisman', para_apelido: 'KLISMAN' },
  { escala_id: UNI, chave: 'vespertino:uid-fernando', caso_ids: [C_UNI], para_uid: 'uid-fernando', para_apelido: 'FERNANDO' },
]

describe('21/10 — Fernando ⇄ Klisman, desfeita depois de a 14ª do HRO ser liberada', () => {
  beforeEach(fernandoKlisman)

  it('a liberação das 15:02 segue com o Fernando; a vaga do Klisman volta limpa, com a cirurgia dele', async () => {
    const r = await desfazer(LADOS_FK)
    const hro = await escala(HRO)
    expect(hro.liberacoes['vespertino:uid-klisman']).toBeUndefined()
    expect(hro.liberacoes['vespertino:uid-fernando']).toMatchObject({ liberadoEm: '2026-10-21T18:02:00.000Z', por: 'uid-marilio' })
    expect(await caso(C_HRO)).toEqual({ anestesista: 'KLISMAN', anestesista_user_id: 'uid-klisman' })
    expect(r.movidas).toEqual([{ escala_id: HRO, de: 'vespertino:uid-klisman', para: 'vespertino:uid-fernando' }])
    expect(r).toMatchObject({ lados: 2, pulados: 0 })
  })

  it('a posição volta ao dono e o resto do override fica (observação), recarimbado por quem desfez', async () => {
    await desfazer(LADOS_FK)
    const hro = await escala(HRO)
    expect(hro.linha_overrides['vespertino:uid-klisman'].assumidaPor).toBeUndefined()
    expect(hro.linha_overrides['vespertino:uid-klisman']).toMatchObject({ observacao: 'Sala 3 ate 16h', por: 'uid-fernando' })
    // do lado da Unimed não sobrou nada no override: a chave some
    expect((await escala(UNI)).linha_overrides).toEqual({})
    expect(await caso(C_UNI)).toEqual({ anestesista: 'FERNANDO', anestesista_user_id: 'uid-fernando' })
  })

  it('mover a marca não vira "liberado"/"desfeito" no log: é UM evento "movida", sem autor na coluna (fora da conta de ações)', async () => {
    await desfazer(LADOS_FK)
    const ev = await eventosLiberacao()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ anestesista: 'vespertino:uid-klisman', status_para: 'movida', por: null })
    expect(ev[0].detalhe).toMatchObject({ de: 'vespertino:uid-klisman', para: 'vespertino:uid-fernando', por: 'uid-fernando', apagada: false })
  })

  it('cirurgia do recibo que ficou SEM login e não é dupla ("?") volta ao dono — não fica órfã', async () => {
    await db.query(`update escala_cirurgica_caso set anestesista = '?', anestesista_user_id = null, sem_anestesista = true where id = $1`, [C_HRO])
    await desfazer(LADOS_FK)
    expect(await caso(C_HRO)).toEqual({ anestesista: 'KLISMAN', anestesista_user_id: 'uid-klisman' })
  })

  it('cirurgia que virou dupla "ocupante + alguém" fica como está (dupla não transfere)', async () => {
    await db.query(`update escala_cirurgica_caso set anestesista = 'FERNANDO + OSCAR', anestesista_user_id = null where id = $1`, [C_HRO])
    await desfazer(LADOS_FK)
    expect(await caso(C_HRO)).toEqual({ anestesista: 'FERNANDO + OSCAR', anestesista_user_id: null })
  })

  it('cirurgias sem dono a quem devolver (para_uid vazio): o payload é recusado inteiro, como na execução', async () => {
    await expect(desfazer([{ ...LADOS_FK[0], para_uid: '' }, LADOS_FK[1]])).rejects.toThrow(/payload_formato_invalido/)
    const hro = await escala(HRO)
    expect(hro.linha_overrides['vespertino:uid-klisman'].assumidaPor.uid).toBe('uid-fernando')
    expect((await escala(UNI)).linha_overrides['vespertino:uid-fernando'].assumidaPor.uid).toBe('uid-klisman')
    expect((await caso(C_UNI)).anestesista_user_id).toBe('uid-klisman')
  })

  it('só a posição, por escolha explícita (caso_ids vazio e sem para_uid): a vaga volta e as cirurgias ficam com quem estão', async () => {
    const r = await desfazer([{ escala_id: HRO, chave: 'vespertino:uid-klisman', caso_ids: [], para_uid: null }])
    expect(r).toMatchObject({ lados: 1, pulados: 0 })
    expect((await escala(HRO)).linha_overrides['vespertino:uid-klisman'].assumidaPor).toBeUndefined()
    expect((await caso(C_HRO)).anestesista_user_id).toBe('uid-fernando')
  })

  it('devolve o estado resultante das duas escalas (overrides, liberações e casos)', async () => {
    const r = await desfazer(LADOS_FK)
    expect(Object.keys(r.escalas).sort()).toEqual([HRO, UNI].sort())
    expect(r.liberacoes[HRO]['vespertino:uid-fernando'].liberadoEm).toBe('2026-10-21T18:02:00.000Z')
    expect(r.casos.map((c) => c.anestesistaUserId).sort()).toEqual(['uid-fernando', 'uid-klisman'])
  })

  it('é idempotente: repetir pula os dois lados e não mexe em nada', async () => {
    await desfazer(LADOS_FK)
    const antes = await escala(HRO)
    const r = await desfazer(LADOS_FK)
    expect(r).toMatchObject({ lados: 2, pulados: 2, movidas: [] })
    expect(await escala(HRO)).toEqual(antes)
  })

  it('tudo ou nada: um lado inválido derruba o desfazer inteiro', async () => {
    await expect(desfazer([LADOS_FK[0], { escala_id: UNI, chave: '' }])).rejects.toThrow(/payload_formato_invalido/)
    const hro = await escala(HRO)
    expect(hro.linha_overrides['vespertino:uid-klisman'].assumidaPor.uid).toBe('uid-fernando')
    expect(hro.liberacoes['vespertino:uid-klisman']).toBeDefined()
    expect((await caso(C_HRO)).anestesista_user_id).toBe('uid-fernando')
  })

  it('cirurgia que o ocupante já passou a um terceiro não é puxada de volta', async () => {
    await db.query(`update escala_cirurgica_caso set anestesista = 'MARILIO', anestesista_user_id = 'uid-marilio' where id = $1`, [C_HRO])
    await desfazer(LADOS_FK)
    expect(await caso(C_HRO)).toEqual({ anestesista: 'MARILIO', anestesista_user_id: 'uid-marilio' })
  })

  it('sem login e sem papel são recusados', async () => {
    await db.exec(`select set_config('teste.uid', '', false)`)
    await expect(desfazer(LADOS_FK)).rejects.toThrow(/nao_autenticado/)
    await db.exec(`select set_config('teste.uid', 'uid-x', false); select set_config('teste.pode', '0', false)`)
    await expect(desfazer(LADOS_FK)).rejects.toThrow(/permission_denied/)
  })
})

describe('21/10 — Melo (12ª) ⇄ Cury (6ª) na mesma escala, liberação na 12ª e desfeita 1 min depois', () => {
  beforeEach(() => semear({
    hroOver: {
      'vespertino:uid-melo': { assumidaPor: { uid: 'uid-cury', nome: 'Marcos Tadeu Cury', tipo: 'posicoes', casoIds: [], em: '2026-10-21T21:37:00.000Z' } },
      'vespertino:uid-cury': { assumidaPor: { uid: 'uid-melo', nome: 'Guilherme Melo', tipo: 'posicoes', casoIds: [C_CURY], em: '2026-10-21T21:37:00.000Z' } },
    },
    hroLib: { 'vespertino:uid-melo': { liberadoEm: '2026-10-21T21:37:40.000Z', por: 'uid-marilio' } }, // quem saiu na 12ª foi o Cury
    casos: [[C_CURY, HRO, 'GUILHERME M ELO', 'uid-melo']],
  }))

  it('a liberação fica com o Cury (na chave dele, que é a 6ª); a 12ª do Melo volta à fila', async () => {
    await desfazer([
      { escala_id: HRO, chave: 'vespertino:uid-melo', caso_ids: [], para_uid: 'uid-melo', para_apelido: 'GUILHERME M ELO' },
      { escala_id: HRO, chave: 'vespertino:uid-cury', caso_ids: [C_CURY], para_uid: 'uid-cury', para_apelido: 'CURY' },
    ])
    const hro = await escala(HRO)
    expect(hro.liberacoes).toEqual({ 'vespertino:uid-cury': { liberadoEm: '2026-10-21T21:37:40.000Z', por: 'uid-marilio' } })
    expect(hro.linha_overrides).toEqual({})
    expect(await caso(C_CURY)).toEqual({ anestesista: 'CURY', anestesista_user_id: 'uid-cury' })
  })
})

describe('A ⇄ B na MESMA escala com as DUAS vagas liberadas durante a assunção (revisão do validador, 11/11)', () => {
  // `v:melo` guarda a saída do Cury (que a ocupava) e `v:cury` a do Melo. Decidindo lado a
  // lado, o 1º lado via "o Cury já tem liberação própria" (era a do Melo, que também ia
  // sair), apagava a dele e o 2º era pulado: sobrava UMA marca, com horário e autor do outro.
  const LIB_NA_VAGA_DO_MELO = { liberadoEm: '2026-10-21T21:40:00.000Z', por: 'uid-marilio' } // quem saiu: Cury
  const LIB_NA_VAGA_DO_CURY = { liberadoEm: '2026-10-21T21:55:00.000Z', por: 'uid-daniela' } // quem saiu: Melo
  const LADOS = [
    { escala_id: HRO, chave: 'vespertino:uid-melo', caso_ids: [] },
    { escala_id: HRO, chave: 'vespertino:uid-cury', caso_ids: [] },
  ]
  beforeEach(() => semear({
    hroOver: {
      'vespertino:uid-melo': { assumidaPor: { uid: 'uid-cury', nome: 'Marcos Tadeu Cury', casoIds: [], em: '2026-10-21T21:37:00.000Z' } },
      'vespertino:uid-cury': { assumidaPor: { uid: 'uid-melo', nome: 'Guilherme Melo', casoIds: [], em: '2026-10-21T21:37:00.000Z' } },
    },
    hroLib: { 'vespertino:uid-melo': LIB_NA_VAGA_DO_MELO, 'vespertino:uid-cury': LIB_NA_VAGA_DO_CURY, 'vespertino:uid-oscar': { liberadoEm: '2026-10-21T20:00:00.000Z' } },
  }))

  it('as duas marcas trocam de chave: cada um continua liberado com o PRÓPRIO horário e autor', async () => {
    const r = await desfazer(LADOS)
    expect((await escala(HRO)).liberacoes).toEqual({
      'vespertino:uid-cury': LIB_NA_VAGA_DO_MELO,
      'vespertino:uid-melo': LIB_NA_VAGA_DO_CURY,
      'vespertino:uid-oscar': { liberadoEm: '2026-10-21T20:00:00.000Z' }, // quem não entrou na troca não é tocado
    })
    expect(r.movidas).toHaveLength(2)
  })

  it('a ordem dos lados no payload não muda o resultado', async () => {
    await desfazer([LADOS[1], LADOS[0]])
    const libs = (await escala(HRO)).liberacoes
    expect(libs['vespertino:uid-cury']).toEqual(LIB_NA_VAGA_DO_MELO)
    expect(libs['vespertino:uid-melo']).toEqual(LIB_NA_VAGA_DO_CURY)
  })

  it('dois eventos "movida", nenhum "apagada"', async () => {
    await desfazer(LADOS)
    const ev = await eventosLiberacao()
    expect(ev.map((e) => [e.status_para, e.detalhe.apagada])).toEqual([['movida', false], ['movida', false]])
  })

  it('o mesmo lado repetido no payload não duplica o movimento', async () => {
    const r = await desfazer([LADOS[0], LADOS[0], LADOS[1]])
    expect(r.movidas).toHaveLength(2)
    expect(r.pulados).toBe(1)
  })
})

describe('quando a marca NÃO muda de chave', () => {
  const assumida = (em, extra = {}) => ({ assumidaPor: { uid: 'uid-romulo', nome: 'Rômulo', casoIds: [], ...(em ? { em } : {}), ...extra } })
  const lado = [{ escala_id: UNI, chave: 'vespertino:uid-alexandre', caso_ids: [] }]

  it('liberada ANTES da assunção (09/11: Alexandre saiu 17:10, Rômulo assumiu 17:54) — é do dono e fica', async () => {
    await semear({ uniOver: { 'vespertino:uid-alexandre': assumida('2026-11-09T20:54:00.000Z') },
      uniLib: { 'vespertino:uid-alexandre': { liberadoEm: '2026-11-09T20:10:00.000Z' } } })
    const r = await desfazer(lado)
    expect((await escala(UNI)).liberacoes).toEqual({ 'vespertino:uid-alexandre': { liberadoEm: '2026-11-09T20:10:00.000Z' } })
    expect(r.movidas).toEqual([])
  })

  it('assunção antiga sem carimbo `em` — não dá para saber de quem é: fica na vaga', async () => {
    await semear({ uniOver: { 'vespertino:uid-alexandre': assumida(null) },
      uniLib: { 'vespertino:uid-alexandre': { liberadoEm: '2026-11-09T21:00:00.000Z' } } })
    await desfazer(lado)
    expect((await escala(UNI)).liberacoes['vespertino:uid-alexandre']).toBeDefined()
  })

  it('ocupante sem login (só nome) — fica na vaga', async () => {
    await semear({ uniOver: { 'vespertino:uid-alexandre': { assumidaPor: { nome: 'FULANO', em: '2026-11-09T20:00:00.000Z' } } },
      uniLib: { 'vespertino:uid-alexandre': { liberadoEm: '2026-11-09T21:00:00.000Z' } } })
    await desfazer(lado)
    expect((await escala(UNI)).liberacoes['vespertino:uid-alexandre']).toBeDefined()
  })

  it('marcador { escalado: true } na vaga não é liberação: fica', async () => {
    await semear({ uniOver: { 'vespertino:uid-alexandre': assumida('2026-11-09T20:00:00.000Z') },
      uniLib: { 'vespertino:uid-alexandre': { escalado: true } } })
    await desfazer(lado)
    expect((await escala(UNI)).liberacoes).toEqual({ 'vespertino:uid-alexandre': { escalado: true } })
  })

  it('chave da noite da fila única (sem turno de dia) — fica', async () => {
    await semear({ uniOver: { 'noite:uid-alexandre': assumida('2026-11-07T22:00:00.000Z') },
      uniLib: { 'noite:uid-alexandre': { liberadoEm: '2026-11-07T23:00:00.000Z' } } })
    await desfazer([{ escala_id: UNI, chave: 'noite:uid-alexandre', caso_ids: [] }])
    expect((await escala(UNI)).liberacoes['noite:uid-alexandre']).toBeDefined()
  })

  it('o ocupante já tinha liberação própria: a da vaga só sai, a dele não é sobrescrita', async () => {
    await semear({ uniOver: { 'vespertino:uid-alexandre': assumida('2026-11-09T20:00:00.000Z') },
      uniLib: { 'vespertino:uid-alexandre': { liberadoEm: '2026-11-09T21:00:00.000Z' }, 'vespertino:uid-romulo': { liberadoEm: '2026-11-09T19:00:00.000Z' } } })
    await desfazer(lado)
    expect((await escala(UNI)).liberacoes).toEqual({ 'vespertino:uid-romulo': { liberadoEm: '2026-11-09T19:00:00.000Z' } })
    const ev = await eventosLiberacao()
    expect(ev).toHaveLength(1)
    expect(ev[0].detalhe).toMatchObject({ de: 'vespertino:uid-alexandre', para: 'vespertino:uid-romulo', apagada: true })
  })
})

describe('ROLLBACK', () => {
  it('remove a função', async () => {
    await db.exec(readFileSync(ROLLBACK, 'utf8'))
    await expect(db.query(`select public.rpc_escala_desfazer_troca('[]'::jsonb)`)).rejects.toThrow()
    await db.exec(readFileSync(MIGRATION, 'utf8'))
  })
})
