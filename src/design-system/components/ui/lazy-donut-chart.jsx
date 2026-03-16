import React, { Suspense } from 'react'

const LazyDonutChart = React.lazy(() => import('./donut-chart').then(m => ({ default: m.DonutChart })))
// Re-export COLOR_PALETTE synchronously (it's just data, not a component)
export { COLOR_PALETTE } from './donut-chart'

export function DonutChart(props) {
  return (
    <Suspense fallback={<div style={{ minHeight: props.size === 'sm' ? 160 : props.size === 'lg' ? 240 : 200 }} className="flex items-center justify-center"><div className="animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" style={{ width: props.size === 'sm' ? 160 : props.size === 'lg' ? 240 : 200, height: props.size === 'sm' ? 160 : props.size === 'lg' ? 240 : 200 }} /></div>}>
      <LazyDonutChart {...props} />
    </Suspense>
  )
}
