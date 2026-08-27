import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';

export default function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Voltar',
  rightContent,
  actions,
  usePortal = true,
  className,
}) {
  const right = actions ?? rightContent;
  if (!onBack && !title && !subtitle && !right) {
    return null;
  }

  const header = (
    <nav
      className={[
        'fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm' +
        // deitado: a faixa de navegação ocupa os 76px da esquerda
        ' deitado:left-[76px]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="px-4 sm:px-5 h-14 flex items-center">
        <div className="flex items-center justify-between w-full">
          {/* Botão Voltar */}
          <div className="min-w-[70px]">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px]"
                aria-label={backLabel}
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">{backLabel}</span>
              </button>
            )}
          </div>

          {/* Título (+ subtitle opcional) centralizado */}
          <div className="flex-1 mx-2 min-w-0 text-center">
            {title && (
              <h1 className="text-base font-semibold text-foreground truncate">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate -mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          {/* Slot direito (actions ou rightContent) */}
          <div className="min-w-[70px] flex justify-end">
            {right}
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {usePortal && typeof document !== 'undefined'
        ? createPortal(header, document.body)
        : header}
      {/* Header é position:fixed (portal ou não), spacer sempre necessário */}
      <div className="h-14" aria-hidden="true" />
    </>
  );
}
