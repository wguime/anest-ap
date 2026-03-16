import { ChevronLeft } from 'lucide-react';

export default function PageHeader({ title, onBack, rightContent }) {
  if (!onBack && !title && !rightContent) {
    return null;
  }

  return (
    <>
      {/* Header Fixo - usando mesma estrutura do BottomNav que funciona */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm"
      >
        <div className="px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between">
            {/* Botão Voltar */}
            <div className="min-w-[70px]">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Voltar</span>
                </button>
              )}
            </div>

            {/* Título Centralizado */}
            {title && (
              <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
                {title}
              </h1>
            )}

            {/* Espaço direito */}
            <div className="min-w-[70px] flex justify-end">
              {rightContent}
            </div>
          </div>
        </div>
      </nav>

      {/* Espaçador */}
      <div className="h-14" aria-hidden="true" />
    </>
  );
}
