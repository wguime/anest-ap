/**
 * StatCard.jsx
 * Card de estatística reutilizável para exibir métricas
 */

import { Card } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';

const COLORS = {
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
  },
};

export function StatCard({ icon: Icon, value, label, color = 'blue' }) {
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
}

export default StatCard;
