import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, Bug, FileText, TrendingDown, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components';

export default function KpiInfeccaoPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Taxa de Infeccao" onBack={() => onNavigate('painelGestao')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Card de KPI */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 dark:bg-destructive/30 flex items-center justify-center">
              <Bug className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Taxa de Infeccao</h3>
              <p className="text-sm text-muted-foreground">Indicador de prevencao</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">2.3%</p>
              <p className="text-xs text-muted-foreground">Taxa Atual</p>
            </div>
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">&lt;3%</p>
              <p className="text-xs text-muted-foreground">Meta</p>
            </div>
          </div>
        </div>

        {/* Informacoes */}
        <SectionCard title="Sobre este Indicador">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Objetivo</p>
                <p className="text-sm text-muted-foreground">Reduzir infeccoes relacionadas a assistencia a saude</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Metodologia</p>
                <p className="text-sm text-muted-foreground">Monitoramento continuo de casos e taxas por setor</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Acoes Corretivas</p>
                <p className="text-sm text-muted-foreground">Protocolos de higiene e uso de EPIs</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
