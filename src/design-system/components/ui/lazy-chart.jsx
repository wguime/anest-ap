import React, { Suspense, useState, useEffect } from 'react'

// Lazy load the entire chart module — no PRIMEIRO uso, não no carregamento do
// módulo. O `import('./chart')` no topo rodava assim que o barrel do DS era
// avaliado, ou seja, em toda abertura do app: recharts (~93 KB) baixado e
// executado no boot sem nenhum gráfico na tela (medido em produção, 15/10/2026).
let chartPromise = null
let resolvedModule = null
const carregarChart = () => {
  if (!chartPromise) {
    chartPromise = import('./chart').then(
      m => { resolvedModule = m; return m },
      // chunk que não veio (rede/deploy): o gráfico fica vazio e o próximo uso tenta de novo
      () => { chartPromise = null; return null },
    )
  }
  return chartPromise
}

function useLazyModule() {
  const [mod, setMod] = useState(resolvedModule)
  useEffect(() => {
    if (!mod) carregarChart().then(m => { if (m) setMod(m) })
  }, [mod])
  return mod
}

export const ChartContainer = React.forwardRef(function ChartContainer(props, ref) {
  const mod = useLazyModule()
  if (!mod) return <div className="flex aspect-video justify-center" />
  return <mod.ChartContainer ref={ref} {...props} />
})

export function ChartTooltip(props) {
  const mod = useLazyModule()
  if (!mod) return null
  return <mod.ChartTooltip {...props} />
}

export function ChartTooltipContent(props) {
  const mod = useLazyModule()
  if (!mod) return null
  const Comp = mod.ChartTooltipContent
  return <Comp {...props} />
}

export function ChartLegend(props) {
  const mod = useLazyModule()
  if (!mod) return null
  return <mod.ChartLegend {...props} />
}

export function ChartLegendContent(props) {
  const mod = useLazyModule()
  if (!mod) return null
  const Comp = mod.ChartLegendContent
  return <Comp {...props} />
}

export function ChartStyle(props) {
  const mod = useLazyModule()
  if (!mod) return null
  return <mod.ChartStyle {...props} />
}
