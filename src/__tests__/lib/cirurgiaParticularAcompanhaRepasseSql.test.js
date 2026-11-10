/**
 * COBRANÇA DE PARTICULAR ACOMPANHA O REPASSE (dono 09/11: "quem fez — enquanto a cobrança ainda não
 * foi preenchida por ninguém, ela acompanha o repasse; depois de preenchida, não muda mais sozinha")
 * — a migration 20261109234000 rodando num Postgres em memória (PGlite) sobre os corpos que estão no
 * ar (fn_sync de 20261002160000 e fn_verificar de 20260723100000, conferidos por md5 com produção).
 *
 * O que trava aqui: o repasse troca o anestesista da cobrança só enquanto ela está como o app criou
 * (sem CPF, R$ 0, pendente, sem observação); a dupla leva os dois nomes como estão no caso, sem login
 * (dono 09/11: "deixar o nome dos dois anestesistas"); caso que vira "?" e continuação não mexem em
 * cobrança; a republicação com outro anestesista também acompanha; o autor da mudança é a sessão que
 * repassou (nunca um nome inventado); e o cron das 20:30 deixa de abrir cobrança de continuação.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const ler = (f) => readFileSync(f, 'utf8')
const SYNC_NO_AR = ler('supabase/migrations/20261002160000_cirurgia_particular_ignora_continuacao.sql')
const VERIF_ARQ = ler('supabase/migrations/20260723100000_cirurgias_particulares_verificacao_diaria.sql')
const MIGRATION = ler('supabase/migrations/20261109234000_cirurgia_particular_acompanha_repasse.sql')
const ROLLBACK = ler('scripts/rollback-20261109234000-particular-acompanha-repasse.sql')
const REPARO = ler('scripts/repair-2026-11-09-particulares-repasse-e-continuacao.sql')
const DONO = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'

// só a função do cron (o arquivo dela também cria o log e agenda o pg_cron, que aqui não existe)
const VERIF_NO_AR = VERIF_ARQ.slice(
  VERIF_ARQ.indexOf('CREATE OR REPLACE FUNCTION public.fn_verificar_cirurgias_particulares('),
  VERIF_ARQ.indexOf('\n$$;') + 4,
)

const ESC = '00000000-0000-0000-0000-0000000000e1'
let seq = 0
const novoId = () => `00000000-0000-0000-0000-${String(++seq).padStart(12, '0')}`

let db
const sessao = (uid) => db.exec(`set test.uid = '${uid}'`)

/** Publica um caso (o gatilho da cobrança roda no INSERT, como na publicação). */
async function novoCaso({ convenio = 'PARTICULAR', iniciais = 'M.S.', anestesista = 'ANA', uid = 'u-ana',
  continuacao = false, cirurgiao = 'DR CIRURGIAO', procedimento, id = novoId() } = {}) {
  await db.query(`insert into public.escala_cirurgica_caso
    (id, escala_id, sala, turno, paciente_iniciais, procedimento, convenio, cirurgiao, anestesista, anestesista_user_id, is_continuacao)
    values ($1, $2, 'CC - Sala 1', 'matutino', $3, $4, $5, $6, $7, $8, $9)`,
  [id, ESC, iniciais, procedimento || `PROCEDIMENTO ${id.slice(-3)}`, convenio, cirurgiao, anestesista, uid, continuacao])
  return id
}
/** O repasse do app (`updateAnestesistaCasos`): só anestesista + login (+ sem_anestesista). */
const repassar = (casoId, anestesista, uid, sem = false) => db.query(
  `update public.escala_cirurgica_caso set anestesista = $2, anestesista_user_id = $3, sem_anestesista = $4 where id = $1`,
  [casoId, anestesista, uid, sem])
const cobrancas = async (casoId) => (await db.query(
  `select id, anestesista_nome, anestesista_user_id, updated_by, updated_by_name, cancelada_em, paciente
     from public.cirurgias_particulares where escala_caso_id = $1 order by created_at`, [casoId])).rows
const cobranca = async (casoId) => (await cobrancas(casoId))[0]
const preencher = (casoId, set) => db.exec(
  `update public.cirurgias_particulares set ${set} where escala_caso_id = '${casoId}'`)
