/**
 * RELATÓRIO DE ADESÃO SEM O CONSULTÓRIO (dono 29/10: "quem está no consultório e SRPA não contenha
 * débitos de preenchimento já que esses horários são fixos") — a migration 20261029213000 rodando
 * num Postgres em memória (PGlite) sobre os corpos que estão no ar (20260924180000).
 *
 * O que trava aqui: o consultório deixa de contar como cirurgia (início, término e tempo da própria
 * pessoa) e o turno só de consultório deixa de pedir tempo total — no relatório ao vivo, no
 * histórico por pessoa e no por hospital. A SRPA (linha sem procedimento) já estava fora e segue
 * fora. A blefaroplastia lançada na SALA Consultório continua contando: o corte é o procedimento,
 * como na caixa do horário (`ehConsultorio`). Os dias na escala não mudam, a migration regrava o
 * histórico recente e o rollback volta tudo.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { ehConsultorio } from '@/lib/escalaHorarioPendente'

const ler = (f) => readFileSync(f, 'utf8')
const ESCALADOS = ler('supabase/migrations/20260924160000_escala_adesao_escalados_sem_consult_fds.sql')
const NO_AR = ler('supabase/migrations/20260924180000_escala_adesao_tempos_todos_cargos.sql')
const MIGRATION = ler('supabase/migrations/20261029213000_escala_adesao_sem_consultorio.sql')
const ROLLBACK = ler('scripts/rollback-20261029213000-adesao-sem-consultorio.sql')

// só a função dos dias na escala (o arquivo dela termina regravando um histórico que aqui não existe)
const soEscalados = ESCALADOS.slice(
  ESCALADOS.indexOf('create or replace function public.escala_adesao_escalados'),
  ESCALADOS.indexOf('do $$'),
)

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ONTEM = iso(new Date(Date.now() - 86400000))
const ESC = '00000000-0000-0000-0000-0000000000e1'
const caso = (n) => `00000000-0000-0000-0000-00000000000${n}`

let db
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.firebase_uid() returns text language sql as $$ select 'u-con' $$;
    create table public.profiles (id text primary key, nome text, role text, email text, active boolean default true, conta_duplicada_de text);
    create table public.user_activity_log (user_id text, event_type text, event_data jsonb, created_at timestamptz default now());
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text,
      linha_overrides jsonb default '{}'::jsonb, ordem_liberacao jsonb default '{}'::jsonb);
    create table public.escala_cirurgica_caso (id uuid primary key, escala_id uuid, sala text, bloco text, turno text,
      procedimento text, anestesista text, anestesista_user_id text, sem_anestesista boolean not null default false,
      status_cirurgia text not null default 'agendada', status_extra text, termino_previsto text);
    create table public.escala_cirurgica_evento (caso_id uuid, tipo text, status_para text, por text, em timestamptz);
    create table public.escala_cirurgica_aviso (autor_user_id text, criado_em timestamptz);
    create table public.escala_cirurgica_aviso_confirmacao (user_id text, confirmado_em timestamptz);
    create table public.escala_cirurgica_aviso_tempo (enviado_por text, enviado_em timestamptz);
    create table public.escala_anestesista_alias (user_id text not null, apelido text not null unique);
    create table public.escala_adesao_dia (data date not null, user_id text not null,
      aberturas integer not null default 0, acoes integer not null default 0, trocas integer not null default 0,
      ini_n integer not null default 0, ter_n integer not null default 0, casos integer not null default 0,
      ini_eu integer not null default 0, ter_eu integer not null default 0, tp_inf integer not null default 0,
      turnos integer not null default 0, tot_eu integer not null default 0,
      escalado boolean not null default false, ini_qq integer not null default 0, ter_qq integer not null default 0,
      gravado_em timestamptz not null default now(), primary key (data, user_id));
    create table public.escala_adesao_hospital_dia (data date not null, hospital text not null,
      casos integer not null default 0, com_ini integer not null default 0, com_ter integer not null default 0,
      com_tp integer not null default 0, turnos integer not null default 0, com_total integer not null default 0,
      gravado_em timestamptz not null default now(), primary key (data, hospital));
    -- o último dia fechado da janela: ontem (no ar ele espera a escala de amanhã e as 17h)
    create function public.escala_adesao_ultimo_dia() returns date language sql
      as $$ select (now() at time zone 'America/Sao_Paulo')::date - 1 $$;
    insert into public.profiles (id, nome, role, email) values
      ('u-con', 'CARLA CONSULTA', 'anestesiologista', 'carla@anest.test'),
      ('u-srpa', 'SERGIO RECUPERA', 'anestesiologista', 'sergio@anest.test'),
      ('u-blef', 'BEATRIZ PALPEBRA', 'anestesiologista', 'beatriz@anest.test');
    insert into public.escala_anestesista_alias values ('u-con', 'CARLA'), ('u-srpa', 'SERGIO'), ('u-blef', 'BEATRIZ');
  `)
  await db.exec(soEscalados)
  await db.exec(NO_AR)
  await db.query(`insert into public.escala_cirurgica (id, data, hospital, status, ordem_liberacao) values
    ($1, $2, 'unimed', 'publicada', '{"matutino": ["CARLA", "SERGIO", "BEATRIZ"], "vespertino": ["CARLA"]}')`, [ESC, ONTEM])
  // a Carla: consultório de manhã (horário fixo, sem toque desde a v5.12.88) e uma cirurgia de verdade à
  // tarde, iniciada e terminada por ela; o Sergio: a linha da SRPA (sem procedimento); a Beatriz: a
  // blefaroplastia lançada na SALA Consultório (é cirurgia: pede horário)
  await db.query(`insert into public.escala_cirurgica_caso
    (id, escala_id, sala, bloco, turno, procedimento, anestesista, anestesista_user_id, status_cirurgia) values
    ($1, $5, 'Consultório', 'consultorio', 'matutino', 'CONSULTORIO – AJUDA', 'CARLA', 'u-con', 'agendada'),
    ($2, $5, 'CC - Sala 3', 'normal', 'vespertino', 'COLECISTECTOMIA VIDEOLAPAROSCÓPICA', 'CARLA', 'u-con', 'terminada'),
    ($3, $5, 'SRPA', 'srpa', 'matutino', null, 'SERGIO', 'u-srpa', 'agendada'),
    ($4, $5, 'Consultório', 'consultorio', 'matutino', '01 BLEFAROPLASTIA - 2h', 'BEATRIZ', 'u-blef', 'terminada')`,
  [caso(1), caso(2), caso(3), caso(4), ESC])
  await db.query(`insert into public.escala_cirurgica_evento values
    ($1, 'status', 'iniciada', 'u-con', ($2::date + time '14:00') at time zone 'America/Sao_Paulo'),
    ($1, 'status', 'terminada', 'u-con', ($2::date + time '16:00') at time zone 'America/Sao_Paulo')`, [caso(2), ONTEM])
}, 60000)
afterAll(async () => { await db?.close() })

const relatorio = async () => {
  const { rows } = await db.query('select public.escala_adesao_relatorio(30) as r')
  const r = rows[0].r
  const pessoa = (nome) => r.pessoas.find((p) => p.nome === nome)
  return { carla: pessoa('CARLA CONSULTA'), sergio: pessoa('SERGIO RECUPERA'), beatriz: pessoa('BEATRIZ PALPEBRA'),
    unimed: r.hospitais.find((h) => h.hospital === 'unimed') }
}
const historico = async (uid) => {
  const { rows } = await db.query('select casos, turnos, ini_eu, ter_eu, escalado from public.escala_adesao_dia where data = $1 and user_id = $2', [ONTEM, uid])
  return rows[0]
}
const hospitalDia = async () => {
  const { rows } = await db.query(`select casos, turnos from public.escala_adesao_hospital_dia where data = $1 and hospital = 'unimed'`, [ONTEM])
  return rows[0]
}

describe('no ar (20260924180000): o consultório pesava como cirurgia', () => {
  it('a Carla devia início, término e tempo total do consultório', async () => {
    const { carla, sergio, unimed } = await relatorio()
    expect(carla).toMatchObject({ casos: 2, turnos: 2, ini_eu: 1, ter_eu: 1, de: 1 })
    expect(sergio).toMatchObject({ casos: 0, turnos: 0, de: 1 }) // a SRPA já ficava fora (sem procedimento)
    expect(unimed).toMatchObject({ casos: 3, turnos: 3 })
    // o histórico gravado do dia trazia o mesmo
    await db.query('select public.escala_adesao_gravar_dia($1::date)', [ONTEM])
    expect(await historico('u-con')).toMatchObject({ casos: 2, turnos: 2 })
  })
})

describe('migration 20261029213000: consultório e SRPA sem débito de preenchimento', () => {
  beforeAll(async () => { await db.exec(MIGRATION) })

  it('relatório ao vivo: sobra a cirurgia de verdade da Carla, com o que ela marcou', async () => {
    const { carla } = await relatorio()
    expect(carla).toMatchObject({ casos: 1, turnos: 1, ini_eu: 1, ter_eu: 1 })
  })

  it('a SRPA segue fora, e os dias na escala ("abre a escala") não mudam', async () => {
    const { carla, sergio } = await relatorio()
    expect(sergio).toMatchObject({ casos: 0, turnos: 0, de: 1 })
    expect(carla.de).toBe(1)
  })

  it('a blefaroplastia da SALA Consultório continua contando: o corte é o procedimento', async () => {
    const { beatriz, unimed } = await relatorio()
    expect(beatriz).toMatchObject({ casos: 1, turnos: 1 })
    expect(unimed).toMatchObject({ casos: 2, turnos: 2 })
  })

  it('o histórico recente foi regravado pela própria migration, por pessoa e por hospital', async () => {
    expect(await historico('u-con')).toMatchObject({ casos: 1, turnos: 1, ini_eu: 1, ter_eu: 1, escalado: true })
    expect(await historico('u-srpa')).toMatchObject({ casos: 0, turnos: 0, escalado: true })
    expect(await hospitalDia()).toMatchObject({ casos: 2, turnos: 2 })
  })

  it('o corte do banco é o mesmo da caixa do horário (`ehConsultorio`)', () => {
    const sql = (p) => /consult/i.test(p || '')
    for (const p of ['CONSULTORIO', 'CONSULTÓRIO – AJUDA', 'CONSULTORIO – AJUDA (12 PACIENTES)', '11 CONSULTAS', '01 BLEFAROPLASTIA - 2h', 'ODONTOPEDIATRIA – 2H', '']) {
      expect(sql(p)).toBe(ehConsultorio({ procedimento: p }))
    }
    // um corte em cada leitura de casos com procedimento: relatório, histórico por pessoa e por hospital
    expect(MIGRATION.match(/^\s+and coalesce\(c\.procedimento, ''\) !~\* 'consult'/gm)).toHaveLength(3)
  })
})

describe('rollback', () => {
  it('volta o consultório a contar, no relatório e no histórico', async () => {
    await db.exec(ROLLBACK)
    const { carla } = await relatorio()
    expect(carla).toMatchObject({ casos: 2, turnos: 2 })
    expect(await historico('u-con')).toMatchObject({ casos: 2, turnos: 2 })
  })
})
