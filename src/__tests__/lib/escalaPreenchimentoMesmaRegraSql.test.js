/**
 * "SEU PREENCHIMENTO" COM A MESMA REGRA DO AVISO (dono 28/10: "eventualmente aparece que tenho
 * 100% de cirurgias marcadas mas falta 1?") — a migration 20261028130000 rodando num Postgres
 * em memória (PGlite) sobre os corpos que estão no ar (20261016150000 + 20261027220000).
 *
 * O que trava aqui: o número de cada pessoa é a conta da tela (`contaDoDia` com o dia virado,
 * pelas pessoas da aba Minhas); "passa para a tarde" sem continuação, a continuação que herdou
 * o término e a dupla "A + B" entram; o relatório de adesão devolve exatamente o que devolvia;
 * e o rollback volta tudo.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { contaDoDia } from '@/lib/escalaHorarioPendente'
import { anestesistaDoCasoEh, normNome } from '@/pages/escala-cirurgica/utils'

const ler = (f) => readFileSync(f, 'utf8')
const NO_AR_16 = ler('supabase/migrations/20261016150000_escala_consultorio_sem_horario.sql')
const NO_AR_27 = ler('supabase/migrations/20261027220000_escala_continuacao_herda_termino.sql')
const MIGRATION = ler('supabase/migrations/20261028130000_escala_preenchimento_mesma_regra.sql')
const ROLLBACK = ler('scripts/rollback-20261028130000-preenchimento-mesma-regra.sql')

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// três dias atrás: dentro dos 6 dias encerrados em qualquer hora em que a suíte rodar
const DIA = iso(new Date(Date.now() - 3 * 86400000))
// dez dias atrás: fora da janela
const VELHO = iso(new Date(Date.now() - 10 * 86400000))
const ESC = { hro: '00000000-0000-0000-0000-0000000000b1', unimed: '00000000-0000-0000-0000-0000000000b2', velho: '00000000-0000-0000-0000-0000000000b3' }

// o dicionário de apelidos (a conta secundária do Melo responde pela principal)
const APELIDOS = [['EDUARDO', 'u-edu'], ['LEONARDO', 'u-leo'], ['ALINE', 'u-aline'], ['ANA', 'u-ana'], ['GUI', 'u-melo2']]
const PERFIS = ['u-melo', 'u-fer', 'u-kar', 'u-garim', 'u-dani', 'u-edu', 'u-leo', 'u-aline', 'u-ana']

let n = 0
const id = () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`
const base = (o) => ({ turno: 'matutino', sala: 'Sala 1', ordem: 1, hora: '08:00', procedimento: 'COLECISTECTOMIA', cirurgiao: 'Fulano', statusCirurgia: 'terminada', statusExtra: null, inicioReal: null, terminoReal: null, isContinuacao: false, ...o })
const cont = (o) => base({ turno: 'vespertino', ordem: 0, hora: '13:00', procedimento: 'CONTINUAÇÃO', isContinuacao: true, statusCirurgia: 'agendada', ...o })
const quem = (alias, uid = null) => ({ anestesista: alias, anestesistaUserId: uid })

const montar = () => {
  n = 0
  const hro = [
    // Melo: uma completa; a que passou à Fernanda, com o início dele marcado
    base({ id: id(), ordem: 0, hora: '07:00', inicioReal: '07:10', terminoReal: '08:40', ...quem('MELO', 'u-melo') }),
    base({ id: id(), hora: 'AS', cirurgiao: 'Marcelo Vieira', statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '10:45', ...quem('MELO', 'u-melo') }),
    cont({ id: id(), cirurgiao: 'Marcelo Cunha', ...quem('FERNANDA', 'u-fer') }),
    // "Passa para a tarde" sem ninguém que continuasse (Karine, 24/10): segue com quem começou
    base({ id: id(), sala: 'Sala 4', cirurgiao: 'Scherer', statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '11:35', ...quem('KARINE', 'u-kar') }),
    // a MESMA pessoa nos dois cards: uma cirurgia, horário na continuação
    base({ id: id(), sala: 'Sala 2', cirurgiao: 'Marcia Morales', statusCirurgia: 'iniciada', ...quem('GARIM', 'u-garim') }),
    cont({ id: id(), sala: 'Sala 2', cirurgiao: 'Marcia Morales', statusCirurgia: 'terminada', inicioReal: '08:00', terminoReal: '14:40', ...quem('GARIM', 'u-garim') }),
    // consultório e suspensa ficam fora
    base({ id: id(), sala: 'Consultório', procedimento: 'CONSULTORIO', ...quem('ANA') }),
    base({ id: id(), sala: 'Sala 7', statusExtra: 'suspensa', ...quem('MELO', 'u-melo') }),
  ]
  const unimed = [
    // duplas sem login: cada nome pelo dicionário; "PED" e a conta secundária resolvem
    base({ id: id(), sala: 'CC - Sala 1', inicioReal: '08:00', terminoReal: '10:00', ...quem('EDUARDO + LEONARDO') }),
    base({ id: id(), sala: 'CC - Sala 2', inicioReal: '08:00', ...quem('PED ALINE + LEONARDO') }),
    base({ id: id(), sala: 'CC - Sala 3', inicioReal: '09:00', terminoReal: '11:00', ...quem('GUI + ANA') }),
    // Umanitá: a Daniela passou adiante sem início; o Eduardo terminou a continuação
    base({ id: id(), sala: 'Umanitá', cirurgiao: 'Lucas', statusCirurgia: 'agendada', statusExtra: 'passa_tarde', ...quem('DANIELA', 'u-dani') }),
    cont({ id: id(), sala: 'Umanitá', cirurgiao: 'LUCAS', statusCirurgia: 'terminada', terminoReal: '15:00', ...quem('EDUARDO', 'u-edu') }),
  ]
  const velho = [base({ id: id(), ...quem('MELO', 'u-melo') })]
  return { hro, unimed, velho }
}

let db
let casos
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.quem (uid text);
    insert into public.quem values ('u-melo');
    create function public.firebase_uid() returns text language sql as $$ select uid from public.quem limit 1 $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql as $$ select true $$;
    create table public.profiles (id text primary key, active boolean default true, email text, conta_duplicada_de text);
    create table public.escala_anestesista_alias (user_id text not null, apelido text not null unique);
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text);
    create table public.escala_cirurgica_caso (
      id uuid primary key, escala_id uuid, sala text, ordem int, hora text, procedimento text, cirurgiao text,
      anestesista text, anestesista_user_id text, is_continuacao boolean, sem_anestesista boolean,
      turno text, status_cirurgia text not null default 'agendada', status_extra text,
      inicio_real text, termino_real text);
  `)
  for (const uid of PERFIS) await db.query('insert into public.profiles (id) values ($1)', [uid])
  await db.query("insert into public.profiles (id, conta_duplicada_de) values ('u-melo2', 'u-melo')")
  for (const [apelido, uid] of APELIDOS) await db.query('insert into public.escala_anestesista_alias values ($1, $2)', [uid, apelido])
  casos = montar()
  const dataDe = { hro: DIA, unimed: DIA, velho: VELHO }
  for (const [chave, lista] of Object.entries(casos)) {
    await db.query("insert into public.escala_cirurgica values ($1, $2, $3, 'publicada')", [ESC[chave], dataDe[chave], chave === 'velho' ? 'hro' : chave])
    for (const c of lista) {
      await db.query(`insert into public.escala_cirurgica_caso
        (id, escala_id, sala, ordem, hora, procedimento, cirurgiao, anestesista, anestesista_user_id, is_continuacao,
         sem_anestesista, turno, status_cirurgia, status_extra, inicio_real, termino_real)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,$15)`,
      [c.id, ESC[chave], c.sala, c.ordem, c.hora, c.procedimento, c.cirurgiao, c.anestesista, c.anestesistaUserId,
        c.isContinuacao, c.turno, c.statusCirurgia, c.statusExtra, c.inicioReal, c.terminoReal])
    }
  }
  // o que está no ar: os corpos de 16/10, reescritos em 27/10
  await db.exec(NO_AR_16)
  await db.exec(NO_AR_27)
}, 60000)
afterAll(async () => { await db?.close() })

const relatorio = async () => {
  await db.exec("update quem set uid = 'u-melo'")
  const { rows } = await db.query('select public.escala_horario_pendente_relatorio($1::date, $2::date) as r', [VELHO, DIA])
  return rows[0].r.casos
}
const meu = async (uid, dias = 6) => {
  await db.exec(`update quem set uid = '${uid}'`)
  const { rows } = await db.query('select public.escala_meu_preenchimento($1) as r', [dias])
  return [rows[0].r.casos, rows[0].r.completos]
}

/** A conta da tela com o dia virado, pelas pessoas da aba Minhas (login no caso; sem ele, o dicionário). */
const mapa = new Map(APELIDOS.map(([a, u]) => [normNome(a), u === 'u-melo2' ? 'u-melo' : u]))
const resolverUid = (raw) => mapa.get(normNome(raw)) || null
const daTela = (uid) => {
  const conta = ['hro', 'unimed'].flatMap((h) => contaDoDia([{ hospital: h, data: DIA, status: 'publicada', casos: casos[h] }], { hoje: DIA, agoraMin: 31 * 60 }))
  const meus = conta.filter((i) => anestesistaDoCasoEh(i.caso, { uid, resolverUid }))
  return [meus.length, meus.filter((i) => !i.falta).length]
}

