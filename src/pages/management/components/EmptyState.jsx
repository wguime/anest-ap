import React from 'react'
import { Plus } from 'lucide-react'
import { Card, CardContent, Button } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

/**
 * EmptyState — Shared empty state component used across management UI.
 *
 * Visual: large icon (token color), heading, description, optional CTA button.
 * Color uses token-based classes (no hardcoded hex).
 *
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {string} title - Heading
 * @param {string} description - Subtext
 * @param {string} [actionLabel] - Optional CTA label
 * @param {function} [onAction] - Optional CTA callback
 * @param {string} [iconColorClass] - Tailwind text color class for icon (defaults to text-primary)
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconColorClass = 'text-primary',
}) {
  return (
    <Card className="bg-card border border-border rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          {Icon ? <Icon className={cn('w-8 h-8', iconColorClass)} /> : null}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            className={cn(
              'flex items-center gap-2',
              'bg-primary hover:bg-primary/90 text-white',
              'rounded-xl px-4 py-2.5'
            )}
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default EmptyState
