/**
 * O TURNO DE SRPA OU CONSULTÓRIO NÃO CONTA: O DIA VALE A FRAÇÃO (dono 29/10: "pode ser descontado desde
 * que o usuário não volte a fazer outros procedimentos"; 30/10: "nesses casos de SRPA e/ou consultório
 * sejam contados os turnos de forma proporcional para contagem de 'dia de escala'") — a migration
 * 20261030110000 rodando num Postgres em memória (PGlite) sobre o que está no ar.
 *
 * "Dias na escala" é a base da coluna "abre a escala" do relatório de adesão. O que trava aqui: o turno
 * em que a pessoa só tem a linha da SRPA ou do consultório (ou o rodapé "(CONSULT)") não conta, e o dia
 * vale a fração dos turnos dela que contam — SRPA de manhã e cirurgia ou fila à tarde = meio dia; o dia
 * só de horário fixo não entra; dois turnos na fila seguem sendo um dia. Abrir o app num meio dia conta
 * meio dia. O relatório ao vivo, o histórico (`escalado_peso`) e as abas de mês somam a mesma fração; o
 * dia gravado antes da regra (sem fração) segue inteiro; o rollback volta o que está no ar.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const ler = (f) => readFileSync(f, 'utf8')
const ESCALADOS = ler('supabase/migrations/20260924160000_escala_adesao_escalados_sem_consult_fds.sql')
const NO_AR_24 = ler('supabase/migrations/20260924180000_escala_adesao_tempos_todos_cargos.sql')
const NO_AR_29 = ler('supabase/migrations/20261029213000_escala_adesao_sem_consultorio.sql')
const MIGRATION = ler('supabase/migrations/20261030110000_escala_adesao_dia_proporcional_srpa_consultorio.sql')
const ROLLBACK = ler('scripts/rollback-20261030110000-adesao-dia-proporcional.sql')

// só a função dos dias na escala (o arquivo dela termina regravando um histórico que aqui não existe)
const soEscalados = ESCALADOS.slice(
  ESCALADOS.indexOf('create or replace function public.escala_adesao_escalados'),
  ESCALADOS.indexOf('do $$'),
)
// corpo de uma função como foi escrito no arquivo (o que fica em pg_proc.prosrc)
const corpo = (sql, nome) => {
  const blocos = sql.match(new RegExp(`create (?:or replace )?function public\\.${nome}\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$;`, 'g'))
  return blocos.at(-1).split('$function$')[1]
}
const md5 = (t) => createHash('md5').update(t).digest('hex')

const ESC = '00000000-0000-0000-0000-0000000000e1'
const caso = (n) => `00000000-0000-0000-0000-00000000000${n}`
const PESSOAS = ['ana', 'bruno', 'caio', 'dora', 'eva', 'fabio', 'gabi', 'helio', 'igor', 'joao']

let db
let ONTEM
let ANTIGO
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.firebase_uid() returns text language sql as $$ select 'u-dora' $$;
    create table public.profiles (id text primary key, nome text, role text, email text, active boolean default true, conta_duplicada_de text);
    create table public.user_activity_log (user_id text, event_type text, event_data jsonb, created_at timestamptz default now());
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text,
      linha_overrides jsonb default '{}'::jsonb, ordem_liberacao jsonb default '{}'::jsonb);
    create table public.escala_cirurgica_caso (id uuid primary key, escala_id uuid, sala text, bloco text, turno text,
      procedimento text, anestesista text, anestesista_user_id text, sem_anestesista boolean not null default false,
      status_cirurgia text not null default 'agendada', status_extra text, termino_previsto text, termino_previsto_por text);
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
      tp_n integer not null default 0, tot_n integer not null default 0,
      gravado_em timestamptz not null default now(), primary key (data, user_id));
    create table public.escala_adesao_hospital_dia (data date not null, hospital text not null,
      casos integer not null default 0, com_ini integer not null default 0, com_ter integer not null default 0,
      com_tp integer not null default 0, turnos integer not null default 0, com_total integer not null default 0,
      gravado_em timestamptz not null default now(), primary key (data, hospital));
    -- o último dia fechado da janela: ontem (no ar ele espera a escala de amanhã e as 17h)
    create function public.escala_adesao_ultimo_dia() returns date language sql
      as $$ select (now() at time zone 'America/Sao_Paulo')::date - 1 $$;
  `)
  // as datas saem do relógio de Brasília do próprio banco: o teste não depende do fuso da máquina
  const { rows: [d] } = await db.query(`select ((now() at time zone 'America/Sao_Paulo')::date - 1)::text as ontem,
    ((now() at time zone 'America/Sao_Paulo')::date - 41)::text as antigo`)
  ONTEM = d.ontem
  ANTIGO = d.antigo
  for (const k of PESSOAS) {
    await db.query('insert into public.profiles (id, nome, role, email) values ($1, $2, $3, $4)', [`u-${k}`, `${k.toUpperCase()} TESTE`, 'anestesiologista', `${k}@anest.test`])
    await db.query('insert into public.escala_anestesista_alias values ($1, $2)', [`u-${k}`, k.toUpperCase()])
  }
  await db.exec(soEscalados)
  await db.exec(NO_AR_24)
  await db.exec(NO_AR_29)
  // manhã: Ana só na SRPA; Bruno na SRPA e, à tarde, numa cirurgia; Caio só no consultório; Dora na fila sem
  // cirurgia; Fabio na fila e, à tarde, "(CONSULT)" no rodapé; Gabi na blefaroplastia da SALA Consultório;
  // Helio na posição de consultório sem procedimento; Igor numa cirurgia e na fila da tarde. Tarde: Eva, que
  // fez consultório de manhã e voltou à fila; Joao só "(CONSULT)"
  await db.query(`insert into public.escala_cirurgica (id, data, hospital, status, ordem_liberacao) values ($1, $2, 'unimed', 'publicada', $3)`,
    [ESC, ONTEM, JSON.stringify({
      matutino: ['ANA', 'BRUNO', 'CAIO', 'DORA', 'FABIO', 'GABI', 'HELIO', 'IGOR'],
      vespertino: ['BRUNO', 'EVA', 'FABIO (CONSULT)', 'IGOR', 'JOAO (CONSULT)'],
    })])
  await db.query(`insert into public.escala_cirurgica_caso
    (id, escala_id, sala, bloco, turno, procedimento, anestesista, anestesista_user_id, status_cirurgia) values
    ($1, $9, 'SRPA', 'srpa', 'matutino', null, 'ANA', 'u-ana', 'agendada'),
    ($2, $9, 'SRPA', 'srpa', 'matutino', null, 'BRUNO', 'u-bruno', 'agendada'),
    ($3, $9, 'CC - Sala 2', 'normal', 'vespertino', 'COLECISTECTOMIA', 'BRUNO', 'u-bruno', 'terminada'),
    ($4, $9, 'Consultório', 'consultorio', 'matutino', 'CONSULTORIO – AJUDA', 'CAIO', 'u-caio', 'agendada'),
    ($5, $9, 'Consultório', 'consultorio', 'matutino', 'CONSULTORIO', 'EVA', 'u-eva', 'agendada'),
    ($6, $9, 'Consultório', 'consultorio', 'matutino', '01 BLEFAROPLASTIA - 2h', 'GABI', 'u-gabi', 'terminada'),
    ($7, $9, 'Consultório', 'consultorio', 'matutino', null, 'HELIO', 'u-helio', 'agendada'),
    ($8, $9, 'CC - Sala 1', 'normal', 'matutino', 'HERNIORRAFIA', 'IGOR', 'u-igor', 'terminada')`,
  [caso(1), caso(2), caso(3), caso(4), caso(5), caso(6), caso(7), caso(8), ESC])
  // abriram a escala ontem: Bruno (meio dia), Dora (dia inteiro) e Fabio (meio dia)
  for (const k of ['bruno', 'dora', 'fabio']) {
    await db.query(`insert into public.user_activity_log values ($1, 'page_view', '{"page": "escalaCirurgica"}', ($2::date + time '10:00') at time zone 'America/Sao_Paulo')`, [`u-${k}`, ONTEM])
  }
  // um dia antigo, gravado antes da regra (sem fração): segue valendo um dia inteiro
  await db.query(`insert into public.escala_adesao_dia (data, user_id, aberturas, escalado) values ($1, 'u-bruno', 1, true)`, [ANTIGO])
}, 60000)
afterAll(async () => { await db?.close() })

const naEscala = async () => {
  const { rows } = await db.query('select user_id from public.escala_adesao_escalados($1::date, $1::date) order by 1', [ONTEM])
  return rows.map((r) => r.user_id.replace('u-', ''))
}
const pesos = async () => {
  const { rows } = await db.query('select user_id, peso::text as peso from public.escala_adesao_escalados($1::date, $1::date) order by 1', [ONTEM])
  return Object.fromEntries(rows.map((r) => [r.user_id.replace('u-', ''), r.peso]))
}
const porPessoa = (r) => Object.fromEntries(r.pessoas.map((p) => [p.nome.replace(' TESTE', '').toLowerCase(), { de: Number(p.de), dne: Number(p.dne) }]))
const relatorio = async () => {
  const { rows } = await db.query('select public.escala_adesao_relatorio(30) as r')
  return porPessoa(rows[0].r)
}
const periodo = async () => {
  const { rows } = await db.query('select public.escala_adesao_periodo($1::date, $2::date) as r', [ANTIGO, ONTEM])
  return porPessoa(rows[0].r)
}
const historico = async (campos = 'escalado') => {
  const { rows } = await db.query(`select user_id, ${campos} from public.escala_adesao_dia where data = $1 order by user_id`, [ONTEM])
  return Object.fromEntries(rows.map((r) => [r.user_id.replace('u-', ''), r]))
}

describe('no ar: o dia contava inteiro, também o só de SRPA ou consultório', () => {
  it('nove pessoas na escala de ontem; só quem tem apenas "(CONSULT)" no rodapé fica fora', async () => {
    expect(await naEscala()).toEqual(['ana', 'bruno', 'caio', 'dora', 'eva', 'fabio', 'gabi', 'helio', 'igor'])
    const r = await relatorio()
    expect(r.bruno).toEqual({ de: 1, dne: 1 })
    expect(r.fabio).toEqual({ de: 1, dne: 1 })
    await db.query('select public.escala_adesao_gravar_dia($1::date)', [ONTEM])
    expect(await historico()).toMatchObject({ ana: { escalado: true }, caio: { escalado: true }, helio: { escalado: true } })
  })
})

describe('migration 20261030110000: o turno de horário fixo não conta, o dia vale a fração', () => {
  beforeAll(async () => { await db.exec(MIGRATION) })

  it('SRPA ou consultório num turno e cirurgia ou fila no outro = meio dia; o dia só de horário fixo sai', async () => {
    expect(await pesos()).toEqual({
      bruno: '0.50', // SRPA de manhã, cirurgia à tarde
      eva: '0.50', // consultório de manhã, fila à tarde
      fabio: '0.50', // fila de manhã, "(CONSULT)" no rodapé da tarde
      dora: '1.00', // fila sem cirurgia
      gabi: '1.00', // a blefaroplastia da SALA Consultório é cirurgia
      igor: '1.00', // dois turnos na fila seguem sendo um dia
    })
  })

  it('abrir num meio dia conta meio dia: a porcentagem nunca passa de 100%', async () => {
    const r = await relatorio()
    expect(r.bruno).toEqual({ de: 0.5, dne: 0.5 })
    expect(r.fabio).toEqual({ de: 0.5, dne: 0.5 })
    expect(r.eva).toEqual({ de: 0.5, dne: 0 })
    expect(r.dora).toEqual({ de: 1, dne: 1 })
    expect(r.igor).toEqual({ de: 1, dne: 0 })
    for (const k of ['ana', 'caio', 'helio', 'joao']) expect(r[k].de).toBe(0)
  })

  it('o histórico recente foi regravado com a fração, e quem só fez SRPA ou consultório não tem linha', async () => {
    const h = await historico('escalado, escalado_peso::text as escalado_peso')
    expect(Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.escalado_peso]))).toEqual({
      bruno: '0.50', dora: '1.00', eva: '0.50', fabio: '0.50', gabi: '1.00', igor: '1.00',
    })
    expect(Object.values(h).every((v) => v.escalado)).toBe(true)
  })

  it('as abas de mês somam a fração; o dia gravado antes da regra vale um dia inteiro', async () => {
    const p = await periodo()
    expect(p.bruno).toEqual({ de: 1.5, dne: 1.5 }) // o dia antigo (1) + o meio dia de ontem
    expect(p.eva).toEqual({ de: 0.5, dne: 0 })
    expect(p.dora).toEqual({ de: 1, dne: 1 })
    expect(p.ana.de).toBe(0)
  })

  it('a coluna nova só aceita uma fração do dia', async () => {
    await expect(db.query(`insert into public.escala_adesao_dia (data, user_id, escalado, escalado_peso) values ($1, 'u-ana', true, 1.5)`, [ANTIGO]))
      .rejects.toThrow(/check/i)
  })
})

describe('rollback', () => {
  it('volta as definições que estão no ar, tira a coluna e o dia volta a contar inteiro', async () => {
    await db.exec(ROLLBACK)
    expect(await naEscala()).toEqual(['ana', 'bruno', 'caio', 'dora', 'eva', 'fabio', 'gabi', 'helio', 'igor'])
    expect((await relatorio()).bruno).toEqual({ de: 1, dne: 1 })
    expect((await periodo()).bruno).toEqual({ de: 2, dne: 2 })
    const { rows: col } = await db.query(`select 1 from information_schema.columns where table_name = 'escala_adesao_dia' and column_name = 'escalado_peso'`)
    expect(col).toHaveLength(0)
    const { rows } = await db.query(`select proname, md5(prosrc) as m from pg_proc where proname in
      ('escala_adesao_escalados', 'escala_adesao_relatorio', 'escala_adesao_gravar_dia', 'escala_adesao_periodo') order by 1`)
    expect(Object.fromEntries(rows.map((r) => [r.proname, r.m]))).toEqual({
      escala_adesao_escalados: md5(corpo(ESCALADOS, 'escala_adesao_escalados')),
      escala_adesao_gravar_dia: md5(corpo(NO_AR_29, 'escala_adesao_gravar_dia')),
      escala_adesao_periodo: md5(corpo(NO_AR_24, 'escala_adesao_periodo')),
      escala_adesao_relatorio: md5(corpo(NO_AR_29, 'escala_adesao_relatorio')),
    })
  })
})
