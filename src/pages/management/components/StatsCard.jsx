import React from 'react'
import { Card, CardContent } from '@/design-system'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

/**
 * StatsCard - Statistics card component for displaying metrics
 *
 * @param {string|number} value - The main statistic value to display
 * @param {string} label - Label/description for the statistic
 * @param {React.Component} icon - Lucide icon component to display
 * @param {string} color - Hex color for the icon background (e.g., '#006837')
 * @param {Object} trend - Optional trend indicator: { value: string|number, positive: boolean }
 * @param {string} className - Additional CSS classes
 */
function StatsCard({
  value,
  label,
  icon: Icon,
  color = '#006837',
  trend,
  className
}) {
  // Generate lighter background color from the main color
  const getBgColor = (hexColor) => {
    return `${hexColor}15` // 15 is hex for ~8% opacity
  }

  return (
    <Card className={cn(
      'bg-white dark:bg-[#1A2420]',
      'border border-[#C8E6C9] dark:border-[#2A3F36]',
      'rounded-2xl shadow-sm',
      'hover:shadow-md transition-shadow duration-200',
      'overflow-hidden',
      className
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Value */}
            <div className="flex items-baseline gap-2">
              <span className={cn(
                'text-3xl font-bold tracking-tight',
                'text-gray-900 dark:text-white'
              )}>
                {value}
              </span>

              {/* Trend Indicator */}
              {trend && (
                <div className={cn(
                  'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium',
                  trend.positive
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                )}>
                  {trend.positive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{trend.value}</span>
                </div>
              )}
            </div>

            {/* Label */}
            <p className={cn(
              'mt-1 text-sm font-medium leading-tight',
              'text-[#6B7280] dark:text-[#A3B8B0]'
            )}>
              {label}
            </p>
          </div>

          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                'flex-shrink-0 p-3 rounded-xl',
                'transition-transform duration-200 hover:scale-105'
              )}
              style={{
                backgroundColor: getBgColor(color),
                color: color
              }}
            >
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default StatsCard
