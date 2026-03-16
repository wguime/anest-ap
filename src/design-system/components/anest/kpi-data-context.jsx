import * as React from "react"

/**
 * KPIDataContext - Contexto para gerenciar dados dos KPIs
 *
 * Permite armazenar, editar e persistir dados dos indicadores de qualidade.
 * Os dados são salvos no localStorage para persistência entre sessões.
 *
 * @example
 * // Provedor no app
 * <KPIDataProvider>
 *   <App />
 * </KPIDataProvider>
 *
 * // Consumir dados
 * const { kpis, updateKPI, getKPI } = useKPIData()
 */

const DEFAULT_STORAGE_KEY = "anest-kpi-data"

// Labels dos meses (12 meses)
const MESES_LABELS_DEFAULT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

// Dados iniciais dos KPIs (exemplo baseado no painel de qualidade)
const defaultKPIs = [
  {
    id: "taxa-infeccao",
    titulo: "Taxa de Infecção Hospitalar",
    valor: 3.2,
    meta: 3.0,
    metaLabel: "≤3%",
    unidade: "%",
    periodo: "Novembro",
    accentColor: "red",
    isLowerBetter: true,
    historico: [2.8, 3.1, 2.9, 3.0, 3.2, 2.7, 3.1, 2.9, 3.2, null, null, null],
    mesesLabels: MESES_LABELS_DEFAULT,
  },
  {
    id: "satisfacao-paciente",
    titulo: "Satisfação do Paciente",
    valor: 92.5,
    meta: 90,
    metaLabel: "≥90%",
    unidade: "%",
    periodo: "Novembro",
    accentColor: "green",
    isLowerBetter: false,
    historico: [88, 89, 91, 90, 92, 91, 93, 92, 92.5, null, null, null],
    mesesLabels: MESES_LABELS_DEFAULT,
  },
  {
    id: "adesao-checklist",
    titulo: "Adesão ao Checklist Cirúrgico",
    valor: 97.8,
    meta: 95,
    metaLabel: "≥95%",
    unidade: "%",
    periodo: "Novembro",
    accentColor: "blue",
    isLowerBetter: false,
    historico: [94, 95, 96, 95, 97, 96, 98, 97, 97.8, null, null, null],
    mesesLabels: MESES_LABELS_DEFAULT,
  },
  {
    id: "tempo-espera",
    titulo: "Tempo Médio de Espera",
    valor: 18,
    meta: 20,
    metaLabel: "≤20min",
    unidade: "min",
    periodo: "Novembro",
    accentColor: "orange",
    isLowerBetter: true,
    historico: [22, 21, 20, 19, 18, 19, 18, 17, 18, null, null, null],
    mesesLabels: MESES_LABELS_DEFAULT,
  },
  {
    id: "higiene-maos",
    titulo: "Adesão à Higiene das Mãos",
    valor: 85,
    meta: 90,
    metaLabel: "≥90%",
    unidade: "%",
    periodo: "Novembro",
    accentColor: "purple",
    isLowerBetter: false,
    historico: [82, 83, 84, 85, 84, 86, 85, 84, 85, null, null, null],
    mesesLabels: MESES_LABELS_DEFAULT,
  },
  {
    id: "eventos-adversos",
    titulo: "Eventos Adversos",
    valor: 1.2,
    meta: 2.0,
    metaLabel: "≤2%",
    unidade: "%",
    periodo: "Novembro",
    accentColor: "cyan",
    isLowerBetter: true,
    historico: [1.5, 1.3, 1.4, 1.2, 1.1, 1.3, 1.2, 1.1, 1.2, null, null, null],
    mesesLabels: MESES_LABELS_DEFAULT,
  },
]

// Context
const KPIDataContext = React.createContext(null)

// Provider
export function KPIDataProvider({ children, initialData, storageKey = DEFAULT_STORAGE_KEY }) {
  // Ref para armazenar initialData para uso no resetToDefault
  const initialDataRef = React.useRef(initialData)

  const [kpis, setKPIs] = React.useState(() => {
    // Tenta carregar do localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          console.error("Erro ao carregar KPIs do localStorage:", e)
        }
      }
    }
    return initialData || defaultKPIs
  })

  // Persiste no localStorage quando os dados mudam
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(kpis))
    }
  }, [kpis, storageKey])

  // Buscar KPI por ID
  const getKPI = React.useCallback(
    (id) => kpis.find((kpi) => kpi.id === id),
    [kpis]
  )

  // Atualizar um KPI específico
  const updateKPI = React.useCallback((id, updates) => {
    setKPIs((prev) =>
      prev.map((kpi) =>
        kpi.id === id ? { ...kpi, ...updates } : kpi
      )
    )
  }, [])

  // Adicionar novo KPI
  const addKPI = React.useCallback((newKPI) => {
    const id = newKPI.id || `kpi-${Date.now()}`
    setKPIs((prev) => [...prev, { ...newKPI, id }])
    return id
  }, [])

  // Remover KPI
  const removeKPI = React.useCallback((id) => {
    setKPIs((prev) => prev.filter((kpi) => kpi.id !== id))
  }, [])

  // Resetar para dados padrão (usa initialData se fornecido)
  const resetToDefault = React.useCallback(() => {
    setKPIs(initialDataRef.current || defaultKPIs)
  }, [])

  // Atualizar valor histórico
  const updateHistorico = React.useCallback((id, index, value) => {
    setKPIs((prev) =>
      prev.map((kpi) => {
        if (kpi.id !== id) return kpi
        const newHistorico = [...kpi.historico]
        newHistorico[index] = value
        return { ...kpi, historico: newHistorico }
      })
    )
  }, [])

  // Adicionar novo mês ao histórico
  const addHistoricoMonth = React.useCallback((id, mes, valor) => {
    setKPIs((prev) =>
      prev.map((kpi) => {
        if (kpi.id !== id) return kpi
        return {
          ...kpi,
          historico: [...kpi.historico, valor],
          mesesLabels: [...kpi.mesesLabels, mes],
        }
      })
    )
  }, [])

  const value = React.useMemo(
    () => ({
      kpis,
      getKPI,
      updateKPI,
      addKPI,
      removeKPI,
      resetToDefault,
      updateHistorico,
      addHistoricoMonth,
    }),
    [kpis, getKPI, updateKPI, addKPI, removeKPI, resetToDefault, updateHistorico, addHistoricoMonth]
  )

  return (
    <KPIDataContext.Provider value={value}>
      {children}
    </KPIDataContext.Provider>
  )
}

// Hook para consumir o contexto
export function useKPIData() {
  const context = React.useContext(KPIDataContext)
  if (!context) {
    throw new Error("useKPIData deve ser usado dentro de um KPIDataProvider")
  }
  return context
}

// Export default KPIs for reference
export { defaultKPIs }
