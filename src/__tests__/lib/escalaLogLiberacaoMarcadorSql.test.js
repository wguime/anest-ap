/**
 * O LOG DE LIBERAÇÃO NÃO CHAMA O MARCADOR DE "LIBERADO" (10/11/2026) — migration
 * 20261110120000_escala_log_liberacao_sem_marcador_repasse.sql, num Postgres em memória.
 *
 * `liberacoes` guarda a liberação ({ liberadoEm }) e o marcador ({ escalado: true }) do
 * repasse/acionamento na mesma chave. O trigger de 18/07 registrava os dois como
 * "liberado": 144 de 1.154 eventos em 30 dias, contados como ação na adesão e lidos como
 * liberação fora da ordem em toda auditoria da fila.
 *
 * O arquivo roda o caminho inteiro: corpo de produção (o do rollback) → migration →
 * rollback. O primeiro describe documenta o defeito; se ele parar de falhar "do jeito
 * antigo", o rollback deixou de ser o corpo que estava no ar.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATION = 'supabase/migrations/20261110120000_escala_log_liberacao_sem_marcador_repasse.sql'
const ROLLBACK = 'scripts/rollback-20261110120000-log-liberacao-sem-marcador.sql'
const LIB = { liberadoEm: '2026-10-19T14:45:00.000Z', por: 'uid-marilio' }
const MARCADOR = { escalado: true, por: 'uid-klisman', em: '2026-10-19T14:45:00.000Z' }
let db
let escalaId

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.firebase_uid() returns text language sql
      as $$ select coalesce(current_setting('teste.uid', true), '') $$;
    create table public.escala_cirurgica (
      id uuid primary key default gen_random_uuid(), data date, hospital text,
      ordem_liberacao jsonb, liberacoes jsonb, linha_overrides jsonb, updated_at timestamptz);
    create table public.escala_cirurgica_evento (
      id uuid primary key default gen_random_uuid(), tipo text, escala_id uuid, data date, hospital text,
      anestesista text, status_para text, detalhe jsonb, por text, em timestamptz default now(),
      seq bigserial);
  `)
  // o corpo que está em produção (é o que o rollback devolve) + o trigger como está no ar
  await db.exec(readFileSync(ROLLBACK, 'utf8'))
  await db.exec(`create trigger tr_escala_evento_liberacao after update on public.escala_cirurgica
    for each row when (old.liberacoes is distinct from new.liberacoes) execute function public.log_escala_liberacao();`)
}, 30000)
afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await db.exec(`truncate escala_cirurgica, escala_cirurgica_evento;
    select set_config('teste.uid', 'uid-klisman', false);
    select set_config('anest.publicacao', '', false);
    select set_config('anest.liberacao_movida', '', false);`)
  const { rows } = await db.query(
    `insert into escala_cirurgica (data, hospital, ordem_liberacao, liberacoes)
     values ('2026-10-19', 'hro', '{"matutino":["A","CRISTINA","C"]}'::jsonb, '{}'::jsonb) returning id`)
  escalaId = rows[0].id
})

const gravar = (liberacoes) => db.query('update escala_cirurgica set liberacoes = $1::jsonb where id = $2', [JSON.stringify(liberacoes), escalaId])
const eventos = async () => (await db.query(
  `select anestesista, status_para, por, detalhe from escala_cirurgica_evento order by seq`)).rows
const acoes = async () => Number((await db.query(
  'select count(*) n from escala_cirurgica_evento where por is not null')).rows[0].n)

describe('ANTES (corpo de produção em 10/11): o defeito', () => {
  it('o marcador do repasse sai como "liberado", com autor, e conta como ação', async () => {
    await gravar({ 'matutino:uid-cristina': MARCADOR })
    const ev = await eventos()
    expect(ev).toHaveLength(1)
    expect(ev[0].status_para).toBe('liberado')
    expect(ev[0].detalhe.em).toBeNull() // é assim que se reconhece o marcador no histórico
    expect(await acoes()).toBe(1)
  })
})

describe('DEPOIS da migration', () => {
  beforeAll(async () => { await db.exec(readFileSync(MIGRATION, 'utf8')) })

  it('marcador novo → "marcador", sem autor na coluna (fora da conta de ações) e com o autor no detalhe', async () => {
    await gravar({ 'matutino:uid-cristina': MARCADOR })
    const ev = await eventos()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ anestesista: 'matutino:uid-cristina', status_para: 'marcador', por: null })
    expect(ev[0].detalhe.por).toBe('uid-klisman')
    expect(ev[0].detalhe.ordem).toEqual({ matutino: ['A', 'CRISTINA', 'C'] })
    expect(await acoes()).toBe(0)
  })

  it('liberação de verdade segue "liberado", com o autor do JWT e o horário', async () => {
    await gravar({ 'matutino:uid-cristina': LIB })
    const ev = await eventos()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ status_para: 'liberado', por: 'uid-klisman' })
    expect(ev[0].detalhe.em).toBe(LIB.liberadoEm)
    expect(await acoes()).toBe(1)
  })

  it('liberar por cima do marcador do repasse é "liberado" (o toque que libera quem ficou sem caso)', async () => {
    await gravar({ 'matutino:uid-cristina': MARCADOR })
    await gravar({ 'matutino:uid-cristina': LIB })
    expect((await eventos()).map((e) => e.status_para)).toEqual(['marcador', 'liberado'])
  })

  it('marcador por cima de uma liberação é "desfeito": a pessoa voltou à fila', async () => {
    await gravar({ 'matutino:uid-cristina': LIB })
    await gravar({ 'matutino:uid-cristina': MARCADOR })
    const ev = await eventos()
    expect(ev.map((e) => e.status_para)).toEqual(['liberado', 'desfeito'])
    expect(ev[1].por).toBe('uid-klisman')
    expect(ev[1].detalhe.marcador).toBe(true)
  })

  it('chave removida: liberação vira "desfeito"; marcador removido não vira nada', async () => {
    await gravar({ 'matutino:uid-cristina': LIB, 'matutino:uid-c': MARCADOR })
    await db.exec('truncate escala_cirurgica_evento')
    await gravar({})
    const ev = await eventos()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ anestesista: 'matutino:uid-cristina', status_para: 'desfeito' })
  })

  it('regravar só por/em, com o mesmo liberadoEm, não repete o evento', async () => {
    await gravar({ 'matutino:uid-cristina': LIB })
    await gravar({ 'matutino:uid-cristina': { ...LIB, por: 'uid-outro', em: '2026-10-19T15:00:00.000Z' } })
    expect((await eventos()).map((e) => e.status_para)).toEqual(['liberado'])
  })

  it('mudar o horário da liberação registra de novo', async () => {
    await gravar({ 'matutino:uid-cristina': LIB })
    await gravar({ 'matutino:uid-cristina': { ...LIB, liberadoEm: '2026-10-19T15:10:00.000Z' } })
    expect((await eventos()).map((e) => e.status_para)).toEqual(['liberado', 'liberado'])
  })

  it('dentro da publicação o desfeito sai rotulado reset_publicacao', async () => {
    await gravar({ 'matutino:uid-cristina': LIB })
    await db.exec(`begin; select set_config('anest.publicacao', '1', true);
      update escala_cirurgica set liberacoes = '{}'::jsonb; commit;`)
    const ev = await eventos()
    expect(ev[1]).toMatchObject({ status_para: 'desfeito' })
    expect(ev[1].detalhe.motivo).toBe('reset_publicacao')
  })

  it('marca que só muda de chave (desfazer troca) não gera evento de liberação', async () => {
    await gravar({ 'vespertino:uid-klisman': LIB })
    await db.exec('truncate escala_cirurgica_evento')
    await db.query(`begin`)
    await db.query(`select set_config('anest.liberacao_movida', '1', true)`)
    await gravar({ 'vespertino:uid-fernando': LIB })
    await db.query(`commit`)
    expect(await eventos()).toEqual([])
  })

  it('liberacoes corrompido (não-objeto) não trava a escrita', async () => {
    await db.query(`update escala_cirurgica set liberacoes = '[]'::jsonb where id = $1`, [escalaId])
    expect(await eventos()).toEqual([])
  })
})

describe('ROLLBACK', () => {
  it('devolve o corpo de 18/07: o marcador volta a sair como "liberado"', async () => {
    await db.exec(readFileSync(ROLLBACK, 'utf8'))
    await gravar({ 'matutino:uid-cristina': MARCADOR })
    expect((await eventos()).map((e) => e.status_para)).toEqual(['liberado'])
    await db.exec(readFileSync(MIGRATION, 'utf8')) // deixa o banco do teste no estado novo
  })
})
