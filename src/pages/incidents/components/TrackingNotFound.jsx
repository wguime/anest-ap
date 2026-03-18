/**
 * Estado de erro quando o relato não é encontrado
 * Usa styling inline para consistência com design original
 */
export function TrackingNotFound({ theme, onBack }) {
  const Icon = theme.Icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center px-4">
        <Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {theme.notFoundTitle}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
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
