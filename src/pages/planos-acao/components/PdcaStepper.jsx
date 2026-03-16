/**
 * PdcaStepper - Stepper PDCA reutilizavel
 * Layout simétrico: circulos centrados, labels abaixo, conectores no meio
 */
import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'
import { PDCA_PHASES, PDCA_PHASE_ORDER } from '@/data/planosAcaoConfig'

export default function PdcaStepper({ currentPhase, onPhaseClick, className }) {
  const currentIndex = PDCA_PHASE_ORDER.indexOf(currentPhase)
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0

  return (
    <div className={cn('flex items-start', className)}>
      {PDCA_PHASE_ORDER.map((phaseId, idx) => {
        const phase = PDCA_PHASES[phaseId]
        const Icon = phase.icon
        const isCompleted = idx < effectiveIndex
        const isCurrent = idx === effectiveIndex
        const canClick = Boolean(onPhaseClick) && idx <= effectiveIndex

        const circleEl = (
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
              isCompleted && 'bg-primary text-primary-foreground',
              isCurrent && 'border-2 border-primary text-primary',
              !isCompleted && !isCurrent && 'border-2 border-border text-muted-foreground'
            )}
          >
            {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
          </div>
        )

        return (
          <Fragment key={phaseId}>
            <div className="flex flex-col items-center">
              {canClick ? (
                <button
                  type="button"
                  onClick={() => onPhaseClick(phaseId)}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {circleEl}
                </button>
              ) : (
                circleEl
              )}
              <span
                className={cn(
                  'text-[11px] mt-1.5 font-medium text-center',
                  isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {phase.shortLabel}
              </span>
            </div>

            {idx < PDCA_PHASE_ORDER.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mt-5',
                  isCompleted ? 'bg-primary' : 'bg-border'
                )}
                aria-hidden="true"
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
