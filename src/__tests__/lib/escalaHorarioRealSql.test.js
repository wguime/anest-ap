/**
 * HORÁRIO REAL no BANCO (dono 02/10) — a migration 20261002190000 rodando de verdade
 * num Postgres em memória (PGlite), na composição que está no ar: a RPC de publicação
 * de 23/09 + o patch do swap + a migration nova, e a RPC do toque no status.
 *
 * É o que garante a SINCRONIA entre as abas do lado do servidor: o toque em
 * Iniciada/Terminada (qualquer aba, qualquer aparelho) preenche o horário no caso, a
 * correção à mão vence o toque, o "Desfazer" devolve o de antes e republicar o turno
 * não perde nada. O realtime (rt_sinal) leva a linha às outras telas.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const ler = (f) => readFileSync(`supabase/migrations/${f}`, 'utf8')
const fatia = (sql, cabeca) => {
  const i = sql.indexOf(cabeca)
  return sql.slice(i, sql.indexOf('\n$$;', i) + 4)
}
const MIGRATION = ler('20261002190000_escala_caso_horario_real.sql')

let db
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create table public.quem (uid text);
    insert into public.quem values ('uid-paulo');
    create function public.firebase_uid() returns text language sql as $$ select uid from public.quem limit 1 $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql as $$ select true $$;
    create table public.profiles (id text, nome text);
    create table public.escala_anestesista_alias (user_id text, apelido text);
    create table public.escala_cirurgica (
      id uuid primary key default gen_random_uuid(), data date, hospital text, status text,
      created_by text, created_at timestamptz, updated_at timestamptz,
      ordem_liberacao jsonb, ajuda_externa jsonb, liberacoes jsonb, linha_overrides jsonb,
      publicacao_turnos jsonb, fds_meta jsonb, source_image_path text,
      published_at timestamptz, published_by text, published_by_name text,
      unique(data,hospital));
    create table public.escala_cirurgica_caso (
      id uuid primary key default gen_random_uuid(), escala_id uuid, sala text, ordem int,
      hora text, tempo_estimado text, termino_previsto text, paciente_iniciais text,
      idade text, procedimento text, convenio text, cirurgiao text, cirurgiao_display text,
      anestesista text, anestesista_user_id text, residente text, residente_user_id text,
      bloco text, is_continuacao boolean, sem_anestesista boolean, tipo text, gravidade text,
      turno text, status_cirurgia text default 'agendada', status_extra text,
      status_atualizado_em timestamptz, status_atualizado_por text,
      origem text not null default 'importacao', created_at timestamptz not null default now(),
      updated_at timestamptz not null default now());
  `)
  await db.exec(fatia(ler('20260923160000_escala_republicar_preserva_andamento.sql'), 'create or replace function public.rpc_publicar_escala_turno('))
  await db.exec(ler('20260923200000_escala_republicacao_swap.sql'))
  await db.exec(fatia(ler('20260821200000_escala_carimbo_status_eixo_principal.sql'), 'create or replace function public.rpc_escala_status_cirurgia('))
  await db.exec(MIGRATION)
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => { await db.exec("truncate escala_cirurgica, escala_cirurgica_caso; update quem set uid = 'uid-paulo'") })

const CASOS = [
  { sala: 'S1', hora: '13:30', anestesista: 'PAULO', anestesista_user_id: 'uid-paulo', paciente_iniciais: 'M.S.', procedimento: 'COLECISTECTOMIA', turno: 'vespertino' },
  { sala: 'S1', hora: '15:30', anestesista: 'PAULO', anestesista_user_id: 'uid-paulo', paciente_iniciais: 'J.R.', procedimento: 'HERNIORRAFIA', turno: 'vespertino' },
]
const publicar = () => db.query(`select public.rpc_publicar_escala_turno('2099-01-02','unimed','vespertino',
  $1::jsonb, $2::jsonb, null, null)`, [JSON.stringify({ ordem_liberacao: ['PAULO'] }), JSON.stringify(CASOS)])
const caso = async (hora) => (await db.query(
  "select id, status_cirurgia, inicio_real, termino_real, inicio_real_por, termino_real_por, termino_previsto from escala_cirurgica_caso where hora = $1", [hora])).rows[0]
const status = async (hora, s) => db.query('select public.rpc_escala_status_cirurgia($1, $2)', [(await caso(hora)).id, s])
const agoraSP = async () => (await db.query("select to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI') as h")).rows[0].h

describe('o toque no status preenche o horário (trigger)', () => {
  it('Iniciada grava o início com a hora da marcação, e quem marcou', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    const c = await caso('13:30')
    expect(c.inicio_real).toBe(await agoraSP())
    expect(c.inicio_real_por).toBe('uid-paulo')
    expect(c.termino_real).toBeNull()
  })

  it('o início CORRIGIDO à mão não é trocado pelo toque em Terminada; o término vem do toque', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    await db.query("update quem set uid = 'uid-ana'")
    await db.query("update escala_cirurgica_caso set inicio_real = '13:50' where hora = '13:30'")
    await status('13:30', 'terminada')
    const c = await caso('13:30')
    expect(c.inicio_real).toBe('13:50')
    expect(c.inicio_real_por).toBe('uid-ana')
    expect(c.termino_real).toBe(await agoraSP())
  })

  it('o término INFORMADO antes do toque (o "Confirmar" do card, 02/10) não é trocado pela hora do toque', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    await db.query("update escala_cirurgica_caso set termino_real = '15:10' where hora = '13:30'")
    await status('13:30', 'terminada')
    expect(await caso('13:30')).toMatchObject({ status_cirurgia: 'terminada', termino_real: '15:10' })
  })

  it('iniciada ANTES do recurso (sem início) → terminada: o início vem do carimbo antigo', async () => {
    await publicar()
    await db.query(`update escala_cirurgica_caso set status_cirurgia = 'iniciada',
      status_atualizado_em = '2099-01-02 14:33:00-03', inicio_real = null where hora = '13:30'`)
    await db.query("update escala_cirurgica_caso set inicio_real = null where hora = '13:30'") // como a linha antiga
    await status('13:30', 'terminada')
    expect((await caso('13:30')).inicio_real).toBe('14:33')
  })

  it('script que muda o status SEM carimbar usa agora — nunca o carimbo da transição anterior', async () => {
    await publicar()
    await db.query(`update escala_cirurgica_caso set status_cirurgia = 'iniciada',
      status_atualizado_em = '2099-01-02 06:00:00-03' where hora = '13:30'`)
    await db.query("update escala_cirurgica_caso set status_cirurgia = 'terminada' where hora = '13:30'")
    const c = await caso('13:30')
    expect(c.inicio_real).toBe('06:00')
    expect(c.termino_real).toBe(await agoraSP())
  })

  it('o "Desfazer" (status e carimbo de antes) tira o término e mantém o início', async () => {
    await publicar()
    await db.query(`update escala_cirurgica_caso set status_cirurgia = 'iniciada',
      status_atualizado_em = '2099-01-02 14:05:00-03' where hora = '13:30'`)
    await status('13:30', 'terminada')
    // o que o service `desfazerTerminada` manda
    await db.query(`update escala_cirurgica_caso set status_cirurgia = 'iniciada',
      status_atualizado_em = '2099-01-02 14:05:00-03' where hora = '13:30' and status_cirurgia = 'terminada'`)
    const c = await caso('13:30')
    expect(c).toMatchObject({ status_cirurgia: 'iniciada', inicio_real: '14:05', termino_real: null, termino_real_por: null })
  })

  it('voltar a Agendada apaga os dois', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    await status('13:30', 'agendada')
    expect(await caso('13:30')).toMatchObject({ inicio_real: null, termino_real: null, inicio_real_por: null })
  })

  it('os avisos (atrasada) não mexem no horário', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    const antes = await caso('13:30')
    await status('13:30', 'atrasada')
    expect((await caso('13:30')).inicio_real).toBe(antes.inicio_real)
  })

  it('horário que não existe é recusado pelo banco', async () => {
    await publicar()
    await expect(db.query("update escala_cirurgica_caso set inicio_real = '25:00' where hora = '13:30'")).rejects.toThrow(/escala_caso_inicio_real_hhmm/)
  })
})

describe('republicar o turno não perde o horário', () => {
  it('início e término (e autores) voltam no caso novo de mesma sala+hora+iniciais', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    await db.query("update escala_cirurgica_caso set inicio_real = '13:50' where hora = '13:30'")
    await status('13:30', 'terminada')
    const antes = await caso('13:30')
    await publicar()
    const depois = await caso('13:30')
    expect(depois.id).not.toBe(antes.id)
    expect(depois).toMatchObject({
      status_cirurgia: 'terminada', inicio_real: '13:50', termino_real: antes.termino_real,
      inicio_real_por: 'uid-paulo', termino_real_por: 'uid-paulo',
    })
    // a outra cirurgia, que não tinha nada, continua sem horário
    expect(await caso('15:30')).toMatchObject({ status_cirurgia: 'agendada', inicio_real: null, termino_real: null })
  })

  it('a migration pode ser reaplicada', async () => {
    await expect(db.exec(MIGRATION)).resolves.toBeDefined()
  })
})
