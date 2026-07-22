import { describe, it, expect } from 'vitest'
import {
  STATUS_PAGAMENTO,
  STATUS_LABEL,
  filtrarAtivas,
  filtrarPorPeriodo,
  computeTotais,
  resumoPorAnestesista,
  parseValorBRL,
  pareceIniciais,
  casoImportavel,
} from '../../lib/cirurgiasParticulares'

// ============================================================================
// Fixtures
// ============================================================================
const reg = (overrides = {}) => ({
  id: 'r1',
  paciente: 'Maria da Silva',
  cirurgiao: 'Dr. João',
  anestesistaNome: 'Gustavo Biesdorf',
  dataCirurgia: '2026-07-15',
  procedimento: 'Colecistectomia',
  local: 'Unimed',
  valor: 1500,
  statusPagamento: 'pendente',
  canceladaEm: null,
  ...overrides,
})

describe('filtrarPorPeriodo — bounds inclusivos, sem Date/fuso', () => {
  const registros = [
    reg({ id: 'a', dataCirurgia: '2026-07-01' }),
    reg({ id: 'b', dataCirurgia: '2026-07-15' }),
    reg({ id: 'c', dataCirurgia: '2026-07-31' }),
    reg({ id: 'd', dataCirurgia: '2026-08-01' }),
  ]

  it('inclui os dois limites do período', () => {
    const out = filtrarPorPeriodo(registros, '2026-07-01', '2026-07-31')
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('fim < início devolve vazio', () => {
    expect(filtrarPorPeriodo(registros, '2026-07-31', '2026-07-01')).toEqual([])
  })

  it('limite ausente é aberto daquele lado', () => {
    expect(filtrarPorPeriodo(registros, '2026-07-16', null).map((r) => r.id)).toEqual(['c', 'd'])
    expect(filtrarPorPeriodo(registros, null, '2026-07-01').map((r) => r.id)).toEqual(['a'])
  })

  it('registro sem dataCirurgia fica de fora', () => {
    expect(filtrarPorPeriodo([reg({ dataCirurgia: null })], null, null)).toEqual([])
  })
})

describe('filtrarAtivas — soft-cancel', () => {
  it('exclui canceladas e tolera null', () => {
    const out = filtrarAtivas([
      reg({ id: 'a' }),
      reg({ id: 'b', canceladaEm: '2026-07-20T10:00:00Z' }),
      null,
    ])
    expect(out.map((r) => r.id)).toEqual(['a'])
  })
})

describe('computeTotais', () => {
  it('soma geral e por status', () => {
    const { total, porStatus } = computeTotais([
      reg({ valor: 1000, statusPagamento: 'pendente' }),
      reg({ valor: 2000, statusPagamento: 'pago' }),
      reg({ valor: 500, statusPagamento: 'pago' }),
      reg({ valor: 300, statusPagamento: 'glosado' }),
    ])
    expect(total).toEqual({ count: 4, valor: 3800 })
    expect(porStatus.pendente).toEqual({ count: 1, valor: 1000 })
    expect(porStatus.pago).toEqual({ count: 2, valor: 2500 })
    expect(porStatus.glosado).toEqual({ count: 1, valor: 300 })
  })

  it('NUMERIC como string (supabase-js) e valor 0', () => {
    const { total, porStatus } = computeTotais([
      reg({ valor: '1234.56', statusPagamento: 'pago' }),
      reg({ valor: 0, statusPagamento: 'pendente' }),
    ])
    expect(total.valor).toBeCloseTo(1234.56)
    expect(porStatus.pago.valor).toBeCloseTo(1234.56)
    expect(porStatus.pendente).toEqual({ count: 1, valor: 0 })
  })

  it('status desconhecido conta no total mas não quebra buckets', () => {
    const { total, porStatus } = computeTotais([reg({ valor: 100, statusPagamento: 'outro' })])
    expect(total).toEqual({ count: 1, valor: 100 })
    expect(porStatus.pendente.count).toBe(0)
    expect(porStatus.pago.count).toBe(0)
    expect(porStatus.glosado.count).toBe(0)
  })

  it('lista vazia', () => {
    const { total } = computeTotais([])
    expect(total).toEqual({ count: 0, valor: 0 })
  })
})

describe('resumoPorAnestesista', () => {
  it('agrupa por nome, soma por status e ordena por total desc', () => {
    const out = resumoPorAnestesista([
      reg({ anestesistaNome: 'Ana', valor: 1000, statusPagamento: 'pago' }),
      reg({ anestesistaNome: 'Ana', valor: 500, statusPagamento: 'pendente' }),
      reg({ anestesistaNome: 'Bruno', valor: 3000, statusPagamento: 'glosado' }),
    ])
    expect(out.map((a) => a.anestesista)).toEqual(['Bruno', 'Ana'])
    expect(out[1]).toMatchObject({ count: 2, valorTotal: 1500, valorPago: 1000, valorPendente: 500, valorGlosado: 0 })
    expect(out[0]).toMatchObject({ count: 1, valorTotal: 3000, valorGlosado: 3000 })
  })

  it('nome ausente vira "—"', () => {
    expect(resumoPorAnestesista([reg({ anestesistaNome: null })])[0].anestesista).toBe('—')
  })
})

describe('parseValorBRL', () => {
  it('aceita pt-BR com milhar e decimal', () => {
    expect(parseValorBRL('1.234,56')).toBe(1234.56)
    expect(parseValorBRL('R$ 1.234,56')).toBe(1234.56)
    expect(parseValorBRL('1234,5')).toBe(1234.5)
  })

  it('aceita formato com ponto decimal e inteiro', () => {
    expect(parseValorBRL('1234.56')).toBe(1234.56)
    expect(parseValorBRL('1500')).toBe(1500)
    expect(parseValorBRL('0')).toBe(0)
  })

  it('rejeita vazio, lixo e negativo', () => {
    expect(parseValorBRL('')).toBeNull()
    expect(parseValorBRL(null)).toBeNull()
    expect(parseValorBRL('abc')).toBeNull()
    expect(parseValorBRL('12,34,56')).toBeNull()
    expect(parseValorBRL('-100')).toBeNull()
  })
})

describe('pareceIniciais — espelho do CHECK da escala', () => {
  it('iniciais retornam true', () => {
    expect(pareceIniciais('C.S.G.')).toBe(true)
    expect(pareceIniciais('C S G')).toBe(true)
    expect(pareceIniciais('MC')).toBe(true)
    expect(pareceIniciais('')).toBe(true)
    expect(pareceIniciais(null)).toBe(true)
  })

  it('nome de verdade retorna false (inclusive acentuado)', () => {
    expect(pareceIniciais('Maria Silva')).toBe(false)
    expect(pareceIniciais('João')).toBe(false)
  })
})

describe('casoImportavel — particular e não suspensa', () => {
  const caso = (overrides = {}) => ({
    convenio: 'PARTICULAR',
    statusCirurgia: 'agendada',
    statusExtra: null,
    ...overrides,
  })

  it('particular agendada/terminada importa', () => {
    expect(casoImportavel(caso())).toBe(true)
    expect(casoImportavel(caso({ statusCirurgia: 'terminada' }))).toBe(true)
  })

  it('suspensa não importa', () => {
    expect(casoImportavel(caso({ statusExtra: 'suspensa' }))).toBe(false)
  })

  it('atrasada/passa_tarde não bloqueiam', () => {
    expect(casoImportavel(caso({ statusExtra: 'atrasada' }))).toBe(true)
    expect(casoImportavel(caso({ statusExtra: 'passa_tarde' }))).toBe(true)
  })

  it('convênio normalizado: "Particular " e "particular c/ acento" importam; Unimed não', () => {
    expect(casoImportavel(caso({ convenio: 'Particular ' }))).toBe(true)
    expect(casoImportavel(caso({ convenio: 'UNIMED REGIONAL' }))).toBe(false)
    expect(casoImportavel(caso({ convenio: '' }))).toBe(false)
    expect(casoImportavel(null)).toBe(false)
  })
})

describe('constantes de status', () => {
  it('ordem canônica e labels pt-BR', () => {
    expect(STATUS_PAGAMENTO.map((s) => s.value)).toEqual(['pendente', 'pago', 'glosado'])
    expect(STATUS_LABEL.pago).toBe('Pago')
  })
})
