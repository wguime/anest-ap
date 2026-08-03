import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectedColumns = []

function queryResult() {
  const chain = {
    select: vi.fn((columns) => {
      selectedColumns.push(columns)
      return chain
    }),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve) => resolve({ data: [], error: null }),
  }
  return chain
}

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => queryResult()),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}))

const { default: service } = await import('@/services/supabaseIncidentsService')

describe('supabaseIncidentsService — campos necessários no Centro de Gestão', () => {
  beforeEach(() => {
    selectedColumns.length = 0
  })

  it.each([
    ['incidentes', () => service.fetchIncidentes()],
    ['denúncias', () => service.fetchDenuncias()],
  ])('carrega identidade e anexos na listagem de %s', async (_label, fetchList) => {
    await fetchList()

    expect(selectedColumns).toHaveLength(1)
    const columns = selectedColumns[0].split(',')
    expect(columns).toEqual(expect.arrayContaining([
      'notificante',
      'denunciante',
      'attachments',
    ]))
  })
})
