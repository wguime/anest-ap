/**
 * Lista de badges de classificação (tipo, gravidade, etc)
 * Usa styling inline para consistência com design original
 */
export function TrackingBadges({ badges = [] }) {
  if (!badges || badges.length === 0) return null;

  // Mapear variant para cores
  const variantColors = {
    secondary: {
      bg: 'bg-muted',
      text: 'text-foreground',
    },
    success: {
      bg: 'bg-success/10 dark:bg-success/30',
      text: 'text-success',
    },
    warning: {
      bg: 'bg-warning/10 dark:bg-warning/30',
      text: 'text-warning',
    },
    destructive: {
      bg: 'bg-destructive/10 dark:bg-destructive/30',
      text: 'text-destructive',
    },
    info: {
      bg: 'bg-info/10 dark:bg-info/30',
      text: 'text-info',
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
