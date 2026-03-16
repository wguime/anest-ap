/**
 * useKpiData - Hook para dados reais dos KPIs
 *
 * Merge metadados estáticos (indicadores-2025.js) com dados dinâmicos (Supabase).
 *
 * Retorna:
 * - indicadores: array com metadados + dados mensais + status
 * - dados: dados brutos do Supabase
 * - summary: estatísticas gerais (conformes, não-conformes, score)
 * - loading, error: estados de carregamento
 * - upsertDado, validateDado: funções para mutação
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { indicadores2025, parseMeta, evaluateStatus, calcularMedia } from '@/data/indicadores-2025'
import supabaseKpiService from '@/services/supabaseKpiService'

/**
 * Hook principal para gerenciar dados dos KPIs
 *
 * @param {Object} options - { ano, indicadorId }
 * @returns {Object} { indicadores, dados, summary, loading, error, upsertDado, validateDado }
 */
export function useKpiData(options = {}) {
  const { ano = 2025, indicadorId = null } = options

  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ============================================================================
  // CARREGAMENTO INICIAL + REAL-TIME
  // ============================================================================

  useEffect(() => {
    let channel = null

    async function load() {
      try {
        setLoading(true)
        const data = await supabaseKpiService.fetchKpiData({ ano, indicadorId })
        setDados(data)
        setError(null)
      } catch (err) {
        console.error('[useKpiData] Error loading:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()

    // Real-time subscription
    channel = supabaseKpiService.subscribeToKpiChanges(({ eventType, new: newRow, old: oldRow }) => {
      if (!newRow) return

      // Filtrar por ano/indicadorId se aplicável
      if (ano && newRow.ano !== ano) return
      if (indicadorId && newRow.indicadorId !== indicadorId) return

      setDados(prev => {
        if (eventType === 'DELETE') {
          return prev.filter(d => d.id !== oldRow?.id)
        }

        const exists = prev.find(d => d.id === newRow.id)
        if (exists) {
          // UPDATE
          return prev.map(d => (d.id === newRow.id ? newRow : d))
        } else {
          // INSERT
          return [...prev, newRow]
        }
      })
    })

    return () => {
      if (channel) supabaseKpiService.unsubscribe(channel)
    }
  }, [ano, indicadorId])

  // ============================================================================
  // MERGE METADADOS + DADOS
  // ============================================================================

  const indicadoresComDados = useMemo(() => {
    return indicadores2025.map(ind => {
      // Filtrar dados mensais para este indicador + ano
      const dadosMensais = dados.filter(d => d.indicadorId === ind.id && d.ano === ano)

      // Parse meta
      const meta = parseMeta(ind.metaLabel)

      // Build array de meses (1-12), usando dados do Supabase ou fallback para static
      const meses = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const dado = dadosMensais.find(d => d.mes === mes)
        if (dado) return dado.valor
        // Fallback para dados estáticos se disponíveis
        return ind.meses[i] ?? null
      })

      // Calcular média e último valor
      const valoresValidos = meses.filter(v => v !== null && v !== undefined)
      const media = valoresValidos.length > 0 ? calcularMedia(valoresValidos) : null
      const ultimoValor = valoresValidos.length > 0 ? valoresValidos[valoresValidos.length - 1] : null

      // Avaliar status atual
      const statusAtual = ultimoValor !== null ? evaluateStatus(ultimoValor, meta, ind.unidade, ind.tolerancia) : null

      // Meses detalhados com informações de validação
      const mesesDetalhados = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const dado = dadosMensais.find(d => d.mes === mes)

        return {
          mes,
          valor: dado?.valor ?? ind.meses[i] ?? null,
          numerador: dado?.numerador ?? null,
          denominador: dado?.denominador ?? null,
          observacao: dado?.observacao ?? null,
          fonte: dado?.fonte ?? null,
          validado: dado?.validado ?? false,
          validadoPor: dado?.validadoPorNome ?? null,
          validadoEm: dado?.validadoEm ?? null,
          hasData: !!dado, // true se tem dado real (Supabase/mock)
          dadoId: dado?.id ?? null,
        }
      })

      // Compute tendencia from last 2 non-null values
      let tendencia = null
      if (valoresValidos.length >= 2) {
        const curr = valoresValidos[valoresValidos.length - 1]
        const prev = valoresValidos[valoresValidos.length - 2]
        const diff = curr - prev
        if (Math.abs(diff) < 0.01) tendencia = 'stable'
        else if (diff > 0) tendencia = meta?.direction === 'lower' ? 'down_bad' : 'up'
        else tendencia = meta?.direction === 'lower' ? 'up_good' : 'down'
      }

      return {
        ...ind,
        meta,
        meses,
        mesesDetalhados,
        media,
        ultimoValor,
        statusAtual,
        tendencia,
        totalColetados: dadosMensais.length,
        totalValidados: dadosMensais.filter(d => d.validado).length,
      }
    })
  }, [dados, ano])

  // ============================================================================
  // MUTAÇÕES
  // ============================================================================

  /**
   * Insere ou atualiza dado mensal
   */
  const upsertDado = useCallback(async (data) => {
    return await supabaseKpiService.upsertKpiDado(data)
  }, [])

  /**
   * Valida dado mensal
   */
  const validateDado = useCallback(async (id, validadorInfo) => {
    return await supabaseKpiService.validateKpiDado(id, validadorInfo)
  }, [])

  // ============================================================================
  // ESTATÍSTICAS GERAIS
  // ============================================================================

  const summary = useMemo(() => {
    const total = indicadoresComDados.length
    const conformes = indicadoresComDados.filter(i => i.statusAtual?.variant === 'success').length
    const parciais = indicadoresComDados.filter(i => i.statusAtual?.variant === 'warning').length
    const naoConformes = indicadoresComDados.filter(i => i.statusAtual?.variant === 'destructive').length
    const semDados = indicadoresComDados.filter(i => !i.statusAtual).length

    // Score geral (% de conformes sobre total com dados)
    const totalComDados = total - semDados
    const scoreGeral = totalComDados > 0 ? Math.round(((conformes + parciais * 0.5) / totalComDados) * 100) : 0

    return {
      total,
      conformes,
      parciais,
      naoConformes,
      semDados,
      scoreGeral,
    }
  }, [indicadoresComDados])

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    indicadores: indicadoresComDados,
    dados,
    summary,
    loading,
    error,
    upsertDado,
    validateDado,
  }
}

export default useKpiData
