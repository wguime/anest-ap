/**
 * getFeriasDoAno + cache com TTL por chave (pegaPlantaoApi).
 * fetch stubado no formato do proxy pegaplantao-proxy; getSupabaseToken
 * vem mockado do setup global.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getFeriasDoAno, clearCache } from '@/services/pegaPlantaoApi'

const plantaoFerias = (nome, dataISO) => ({
  CodigoPlantao: `${nome}-${dataISO}`,
  Setor: 'Férias',
  ProfDePlantao: nome,
  Inicio: `${dataISO}T07:00:00`,
  Fim: `${dataISO}T19:00:00`,
})

const plantaoComum = (nome, dataISO) => ({
  CodigoPlantao: `p-${nome}-${dataISO}`,
  Setor: 'ANESTESIA CHAPECO - 1 - P1',
  ProfDePlantao: nome,
  Inicio: `${dataISO}T19:00:00`,
})

describe('getFeriasDoAno', () => {
  let chamadas

  beforeEach(() => {
    clearCache()
    chamadas = []
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body)
      chamadas.push(body.endpoint)
      // mês vem do filtro.dataInicio=YYYY-MM-01T00:00:00 no endpoint
      const mes = decodeURIComponent(body.endpoint).match(/dataInicio=\d{4}-(\d{2})-01/)?.[1]
      const payload = mes === '01'
        ? [plantaoFerias('G. Melo', '2026-01-05'), plantaoComum('Outro', '2026-01-05')]
        : mes === '02'
          ? [plantaoFerias('G. Melo', '2026-01-05'), plantaoFerias('Raquel Schneider', '2026-02-02')] // duplicado cross-mês
          : []
      return { ok: true, json: async () => payload }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCache()
  })

  it('varre 12 meses, filtra Setor férias e deduplica por CodigoPlantao', async () => {
    const registros = await getFeriasDoAno(2026)
    expect(chamadas).toHaveLength(12)
    expect(registros).toHaveLength(2) // duplicado de janeiro não repete; plantão comum fora
    expect(registros.map((r) => r.CodigoPlantao).sort()).toEqual([
      'G. Melo-2026-01-05',
      'Raquel Schneider-2026-02-02',
    ])
  })

  it('cacheia o agregado por 30min (2ª chamada não bate na rede)', async () => {
    await getFeriasDoAno(2026)
    const chamadasAposPrimeira = chamadas.length
    await getFeriasDoAno(2026)
    expect(chamadas.length).toBe(chamadasAposPrimeira)
  })

  it('TTL de 30min expira depois (e o TTL por chave não vaza para outras chaves)', async () => {
    vi.useFakeTimers()
    try {
      await getFeriasDoAno(2026)
      const antes = chamadas.length
      vi.advanceTimersByTime(29 * 60 * 1000)
      await getFeriasDoAno(2026)
      expect(chamadas.length).toBe(antes) // 29min: ainda em cache (TTL default seria 5min)
      vi.advanceTimersByTime(2 * 60 * 1000)
      await getFeriasDoAno(2026)
      expect(chamadas.length).toBe(antes + 12) // 31min: expirou, revarre
    } finally {
      vi.useRealTimers()
    }
  })

  it('erro em qualquer mês propaga (sem fallback mock)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })))
    await expect(getFeriasDoAno(2026)).rejects.toThrow()
  })
})
