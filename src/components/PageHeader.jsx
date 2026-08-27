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
      {/* deitado: 44px no lugar de 56 (dono 26/08). Na horizontal a altura é o
          que falta — a moldura fixa (header 56 + barra 72) comia 128px de 390 —,
          e o header continua com alvo de toque de 44px, que é o piso. */}
      <div className="px-4 sm:px-5 h-14 deitado:h-11 flex items-center">
        <div className="flex items-center justify-between w-full">
          {/* Botão Voltar */}
          <div className="min-w-[70px] deitado:min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px] deitado:min-h-[40px] deitado:pr-1"
                aria-label={backLabel}
              >
                <ChevronLeft className="w-5 h-5" />
                {/* deitado: fica só a seta — o rótulo custa ~55px de largura em
                    cada uma das 137 páginas e o ícone sozinho já é o padrão de
                    voltar. O `aria-label` continua dizendo "Voltar". */}
                <span className="text-sm font-medium deitado:hidden">{backLabel}</span>
              </button>
            )}
          </div>

          {/* Título (+ subtitle opcional) centralizado */}
          <div className="flex-1 mx-2 min-w-0 text-center">
            {title && (
              <h1 className="text-base deitado:text-[15px] font-semibold text-foreground truncate">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs deitado:text-[11px] text-muted-foreground truncate -mt-0.5 deitado:-mt-1">
                {subtitle}
              </p>
            )}
          </div>

          {/* Slot direito (actions ou rightContent) */}
          <div className="min-w-[70px] deitado:min-w-0 flex justify-end">
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
      <div className="h-14 deitado:h-11" aria-hidden="true" />
    </>
  );
}
