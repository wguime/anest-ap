/**
 * PanelShell - Container padrão para painéis com scroll
 * 
 * Garante scroll perfeito sem "pixel mágico"
 * Estrutura flex com header fixo, conteúdo scrollável e footer fixo
 */

import { Card } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';

export function PanelShell({ header, footer, children, className }) {
  return (
    <Card 
      className={cn(
        "flex flex-col h-full min-h-0 min-w-0 overflow-hidden",
        className
      )}
    >
      {header && (
        <div className="flex-shrink-0 border-b border-border p-4">
          {header}
        </div>
      )}
      
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4">
          {children}
        </div>
      </div>
      
      {footer && (
        <div className="flex-shrink-0 border-t border-border bg-background p-4">
          {footer}
        </div>
      )}
    </Card>
  );
}
