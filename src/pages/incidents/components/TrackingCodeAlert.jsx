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
      bg: 'bg-destructive/10 dark:bg-destructive/20',
      border: 'border-destructive/30',
      iconColor: '#EF4444',
      iconColorDark: '#F87171',
      labelColor: 'text-destructive',
      codeColor: 'text-destructive',
      hintColor: 'text-destructive',
    },
    warning: {
      bg: 'bg-warning/10 dark:bg-warning/20',
      border: 'border-warning/30',
      iconColor: '#92400E',
      iconColorDark: '#FBBF24',
      labelColor: 'text-warning',
      codeColor: 'text-warning',
      hintColor: 'text-warning',
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
