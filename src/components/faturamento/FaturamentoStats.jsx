/**
 * FaturamentoStats - Cards de estatísticas do faturamento
 * Seguindo o padrão visual do KPICard do design system ANEST
 */
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Clock } from 'lucide-react';

export function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, variant = 'primary' }) {
  const isPositive = trend === 'up';

  // Token semântico por variante (substitui lookup-key por hex — Onda L)
  const getAccentBg = () => {
    switch (variant) {
      case 'destructive': return 'bg-destructive/10';
      case 'warning': return 'bg-warning/10';
      case 'primary':
      default: return 'bg-muted';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'destructive': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'primary':
      default: return 'text-primary';
    }
  };

  return (
    <div className="rounded-[20px] p-4 bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none">
      {/* Header: Icon + Trend */}
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getAccentBg()}`}>
            <Icon className={`w-5 h-5 ${getIconColor()}`} />
          </div>
        )}
        {trend && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
            <span className={`text-[11px] font-semibold ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {trendValue}%
            </span>
          </div>
        )}
      </div>

      {/* Title + Value */}
      <div className="space-y-1">
        <p className="text-[12px] font-medium text-muted-foreground">{title}</p>
        <p className="text-[20px] font-bold text-foreground leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function FaturamentoStats({ stats, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-[20px] p-4 bg-card border border-border animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 bg-muted rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-6 bg-muted rounded w-24" />
              <div className="h-2 bg-muted rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        title="Produzido"
        value={stats.produzidoFormatado || 'R$ 0,00'}
        subtitle="Este mês"
        icon={DollarSign}
        trend={stats.produzido?.variacao > 0 ? 'up' : stats.produzido?.variacao < 0 ? 'down' : null}
        trendValue={Math.abs(stats.produzido?.variacao || 0).toFixed(1)}
        variant="primary"
      />

      <StatCard
        title="Recebido"
        value={stats.recebidoFormatado || 'R$ 0,00'}
        subtitle="Este mês"
        icon={TrendingUp}
        trend={stats.recebido?.variacao > 0 ? 'up' : stats.recebido?.variacao < 0 ? 'down' : null}
        trendValue={Math.abs(stats.recebido?.variacao || 0).toFixed(1)}
        variant="primary"
      />

      <StatCard
        title="Glosas"
        value={stats.glosasFormatado || 'R$ 0,00'}
        subtitle={`${stats.glosas?.percentual?.toFixed(1) || 0}% do total`}
        icon={AlertTriangle}
        variant="destructive"
      />

      <StatCard
        title="Over"
        value={stats.overFormatado || 'R$ 0,00'}
        subtitle="A receber"
        icon={Clock}
        variant="warning"
      />
    </div>
  );
}

export function FaturamentoQuickStats({ stats }) {
  if (!stats) return null;

  // Tokens semânticos theme-aware (corrige contraste no dark — antes eram hex
  // inline fixos: verde escuro #004225/#2E8B57 ilegível sobre card escuro).
  const items = [
    { value: stats.eventosAbertos || 0, label: 'Eventos', tone: 'text-primary' },
    { value: stats.notasPendentes || 0, label: 'Notas', tone: 'text-warning' },
    { value: stats.lotesPendentes || 0, label: 'Lotes', tone: 'text-success' },
    { value: stats.recursosAbertos || 0, label: 'Recursos', tone: 'text-destructive' },
  ];

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-foreground mb-3">
        Resumo Rápido
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center p-3 bg-card rounded-xl border border-border min-h-[70px]"
          >
            <p className={`text-[18px] font-bold leading-none ${item.tone}`}>
              {item.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FaturamentoStats;
