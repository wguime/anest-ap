import { CheckCircle2 } from 'lucide-react';

/**
 * Seção de conclusão do relato
 * Usa styling inline consistente com design original
 */
export function TrackingConclusion({ conclusion, variant = 'success' }) {
  if (!conclusion) return null;

  // Cores baseadas no variant
  const colors = {
    success: {
      bg: 'bg-success/10 dark:bg-success/20',
      border: 'border-success/30',
      title: 'text-success',
      text: 'text-success',
      icon: '#059669',
    },
    error: {
      bg: 'bg-destructive/10 dark:bg-destructive/20',
      border: 'border-destructive/30',
      title: 'text-destructive',
      text: 'text-destructive',
      icon: '#EF4444',
    },
  };

  const colorConfig = colors[variant] || colors.success;

  return (
    <div className={`rounded-2xl p-4 border mb-4 ${colorConfig.bg} ${colorConfig.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-4 h-4" style={{ color: colorConfig.icon }} />
        <h3 className={`text-sm font-semibold ${colorConfig.title}`}>
          Conclusão
        </h3>
      </div>
      <p className={`text-sm ${colorConfig.text}`}>
        {conclusion}
      </p>
    </div>
  );
}
