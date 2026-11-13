/**
 * api-v1 — rotas /v1/escala-cirurgica e /v1/anestesistas (nov/2026).
 *
 * A chave vai para uma empresa EXTERNA. O que estes testes seguram:
 *  - a resposta é whitelist: nenhum campo de paciente (iniciais, idade,
 *    procedimento, convênio, gravidade) nem observação sai, mesmo que a linha
 *    do banco os traga;
 *  - a validação de parâmetros barra intervalo grande e valor fora da lista.
 */
import { describe, expect, it } from 'vitest'
import {
  agruparEscalas,
  mapAnestesistaApi,
  mapCasoApi,
  parseAtivos,
  parseParamsEscala,
  rotaAnestesistas,
  rotaEscalaCirurgica,
} from '../../../supabase/functions/api-v1/_escala-cirurgica.ts'

const sp = (q) => new URLSearchParams(q)

const linhaComPii = {
  data: '2026-11-12',
  hospital: 'unimed',
  turno: 'matutino',
  caso_id: 'c1',
  sala: '3',
  ordem: 1,
  hora: '07:00',
  termino_previsto: '09:00',
  tempo_estimado: '2h',
  cirurgiao_nome: 'Dr. Fulano',
  anestesista_id: 'uid-a',
  anestesista_nome: 'ANESTESISTA A',
  residente_id: null,
  residente_nome: null,
  tipo: 'eletiva',
  status_cirurgia: 'terminada',
  inicio_real: '07:10',
  termino_real: '08:55',
  // vazamento simulado — não pode aparecer na resposta
  paciente_iniciais: 'J.S.',
  idade: '54',
  procedimento: 'Colecistectomia',
  convenio: 'Unimed',
  gravidade: 'ASA 3',
  linha_overrides: { obs: 'x' },
  source_image_path: 'a/b.jpg',
  email: 'a@b.c',
}

const PROIBIDOS = [
  'paciente_iniciais', 'idade', 'procedimento', 'convenio', 'gravidade',
  'linha_overrides', 'observacoes', 'source_image_path', 'email',
  'permissions', 'last_access', 'is_admin', 'caso_id',
]

function chavesProfundas(obj, acc = new Set()) {
  if (Array.isArray(obj)) obj.forEach((o) => chavesProfundas(o, acc))
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      acc.add(k)
      chavesProfundas(v, acc)
    }
  }
  return acc
}

describe('parseParamsEscala', () => {
  it('aceita data única', () => {
    const r = parseParamsEscala(sp('data=2026-11-12'))
    expect(r).toEqual({ ok: true, params: { inicio: '2026-11-12', fim: '2026-11-12', hospital: null, turno: null } })
  })

  it('aceita intervalo com filtros (normaliza caixa)', () => {
    const r = parseParamsEscala(sp('inicio=2026-11-01&fim=2026-11-30&hospital=HRO&turno=Vespertino'))
    expect(r.ok && r.params).toEqual({ inicio: '2026-11-01', fim: '2026-11-30', hospital: 'hro', turno: 'vespertino' })
  })

  it('aceita exatamente 62 dias e recusa 63', () => {
    expect(parseParamsEscala(sp('inicio=2026-01-01&fim=2026-03-04')).ok).toBe(true)
    const r = parseParamsEscala(sp('inicio=2026-01-01&fim=2026-03-05'))
    expect(r.ok).toBe(false)
    expect(r.erro.status).toBe(400)
  })

  it.each([
    ['', 'sem data'],
    ['data=2026-02-30', 'data inexistente'],
    ['data=12/11/2026', 'formato errado'],
    ['inicio=2026-11-01', 'fim ausente'],
    ['inicio=2026-11-10&fim=2026-11-01', 'fim antes do início'],
    ['data=2026-11-12&inicio=2026-11-01&fim=2026-11-02', 'data + intervalo'],
    ['data=2026-11-12&hospital=fds', 'hospital fora da lista'],
    ['data=2026-11-12&turno=noturno', 'turno fora da lista'],
  ])('recusa %s (%s)', (q) => {
    const r = parseParamsEscala(sp(q))
    expect(r.ok).toBe(false)
    expect(r.erro.body.error).toBe('invalid_parameter')
  })
})

describe('parseAtivos', () => {
  it('ausente = todos; true/false; resto = 400', () => {
    expect(parseAtivos(sp(''))).toEqual({ ok: true, params: null })
    expect(parseAtivos(sp('ativos=true'))).toEqual({ ok: true, params: true })
    expect(parseAtivos(sp('ativos=FALSE'))).toEqual({ ok: true, params: false })
    expect(parseAtivos(sp('ativos=1')).ok).toBe(false)
  })
})

describe('mapCasoApi — whitelist', () => {
  it('só os campos previstos, sem PII de paciente', () => {
    const c = mapCasoApi(linhaComPii)
    expect(Object.keys(c).sort()).toEqual([
      'anestesista', 'cirurgiao', 'continuacao', 'hora', 'inicio_real', 'ordem', 'residente',
      'sala', 'sem_anestesista', 'status', 'tempo_estimado', 'termino_previsto', 'termino_real', 'tipo',
    ])
    expect(c.anestesista).toEqual({ id: 'uid-a', nome: 'ANESTESISTA A' })
    expect(c.residente).toBeNull()
  })

  it('anestesista sem uid (texto do rodapé) sai com id null; tipo desconhecido vira null', () => {
    const c = mapCasoApi({ ...linhaComPii, anestesista_id: null, anestesista_nome: 'APELIDO', tipo: 'xyz' })
    expect(c.anestesista).toEqual({ id: null, nome: 'APELIDO' })
    expect(c.tipo).toBeNull()
  })
})

