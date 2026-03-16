/**
 * Lista de badges de classificação (tipo, gravidade, etc)
 * Usa styling inline para consistência com design original
 */
export function TrackingBadges({ badges = [] }) {
  if (!badges || badges.length === 0) return null;

  // Mapear variant para cores
  const variantColors = {
    secondary: {
      bg: 'bg-[#F3F4F6] dark:bg-[#243530]',
      text: 'text-[#111827] dark:text-white',
    },
    success: {
      bg: 'bg-[#D1FAE5] dark:bg-[#065F46]/30',
      text: 'text-[#059669]',
    },
    warning: {
      bg: 'bg-[#FEF3C7] dark:bg-[#92400E]/30',
      text: 'text-[#D97706]',
    },
    destructive: {
      bg: 'bg-[#FEE2E2] dark:bg-[#991B1B]/30',
      text: 'text-[#DC2626]',
    },
    info: {
      bg: 'bg-[#DBEAFE] dark:bg-[#1E40AF]/30',
      text: 'text-[#2563EB]',
    },
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        const colors = variantColors[badge.variant] || variantColors.secondary;

        return (
          <span
            key={index}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {Icon && <Icon className="w-3 h-3" />}
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
