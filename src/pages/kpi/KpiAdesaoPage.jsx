import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, CheckCircle, FileText, TrendingUp, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '../../components';

export default function KpiAdesaoPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Adesao aos Protocolos" onBack={() => onNavigate('painelGestao')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 dark:bg-success/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Adesao aos Protocolos</h3>
              <p className="text-sm text-muted-foreground">Conformidade clinica</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">94%</p>
              <p className="text-xs text-muted-foreground">Taxa Atual</p>
            </div>
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">&ge;90%</p>
              <p className="text-xs text-muted-foreground">Meta</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre este Indicador">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Objetivo</p>
                <p className="text-sm text-muted-foreground">Garantir seguimento dos protocolos clinicos estabelecidos</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Metodologia</p>
                <p className="text-sm text-muted-foreground">Auditorias periodicas e checklists de verificacao</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ClipboardCheck className="w-5 h-5 text-category-purple-fg mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Protocolos Monitorados</p>
                <p className="text-sm text-muted-foreground">Cirurgia segura, identificacao do paciente, quedas</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
