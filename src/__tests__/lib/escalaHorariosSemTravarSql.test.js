/**
 * HORÁRIOS — LIBERAR SEM TRAVAR no BANCO (dono 27/10) — a migration 20261027190000 rodando
 * num Postgres em memória (PGlite) sobre a composição que está no ar: a publicação de 23/09,
 * o horário real de 02/10, a trava de 14/10, a conferência do dia de 15/10 e o consultório
 * de 16/10.
 *
 * O que trava aqui: "Terminou · horário depois" fecha a cirurgia sem a hora do toque e sem
 * exigir início; a liberação só barra cirurgia ABERTA; o estimado de uma cirurgia que ainda
 * não começou é uma duração que vira horário no Iniciada (com o autor de quem estimou e o
 * registro na captura); republicar não perde a duração; e o rollback volta tudo.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const ler = (f) => readFileSync(`supabase/migrations/${f}`, 'utf8')
const fatia = (sql, cabeca) => {
  const i = sql.indexOf(cabeca)
  return sql.slice(i, sql.indexOf('\n$$;', i) + 4)
}
const MIGRATION = ler('20261027190000_escala_horarios_liberar_sem_travar.sql')
const ROLLBACK = readFileSync('scripts/rollback-20261027190000-horarios-liberar-sem-travar.sql', 'utf8')

let db
const montar = async () => {
  db = new PGlite()
  await db.exec(`
    set check_function_bodies = off;
    create role anon; create role authenticated; create role service_role;
    create table public.quem (uid text);
    insert into public.quem values ('uid-paulo');
    create function public.firebase_uid() returns text language sql as $$ select uid from public.quem limit 1 $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql as $$ select true $$;
    create table public.profiles (id text, nome text, active boolean default true);
    create table public.escala_anestesista_alias (user_id text, apelido text);
    create table public.escala_cirurgica (
      id uuid primary key default gen_random_uuid(), data date, hospital text, status text,
      created_by text, created_at timestamptz, updated_at timestamptz,
      ordem_liberacao jsonb, ajuda_externa jsonb, liberacoes jsonb default '{}'::jsonb, linha_overrides jsonb default '{}'::jsonb,
      urgencias_meta jsonb, publicacao_turnos jsonb, fds_meta jsonb, source_image_path text,
      published_at timestamptz, published_by text, published_by_name text,
      unique(data,hospital));
    create table public.escala_cirurgica_caso (
      id uuid primary key default gen_random_uuid(), escala_id uuid, sala text, ordem int,
      hora text, tempo_estimado text, termino_previsto text, termino_previsto_por text, paciente_iniciais text,
      idade text, procedimento text, convenio text, cirurgiao text, cirurgiao_display text,
      anestesista text, anestesista_user_id text, residente text, residente_user_id text,
      bloco text, is_continuacao boolean, sem_anestesista boolean, tipo text, gravidade text,
      turno text, status_cirurgia text default 'agendada', status_extra text,
      status_atualizado_em timestamptz, status_atualizado_por text,
      origem text not null default 'importacao', created_at timestamptz not null default now(),
      updated_at timestamptz not null default now());
    -- a captura de verdade grava em escala_cirurgica_captura; aqui um registro mínimo do estimado
    create table public.log_estimativa (de text, para text);
    create function public.captura_escala_caso_update() returns trigger language plpgsql as $$
    begin
      if old.termino_previsto is distinct from new.termino_previsto then
        insert into public.log_estimativa values (old.termino_previsto, new.termino_previsto);
      end if;
      return new;
    end $$;
    create trigger tr_escala_caso_captura_update after update of termino_previsto, anestesista, anestesista_user_id, sem_anestesista
      on public.escala_cirurgica_caso for each row execute function public.captura_escala_caso_update();
  `)
  await db.exec(fatia(ler('20260923160000_escala_republicar_preserva_andamento.sql'), 'create or replace function public.rpc_publicar_escala_turno('))
  await db.exec(ler('20260923200000_escala_republicacao_swap.sql'))
  await db.exec(fatia(ler('20260821200000_escala_carimbo_status_eixo_principal.sql'), 'create or replace function public.rpc_escala_status_cirurgia('))
  await db.exec(ler('20261002190000_escala_caso_horario_real.sql'))
  await db.exec(ler('20261014200000_escala_horario_obrigatorio_no_banco.sql'))
  await db.exec(ler('20261015230000_escala_liberar_confere_dia.sql'))
  await db.exec(ler('20261016150000_escala_consultorio_sem_horario.sql'))
  await db.exec(MIGRATION)
}
beforeAll(montar, 60000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec("truncate escala_cirurgica, escala_cirurgica_caso, log_estimativa; update quem set uid = 'uid-paulo'")
})

const CASOS = [
  { sala: 'S1', hora: '13:30', anestesista: 'PAULO', anestesista_user_id: 'uid-paulo', paciente_iniciais: 'M.S.', procedimento: 'COLECISTECTOMIA', turno: 'vespertino' },
  { sala: 'S1', hora: '15:30', anestesista: 'PAULO', anestesista_user_id: 'uid-paulo', paciente_iniciais: 'J.R.', procedimento: 'HERNIORRAFIA', turno: 'vespertino' },
]
const publicar = (casos = CASOS) => db.query(`select public.rpc_publicar_escala_turno('2099-01-02','unimed','vespertino',
  $1::jsonb, $2::jsonb, null, null)`, [JSON.stringify({ ordem_liberacao: ['PAULO'] }), JSON.stringify(casos)])
const caso = async (hora) => (await db.query(
  `select id, status_cirurgia, inicio_real, termino_real, inicio_real_por, termino_real_por, termino_previsto,
          termino_previsto_por, duracao_estimada_min, duracao_estimada_por, status_atualizado_por
     from escala_cirurgica_caso where hora = $1`, [hora])).rows[0]
const status = async (hora, s) => db.query('select public.rpc_escala_status_cirurgia($1, $2)', [(await caso(hora)).id, s])
const terminarSemHorario = async (hora) => db.query('select public.rpc_escala_terminar_sem_horario($1)', [(await caso(hora)).id])
const como = (uid) => db.exec(`update quem set uid = '${uid}'`)
const liberar = async () => {
  const { rows } = await db.query("select id from escala_cirurgica where data = '2099-01-02'")
  return db.query(`select public.rpc_escala_patch_liberacao($1, 'liberacoes', 'vespertino:uid-paulo', '{"liberadoEm":"2099-01-02T18:00:00Z"}'::jsonb)`, [rows[0].id])
}
const agoraSP = async () => (await db.query("select to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI') as h")).rows[0].h

describe('"Terminou · horário depois" (dono 27/10)', () => {
  it('fecha a agendada sem a hora do toque como término e sem exigir o início', async () => {
    await publicar()
    await como('uid-luciana') // o plantonista
    await terminarSemHorario('13:30')
    const c = await caso('13:30')
    expect(c.status_cirurgia).toBe('terminada')
    expect(c.termino_real).toBeNull()
    expect(c.inicio_real).toBeNull()
    expect(c.status_atualizado_por).toBe('uid-luciana') // quem confirmou e o limite ficam no carimbo
  })

  it('na iniciada, mantém o início do toque em Iniciada e deixa o término a informar', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    const ini = (await caso('13:30')).inicio_real
    await terminarSemHorario('13:30')
    const c = await caso('13:30')
    expect(c.inicio_real).toBe(ini)
    expect(c.termino_real).toBeNull()
  })

  it('vale também para o próprio anestesista do caso (a folha é a mesma para todos)', async () => {
    await publicar()
    await terminarSemHorario('13:30') // uid-paulo é o dono
    expect((await caso('13:30')).termino_real).toBeNull()
  })

  it('a flag não vaza: depois dela, Terminada pelo caminho de sempre volta a exigir o início', async () => {
    await publicar()
    await terminarSemHorario('13:30')
    await expect(status('15:30', 'terminada')).rejects.toThrow(/inicio_obrigatorio/)
  })

  it('o Terminada de sempre continua gravando o término do toque', async () => {
    await publicar()
    await status('13:30', 'iniciada')
    await status('13:30', 'terminada')
    expect((await caso('13:30')).termino_real).toBe(await agoraSP())
  })

  it('quem operou informa depois: início e término entram com o autor', async () => {
    await publicar()
    await como('uid-luciana')
    await terminarSemHorario('13:30')
    await como('uid-paulo')
    await db.query("update escala_cirurgica_caso set inicio_real = '13:35', termino_real = '14:50' where hora = '13:30'")
    const c = await caso('13:30')
    expect([c.inicio_real, c.termino_real, c.inicio_real_por, c.termino_real_por]).toEqual(['13:35', '14:50', 'uid-paulo', 'uid-paulo'])
  })
})

describe('trava da liberação: só cirurgia ABERTA (dono 27/10)', () => {
  it('terminada sem horário NÃO trava mais', async () => {
    await publicar()
    await terminarSemHorario('13:30')
    await terminarSemHorario('15:30')
    await expect(liberar()).resolves.toBeTruthy()
  })

  it('cirurgia aberta continua travando', async () => {
    await publicar()
    await terminarSemHorario('13:30')
    await status('15:30', 'iniciada')
    await expect(liberar()).rejects.toThrow(/horario_pendente/)
  })
})

describe('estimado que conta do início (dono 27/10)', () => {
  it('a duração vira o término previsto no Iniciada, com o autor de quem estimou', async () => {
    await publicar()
    await como('uid-paulo')
    await db.query("update escala_cirurgica_caso set duracao_estimada_min = 120 where hora = '15:30'")
    expect((await caso('15:30')).duracao_estimada_por).toBe('uid-paulo')
    await como('uid-luciana') // quem toca o Iniciada é outra pessoa
    await db.query("update escala_cirurgica_caso set inicio_real = '16:05' where hora = '15:30'")
    await status('15:30', 'iniciada')
    const c = await caso('15:30')
    expect(c.termino_previsto).toBe('18:05')
    expect(c.termino_previsto_por).toBe('uid-paulo')
    expect(c.duracao_estimada_min).toBeNull()
  })

  it('atravessa a meia-noite', async () => {
    await publicar()
    await db.query("update escala_cirurgica_caso set duracao_estimada_min = 90, inicio_real = '23:30' where hora = '15:30'")
    await status('15:30', 'iniciada')
    expect((await caso('15:30')).termino_previsto).toBe('01:00')
  })

  it('a conversão entra no registro de estimativas (a captura escuta o status)', async () => {
    await publicar()
    await db.query("update escala_cirurgica_caso set duracao_estimada_min = 60, inicio_real = '14:00' where hora = '13:30'")
    await status('13:30', 'iniciada')
    const { rows } = await db.query('select * from log_estimativa')
    expect(rows).toEqual([{ de: null, para: '15:00' }])
  })

  it('Terminada limpa a duração que sobrou', async () => {
    await publicar()
    await db.query("update escala_cirurgica_caso set duracao_estimada_min = 60 where hora = '13:30'")
    await terminarSemHorario('13:30')
    expect((await caso('13:30')).duracao_estimada_min).toBeNull()
  })

  it('fora do intervalo (1 a 720 min) o banco recusa', async () => {
    await publicar()
    await expect(db.query("update escala_cirurgica_caso set duracao_estimada_min = 0 where hora = '13:30'")).rejects.toThrow()
  })

  it('republicar o turno não perde a duração estimada', async () => {
    await publicar()
    await como('uid-paulo')
    await db.query("update escala_cirurgica_caso set duracao_estimada_min = 75 where hora = '15:30'")
    await publicar()
    const c = await caso('15:30')
    expect(c.duracao_estimada_min).toBe(75)
    expect(c.duracao_estimada_por).toBe('uid-paulo')
  })
})

describe('migration e rollback', () => {
  it('rodar a migration de novo não muda nada (publicação já corrigida)', async () => {
    await expect(db.exec(MIGRATION)).resolves.toBeTruthy()
    const { rows } = await db.query("select pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc) as d")
    expect(rows[0].d.match(/duracao_estimada_min smallint/g)).toHaveLength(1)
  })

  it('o rollback volta a trava, o gatilho e a publicação de antes', async () => {
    await db.exec(ROLLBACK)
    const { rows } = await db.query(`select
      position('duracao_estimada_min' in pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc)) = 0 as pub,
      to_regprocedure('public.rpc_escala_terminar_sem_horario(uuid)') is null as rpc,
      position('p_inicio is null' in pg_get_functiondef('public.escala_caso_trava_liberacao'::regproc)) > 0 as trava`)
    expect(rows[0]).toEqual({ pub: true, rpc: true, trava: true })
    await publicar()
    // (sem o `caso()` daqui: as colunas da duração não existem mais depois do rollback)
    const { rows: [c] } = await db.query("select id from escala_cirurgica_caso where hora = '13:30'")
    await expect(db.query("select public.rpc_escala_status_cirurgia($1, 'terminada')", [c.id])).rejects.toThrow(/inicio_obrigatorio/)
    // devolve o banco do teste ao estado migrado para não depender da ordem
    await db.close(); await montar()
  }, 60000)
})
