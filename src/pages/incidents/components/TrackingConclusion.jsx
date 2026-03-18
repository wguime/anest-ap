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
      bg: 'bg-muted dark:bg-[#0D2818]',
      border: 'border-[#A7F3D0] dark:border-[#065F46]',
      title: 'text-[#047857] dark:text-[#6EE7B7]',
      text: 'text-[#047857] dark:text-[#6EE7B7]',
      icon: '#059669',
    },
    error: {
      bg: 'bg-[#FEE2E2] dark:bg-[#7F1D1D]/20',
      border: 'border-[#EF4444]/30',
      title: 'text-[#991B1B] dark:text-[#FCA5A5]',
      text: 'text-[#B91C1C] dark:text-destructive',
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
