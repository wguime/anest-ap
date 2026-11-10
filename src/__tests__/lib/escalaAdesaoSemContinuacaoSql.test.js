/**
 * ADESÃO SEM A CONTINUAÇÃO EM DOBRO (dono 09/11: "corrigir e refazer 30 dias") — a migration
 * 20261109232000 rodando num Postgres em memória (PGlite) sobre os corpos que estão no ar
 * (20261030110000 + o par de continuação de 20261027220000).
 *
 * A cirurgia que começa de manhã e continua à tarde é um cartão só no app (a linha "CONTINUAÇÃO" da
 * mesma pessoa dá lugar ao caso da manhã), mas o relatório de adesão contava a linha da tarde como
 * outra cirurgia, sem início e sem término. O que trava aqui: a continuação da MESMA pessoa conta uma
 * vez, com o que foi marcado em qualquer um dos dois cartões; a de OUTRA pessoa e a que não tem
 * cirurgia da manhã seguem contando; quando outra pessoa continua a manhã ainda aberta, quem começou
 * não é cobrado pelo término nem quem continuou pelo início (dono 09/11: "não cobrar o término dele",
 * como a conta do horário); dupla só funde com a mesma dupla; consultório e SRPA seguem fora;
 * os turnos (tempo total) não mudam; o histórico recente é regravado; e a migration funciona antes E
 * depois da cópia pronta (20261109233000) sem nunca apagar a função pública que lê a cópia.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const ler = (f) => readFileSync(f, 'utf8')
const PARES = ler('supabase/migrations/20261027220000_escala_continuacao_herda_termino.sql')
const NO_AR = ler('supabase/migrations/20261030110000_escala_adesao_dia_proporcional_srpa_consultorio.sql')
const MIGRATION = ler('supabase/migrations/20261109232000_escala_adesao_sem_continuacao.sql')
const ROLLBACK = ler('scripts/rollback-20261109232000-adesao-sem-continuacao.sql')
const SNAPSHOT = ler('supabase/migrations/20261109233000_escala_adesao_snapshot.sql')
// a conferência da cópia pronta lê `cron.job`, que aqui não existe
const soSnapshot = SNAPSHOT.slice(0, SNAPSHOT.indexOf('-- Conferência'))
// só as três funções do par (o resto do arquivo são RPCs do horário, que aqui não entram)
const soPares = PARES.slice(
  PARES.indexOf('create or replace function public.escala_nomes_cirurgiao'),
  PARES.indexOf('create or replace function public.escala_horario_pendente_relatorio'),
)
const corpo = (sql, nome) => sql.slice(sql.indexOf(`function public.${nome}(`)).split('$function$')[1]
const md5 = (t) => createHash('md5').update(t).digest('hex')

const ESC = '00000000-0000-0000-0000-0000000000e1'
const caso = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
const PESSOAS = ['ana', 'bruno', 'caio', 'dora', 'eva', 'gabi', 'helio', 'igor', 'joao', 'kiko', 'lara', 'mara', 'nilo']

// [n, sala, turno, procedimento, cirurgião, anestesista, login, status, extra, continuação]
const CASOS = [
  // Ana — manhã ainda ABERTA (iniciada por ela) e a continuação terminada por ela: início de quem
  // começou, término de quem continuou (27/10), uma cirurgia completa
  [1, 'Sala 1', 'matutino', 'COLECTOMIA', 'JOSE SILVA', 'ANA', 'u-ana', 'iniciada', null, false],
  [2, 'Sala 1', 'vespertino', 'COLECTOMIA', 'JOSE SILVA', 'ANA', 'u-ana', 'terminada', null, true],
  // Joao — o caso de todo dia: marcou tudo no cartão da manhã e a linha da tarde nunca foi tocada
  [3, 'Sala 2', 'matutino', 'HIPEC', 'MARIA COSTA', 'JOAO', 'u-joao', 'terminada', null, false],
  [4, 'Sala 2', 'vespertino', 'HIPEC', 'MARIA COSTA', 'JOAO', 'u-joao', 'agendada', null, true],
  // Bruno começou, o Caio continuou e terminou: outra pessoa, cada um com a sua; o término é do Caio
  [5, 'Sala 3', 'matutino', 'MICROCIRURGIA', 'PEDRO ROCHA', 'BRUNO', 'u-bruno', 'iniciada', null, false],
  [6, 'Sala 3', 'vespertino', 'MICROCIRURGIA', 'PEDRO ROCHA', 'CAIO', 'u-caio', 'terminada', null, true],
  // Dora — continuação sem cirurgia da manhã que case (outra sala): conta
  [7, 'Sala 4', 'vespertino', 'ARTRODESE', 'LUIS PRADO', 'DORA', 'u-dora', 'agendada', null, true],
  // Gabi — a manhã segue marcada "Passa para tarde" (fora da conta desde sempre): a continuação
  // representa a cirurgia, com o que a Gabi marcou no cartão da manhã
  [8, 'Sala 5', 'matutino', 'WHIPPLE', 'RUI NUNES', 'GABI', 'u-gabi', 'terminada', 'passa_tarde', false],
  [9, 'Sala 5', 'vespertino', 'WHIPPLE', 'RUI NUNES', 'GABI', 'u-gabi', 'agendada', null, true],
  // Eva em dupla — a mesma dupla (em outra ordem) funde; com metade trocada, não (HIPEC de 27/10)
  [10, 'Sala 6', 'matutino', 'ESOFAGECTOMIA', 'TITO LIMA', 'EVA + BRUNO', 'u-eva', 'terminada', null, false],
  [11, 'Sala 6', 'vespertino', 'ESOFAGECTOMIA', 'TITO LIMA', 'BRUNO + EVA', 'u-eva', 'agendada', null, true],
  [12, 'Sala 7', 'matutino', 'HEPATECTOMIA', 'TITO LIMA', 'EVA + BRUNO', 'u-eva', 'terminada', null, false],
  [13, 'Sala 7', 'vespertino', 'HEPATECTOMIA', 'TITO LIMA', 'CAIO + EVA', 'u-eva', 'agendada', null, true],
  // Helio — consultório de manhã (fora desde 29/10) e uma cirurgia comum à tarde; Igor — SRPA
  [14, 'Consultório', 'matutino', 'CONSULTORIO – AJUDA', '', 'HELIO', 'u-helio', 'agendada', null, false],
  [15, 'Sala 8', 'vespertino', 'HERNIORRAFIA', 'ANA BEATRIZ', 'HELIO', 'u-helio', 'terminada', null, false],
  [16, 'SRPA', 'matutino', null, '', 'IGOR', 'u-igor', 'agendada', null, false],
  // Kiko não marcou nada de manhã; a Lara continuou e só marcou o término: ele deve o início, ela nada
  [17, 'Sala 9', 'matutino', 'GASTRECTOMIA', 'IVO REIS', 'KIKO', 'u-kiko', 'agendada', null, false],
  [18, 'Sala 9', 'vespertino', 'GASTRECTOMIA', 'IVO REIS', 'LARA', 'u-lara', 'terminada', null, true],
  // Nilo iniciou; a Mara continuou e não marcou nada: ele não deve nada, ela deve o término
  [19, 'Sala 10', 'matutino', 'NEFRECTOMIA', 'OTO MAIA', 'NILO', 'u-nilo', 'iniciada', null, false],
  [20, 'Sala 10', 'vespertino', 'NEFRECTOMIA', 'OTO MAIA', 'MARA', 'u-mara', 'agendada', null, true],
]
// [caso, para, por]
const EVENTOS = [
  [1, 'iniciada', 'u-ana'], [2, 'terminada', 'u-ana'],
  [3, 'iniciada', 'u-joao'], [3, 'terminada', 'u-joao'],
  [5, 'iniciada', 'u-bruno'], [6, 'iniciada', 'u-caio'], [6, 'terminada', 'u-caio'],
  [8, 'iniciada', 'u-gabi'], [8, 'terminada', 'u-gabi'],
  [10, 'iniciada', 'u-eva'], [10, 'terminada', 'u-eva'], [12, 'iniciada', 'u-eva'], [12, 'terminada', 'u-eva'],
  [15, 'iniciada', 'u-helio'], [15, 'terminada', 'u-helio'],
  [18, 'terminada', 'u-lara'], [19, 'iniciada', 'u-nilo'],
]

const bancos = []
async function montar() {
  const db = new PGlite()
  bancos.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.firebase_uid() returns text language sql as $$ select 'u-ana' $$;
    create table public.profiles (id text primary key, nome text, role text, email text, active boolean default true, conta_duplicada_de text);
    create table public.user_activity_log (user_id text, event_type text, event_data jsonb, created_at timestamptz default now());
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text,
      linha_overrides jsonb default '{}'::jsonb, ordem_liberacao jsonb default '{}'::jsonb);
    create table public.escala_cirurgica_caso (id uuid primary key, escala_id uuid, sala text, bloco text, turno text,
      hora text, ordem integer, procedimento text, cirurgiao text, anestesista text, anestesista_user_id text,
      sem_anestesista boolean not null default false, is_continuacao boolean not null default false,
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
  // a data sai do relógio de Brasília do próprio banco: o teste não depende do fuso da máquina
  const { rows: [d] } = await db.query(`select ((now() at time zone 'America/Sao_Paulo')::date - 1)::text as ontem`)
  db.ONTEM = d.ontem
  for (const k of PESSOAS) {
    await db.query('insert into public.profiles (id, nome, role, email) values ($1, $2, $3, $4)', [`u-${k}`, `${k.toUpperCase()} TESTE`, 'anestesiologista', `${k}@anest.test`])
    await db.query('insert into public.escala_anestesista_alias values ($1, $2)', [`u-${k}`, k.toUpperCase()])
  }
  await db.exec(soPares)
  await db.exec(NO_AR)
  await db.query(`insert into public.escala_cirurgica (id, data, hospital, status, ordem_liberacao) values ($1, $2, 'hro', 'publicada', $3)`,
    [ESC, db.ONTEM, JSON.stringify({ matutino: ['ANA', 'JOAO', 'BRUNO', 'GABI', 'EVA', 'IGOR'], vespertino: ['ANA', 'JOAO', 'CAIO', 'DORA', 'GABI', 'EVA', 'HELIO'] })])
  for (const [n, sala, turno, proc, cir, anest, uid, st, extra, cont] of CASOS) {
    await db.query(`insert into public.escala_cirurgica_caso
      (id, escala_id, sala, bloco, turno, hora, ordem, procedimento, cirurgiao, anestesista, anestesista_user_id, status_cirurgia, status_extra, is_continuacao)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [caso(n), ESC, sala, sala === 'SRPA' ? 'srpa' : sala === 'Consultório' ? 'consultorio' : 'normal', turno,
      turno === 'matutino' ? '07:30' : '13:00', n, proc, cir, anest, uid, st, extra, cont])
  }
  for (const [n, para, por] of EVENTOS) {
    await db.query(`insert into public.escala_cirurgica_evento values ($1, 'status', $2, $3, ($4::date + time '10:00') at time zone 'America/Sao_Paulo')`, [caso(n), para, por, db.ONTEM])
  }
  // o histórico como o cron o gravou, com a conta que está no ar
  await db.query('select public.escala_adesao_gravar_dia($1::date)', [db.ONTEM])
  return db
}

const CAMPOS = ['casos', 'ini_eu', 'ter_eu', 'ini_qq', 'ter_qq', 'turnos']
const so = (o, campos = CAMPOS) => (o ? Object.fromEntries(campos.map((k) => [k, Number(o[k])])) : o)
const def = async (db, f) => (await db.query(`select pg_get_functiondef('public.${f}'::regprocedure) as d`)).rows[0].d
const relatorio = async (db) => {
  const r = (await db.query('select public.escala_adesao_relatorio(30) as r')).rows[0].r
  const pessoas = Object.fromEntries(PESSOAS.map((k) => [k, so(r.pessoas.find((p) => p.nome === `${k.toUpperCase()} TESTE`))]))
  return { ...pessoas, hro: so(r.hospitais.find((h) => h.hospital === 'hro'), ['casos', 'com_ini', 'com_ter', 'turnos']), bruto: r }
}
const historico = async (db) => {
  const { rows } = await db.query('select * from public.escala_adesao_dia where data = $1', [db.ONTEM])
  const { rows: [h] } = await db.query(`select * from public.escala_adesao_hospital_dia where data = $1 and hospital = 'hro'`, [db.ONTEM])
  // quem não teve nada no dia não tem linha gravada (o Igor, só na SRPA): vale zero
  const zero = Object.fromEntries(PESSOAS.map((k) => [k, linha(0, 0, 0, 0, 0, 0)]))
  return { ...zero, ...Object.fromEntries(rows.map((r) => [r.user_id.slice(2), so(r)])), hro: so(h, ['casos', 'com_ini', 'com_ter', 'turnos']) }
}

// casos, ini_eu, ter_eu, ini_qq, ter_qq, turnos
const linha = (casos, ini_eu, ter_eu, ini_qq, ter_qq, turnos) => ({ casos, ini_eu, ter_eu, ini_qq, ter_qq, turnos })
const ANTES = {
  ana: linha(2, 1, 1, 1, 1, 2), joao: linha(2, 1, 1, 1, 1, 2), bruno: linha(1, 1, 0, 1, 0, 1), caio: linha(1, 1, 1, 1, 1, 1),
  dora: linha(1, 0, 0, 0, 0, 1), gabi: linha(1, 0, 0, 0, 0, 1), eva: linha(4, 2, 2, 2, 2, 2), helio: linha(1, 1, 1, 1, 1, 1),
  igor: linha(0, 0, 0, 0, 0, 0),
  kiko: linha(1, 0, 0, 0, 0, 1), lara: linha(1, 0, 1, 0, 1, 1), nilo: linha(1, 1, 0, 1, 0, 1), mara: linha(1, 0, 0, 0, 0, 1),
}
const DEPOIS = {
  ...ANTES,
  ana: linha(1, 1, 1, 1, 1, 2),   // início na manhã + término na continuação = uma cirurgia completa
  joao: linha(1, 1, 1, 1, 1, 2),  // a linha da tarde nunca tocada deixa de pesar
  gabi: linha(1, 1, 1, 1, 1, 1),  // a continuação representa a cirurgia, com as marcas do cartão da manhã
  eva: linha(3, 2, 2, 2, 2, 2),   // só a mesma dupla funde
  // outra pessoa continuou a manhã aberta: o término não é cobrado de quem começou…
  bruno: linha(1, 1, 1, 1, 1, 1),
  nilo: linha(1, 1, 1, 1, 1, 1),
  kiko: linha(1, 0, 1, 0, 1, 1),  // …que segue devendo o início que não marcou
  // …nem o início de quem continuou, que responde pelo término
  lara: linha(1, 1, 1, 1, 1, 1),
  mara: linha(1, 1, 0, 1, 0, 1),
}
const HRO_ANTES = { casos: 17, com_ini: 8, com_ter: 7, turnos: 15 }
const HRO_DEPOIS = { casos: 14, com_ini: 11, com_ter: 11, turnos: 15 }
const confere = (obtido, esperado, hro) => {
  for (const k of PESSOAS) expect(obtido[k], k).toEqual(esperado[k])
  expect(obtido.hro).toEqual(hro)
}

afterAll(async () => { await Promise.all(bancos.map((b) => b.close())) })

describe('a base é o que está em produção', () => {
  it('os corpos de 20261030110000 e o par de 20261027220000 têm o md5 conferido no banco em 09/11', () => {
    expect(md5(corpo(NO_AR, 'escala_adesao_relatorio'))).toBe('720fd3a010fe545a417c2063cf1ee53d')
    expect(md5(corpo(NO_AR, 'escala_adesao_gravar_dia'))).toBe('8d48e6178e0c50ca43435240e1393b0d')
    expect(md5(PARES.slice(PARES.indexOf('function public.escala_pares_continuacao(')).split('$$')[1])).toBe('c8f05fc875d5ce4fd3abdf893b00b357')
  })
  it('o rollback devolve exatamente esses corpos', () => {
    expect(md5(corpo(ROLLBACK, 'escala_adesao_relatorio'))).toBe('720fd3a010fe545a417c2063cf1ee53d')
    expect(md5(corpo(ROLLBACK, 'escala_adesao_gravar_dia'))).toBe('8d48e6178e0c50ca43435240e1393b0d')
  })
})

describe('ordem prevista: a migration ANTES da cópia pronta', () => {
  let db
  beforeAll(async () => { db = await montar() }, 60000)

  it('no ar: a continuação da mesma pessoa pesava como outra cirurgia', async () => {
    confere(await relatorio(db), ANTES, HRO_ANTES)
    confere(await historico(db), ANTES, HRO_ANTES)
  })

  it('migration: a cirurgia conta uma vez, com o que foi marcado nos dois cartões', async () => {
    const res = await db.exec(MIGRATION)
    confere(await relatorio(db), DEPOIS, HRO_DEPOIS)
    // a conferência do fim do arquivo
    expect(res.at(-1).rows[0]).toMatchObject({ relatorio_le_a_conta: true, gravacao_le_a_conta: true, publica_intacta: true, auth_conta: false })
    expect(Number(res.at(-1).rows[0].dias_regravados)).toBe(1)
  })

  it('o histórico recente foi regravado pela própria migration, por pessoa e por hospital', async () => {
    confere(await historico(db), DEPOIS, HRO_DEPOIS)
  })

  it('o par é o da conta do horário, estendido à manhã já terminada; dupla só com a mesma dupla', async () => {
    const { rows } = await db.query(`select continuacao_id, origem_id, herda from public.escala_adesao_continuacoes($1::date, $1::date) order by 1`, [db.ONTEM])
    expect(rows).toEqual([[2, 1, false], [4, 3, false], [6, 5, true], [9, 8, false], [11, 10, false], [18, 17, true], [20, 19, true]]
      .map(([k, o, herda]) => ({ continuacao_id: caso(k), origem_id: caso(o), herda })))
    // a função do horário só vê a manhã ABERTA: Ana (mesma pessoa) e os três em que outra pessoa
    // continuou (herda) — é dela, sem mudança, que sai quem não é cobrado
    const { rows: pares } = await db.query(`select continuacao_id, herda from public.escala_pares_continuacao($1::date, $1::date) order by 1`, [db.ONTEM])
    expect(pares).toEqual([[2, false], [6, true], [18, true], [20, true]].map(([k, herda]) => ({ continuacao_id: caso(k), herda })))
    expect(rows.filter((r) => r.herda).map((r) => r.continuacao_id)).toEqual(pares.filter((p) => p.herda).map((p) => p.continuacao_id))
  })

  it('a função pública segue com o acesso, e as funções novas não ficam abertas ao app', async () => {
    expect(await def(db, 'escala_adesao_relatorio(integer)')).toContain('acesso negado')
    const { rows: [p] } = await db.query(`select
      has_function_privilege('authenticated', 'public.escala_adesao_casos(date, date)', 'execute') as casos,
      has_function_privilege('anon', 'public.escala_adesao_continuacoes(date, date)', 'execute') as pares,
      has_function_privilege('authenticated', 'public.escala_adesao_gravar_dia(date)', 'execute') as gravar,
      has_function_privilege('authenticated', 'public.escala_adesao_relatorio(integer)', 'execute') as publica`)
    expect(p).toEqual({ casos: false, pares: false, gravar: false, publica: true })
  })

  it('rodar duas vezes dá no mesmo', async () => {
    await db.exec(MIGRATION)
    confere(await relatorio(db), DEPOIS, HRO_DEPOIS)
    confere(await historico(db), DEPOIS, HRO_DEPOIS)
  })

  it('rollback: volta a conta antiga, regrava o histórico e remove as funções novas', async () => {
    await db.exec(ROLLBACK)
    confere(await relatorio(db), ANTES, HRO_ANTES)
    confere(await historico(db), ANTES, HRO_ANTES)
    expect(md5((await db.query(`select prosrc from pg_proc where proname = 'escala_adesao_relatorio'`)).rows[0].prosrc)).toBe('720fd3a010fe545a417c2063cf1ee53d')
    expect(md5((await db.query(`select prosrc from pg_proc where proname = 'escala_adesao_gravar_dia'`)).rows[0].prosrc)).toBe('8d48e6178e0c50ca43435240e1393b0d')
    const { rows: [f] } = await db.query(`select to_regprocedure('public.escala_adesao_casos(date, date)') as a, to_regprocedure('public.escala_adesao_continuacoes(date, date)') as b`)
    expect(f).toEqual({ a: null, b: null })
    await db.exec(ROLLBACK) // duas vezes
    confere(await relatorio(db), ANTES, HRO_ANTES)
  })

  it('a cópia pronta aplicada em seguida clona a conta nova', async () => {
    await db.exec(MIGRATION)
    await db.exec(soSnapshot)
    const calc = await def(db, 'escala_adesao_relatorio_calc(integer)')
    expect(calc).toContain('escala_adesao_casos')
    expect(calc).not.toContain('acesso negado')
    expect(await def(db, 'escala_adesao_relatorio(integer)')).toContain('escala_adesao_snapshot')
    confere(await relatorio(db), DEPOIS, HRO_DEPOIS)
  })
})

describe('ordem invertida: a migration DEPOIS da cópia pronta', () => {
  let db
  beforeAll(async () => {
    db = await montar()
    await db.exec(soSnapshot)
  }, 60000)

  it('a cópia pronta guarda a conta antiga', async () => {
    confere(await relatorio(db), ANTES, HRO_ANTES)
  })

  it('a conta nova vai para o cálculo interno; a função pública segue lendo a cópia', async () => {
    const res = await db.exec(MIGRATION)
    const calc = await def(db, 'escala_adesao_relatorio_calc(integer)')
    expect(calc).toContain('escala_adesao_casos')
    expect(calc).not.toContain('acesso negado')
    const pub = await def(db, 'escala_adesao_relatorio(integer)')
    expect(pub).toContain('escala_adesao_snapshot')
    expect(pub).toContain('acesso negado')
    expect(pub).not.toContain('escala_adesao_casos')
    expect(res.at(-1).rows[0]).toMatchObject({ relatorio_le_a_conta: true, gravacao_le_a_conta: true, publica_intacta: true })
  })

  it('a cópia foi regravada na hora: quem abre o relatório já vê a conta nova', async () => {
    const { rows: [s] } = await db.query(`select gerado_em > now() - interval '1 minute' as agora from public.escala_adesao_snapshot where dias = 30`)
    expect(s.agora).toBe(true)
    const r = await relatorio(db)
    confere(r, DEPOIS, HRO_DEPOIS)
    // veio da cópia, não de um cálculo na hora
    const { rows: [c] } = await db.query('select dados from public.escala_adesao_snapshot where dias = 30')
    expect(r.bruto).toEqual(c.dados)
    confere(await historico(db), DEPOIS, HRO_DEPOIS)
  })

  it('o cálculo interno e a cópia seguem fechados ao app', async () => {
    const { rows: [p] } = await db.query(`select
      has_function_privilege('authenticated', 'public.escala_adesao_relatorio_calc(integer)', 'execute') as calc,
      has_function_privilege('authenticated', 'public.escala_adesao_relatorio(integer)', 'execute') as publica`)
    expect(p).toEqual({ calc: false, publica: true })
  })

  it('rodar duas vezes dá no mesmo', async () => {
    await db.exec(MIGRATION)
    expect(await def(db, 'escala_adesao_relatorio(integer)')).toContain('escala_adesao_snapshot')
    confere(await relatorio(db), DEPOIS, HRO_DEPOIS)
  })

  it('rollback: a conta antiga volta ao cálculo interno e à cópia, sem tocar a função pública', async () => {
    await db.exec(ROLLBACK)
    const calc = await def(db, 'escala_adesao_relatorio_calc(integer)')
    expect(calc).not.toContain('escala_adesao_casos')
    expect(calc).not.toContain('acesso negado')
    expect(await def(db, 'escala_adesao_relatorio(integer)')).toContain('escala_adesao_snapshot')
    confere(await relatorio(db), ANTES, HRO_ANTES)
    confere(await historico(db), ANTES, HRO_ANTES)
  })
})

describe('estado inesperado', () => {
  it('função pública lendo a cópia sem o cálculo interno: aborta sem gravar nada', async () => {
    const db = await montar()
    await db.exec(soSnapshot)
    await db.exec('drop function public.escala_adesao_snapshot_atualizar(); drop function public.escala_adesao_relatorio_calc(integer)')
    await expect(db.exec(MIGRATION)).rejects.toThrow(/estado inesperado/)
    await db.exec('rollback')
    expect(await def(db, 'escala_adesao_relatorio(integer)')).toContain('escala_adesao_snapshot')
    expect(await def(db, 'escala_adesao_gravar_dia(date)')).not.toContain('escala_adesao_casos')
  }, 60000)
})
