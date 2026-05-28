import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, Clock, FileText, TrendingDown, Timer } from 'lucide-react';
import { PageHeader } from '../../components';

export default function KpiTempoPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Tempo de Atendimento" onBack={() => onNavigate('painelGestao')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-info/10 dark:bg-info/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-info" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Tempo de Atendimento</h3>
              <p className="text-sm text-muted-foreground">Eficiencia operacional</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">18min</p>
              <p className="text-xs text-muted-foreground">Tempo Medio</p>
            </div>
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">&le;20min</p>
              <p className="text-xs text-muted-foreground">Meta</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre este Indicador">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Objetivo</p>
                <p className="text-sm text-muted-foreground">Otimizar o fluxo de atendimento ao paciente</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Metodologia</p>
                <p className="text-sm text-muted-foreground">Medicao de timestamps em cada etapa</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Timer className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Etapas Monitoradas</p>
                <p className="text-sm text-muted-foreground">Chegada, triagem, avaliacao, alta</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