const cron = async () => (await db.query(`select public.fn_verificar_cirurgias_particulares('manual', false) as r`)).rows[0].r
const gatilhos = async () => Number((await db.query(
  `select count(*) n from pg_trigger where tgname = 'tr_caso_cobranca_acompanha_repasse' and not tgisinternal`)).rows[0].n)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    -- quem está logado no teste (no ar: o sub do JWT do Firebase)
    create function public.firebase_uid() returns text language sql stable
      as $$ select coalesce(nullif(current_setting('test.uid', true), ''), '') $$;
    create function public.fn_convenio_particular(p_convenio text) returns boolean language sql immutable
      as $$ select upper(btrim(coalesce(p_convenio, ''))) ~ '^PART(ICULAR)?[^A-Z]*$' $$;
    create table public.profiles (id text primary key, nome text, role text, active boolean default true);
    create table public.admin_users (firebase_uid text);
    create table public.notifications (id uuid);
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text);
    create table public.escala_cirurgica_caso (id uuid primary key, escala_id uuid, sala text, turno text,
      paciente_iniciais text, procedimento text, convenio text, cirurgiao text, anestesista text,
      anestesista_user_id text, is_continuacao boolean not null default false,
      sem_anestesista boolean not null default false, status_extra text);
    create table public.cirurgias_particulares (
      id uuid primary key default gen_random_uuid(), paciente text not null, paciente_cpf text,
      cirurgiao text not null, anestesista_nome text not null, anestesista_user_id text,
      data_cirurgia date not null, procedimento text not null, local text not null,
      valor numeric not null check (valor >= 0), status_pagamento text not null default 'pendente',
      data_pagamento date, observacoes text, escala_caso_id uuid,
      cancelada_em timestamptz, cancelada_por text, cancelada_por_nome text, motivo_cancelamento text,
      created_by text, created_by_name text, updated_by text, updated_by_name text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create unique index uq_cirurgias_particulares_escala_caso on public.cirurgias_particulares (escala_caso_id)
      where escala_caso_id is not null and cancelada_em is null;
    create table public.cirurgias_particulares_check_log (id uuid primary key default gen_random_uuid(),
      run_at timestamptz not null default now(), origem text not null default 'cron',
      corrigidos int not null default 0, suspeitos int not null default 0, suspensos int not null default 0,
      incompletos int not null default 0, achados jsonb not null default '[]'::jsonb);
    insert into public.profiles (id, nome, role) values
      ('u-ana', 'ANA PUBLICADA', 'anestesiologista'),
      ('u-bruno', 'BRUNO REPASSE', 'anestesiologista'),
      ('u-coord', 'CARLOS COORDENA', 'anestesiologista');
    insert into public.escala_cirurgica (id, data, hospital, status) values ('${ESC}', current_date, 'unimed', 'publicada');
  `)
  await db.exec(SYNC_NO_AR)
  await db.exec(VERIF_NO_AR)
  // o gatilho que está no ar (pg_get_triggerdef de produção, 09/11)
  await db.exec(`create trigger tr_caso_sync_cirurgia_particular
    after insert or update of status_extra, convenio, paciente_iniciais on public.escala_cirurgica_caso
    for each row execute function public.fn_sync_cirurgia_particular()`)
  await sessao('u-coord')
}, 60000)
afterAll(async () => { await db?.close() })

describe('no ar: a cobrança ficava com o anestesista da publicação', () => {
  it('o repasse para o Bruno não chegava à cobrança', async () => {
    const c = await novoCaso()
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana' })
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana' })
  })

  it('o cron abria uma 2ª cobrança para a continuação (o gatilho já a ignorava)', async () => {
    const cont = await novoCaso({ continuacao: true, iniciais: 'C.O.' })
    expect(await cobrancas(cont)).toHaveLength(0)
    await cron()
    expect(await cobrancas(cont)).toHaveLength(1)
    await db.query('delete from public.cirurgias_particulares where escala_caso_id = $1', [cont])
    await db.query('delete from public.escala_cirurgica_caso where id = $1', [cont])
  })
})

describe('migration 20261109234000: a cobrança acompanha o repasse enquanto não foi preenchida', () => {
  beforeAll(async () => { await db.exec(MIGRATION) })

  it('repasse com a cobrança em rascunho: passa para quem fez, assinada por quem repassou', async () => {
    const c = await novoCaso()
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({
      anestesista_nome: 'BRUNO REPASSE', anestesista_user_id: 'u-bruno',
      updated_by: 'u-coord', updated_by_name: 'CARLOS COORDENA',
    })
    expect(await cobrancas(c)).toHaveLength(1)
  })

  it('o nome do paciente completado sozinho pelo app não conta como preenchimento', async () => {
    const c = await novoCaso()
    await preencher(c, `paciente = 'MARIA DA SILVA', updated_by = 'u-coord'`)
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'BRUNO REPASSE', paciente: 'MARIA DA SILVA' })
  })

  it.each([
    ['CPF', `paciente_cpf = '52998224725'`],
    ['valor', 'valor = 1500'],
    ['observação', `observacoes = 'combinado com o cirurgião'`],
    ['pagamento', `status_pagamento = 'pago', data_pagamento = current_date`],
    ['glosa', `status_pagamento = 'glosado'`],
  ])('cobrança já preenchida (%s) não muda sozinha', async (_o, set) => {
    const c = await novoCaso()
    await preencher(c, set)
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana', updated_by: null })
  })

  it('cobrança cancelada não muda', async () => {
    const c = await novoCaso()
    await preencher(c, `cancelada_em = now(), motivo_cancelamento = 'teste'`)
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA' })
    // sai da escala para não entrar na conta do cron mais abaixo (caso com cobrança cancelada é
    // "elegível sem lançamento ativo" para ele — comportamento que já está no ar, fora desta migration)
    await db.query('delete from public.escala_cirurgica_caso where id = $1', [c])
  })

  it.each(['UNIMED', 'PART/SC'])('convênio %s: o repasse não cria nem mexe em cobrança', async (convenio) => {
    const c = await novoCaso({ convenio })
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobrancas(c)).toHaveLength(0)
  })

  it('continuação: repassar a linha da tarde não cria cobrança nem mexe na da manhã', async () => {
    const manha = await novoCaso({ iniciais: 'J.P.', procedimento: 'HERNIORRAFIA' })
    const tarde = await novoCaso({ iniciais: 'J.P.', procedimento: 'HERNIORRAFIA · CONTINUAÇÃO +-14h', continuacao: true })
    await repassar(tarde, 'BRUNO', 'u-bruno')
    expect(await cobrancas(tarde)).toHaveLength(0)
    expect(await cobranca(manha)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', updated_by: null })
  })

  it('caso que vira dupla "A + B": a cobrança mostra os dois nomes como estão no caso, sem login', async () => {
    const c = await novoCaso()
    await repassar(c, ' ANA + BRUNO ', null)
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA + BRUNO', anestesista_user_id: null, updated_by: 'u-coord' })
    // texto de dupla com login (estado inválido que já apareceu): continua dupla, sem login
    await repassar(c, 'BRUNO + ANA', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'BRUNO + ANA', anestesista_user_id: null })
    // a dupla desfeita volta a ser uma pessoa só
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'BRUNO REPASSE', anestesista_user_id: 'u-bruno' })
  })

  it('caso que já nasce dupla: a cobrança nasce com os dois nomes (como já era)', async () => {
    const c = await novoCaso({ anestesista: 'ANA + BRUNO', uid: null })
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA + BRUNO', anestesista_user_id: null })
  })

  it('cobrança já preenchida não vira dupla sozinha', async () => {
    const c = await novoCaso()
    await preencher(c, `paciente_cpf = '52998224725'`)
    await repassar(c, 'ANA + BRUNO', null)
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana', updated_by: null })
  })

  it.each(['?', '//', ''])('caso que fica sem anestesista (%j): a cobrança guarda o último nome', async (txt) => {
    const c = await novoCaso()
    await repassar(c, txt, null, true)
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana', updated_by: null })
  })

  it('anestesista sem login (só o nome): acompanha pelo nome, login vazio', async () => {
    const c = await novoCaso()
    await repassar(c, 'DR DE FORA', null)
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'DR DE FORA', anestesista_user_id: null, updated_by: 'u-coord' })
  })

  it('volta para a Ana se o repasse for desfeito, e gravar o mesmo valor não toca a cobrança', async () => {
    const c = await novoCaso()
    await repassar(c, 'BRUNO', 'u-bruno')
    await repassar(c, 'ANA', 'u-ana')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana' })
    await preencher(c, 'updated_by = null')
    await repassar(c, 'ANA', 'u-ana') // repetição idempotente do service
    expect((await cobranca(c)).updated_by).toBeNull()
  })

  it('sem sessão (script sem JWT): troca o nome e não inventa autor', async () => {
    const c = await novoCaso()
    await sessao('')
    await repassar(c, 'BRUNO', 'u-bruno')
    await sessao('u-coord')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'BRUNO REPASSE', updated_by: null, updated_by_name: null })
  })

  it('republicação com outro anestesista: o rascunho re-vinculado acompanha; o preenchido só re-vincula', async () => {
    const [a, b] = [await novoCaso({ procedimento: 'REPUB RASCUNHO' }), await novoCaso({ procedimento: 'REPUB PREENCHIDA' })]
    await preencher(b, `paciente_cpf = '52998224725', valor = 900`)
    await db.query('delete from public.escala_cirurgica_caso where id = any($1)', [[a, b]])
    const a2 = await novoCaso({ procedimento: 'REPUB RASCUNHO', anestesista: 'BRUNO', uid: 'u-bruno' })
    const b2 = await novoCaso({ procedimento: 'REPUB PREENCHIDA', anestesista: 'BRUNO', uid: 'u-bruno' })
    expect(await cobrancas(a)).toHaveLength(0)
    expect(await cobrancas(a2)).toHaveLength(1)
    expect(await cobranca(a2)).toMatchObject({ anestesista_nome: 'BRUNO REPASSE', anestesista_user_id: 'u-bruno' })
    expect(await cobrancas(b2)).toHaveLength(1)
    expect(await cobranca(b2)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana' })
  })

  it('o cron não abre cobrança de continuação, e segue recuperando o caso normal sem lançamento', async () => {
    const cont = await novoCaso({ continuacao: true, iniciais: 'C.O.', procedimento: 'CRON CONTINUACAO' })
    const normal = await novoCaso({ iniciais: 'N.O.', procedimento: 'CRON NORMAL' })
    await db.query('delete from public.cirurgias_particulares where escala_caso_id = $1', [normal])
    const r = await cron()
    expect(r.erro).toBeUndefined()
    expect(r.corrigidos).toBe(1)
    expect(await cobrancas(cont)).toHaveLength(0)
    expect(await cobrancas(normal)).toHaveLength(1)
  })

  it('o cron não re-vincula órfão a uma linha de continuação', async () => {
    const manha = await novoCaso({ iniciais: 'O.R.', procedimento: 'ORFAO' })
    await db.query('delete from public.escala_cirurgica_caso where id = $1', [manha])
    const cont = await novoCaso({ iniciais: 'O.R.', procedimento: 'ORFAO', continuacao: true })
    await cron()
    expect(await cobrancas(cont)).toHaveLength(0)
    expect(await cobrancas(manha)).toHaveLength(1)
  })

  it('a função da troca é interna: quem está logado no app não a chama por RPC', async () => {
    const { rows } = await db.query(`select
      has_function_privilege('authenticated', 'public.fn_cirurgia_particular_acompanha(uuid, text, text)', 'execute') as auth,
      has_function_privilege('anon', 'public.fn_cirurgia_particular_acompanha(uuid, text, text)', 'execute') as anon`)
    expect(rows[0]).toEqual({ auth: false, anon: false })
  })

  it('as duas funções regravadas só diferem do que está no ar nos blocos "09/11"', () => {
    const semLinhas0911 = MIGRATION.split('\n').filter((l) => !/09\/11:/.test(l)
      && !l.includes('perform public.fn_cirurgia_particular_acompanha(new.id, new.anestesista, new.anestesista_user_id);\n    return new;')).join('\n')
    const semChamada = semLinhas0911.replace(
      '    perform public.fn_cirurgia_particular_acompanha(new.id, new.anestesista, new.anestesista_user_id);\n    return new;\n  end if;\n\n  select p.nome into v_anest_nome',
      '    return new;\n  end if;\n\n  select p.nome into v_anest_nome')
    const corpo = (s, ini) => s.slice(s.indexOf(ini)).split(/\$function\$|\$\$/)[1]
    expect(semChamada).toContain(corpo(SYNC_NO_AR, 'CREATE OR REPLACE FUNCTION public.fn_sync_cirurgia_particular'))
    expect(semChamada).toContain(corpo(VERIF_NO_AR, 'CREATE OR REPLACE FUNCTION'))
    expect(MIGRATION.match(/09\/11:/g)).toHaveLength(3)
  })

  it('rodar a migration duas vezes dá no mesmo', async () => {
    await db.exec(MIGRATION)
    expect(await gatilhos()).toBe(1)
    const c = await novoCaso()
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'BRUNO REPASSE' })
    expect(await cobrancas(c)).toHaveLength(1)
  })
})

describe('reparo 2026-11-09 (dados sintéticos): corrige as antigas e cancela as duplicadas de continuação', () => {
  // as travas do arquivo são as contagens de PRODUÇÃO (183 e 12); aqui entram as do cenário
  const comTravas = (a, b) => REPARO
    .replace('v_esperado_a constant int := 183;', `v_esperado_a constant int := ${a};`)
    .replace('v_folga_menos constant int := 10;', 'v_folga_menos constant int := 0;')
    .replace('v_folga_mais constant int := 5;', 'v_folga_mais constant int := 0;')
    .replace('v_esperado_b constant int := 12;', `v_esperado_b constant int := ${b};`)
    .replaceAll(`date '2026-11-09'`, `date '2999-01-01'`)
  // a última linha ativa do arquivo é o `rollback;` do ensaio (depois dela só o DESFAZER, comentado)
  const gravando = (sql) => {
    const i = sql.lastIndexOf('\nrollback;\n')
    return `${sql.slice(0, i)}\ncommit;\n${sql.slice(i + 11)}`
  }
  const TAB = 'public.cirurgias_particulares_reparo_2026_11_09'
  const tabelaExiste = async () => (await db.query(`select to_regclass('${TAB}') is not null as ok`)).rows[0].ok
  const registro = async () => (await db.query(`select * from ${TAB} order by parte, anestesista_nome_depois`)).rows
  const DESFAZER = REPARO.slice(REPARO.indexOf('-- >>> DESFAZER'), REPARO.indexOf('-- <<< DESFAZER'))
    .split('\n').slice(1).map((l) => l.replace(/^-- ?/, '')).join('\n')
  const tabela = (res) => [...res].reverse().find((r) => r.rows?.length)?.rows ?? []
  const linha = (rows, ini) => rows.find((r) => r.parte.startsWith(ini))?.n
  const semGatilho = (ligado) => db.exec(
    `alter table public.escala_cirurgica_caso ${ligado ? 'enable' : 'disable'} trigger tr_caso_cobranca_acompanha_repasse`)
  const duplicar = (casoId, extra = '') => db.query(`insert into public.cirurgias_particulares
    (paciente, cirurgiao, anestesista_nome, data_cirurgia, procedimento, local, valor, escala_caso_id, created_by_name ${extra ? ', paciente_cpf' : ''})
    values ('X.', 'c', 'ANA PUBLICADA', current_date, 'p', 'Unimed', 0, $1, 'Verificação diária (auto)' ${extra ? `, '52998224725'` : ''})`, [casoId])
  const c = {}

  beforeAll(async () => {
    await db.exec('delete from public.cirurgias_particulares; delete from public.escala_cirurgica_caso;')
    await db.query(`insert into public.profiles (id, nome, role) values ($1, 'DONO DO GRUPO', 'anestesiologista')`, [DONO])
    // o passado: repasses feitos quando a cobrança ainda não acompanhava
    await semGatilho(false)
    c.repasse = await novoCaso(); await repassar(c.repasse, 'BRUNO', 'u-bruno')
    c.aDefinir = await novoCaso({ anestesista: '?', uid: null }); await repassar(c.aDefinir, 'ANA', 'u-ana')
    c.dupla = await novoCaso(); await repassar(c.dupla, 'ANA + BRUNO', null)
    c.preenchida = await novoCaso(); await preencher(c.preenchida, 'valor = 800'); await repassar(c.preenchida, 'BRUNO', 'u-bruno')
    c.semAnest = await novoCaso(); await repassar(c.semAnest, '?', null, true)
    c.igual = await novoCaso()
    c.soGrafia = await novoCaso(); await preencher(c.soGrafia, `anestesista_nome = 'ANA P. DE TAL'`)
    // continuações com a cobrança que o cron abria: duas com par, uma preenchida com par
    for (const k of ['d1', 'd2', 'dPreenchida']) {
      c[`${k}Manha`] = await novoCaso({ iniciais: `${k}.`, cirurgiao: 'DR PAR' })
      c[k] = await novoCaso({ iniciais: `${k}.`, cirurgiao: ' dr par ', continuacao: true })
      await duplicar(c[k], k === 'dPreenchida' ? 'cpf' : '')
    }
    await semGatilho(true)
  })

  const nomes = async () => Object.fromEntries(await Promise.all(
    ['repasse', 'aDefinir', 'dupla', 'preenchida', 'semAnest', 'igual', 'soGrafia'].map(async (k) => [k, (await cobranca(c[k])).anestesista_nome])))
  const ANTES = { repasse: 'ANA PUBLICADA', aDefinir: 'A definir', dupla: 'ANA PUBLICADA', preenchida: 'ANA PUBLICADA',
    semAnest: 'ANA PUBLICADA', igual: 'ANA PUBLICADA', soGrafia: 'ANA P. DE TAL' }

  it('o arquivo como está é ENSAIO: termina em rollback e não assina como system/admin', () => {
    const ativo = REPARO.split('\n').filter((l) => l.trim() && !l.startsWith('--'))
    expect(ativo.at(-1)).toBe('rollback;')
    expect(ativo.filter((l) => /^(commit|rollback);/.test(l))).toEqual(['rollback;'])
    expect(REPARO).not.toMatch(/'(system|admin)'/i)
    expect(REPARO).not.toMatch(/delete\s+from/i)
  })

  it('aborta com as travas de produção (o cenário não tem 183 nem 12) e não grava nada', async () => {
    await expect(db.exec(gravando(REPARO))).rejects.toThrow(/reparo A: esperava 183/)
    await db.exec('rollback')
    expect(await nomes()).toEqual(ANTES)
  })

  it('ensaio: mostra o antes/depois por anestesista e não grava nada', async () => {
    const rows = tabela(await db.exec(comTravas(3, 3)))
    expect(rows.filter((r) => r.parte === 'A · de → para').map((r) => [r.de, r.para, r.n]).sort()).toEqual([
      ['A definir', 'ANA PUBLICADA', 1],
      ['ANA PUBLICADA', 'ANA + BRUNO', 1],
      ['ANA PUBLICADA', 'BRUNO REPASSE', 1],
    ])
    expect(linha(rows, 'A · total')).toBe(3)
    expect(linha(rows, 'B · duplicadas')).toBe(2)
    expect(linha(rows, 'depois · rascunho ainda')).toBe(0)
    expect(linha(rows, 'depois · cobrança ativa em linha de continuação NÃO')).toBe(0)
    expect(linha(rows, 'depois · continuação com cobrança PREENCHIDA')).toBe(1)
    expect(JSON.stringify(rows)).not.toMatch(/X\.|M\.S\./) // nenhum paciente na tabela
    expect(await nomes()).toEqual(ANTES)
    expect((await cobranca(c.d1)).cancelada_em).toBeNull()
    expect(linha(rows, 'registro · linhas')).toBe(5)
    expect(await tabelaExiste()).toBe(false) // o ensaio não deixa nem a tabela do de → para
  })

  it('continuação sem par muda a conta da parte B: aborta inteiro, nem a parte A fica', async () => {
    const semPar = await novoCaso({ iniciais: 'S.P.', cirurgiao: 'DR SEM PAR', continuacao: true })
    await duplicar(semPar)
    await expect(db.exec(gravando(comTravas(3, 4)))).rejects.toThrow(/reparo B: esperava 4/)
    await db.exec('rollback')
    expect(await nomes()).toEqual(ANTES)
    expect(await tabelaExiste()).toBe(false)
    await db.query('delete from public.cirurgias_particulares where escala_caso_id = $1', [semPar])
  })

  it('com commit: corrige os 3 para quem fez, assinado pelo dono, e não toca os outros', async () => {
    await db.exec(gravando(comTravas(3, 3)))
    expect(await nomes()).toEqual({ ...ANTES, repasse: 'BRUNO REPASSE', aDefinir: 'ANA PUBLICADA', dupla: 'ANA + BRUNO' })
    expect(await cobranca(c.repasse)).toMatchObject({ anestesista_user_id: 'u-bruno', updated_by: DONO, updated_by_name: 'DONO DO GRUPO' })
    expect(await cobranca(c.dupla)).toMatchObject({ anestesista_user_id: null })
    expect((await cobranca(c.preenchida)).updated_by).toBeNull()
    expect((await cobranca(c.soGrafia)).updated_by).toBeNull()
  })

  it('com commit: cancela as 2 duplicadas como a tela cancela; a preenchida e as da manhã ficam', async () => {
    const { rows } = await db.query(`select cancelada_por, cancelada_por_nome, motivo_cancelamento
      from public.cirurgias_particulares where escala_caso_id = any($1) and cancelada_em is not null`, [[c.d1, c.d2]])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ cancelada_por: DONO, cancelada_por_nome: 'DONO DO GRUPO' })
    expect(rows[0].motivo_cancelamento).toMatch(/continuação/)
    expect((await cobranca(c.dPreenchida)).cancelada_em).toBeNull()
    for (const k of ['d1Manha', 'd2Manha', 'dPreenchidaManha']) expect((await cobranca(c[k])).cancelada_em).toBeNull()
    const { rows: total } = await db.query('select count(*) n from public.cirurgias_particulares')
    expect(Number(total[0].n)).toBe(13) // nada apagado: 7 + 3 manhãs + 3 continuações
  })

  it('de → para por linha: uma linha por cobrança alterada, com o antes, o depois e quem rodou', async () => {
    const r = await registro()
    expect(r.map((x) => [x.parte, x.anestesista_nome_antes, x.anestesista_user_id_antes, x.anestesista_nome_depois, x.anestesista_user_id_depois])).toEqual([
      ['A', 'ANA PUBLICADA', 'u-ana', 'ANA + BRUNO', null],
      ['A', 'A definir', null, 'ANA PUBLICADA', 'u-ana'],
      ['A', 'ANA PUBLICADA', 'u-ana', 'BRUNO REPASSE', 'u-bruno'],
      ['B', 'ANA PUBLICADA', null, 'ANA PUBLICADA', null],
      ['B', 'ANA PUBLICADA', null, 'ANA PUBLICADA', null],
    ])
    const ids = async (ks) => (await Promise.all(ks.map(async (k) => (await cobranca(c[k])).id))).sort()
    expect(r.filter((x) => x.parte === 'A').map((x) => x.cobranca_id).sort()).toEqual(await ids(['repasse', 'aDefinir', 'dupla']))
    expect(r.filter((x) => x.parte === 'B').map((x) => x.cobranca_id).sort()).toEqual(await ids(['d1', 'd2']))
    for (const x of r) {
      expect(x).toMatchObject({ rodado_por: DONO, rodado_por_nome: 'DONO DO GRUPO', cancelada_em_antes: null, updated_by_antes: null })
      expect(x.rodado_em).toBeTruthy()
      expect(x.updated_at_antes).toBeTruthy()
    }
  })

  it('a tabela do de → para não tem coluna de paciente e fica fechada para o app', async () => {
    const { rows: cols } = await db.query(`select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'cirurgias_particulares_reparo_2026_11_09'`)
    expect(cols.map((x) => x.column_name).filter((n) => /paciente|cpf|procedimento|cirurgiao/.test(n))).toEqual([])
    const { rows } = await db.query(`select c.relrowsecurity rls, c.relforcerowsecurity forcada,
        (select count(*)::int from pg_policy p where p.polrelid = c.oid) policies,
        has_table_privilege('authenticated', c.oid, 'select') auth, has_table_privilege('anon', c.oid, 'select') anon
      from pg_class c where c.oid = '${TAB}'::regclass`)
    expect(rows[0]).toEqual({ rls: true, forcada: true, policies: 0, auth: false, anon: false })
  })

  it('o cron da noite não reabre o que foi cancelado (por isso a migration vem antes)', async () => {
    expect((await cron()).corrigidos).toBe(0)
    expect((await cobrancas(c.d1)).filter((r) => !r.cancelada_em)).toHaveLength(0)
  })

  it('rodar o reparo de novo aborta, e sem a migration ele nem começa', async () => {
    await expect(db.exec(gravando(comTravas(3, 3)))).rejects.toThrow(/fora da faixa/)
    await db.exec('rollback')
    await db.exec('alter trigger tr_caso_cobranca_acompanha_repasse on public.escala_cirurgica_caso rename to tr_x')
    await expect(db.exec(gravando(comTravas(3, 3)))).rejects.toThrow(/aplicar antes a migration 20261109234000/)
    await db.exec('rollback')
    await db.exec('alter trigger tr_x on public.escala_cirurgica_caso rename to tr_caso_cobranca_acompanha_repasse')
    expect(await registro()).toHaveLength(5) // as tentativas abortadas não duplicam nem apagam o registro
  })

  it('DESFAZER (o SQL comentado no fim): devolve os nomes e reabre as canceladas; o que foi editado depois fica', async () => {
    expect(DESFAZER).toMatch(/^begin;/)
    // a guia do "A definir" foi preenchida e trocada de anestesista à mão depois do reparo: não volta
    await preencher(c.aDefinir, `anestesista_nome = 'BRUNO REPASSE', anestesista_user_id = 'u-bruno', updated_by = 'u-coord'`)
    const res = tabela(await db.exec(DESFAZER))
    expect(res).toEqual([
      { parte: 'A', registradas: 3, desfeitas: 2, ficaram_como_estao: 1 },
      { parte: 'B', registradas: 2, desfeitas: 2, ficaram_como_estao: 0 },
    ])
    expect(await nomes()).toEqual({ ...ANTES, aDefinir: 'BRUNO REPASSE' })
    expect(await cobranca(c.repasse)).toMatchObject({ anestesista_user_id: 'u-ana', updated_by: DONO })
    expect(await cobranca(c.dupla)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana' })
    for (const k of ['d1', 'd2']) {
      const { rows } = await db.query(`select cancelada_em, cancelada_por, motivo_cancelamento
        from public.cirurgias_particulares where escala_caso_id = $1`, [c[k]])
      expect(rows).toEqual([{ cancelada_em: null, cancelada_por: null, motivo_cancelamento: null }])
    }
    expect(await registro()).toHaveLength(5) // o registro fica
    // desfazer de novo não muda mais nada
    expect(tabela(await db.exec(DESFAZER)).map((x) => x.desfeitas)).toEqual([0, 0])
  })
})

describe('rollback', () => {
  it('tira o gatilho e as funções novas; o repasse volta a não chegar à cobrança', async () => {
    await db.exec(ROLLBACK)
    await db.exec(ROLLBACK) // idempotente
    expect(await gatilhos()).toBe(0)
    const { rows } = await db.query(`select count(*) n from pg_proc where proname like 'fn_cirurgia_particular_acompanha%'`)
    expect(Number(rows[0].n)).toBe(0)
    const c = await novoCaso()
    await repassar(c, 'BRUNO', 'u-bruno')
    expect(await cobranca(c)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA', anestesista_user_id: 'u-ana' })
  })

  it('a republicação e o cron voltam aos corpos do ar, sem erro', async () => {
    const a = await novoCaso({ procedimento: 'RB REPUB' })
    await db.query('delete from public.escala_cirurgica_caso where id = $1', [a])
    const a2 = await novoCaso({ procedimento: 'RB REPUB', anestesista: 'BRUNO', uid: 'u-bruno' })
    expect(await cobranca(a2)).toMatchObject({ anestesista_nome: 'ANA PUBLICADA' })
    expect((await cron()).erro).toBeUndefined()
  })
})
