/**
 * api-v1 — `id` dos sócios no extrato e GET /v1/ferias/ausencias.
 *
 * Travas:
 *  1. identidade: o id só sai com casamento ÚNICO e exato (nome/apelido normalizado ou
 *     e-mail de EMAIL_TO_SOCIO); 0 ou ≥2 candidatos → null. EMAIL_TO_SOCIO da edge = gate.js;
 *  2. composição: férias (após o replay das movimentações) + licença do PP; férias vence
 *     a licença no mesmo dia; fora do intervalo não sai;
 *  3. whitelist (LGPD art. 11): nenhum motivo, setor, código ou campo cru do PP na resposta —
 *     testado na ROTA inteira, com o Pega Plantão e o banco simulados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EMAIL_TO_SOCIO as EMAIL_TO_SOCIO_APP } from '@/pages/ferias/gate.js'
import {
  EMAIL_TO_SOCIO,
  resolverIdsSocios,
  idUnico,
  indexarAnestesistas,
} from '../../../supabase/functions/api-v1/_ferias.ts'
import {
  comporAusencias,
  parseIntervalo,
  rotaFeriasAusencias,
} from '../../../supabase/functions/api-v1/_ausencias.ts'
import { EXEMPLOS } from '../../../supabase/functions/api-v1/_exemplos.ts'

const SOCIOS = [
  { nome: 'G. MELO', nomeCompleto: 'Guilherme Souza Melo' },
  { nome: 'FERNANDA GUOLLO', nomeCompleto: 'Fernanda Guollo' },
  { nome: 'THAYNÁ REGINA SANTOS', nomeCompleto: 'Thayná Regina Santos' },
  { nome: 'A. SCHMIDT', nomeCompleto: 'Alexandre Schmidt' },
  { nome: 'OSCAR AUGUSTO DE OLIVEIRA MORAIS', nomeCompleto: 'Oscar Augusto de Oliveira Morais' },
  { nome: 'JOÃO SILVA', nomeCompleto: 'João Silva' },
]

const ANESTESISTAS = [
  { id: 'uid-melo', nome: 'GUILHERME MELO', apelidos: ['MELO'] },
  { id: 'uid-guollo', nome: 'FERNANDA GUOLLO', apelidos: [] },
  { id: 'uid-thayna', nome: 'THAYNA REGINA SANTOS', apelidos: [] }, // sem acento no profile
  { id: 'uid-schmidt', nome: 'ALEXANDRE SCHMIDT', apelidos: ['A. SCHMIDT'] },
  { id: 'uid-oscar', nome: 'OSCAR MORAIS', apelidos: ['OSCAR'] }, // parecido NÃO é igual
  { id: 'uid-joao-1', nome: 'JOÃO SILVA', apelidos: [] },
  { id: 'uid-joao-2', nome: 'JOAO SILVA', apelidos: [] }, // homônimo → ambíguo
  { id: 'uid-pedro', nome: 'PEDRO NAO SOCIO', apelidos: ['PEDRINHO'] },
]

const IDENT = {
  anestesistas: ANESTESISTAS,
  idsPorEmailSocio: new Map([['G. MELO', new Set(['uid-melo'])]]),
}

describe('api-v1 férias — identidade (id nulo em ambiguidade)', () => {
  it('EMAIL_TO_SOCIO da edge espelha o do app (gate.js)', () => {
    expect(EMAIL_TO_SOCIO).toEqual(EMAIL_TO_SOCIO_APP)
  })

  it('casa só quando há exatamente 1 candidato', () => {
    const ids = resolverIdsSocios(SOCIOS, IDENT)
    expect(ids.get('G. MELO')).toBe('uid-melo') // pelo e-mail
    expect(ids.get('FERNANDA GUOLLO')).toBe('uid-guollo') // nome exato
    expect(ids.get('THAYNÁ REGINA SANTOS')).toBe('uid-thayna') // acento/caixa
    expect(ids.get('A. SCHMIDT')).toBe('uid-schmidt') // nome + apelido, mesmo uid
    expect(ids.get('OSCAR AUGUSTO DE OLIVEIRA MORAIS')).toBeNull() // sem casamento exato
    expect(ids.get('JOÃO SILVA')).toBeNull() // dois uids → ambíguo
  })

  it('fontes discordantes anulam (e-mail aponta X, nome aponta Y)', () => {
    const ident = { anestesistas: ANESTESISTAS, idsPorEmailSocio: new Map([['FERNANDA GUOLLO', new Set(['uid-outro'])]]) }
    expect(resolverIdsSocios(SOCIOS, ident).get('FERNANDA GUOLLO')).toBeNull()
  })

  it('apelido de duas pessoas é ambíguo', () => {
    const idx = indexarAnestesistas([
      { id: 'a', nome: 'X UM', apelidos: ['ZE'] },
      { id: 'b', nome: 'X DOIS', apelidos: ['ZE'] },
    ])
    expect(idUnico(idx, ['ZE'])).toBeNull()
    expect(idUnico(idx, ['x um'])).toBe('a')
  })
})

describe('api-v1 /v1/ferias/ausencias — composição', () => {
  const base = {
    inicio: '2026-07-13',
    fim: '2026-07-19',
    socios: SOCIOS,
    identidades: IDENT,
  }

  it('férias + ausência, férias vence no mesmo dia, intervalo respeitado, FDS como o PP traz', () => {
    const out = comporAusencias({
      ...base,
      ferias: [
        { nome: 'G. MELO', data: '2026-07-13' },
        { nome: 'FERNANDA GUOLLO', data: '2026-07-14' },
        { nome: 'FERNANDA GUOLLO', data: '2026-07-18' }, // sábado: sai se o PP/app registrou
        { nome: 'G. MELO', data: '2026-07-20' }, // fora do intervalo
      ],
      licencas: [
        { nome: 'FERNANDA GUOLLO', data: '2026-07-14', motivo: 'LICENÇA SAÚDE' }, // mesmo dia das férias → só 'ferias'
        { nome: 'PEDRINHO', data: '2026-07-15', motivo: 'LICENÇA SAÚDE' }, // não sócio, casa por apelido
        { nome: 'FULANO SEM CADASTRO', data: '2026-07-15', motivo: 'Licença Maternidade' }, // não sócio sem casamento
        { nome: 'JOÃO SILVA', data: '2026-07-16', motivo: 'LICENÇA SAÚDE' }, // sócio ambíguo
      ],
    })
    expect(out).toEqual([
      { data: '2026-07-13', pessoa: { id: 'uid-melo', nome: 'Guilherme Souza Melo' }, tipo: 'ferias', motivo: null },
      { data: '2026-07-14', pessoa: { id: 'uid-guollo', nome: 'Fernanda Guollo' }, tipo: 'ferias', motivo: null },
      { data: '2026-07-15', pessoa: { id: null, nome: 'FULANO SEM CADASTRO' }, tipo: 'ausente', motivo: 'Licença Maternidade' },
      { data: '2026-07-15', pessoa: { id: 'uid-pedro', nome: 'PEDRO NAO SOCIO' }, tipo: 'ausente', motivo: 'LICENÇA SAÚDE' },
      { data: '2026-07-16', pessoa: { id: null, nome: 'João Silva' }, tipo: 'ausente', motivo: 'LICENÇA SAÚDE' },
      { data: '2026-07-18', pessoa: { id: 'uid-guollo', nome: 'Fernanda Guollo' }, tipo: 'ferias', motivo: null },
    ])
  })

  it('parâmetros: data ou inicio+fim, teto de dias e faixa de anos', () => {
    const sp = (q) => new URLSearchParams(q)
    expect(parseIntervalo(sp('data=2026-07-13'), 2026)).toEqual({ ok: true, inicio: '2026-07-13', fim: '2026-07-13' })
    expect(parseIntervalo(sp('inicio=2026-12-20&fim=2027-01-10'), 2026).ok).toBe(true)
    expect(parseIntervalo(sp(''), 2026).ok).toBe(false)
    expect(parseIntervalo(sp('data=2026-07-13&inicio=2026-07-13&fim=2026-07-14'), 2026).ok).toBe(false)
    expect(parseIntervalo(sp('inicio=2026-07-14&fim=2026-07-13'), 2026).ok).toBe(false)
    expect(parseIntervalo(sp('inicio=2026-01-01&fim=2026-03-31'), 2026).ok).toBe(false)
    expect(parseIntervalo(sp('data=2022-12-31'), 2026).ok).toBe(false)
    expect(parseIntervalo(sp('data=2028-01-01'), 2026).ok).toBe(false)
  })

  it('o exemplo fictício tem o formato da resposta real', () => {
    const ex = EXEMPLOS['/v1/ferias/ausencias']
    expect(Object.keys(ex.meta).sort()).toEqual(['fim', 'fonte', 'inicio', 'tipos', 'total'])
    for (const item of ex.data) {
      expect(Object.keys(item).sort()).toEqual(['data', 'motivo', 'pessoa', 'tipo'])
      expect(Object.keys(item.pessoa).sort()).toEqual(['id', 'nome'])
    }
  })
})

// ─── Rota inteira com PP e banco simulados ──────────────────────────────────

const PP = [
  // férias do PP + campos que NUNCA podem sair
  { CodigoPlantao: 'PPF1', Setor: 'Férias', ProfDePlantao: 'FERNANDA GUOLLO', ProfFixo: null, Inicio: '2026-07-14T07:00:00', Fim: '2026-07-14T19:00:00', DataCriacao: '2026-01-10T09:00:00', Comentario: 'viagem', Email: 'x@y.z' },
  // férias do PP DESMARCADA no app → some
  { CodigoPlantao: 'PPF2', Setor: 'Férias', ProfDePlantao: 'FERNANDA GUOLLO', ProfFixo: null, Inicio: '2026-07-15T07:00:00', Fim: '2026-07-15T19:00:00', DataCriacao: '2026-01-10T09:00:00' },
  // licenças: dado de saúde
  { CodigoPlantao: 'PPL1', Setor: 'LICENÇA SAÚDE', ProfDePlantao: 'G. MELO', ProfFixo: null, Inicio: '2026-07-14T07:00:00', Fim: '2026-07-14T19:00:00', DataCriacao: '2026-07-01T09:00:00', Comentario: 'CID J11 gripe', Motivo: 'atestado médico' },
  { CodigoPlantao: 'PPL2', Setor: 'Licença Maternidade', ProfDePlantao: null, ProfFixo: 'FULANA DE FORA', Inicio: '2026-07-16T07:00:00', Fim: '2026-07-16T19:00:00', DataCriacao: '2026-07-01T09:00:00', Observacao: 'gestante' },
  // plantão comum: não é ausência
  { CodigoPlantao: 'PPP1', Setor: 'P1 HRO', ProfDePlantao: 'A. SCHMIDT', ProfFixo: null, Inicio: '2026-07-14T07:00:00', Fim: '2026-07-14T19:00:00', DataCriacao: '2026-07-01T09:00:00' },
]

const MOVS = [
  { id: 'm1', nome: 'FERNANDA GUOLLO', data: '2026-07-15', acao: 'desmarcar', origem_dia: 'pegaplantao', codigo_pp: 'PPF2', criado_em: '2026-07-02T10:00:00Z' },
  { id: 'm2', nome: 'G. MELO', data: '2026-07-16', acao: 'marcar', origem_dia: 'app', codigo_pp: null, criado_em: '2026-07-02T11:00:00Z' },
]

function fakeSupabase() {
  const resp = {
    vw_api_anestesistas: [
      { id: 'uid-melo', nome: 'GUILHERME MELO', apelidos: [] },
      { id: 'uid-guollo', nome: 'FERNANDA GUOLLO', apelidos: [] },
    ],
    profiles: [{ id: 'uid-melo-2', email: 'anestesista.guilherme@gmail.com', conta_duplicada_de: 'uid-melo' }],
    ferias_movimentacoes: MOVS,
  }
  return {
    from(tabela) {
      const q = {
        select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q,
        then: (res, rej) => Promise.resolve({ data: resp[tabela] ?? [], error: null }).then(res, rej),
      }
      return q
    },
  }
}

describe('api-v1 /v1/ferias/ausencias — rota (whitelist LGPD)', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: () => 'configurado' } })
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).endsWith('/token')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
      }
      expect(init?.method ?? 'GET').toBe('GET')
      const ini = new URL(String(url)).searchParams.get('filtro.dataInicio').slice(0, 7)
      return new Response(JSON.stringify(PP.filter((p) => p.Inicio.startsWith(ini))), { status: 200 })
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('compõe férias (com replay) + ausente com o motivo (setor do PP) e sem campo cru', async () => {
    const r = await rotaFeriasAusencias({
      supabase: fakeSupabase(),
      url: new URL('https://x/functions/v1/api-v1/v1/ferias/ausencias?inicio=2026-07-13&fim=2026-07-17'),
      pathname: '/v1/ferias/ausencias',
    })
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([
      { data: '2026-07-14', pessoa: { id: 'uid-guollo', nome: 'Fernanda Guollo' }, tipo: 'ferias', motivo: null },
      { data: '2026-07-14', pessoa: { id: 'uid-melo', nome: 'Guilherme Souza Melo' }, tipo: 'ausente', motivo: 'LICENÇA SAÚDE' },
      // 15/07 desmarcado no app → não aparece
      { data: '2026-07-16', pessoa: { id: null, nome: 'FULANA DE FORA' }, tipo: 'ausente', motivo: 'Licença Maternidade' },
      { data: '2026-07-16', pessoa: { id: 'uid-melo', nome: 'Guilherme Souza Melo' }, tipo: 'ferias', motivo: null }, // marcado no app
    ])
    expect(r.body.meta.total).toBe(4)
    const texto = JSON.stringify(r.body.data)
    // o motivo é o SETOR do PP e nada mais: comentário/campos crus nunca saem
    expect(texto).not.toMatch(/CID|gripe|atestado|gestante|viagem|x@y\.z|PP[FLP]\d|Setor|Comentario|Motivo|Observacao|P1 HRO|email/)
    for (const item of r.body.data) {
      expect(Object.keys(item).sort()).toEqual(['data', 'motivo', 'pessoa', 'tipo'])
      expect(Object.keys(item.pessoa).sort()).toEqual(['id', 'nome'])
    }
  })

  it('parâmetro inválido devolve 400 sem chamar o PP', async () => {
    const r = await rotaFeriasAusencias({
      supabase: fakeSupabase(),
      url: new URL('https://x/v1/ferias/ausencias'),
      pathname: '/v1/ferias/ausencias',
    })
    expect(r.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
