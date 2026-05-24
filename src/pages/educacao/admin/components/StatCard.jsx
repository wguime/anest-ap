/**
 * StatCard.jsx
 * Card de estatística reutilizável para exibir métricas
 */

import { memo } from 'react';
import { Card } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';

const COLORS = {
  purple: {
    bg: 'bg-category-purple-bg',
    text: 'text-category-purple-fg',
  },
  blue: {
    bg: 'bg-category-blue-bg',
    text: 'text-category-blue-fg',
  },
  orange: {
    bg: 'bg-category-orange-bg',
    text: 'text-category-orange-fg',
  },
  green: {
    bg: 'bg-category-teal-bg',
    text: 'text-category-teal-fg',
  },
};

export const StatCard = memo(function StatCard({ icon: Icon, value, label, color = 'blue' }) {
  const colorClasses = COLORS[color] || COLORS.blue;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          colorClasses.bg
        )}>
          <Icon className={cn("w-5 h-5", colorClasses.text)} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
});

export default StatCard;
