import { Lock, Shield } from 'lucide-react';

/**
 * Alerta com código de rastreio para acompanhamento
 * Usa styling inline para consistência com design original
 */
export function TrackingCodeAlert({ trackingCode, variant = 'error', type = 'denuncia' }) {
  if (!trackingCode) return null;

  const Icon = type === 'denuncia' ? Lock : Shield;

  // Cores baseadas no variant/type
  const colors = {
    error: {
      bg: 'bg-[#FEE2E2] dark:bg-[#7F1D1D]/20',
      border: 'border-[#EF4444]/30',
      iconColor: '#EF4444',
      iconColorDark: '#F87171',
      labelColor: 'text-[#B91C1C] dark:text-destructive',
      codeColor: 'text-[#991B1B] dark:text-[#FCA5A5]',
      hintColor: 'text-destructive dark:text-destructive',
    },
    warning: {
      bg: 'bg-[#FEF3C7] dark:bg-[#78350F]/20',
      border: 'border-warning/30',
      iconColor: '#92400E',
      iconColorDark: '#FBBF24',
      labelColor: 'text-[#92400E] dark:text-warning',
      codeColor: 'text-[#92400E] dark:text-warning',
      hintColor: 'text-[#D97706] dark:text-warning',
    },
  };

  const colorConfig = colors[variant] || colors.error;

  const description = type === 'denuncia'
    ? 'Guarde este código para acompanhar o andamento da sua denúncia'
    : 'Use este código para acompanhar o andamento do seu relato';

  return (
    <div className={`p-3 rounded-xl ${colorConfig.bg} border ${colorConfig.border} mb-4`}>
      <div className="flex items-center gap-2">
        <Icon
          className="w-4 h-4"
          style={{ color: colorConfig.iconColor }}
        />
        <span className={`text-xs ${colorConfig.labelColor}`}>
          Código de rastreio
        </span>
      </div>
      <p className={`text-base font-mono font-bold mt-1 ${colorConfig.codeColor}`}>
        {trackingCode}
      </p>
      <p className={`text-xs mt-1 ${colorConfig.hintColor}`}>
        {description}
      </p>
    </div>
  );
}
