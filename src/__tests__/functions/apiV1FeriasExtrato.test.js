/**
 * Paridade da rota GET /v1/ferias/extrato (api-v1) com a tela de Extrato de Férias.
 *
 * A rota calcula com CÓPIAS GERADAS das libs (supabase/functions/api-v1/_lib-ferias).
 * Duas travas:
 *  1. as cópias estão em dia com src/lib (senão: node scripts/gerar-libs-ferias-api-v1.mjs);
 *  2. `comporExtratoFerias` da edge dá o MESMO extrato que a composição da
 *     ExtratoFeriasPage feita com as libs ORIGINAIS de src/lib, num cenário que
 *     exercita FDS, feriado em semana inteira/parcial, 7ª vaga com e sem ordem
 *     confiável, marcação/desmarcação no app, desmarcação de código do PP,
 *     duplicata de código e nome fora da lista de sócios.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { normalizarRegistrosFerias, construirExtrato } from '@/lib/extratoFerias'
import { aplicarMovimentacoes, vistasDasMovimentacoes } from '@/lib/feriasMovimentacoes'
import { ultimoAMarcar, penalidadesSetimaVaga, aplicarPenalidades } from '@/lib/feriasAnalise'
import { MAX_VAGAS_DIA } from '@/lib/extratoFeriasRegras'
import { getSocios } from '@/lib/feriasSocios'
import { getFeriados } from '@/lib/feriasFeriados'

import {
  comporExtratoFerias,
  serializarSocio,
  normalizarNome,
} from '../../../supabase/functions/api-v1/_ferias.ts'
import { gerarTodos, DESTINO } from '../../../scripts/gerar-libs-ferias-api-v1.mjs'

// ─── Referência: a composição da ExtratoFeriasPage (memos registrosPP → extrato) ─
function extratoComoATela({ plantoesRaw, movimentacoes, marcacoesVistas, ano }) {
  const socios = getSocios(ano)
  const feriados = getFeriados(ano)
  const registrosPP = normalizarRegistrosFerias(plantoesRaw)
  const registros = aplicarMovimentacoes(registrosPP, movimentacoes)
  const extratoBase = construirExtrato({ registros, ano, socios, feriados })
  const doPP = new Map(
    registrosPP.filter((r) => r.criadoEm).map((r) => [r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.criadoEm }])
  )
  const vistas = new Map([...(marcacoesVistas || new Map()), ...doPP, ...vistasDasMovimentacoes(movimentacoes)])
  const codigosPorDia = new Map()
  for (const r of registros) {
    if (r.ehFimDeSemana) continue
    if (!codigosPorDia.has(r.data)) codigosPorDia.set(r.data, [])
    codigosPorDia.get(r.data).push(r.codigo)
  }
  const ultimosPorDia = new Map()
  for (const [data, nomes] of extratoBase.porDia) {
    if (nomes.length <= MAX_VAGAS_DIA) continue
    const info = ultimoAMarcar(codigosPorDia.get(data) || [], vistas)
    if (info) ultimosPorDia.set(data, info)
  }
  return aplicarPenalidades(extratoBase, penalidadesSetimaVaga(extratoBase.porDia, ultimosPorDia))
}

// ─── Cenário ─────────────────────────────────────────────────────────────────
const ANO = 2026
const SOCIOS = getSocios(ANO).map((s) => s.nome)
let seq = 0
const pp = (nome, data, criadoEm = `${data.slice(0, 4)}-01-10T09:00:00`, extra = {}) => ({
  CodigoPlantao: `PP${++seq}`,
  Setor: 'Férias',
  ProfDePlantao: nome,
  ProfFixo: null,
  Inicio: `${data}T07:00:00`,
  Fim: `${data}T19:00:00`,
  DataCriacao: criadoEm,
  // campos que a API NÃO pode devolver
  Email: 'x@y.z',
  Observacao: 'motivo qualquer',
  ...extra,
})
const semana = (nome, datas, criadoEm) => datas.map((d) => pp(nome, d, criadoEm))

function cenario() {
  seq = 0
  const [A, B, C, D, E, F, G, H] = SOCIOS
  const plantoesRaw = [
    // semana de Tiradentes (21/04) INTEIRA → feriado não conta: 4 dias
    ...semana(A, ['2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24']),
    // feriado em semana parcial → conta; + sábado (FDS nunca conta)
    ...semana(B, ['2026-04-21', '2026-04-22', '2026-04-25']),
    // 7ª vaga em 2026-07-15 com ordem confiável (H marcou por último, horas depois)
    ...[A, B, C, D, E, F].map((n, i) => pp(n, '2026-07-15', `2026-02-0${i + 1}T10:00:00`)),
    pp(H, '2026-07-15', '2026-03-20T10:00:00'),
    // 7ª vaga em 2026-07-16 com ordem NÃO confiável (todos no mesmo lote de <5 min)
    ...[A, B, C, D, E, F, G].map((n, i) => pp(n, '2026-07-16', `2026-02-01T10:0${i % 4}:00`)),
    // duplicata do mesmo CodigoPlantao (o PP repete entre meses) — conta 1
    { ...pp(C, '2026-09-08'), CodigoPlantao: 'DUP' },
    { ...pp(C, '2026-09-08'), CodigoPlantao: 'DUP' },
    // ProfFixo como fonte do nome, sem DataCriacao
    { ...pp(null, '2026-10-05', null), ProfFixo: D, CodigoPlantao: 'FIXO1' },
    // nome fora da lista de sócios → não aparece
    pp('FULANO DE FORA', '2026-05-04'),
    // licença (outro setor) → ignorada
    { ...pp(E, '2026-06-01'), Setor: 'LICENÇA SAÚDE' },
  ]
  const movimentacoes = [
    { id: 'm1', nome: G, data: '2026-12-01', acao: 'marcar', origemDia: 'app', codigoPp: null, criadoEm: '2026-08-04T12:00:00+00:00' },
    { id: 'm2', nome: G, data: '2026-12-02', acao: 'marcar', origemDia: 'app', codigoPp: null, criadoEm: '2026-08-04T12:00:01+00:00' },
    { id: 'm3', nome: G, data: '2026-12-02', acao: 'desmarcar', origemDia: 'app', codigoPp: null, criadoEm: '2026-08-05T12:00:00+00:00' },
    // desmarca um dia do PP (o dia 22/04 de B)
    { id: 'm4', nome: B, data: '2026-04-22', acao: 'desmarcar', origemDia: 'pegaplantao', codigoPp: 'PP7', criadoEm: '2026-08-06T12:00:00+00:00' },
    // marcação no app num dia que vira 8º (2026-07-15), com timestamp REAL posterior → G paga
    { id: 'm5', nome: G, data: '2026-07-15', acao: 'marcar', origemDia: 'app', codigoPp: null, criadoEm: '2026-09-01T12:00:00+00:00' },
  ]
  // first-seen gravado pela tela para o código sem DataCriacao
  const marcacoesVistas = new Map([['FIXO1', { nome: D, data: '2026-10-05', firstSeenAt: '2026-08-10T00:00:00+00:00' }]])
  return { plantoesRaw, movimentacoes, marcacoesVistas, ano: ANO }
}

describe('api-v1 /v1/ferias/extrato — libs geradas', () => {
  it('as cópias em _lib-ferias estão em dia com src/lib', () => {
    for (const { arquivo, conteudo } of gerarTodos()) {
      expect(readFileSync(resolve(DESTINO, arquivo), 'utf8'), `${arquivo} desatualizado — rode node scripts/gerar-libs-ferias-api-v1.mjs`).toBe(conteudo)
    }
  })
})

describe('api-v1 /v1/ferias/extrato — paridade com a tela', () => {
  it('mesmo extrato (porPessoa, porDia, totais) que a composição da ExtratoFeriasPage', () => {
    const entrada = cenario()
    const edge = comporExtratoFerias(entrada)
    const tela = extratoComoATela(cenario())
    expect(edge.porPessoa).toEqual(tela.porPessoa)
    expect([...edge.porDia]).toEqual([...tela.porDia])
    expect(edge.totalDiasContados).toBe(tela.totalDiasContados)
  })

  it('o cenário exercita as regras (não é paridade de extrato vazio)', () => {
    const ex = comporExtratoFerias(cenario())
    const [A, B, C, D, , , G, H] = SOCIOS
    const p = (n) => ex.porPessoa.find((x) => x.nome === n)
    // A: semana de Tiradentes inteira (4) + 15/07 + 16/07
    expect(p(A).diasContados).toBe(6)
    expect(p(A).feriadosNaoContados).toEqual(['2026-04-21'])
    // B: 21/04 (feriado em semana parcial, conta) + 15/07 + 16/07; 22/04 desmarcado no app; sábado ignorado
    expect(p(B).diasContados).toBe(3)
    expect(p(B).fdsIgnorados).toEqual(['2026-04-25'])
    // C: duplicata conta 1
    expect(p(C).dias.filter((d) => d === '2026-09-08')).toHaveLength(1)
    // D: nome via ProfFixo
    expect(p(D).dias).toContain('2026-10-05')
    // 7ª vaga: 15/07 tem 8 (G marcou no app por último) → G paga 2 extras; H não
    expect(p(G).diasPenalidade).toBe(2)
    expect(p(G).saldo).toBe(p(G).cota - p(G).diasContados - 2)
    expect(p(H).diasPenalidade).toBe(0)
    // 16/07: ordem não confiável → ninguém paga por ele
    expect(ex.porPessoa.flatMap((x) => x.penalidades).map((x) => x.data)).toEqual(['2026-07-15'])
    // G: 01/12 marcado e 02/12 desmarcado no app
    expect(p(G).dias).toEqual(['2026-07-15', '2026-07-16', '2026-12-01'])
  })

  it('0 movimentações e 0 vistas ⇒ idêntico à tela também', () => {
    const base = { ...cenario(), movimentacoes: [], marcacoesVistas: new Map() }
    expect(comporExtratoFerias(base).porPessoa).toEqual(extratoComoATela({ ...cenario(), movimentacoes: [], marcacoesVistas: new Map() }).porPessoa)
  })
})

describe('api-v1 /v1/ferias/extrato — whitelist (LGPD)', () => {
  it('serializa só os campos públicos, sem nada do PP cru nem de movimentação', () => {
    const ex = comporExtratoFerias(cenario())
    const json = ex.porPessoa.map(serializarSocio)
    for (const s of json) {
      expect(Object.keys(s).sort()).toEqual(
        ['cota', 'dias_marcados', 'dias_penalidade', 'dias_usados', 'nome', 'nome_escala', 'penalidades', 'periodos', 'regra_cota', 'saldo'].sort()
      )
      for (const per of s.periodos) expect(Object.keys(per).sort()).toEqual(['dias_uteis', 'fim', 'inicio'])
      for (const pen of s.penalidades) expect(Object.keys(pen).sort()).toEqual(['data', 'dias_extras'])
      expect(s.dias_usados).toBe(s.dias_marcados + s.dias_penalidade)
      expect(s.saldo).toBe(s.cota - s.dias_usados)
    }
    const texto = JSON.stringify(json)
    expect(texto).not.toMatch(/x@y\.z|motivo|FULANO|LICEN|CodigoPlantao|PP\d|app:|user_id|avisos/i)
  })

  it('normalizarNome casa caixa/acento/pontuação', () => {
    expect(normalizarNome('g. melo')).toBe(normalizarNome('G. MELO'))
    expect(normalizarNome('Thayna Regina Santos')).toBe(normalizarNome('THAYNÁ REGINA SANTOS'))
  })
})