describe('marcadores do rodapé não viram nome', () => {
  it.each(['?', '//', '???', '  ', '-'])('anestesista %j sem uid → null', (m) => {
    expect(mapCasoApi({ ...linhaComPii, anestesista_id: null, anestesista_nome: m }).anestesista).toBeNull()
  })

  it('sem_anestesista anula o anestesista mesmo com nome/uid na linha', () => {
    const c = mapCasoApi({ ...linhaComPii, sem_anestesista: true })
    expect(c.anestesista).toBeNull()
    expect(c.sem_anestesista).toBe(true)
  })

  it('continuacao sai como booleano; ausente = false', () => {
    expect(mapCasoApi({ ...linhaComPii, continuacao: true }).continuacao).toBe(true)
    expect(mapCasoApi(linhaComPii).continuacao).toBe(false)
  })

  it('dupla "A + B" sem uid sai como texto', () => {
    expect(mapCasoApi({ ...linhaComPii, anestesista_id: null, anestesista_nome: 'ANA + BIA' }).anestesista)
      .toEqual({ id: null, nome: 'ANA + BIA' })
  })
})

describe('agruparEscalas', () => {
  it('agrupa por data+hospital+turno e ordena salas/ordem/hospitais', () => {
    const rows = [
      { ...linhaComPii, hospital: 'hro', sala: '10', ordem: 1 },
      { ...linhaComPii, sala: '10', ordem: 2 },
      { ...linhaComPii, sala: '2', ordem: 1 },
      { ...linhaComPii, sala: '10', ordem: 1 },
      { ...linhaComPii, turno: 'vespertino', sala: '1', ordem: 1 },
    ]
    const e = agruparEscalas(rows)
    expect(e.map((x) => `${x.hospital}/${x.turno}`)).toEqual(['unimed/matutino', 'unimed/vespertino', 'hro/matutino'])
    expect(e[0].casos.map((c) => `${c.sala}:${c.ordem}`)).toEqual(['2:1', '10:1', '10:2'])
    for (const p of PROIBIDOS) expect(chavesProfundas(e).has(p)).toBe(false)
  })
})

describe('mapAnestesistaApi', () => {
  it('whitelist e apelidos deduplicados', () => {
    const a = mapAnestesistaApi({ id: 'u1', nome: 'FULANO', ativo: true, apelidos: ['FUL', ' FUL ', ''], email: 'x@y', is_admin: true })
    expect(a).toEqual({ id: 'u1', nome: 'FULANO', apelidos: ['FUL'], ativo: true })
    expect(mapAnestesistaApi({ id: 'u2', nome: '' })).toBeNull()
  })
})

// ── rotas com supabase falso (pagina e aplica filtros) ─────────────────────
function fakeSupabase(tabelas) {
  const chamadas = []
  return {
    chamadas,
    from(tabela) {
      const filtros = []
      let range = null
      const b = {
        select: () => b,
        gte: (c, v) => (filtros.push(['gte', c, v]), b),
        lte: (c, v) => (filtros.push(['lte', c, v]), b),
        eq: (c, v) => (filtros.push(['eq', c, v]), b),
        order: () => b,
        range: (de, ate) => ((range = [de, ate]), b),
        then(res) {
          chamadas.push({ tabela, filtros: [...filtros], range })
          let rows = tabelas[tabela] ?? []
          for (const [op, c, v] of filtros) {
            rows = rows.filter((r) => (op === 'eq' ? r[c] === v : op === 'gte' ? r[c] >= v : r[c] <= v))
          }
          if (range) rows = rows.slice(range[0], range[1] + 1)
          return Promise.resolve({ data: rows, error: null }).then(res)
        },
      }
      return b
    },
  }
}

const ctx = (supabase, q) => ({ supabase, url: new URL(`https://x/v1/r?${q}`), pathname: '/v1/r' })

describe('rotaEscalaCirurgica', () => {
  it('pagina além de 1000 linhas e não vaza PII', async () => {
    const rows = Array.from({ length: 2300 }, (_, i) => ({ ...linhaComPii, sala: String(i % 20), ordem: i }))
    const sb = fakeSupabase({ vw_api_escala_cirurgica: rows })
    const r = await rotaEscalaCirurgica(ctx(sb, 'data=2026-11-12&hospital=unimed'))
    expect(r.status).toBe(200)
    expect(r.body.meta.total_casos).toBe(2300)
    expect(sb.chamadas).toHaveLength(3)
    expect(sb.chamadas[0].filtros).toContainEqual(['eq', 'hospital', 'unimed'])
    for (const p of PROIBIDOS) expect(chavesProfundas(r.body).has(p)).toBe(false)
  })

  it('400 sem consultar o banco quando o parâmetro é inválido', async () => {
    const sb = fakeSupabase({})
    const r = await rotaEscalaCirurgica(ctx(sb, 'data=ontem'))
    expect(r.status).toBe(400)
    expect(sb.chamadas).toHaveLength(0)
  })
})

describe('rotaAnestesistas', () => {
  it('filtra por ativos', async () => {
    const sb = fakeSupabase({
      vw_api_anestesistas: [
        { id: 'b', nome: 'BETA', ativo: true, apelidos: [] },
        { id: 'a', nome: 'ALFA', ativo: false, apelidos: ['AL'] },
      ],
    })
    const todos = await rotaAnestesistas(ctx(sb, ''))
    expect(todos.body.data.map((a) => a.id)).toEqual(['a', 'b'])
    const ativos = await rotaAnestesistas(ctx(sb, 'ativos=true'))
    expect(ativos.body.data).toEqual([{ id: 'b', nome: 'BETA', apelidos: [], ativo: true }])
  })
})