describe('"Seu preenchimento" com a mesma regra do aviso (dono 28/10)', () => {
  let antes
  it('ANTES (o que está no ar): a Karine aparece com 100% de nada e a Fernanda sem a continuação', async () => {
    antes = await relatorio()
    expect(antes.some((c) => c.anestesista === 'KARINE' && c.falta === 'ter')).toBe(true) // o relatório cobra
    expect(await meu('u-kar', 7)).toEqual([0, 0]) // o número não conta
    expect(await meu('u-fer', 7)).toEqual([0, 0])
  })

  it('DEPOIS: o número de cada pessoa é a conta da tela, pelas pessoas da aba Minhas', async () => {
    await db.exec(MIGRATION)
    const esperado = {
      'u-melo': [3, 3], // completa + início da que passou + "GUI + ANA" pela conta secundária; a de 10 dias atrás fica fora
      'u-fer': [1, 0], // herdou o término
      'u-kar': [1, 0], // passa para a tarde sem continuação: segue com ela
      'u-garim': [1, 1], // mesma pessoa: uma cirurgia, horário na continuação
      'u-dani': [1, 0], // passou adiante sem o início
      'u-edu': [2, 2], // dupla + continuação terminada
      'u-leo': [2, 1], // as duas duplas
      'u-aline': [1, 0], // "PED ALINE" resolve pelo dicionário
      'u-ana': [1, 1], // a dupla; o consultório fica fora
    }
    for (const [uid, par] of Object.entries(esperado)) {
      expect([uid, ...daTela(uid)]).toEqual([uid, ...par])
      expect([uid, ...await meu(uid)]).toEqual([uid, ...par])
    }
  })

  it('o relatório de adesão devolve exatamente o que devolvia', async () => {
    expect(await relatorio()).toEqual(antes)
  })

  it('o apelido que normaliza igual para dois logins não resolve ninguém', async () => {
    await db.exec(`insert into public.profiles (id) values ('u-jh'), ('u-jr');
      insert into public.escala_anestesista_alias values ('u-jh', 'JOAO'), ('u-jr', 'JOÃO');`)
    await db.query(`insert into public.escala_cirurgica_caso (id, escala_id, sala, ordem, hora, procedimento, anestesista, turno, status_cirurgia, inicio_real, termino_real)
      values ('00000000-0000-0000-0000-0000000000ff', $1, 'CC - Sala 9', 1, '08:00', 'HERNIOPLASTIA', 'JOAO + LEONARDO', 'matutino', 'terminada', '08:00', '09:00')`, [ESC.unimed])
    expect(await meu('u-jh')).toEqual([0, 0])
    expect(await meu('u-jr')).toEqual([0, 0])
    expect(await meu('u-leo')).toEqual([3, 2])
    await db.exec("delete from public.escala_cirurgica_caso where id = '00000000-0000-0000-0000-0000000000ff'")
  })

  it('ninguém de fora chama a conta direto; as duas RPCs seguem para quem está logado', async () => {
    const { rows } = await db.query(`select
      has_function_privilege('authenticated', 'public.escala_horario_conta(date, date)', 'execute') as conta_auth,
      has_function_privilege('anon', 'public.escala_horario_conta(date, date)', 'execute') as conta_anon,
      has_function_privilege('authenticated', 'public.escala_meu_preenchimento(integer)', 'execute') as meu_auth,
      has_function_privilege('authenticated', 'public.escala_horario_pendente_relatorio(date, date)', 'execute') as rel_auth`)
    expect(rows[0]).toEqual({ conta_auth: false, conta_anon: false, meu_auth: true, rel_auth: true })
  })

  it('o rollback volta o que está no ar e tira a conta única', async () => {
    await db.exec(ROLLBACK)
    expect(await relatorio()).toEqual(antes)
    expect(await meu('u-kar', 7)).toEqual([0, 0])
    const { rows } = await db.query("select count(*)::int as n from pg_proc where proname = 'escala_horario_conta'")
    expect(rows[0].n).toBe(0)
  })
})
