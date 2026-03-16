import React, { Suspense, useState, useEffect } from 'react'

// Lazy load the entire chart module
const chartPromise = import('./chart')
let resolvedModule = null
chartPromise.then(m => { resolvedModule = m })

function useLazyModule() {
  const [mod, setMod] = useState(resolvedModule)
  useEffect(() => {
    if (!mod) chartPromise.then(m => { resolvedModule = m; setMod(m) })
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
