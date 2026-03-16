/**
 * CascadeSummary.jsx
 * Componente que mostra o resumo das entidades criadas no fluxo cascata
 */

import {
  Badge,
} from '@/design-system';
import {
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Check,
  Clock,
  Link2,
  Plus,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';

const STEP_CONFIG = {
  trilha: {
    label: 'Trilha',
    icon: GitBranch,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  treinamento: {
    label: 'Treinamento',
    icon: BookOpen,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  modulo: {
    label: 'Módulo',
    icon: FolderOpen,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  aula: {
    label: 'Aula',
    icon: Video,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
};

const STEPS = ['trilha', 'treinamento', 'modulo', 'aula'];

export function CascadeSummary({
  createdEntities = {},
  currentStep,
  onStepClick,
}) {
  return (
    <div className="space-y-3">
      {STEPS.map((step, index) => {
        const config = STEP_CONFIG[step];
        const Icon = config.icon;
        const entity = createdEntities[step];
        const isCompleted = !!entity;
        const isCurrent = currentStep === step;
        const isPast = STEPS.indexOf(currentStep) > index;
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div
            key={step}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-all",
              isCompleted && "bg-card border-border",
              isCurrent && !isCompleted && "bg-primary/5 border-primary",
              isFuture && "opacity-50 bg-muted/30 border-dashed border-border"
            )}
          >
            {/* Ícone com status */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              isCompleted ? "bg-success/10" : config.bgColor
            )}>
              {isCompleted ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Icon className={cn("w-4 h-4", config.color)} />
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  "text-sm font-medium",
                  isFuture && "text-muted-foreground"
                )}>
                  {config.label}
                </p>
                {entity?._mode && (
                  <Badge 
                    variant="secondary" 
                    badgeStyle="subtle" 
                    className="text-[10px]"
                  >
                    {entity._mode === 'create' ? (
                      <><Plus className="w-3 h-3 mr-0.5" /> Novo</>
                    ) : (
                      <><Link2 className="w-3 h-3 mr-0.5" /> Anexado</>
                    )}
                  </Badge>
                )}
              </div>

              {entity ? (
                <div>
                  <p className="text-sm truncate">{entity.titulo}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {entity.id}
                  </p>
                </div>
              ) : isCurrent ? (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Em andamento...
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pendente
                </p>
              )}
            </div>

            {/* Botão de editar (para itens completos) */}
            {isCompleted && isPast && onStepClick && (
              <button
                type="button"
                onClick={() => onStepClick(step)}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Editar
              </button>
            )}
          </div>
        );
      })}

      {/* Linha de conexão visual */}
      <div className="relative -mt-3 pt-3 pl-4">
        <div 
          className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border"
          style={{ height: 'calc(100% - 32px)', top: '-100%' }}
        />
      </div>
    </div>
  );
}

export default CascadeSummary;
