/**
 * Estado de erro quando o relato não é encontrado
 * Usa styling inline para consistência com design original
 */
export function TrackingNotFound({ theme, onBack }) {
  const Icon = theme.Icon;

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] flex items-center justify-center">
      <div className="text-center px-4">
        <Icon className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-2">
          {theme.notFoundTitle}
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-4">
          {theme.notFoundDescription}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="font-medium"
          style={{ color: theme.primaryColor }}
        >
          Voltar para Meus Relatos
        </button>
      </div>
    </div>
  );
}
