/**
 * A CONTINUAÇÃO HERDA O TÉRMINO no BANCO (dono 27/10, 19:52) — a migration 20261027220000
 * rodando num Postgres em memória (PGlite) sobre os corpos que estão no ar (20261016150000).
 *
 * O que trava aqui: o relatório de adesão e o "Seu preenchimento" fazem a MESMA conta da tela
 * (`pendenciasDoDia` com o dia virado). O término da manhã aberta é de quem a escala da tarde
 * pôs na continuação; o início segue com quem começou; o horário de qualquer card do par vale;
 * a mesma pessoa nos dois cards não passa nada. E o rollback volta tudo.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { pendenciasDoDia } from '@/lib/escalaHorarioPendente'

const ler = (f) => readFileSync(f, 'utf8')
const MIGRATION = ler('supabase/migrations/20261027220000_escala_continuacao_herda_termino.sql')
const NO_AR = ler('supabase/migrations/20261016150000_escala_consultorio_sem_horario.sql')
const ROLLBACK = ler('scripts/rollback-20261027220000-continuacao-herda-termino.sql')

// três dias atrás: dentro da janela das duas RPCs em qualquer data em que a suíte rodar
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DIA = iso(new Date(Date.now() - 3 * 86400000))
const ESC = { hro: '00000000-0000-0000-0000-0000000000a1', unimed: '00000000-0000-0000-0000-0000000000a2' }

let n = 0
const id = () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`
const manha = (o) => ({ turno: 'matutino', sala: 'Sala 1', ordem: 1, hora: 'AS', procedimento: 'MICROCIRURGIA', cirurgiao: 'Marcelo Vieira', statusCirurgia: 'iniciada', statusExtra: null, inicioReal: '08:00', terminoReal: null, isContinuacao: false, ...o })
const tarde = (o) => ({ turno: 'vespertino', sala: 'Sala 1', ordem: 0, hora: '13:00', procedimento: 'CONTINUAÇÃO', cirurgiao: 'Marcelo Cunha', statusCirurgia: 'agendada', statusExtra: null, inicioReal: null, terminoReal: null, isContinuacao: true, ...o })
const quem = (alias, uid = null) => ({ anestesista: alias, anestesistaUserId: uid })

/** O dia de outubro, um card por situação (os nomes são os do quadro de 27/10 e do mês). */
const montarCasos = () => {
  n = 0
  const hro = [
    // Sala 1 de 27/10: Melo começou e passou para a tarde; a Fernanda não marcou a continuação
    manha({ id: id(), ordem: 0, hora: '07:00', statusCirurgia: 'terminada', inicioReal: '08:00', terminoReal: '09:44', ...quem('MELO', 'u-melo') }),
    manha({ id: id(), statusExtra: 'passa_tarde', inicioReal: '10:45', ...quem('MELO', 'u-melo') }),
    tarde({ id: id(), ...quem('FERNANDA', 'u-fer') }),
    // IOSC: cirurgiões sem nome em comum não se casam — o término da Nathalia fica com ela
    manha({ id: id(), sala: 'IOSC', ordem: 20, cirurgiao: 'Jorge Valentini', ...quem('NATHALIA', 'u-nat') }),
    tarde({ id: id(), sala: 'IOSC', ordem: 2, cirurgiao: 'Guilherme Dalul', ...quem('PELISSARO', 'u-pel') }),
    // IOSC: a do Rafael marcada "Passa para tarde", completa pela continuação do Marílio
    manha({ id: id(), sala: 'IOSC', ordem: 21, cirurgiao: 'Rafael Tirapelle', statusExtra: 'passa_tarde', ...quem('KARINE', 'u-kar') }),
    tarde({ id: id(), sala: 'IOSC', ordem: 3, cirurgiao: 'Rafael Tirapelle', statusCirurgia: 'terminada', inicioReal: '13:00', terminoReal: '15:00', ...quem('MARILIO', 'u-mar') }),
    // Sala 2: a MESMA pessoa nos dois cards — vale o horário da continuação
    manha({ id: id(), sala: 'Sala 2', ordem: 5, cirurgiao: 'Marcia Morales', ...quem('GARIM', 'u-garim') }),
    tarde({ id: id(), sala: 'Sala 2', ordem: 4, cirurgiao: 'Marcia Morales', statusCirurgia: 'terminada', inicioReal: '08:00', terminoReal: '14:40', ...quem('GARIM', 'u-garim') }),
    // Sala 3: ninguém marcou nada — o início é da Aline, o término do Eduardo
    manha({ id: id(), sala: 'Sala 3', ordem: 6, cirurgiao: 'LUCAS', statusCirurgia: 'agendada', inicioReal: null, ...quem('ALINE', 'u-aline') }),
    tarde({ id: id(), sala: 'Sala 3', ordem: 5, cirurgiao: 'LUCAS', ...quem('EDUARDO', 'u-edu') }),
    // fora de par, como sempre
    manha({ id: id(), sala: 'Sala 9', ordem: 9, hora: '09:00', cirurgiao: 'Fulano', statusCirurgia: 'terminada', inicioReal: null, ...quem('ANA', 'u-ana') }),
  ]
  const unimed = [
    // HIPEC: dupla da manhã, outra dupla na continuação (passa para a noite)
    manha({ id: id(), sala: 'CC - Sala 3', ordem: 12, hora: '07:30', cirurgiao: 'CRISTIANO VENDRAME', statusExtra: 'passa_tarde', ...quem('OSCAR + ERLEI') }),
    tarde({ id: id(), sala: 'CC - Sala 3', ordem: 1, cirurgiao: 'CRISTIANO VENDRAME', statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '08:00', ...quem('ALEXANDRE D + ERLEI') }),
    // a MESMA dupla escrita em outra ordem e caixa não passa nada
    manha({ id: id(), sala: 'CC - Sala 5', ordem: 13, cirurgiao: 'PAULO CALDAS', ...quem('ROMULO + VICENTE') }),
    tarde({ id: id(), sala: 'CC - Sala 5', ordem: 2, cirurgiao: 'PAULO FERNANDO CALDAS', statusCirurgia: 'terminada', inicioReal: '08:00', terminoReal: '15:00', ...quem('vicente + Rômulo') }),
    // acento na sala e no cirurgião
    manha({ id: id(), sala: 'Umanitá', ordem: 25, cirurgiao: 'Lúcas', ...quem('DANIELA', 'u-dani') }),
    tarde({ id: id(), sala: 'Umanitá', ordem: 6, cirurgiao: 'LUCAS', ...quem('EDUARDO', 'u-edu') }),
  ]
  return { hro, unimed }
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
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text);
    create table public.escala_cirurgica_caso (
      id uuid primary key, escala_id uuid, sala text, ordem int, hora text, procedimento text, cirurgiao text,
      anestesista text, anestesista_user_id text, is_continuacao boolean, sem_anestesista boolean,
      turno text, status_cirurgia text not null default 'agendada', status_extra text,
      inicio_real text, termino_real text);
  `)
  for (const uid of ['u-melo', 'u-fer', 'u-garim', 'u-dani', 'u-aline', 'u-edu']) {
    await db.query('insert into public.profiles (id) values ($1)', [uid])
  }
  casos = montarCasos()
  for (const [hospital, lista] of Object.entries(casos)) {
    await db.query("insert into public.escala_cirurgica values ($1, $2, $3, 'publicada')", [ESC[hospital], DIA, hospital])
    for (const c of lista) {
      await db.query(`insert into public.escala_cirurgica_caso
        (id, escala_id, sala, ordem, hora, procedimento, cirurgiao, anestesista, anestesista_user_id, is_continuacao,
         sem_anestesista, turno, status_cirurgia, status_extra, inicio_real, termino_real)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,$15)`,
      [c.id, ESC[hospital], c.sala, c.ordem, c.hora, c.procedimento, c.cirurgiao, c.anestesista, c.anestesistaUserId,
        c.isContinuacao, c.turno, c.statusCirurgia, c.statusExtra, c.inicioReal, c.terminoReal])
    }
  }
  // os corpos que estão no ar (o relatório e o "Seu preenchimento" de 16/10)
  await db.exec(NO_AR)
}, 60000)
afterAll(async () => { await db?.close() })
beforeEach(async () => { await db.exec("update quem set uid = 'u-melo'") })

const relatorio = async () => {
  const { rows } = await db.query('select public.escala_horario_pendente_relatorio($1::date, $1::date) as r', [DIA])
  return rows[0].r.casos.map((c) => [c.id, c.anestesista, c.falta]).sort()
}
const meu = async (uid) => {
  await db.exec(`update quem set uid = '${uid}'`)
  const { rows } = await db.query('select public.escala_meu_preenchimento(7) as r')
  return [rows[0].r.casos, rows[0].r.completos]
}
/** A conta da tela com o dia virado (o que a aba Minhas mostra no dia seguinte). */
const daTela = () => Object.entries(casos)
  .flatMap(([hospital, lista]) => pendenciasDoDia([{ hospital, data: DIA, status: 'publicada', casos: lista }], { hoje: DIA, agoraMin: 31 * 60 }))
  .map((p) => [p.caso.id, p.caso.anestesista, p.falta]).sort()

describe('a continuação herda o término no banco (dono 27/10)', () => {
  it('ANTES (o que está no ar): o Melo, a Karine e o Oscar + Erlei aparecem com "Falta término"', async () => {
    const r = await relatorio()
    expect(r.filter(([, a]) => ['MELO', 'KARINE', 'OSCAR + ERLEI'].includes(a)).map(([, a, f]) => [a, f]))
      .toEqual(expect.arrayContaining([['MELO', 'ter'], ['KARINE', 'ter'], ['OSCAR + ERLEI', 'ter']]))
  })

  it('DEPOIS: o relatório de adesão faz a MESMA conta da tela, cirurgia por cirurgia', async () => {
    await db.exec(MIGRATION)
    const r = await relatorio()
    expect(r).toEqual(daTela())
    const porNome = Object.fromEntries(r.map(([, a, f]) => [a, f]))
    expect(porNome).toEqual({
      FERNANDA: 'ter', // herdou o término do Melo
      NATHALIA: 'ter', // IOSC sem par: segue com ela
      ALINE: 'ini', // começou: deve o início
      EDUARDO: 'ter', // Sala 3 e Umanitá: deve o término (a mesma chave guarda o último)
      'ALEXANDRE D + ERLEI': 'ter', // a dupla da tarde, não a da manhã
      ANA: 'ambos', // fora de par, como sempre
    })
    expect(r.filter(([, a]) => a === 'EDUARDO')).toHaveLength(2)
  })

  it('os pares: "Marcelo Cunha" casa com "Marcelo Vieira"; o IOSC sem nome em comum não casa', async () => {
    const { rows } = await db.query(`select k.anestesista as tarde, m.anestesista as manha, p.herda
      from public.escala_pares_continuacao($1::date, $1::date) p
      join escala_cirurgica_caso k on k.id = p.continuacao_id
      join escala_cirurgica_caso m on m.id = p.origem_id order by 1, 2`, [DIA])
    expect(rows.map((r) => [r.tarde, r.manha, r.herda])).toEqual([
      ['ALEXANDRE D + ERLEI', 'OSCAR + ERLEI', true],
      ['EDUARDO', 'ALINE', true],
      ['EDUARDO', 'DANIELA', true],
      ['FERNANDA', 'MELO', true],
      ['GARIM', 'GARIM', false],
      ['MARILIO', 'KARINE', true],
      ['vicente + Rômulo', 'ROMULO + VICENTE', false],
    ])
  })

  it('"Seu preenchimento": a manhã que passou o término sai da conta; com a mesma pessoa vale o horário da continuação', async () => {
    expect(await meu('u-melo')).toEqual([1, 1]) // a terminada das 07:00; a que passou para a tarde não conta
    expect(await meu('u-dani')).toEqual([0, 0]) // Umanitá: o término é do Eduardo
    expect(await meu('u-garim')).toEqual([1, 1]) // o término está no card da continuação
  })

  it('ninguém de fora chama a função dos pares (nem as de normalizar) direto', async () => {
    for (const f of ['escala_pares_continuacao(date, date)', 'escala_nomes_cirurgiao(text)', 'escala_pessoas_caso(text)']) {
      const { rows } = await db.query(`select has_function_privilege('authenticated', 'public.${f}', 'execute') as auth,
        has_function_privilege('anon', 'public.${f}', 'execute') as anon`)
      expect(rows[0]).toEqual({ auth: false, anon: false })
    }
  })

  it('acento decomposto (NFD) normaliza igual ao JS', async () => {
    const { rows } = await db.query("select public.escala_pessoas_caso($1) as p, public.escala_nomes_cirurgiao($2) as n",
      ['Ro\u0301mulo + VICENTE'.normalize('NFD'), 'Leo\u0301nidas Ma\u0301rio'.normalize('NFD')])
    expect(rows[0]).toEqual({ p: ['ROMULO', 'VICENTE'], n: ['LEONIDAS', 'MARIO'] })
  })

  it('o rollback volta o que está no ar e tira as funções novas', async () => {
    await db.exec(ROLLBACK)
    const r = await relatorio()
    expect(r.some(([, a, f]) => a === 'MELO' && f === 'ter')).toBe(true)
    const { rows } = await db.query("select count(*)::int as n from pg_proc where proname in ('escala_pares_continuacao', 'escala_pessoas_caso', 'escala_nomes_cirurgiao')")
    expect(rows[0].n).toBe(0)
    expect(await meu('u-garim')).toEqual([1, 0])
  })
})
