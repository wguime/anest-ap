import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, Star, FileText, TrendingUp, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components';

export default function KpiSatisfacaoPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Satisfacao do Paciente" onBack={() => onNavigate('painelGestao')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-warning/10 dark:bg-warning/30 flex items-center justify-center">
              <Star className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Satisfacao do Paciente</h3>
              <p className="text-sm text-muted-foreground">Pesquisas e feedback</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">4.6</p>
              <p className="text-xs text-muted-foreground">Nota Media</p>
            </div>
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">&ge;4.5</p>
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
                <p className="text-sm text-muted-foreground">Medir e melhorar a experiencia do paciente</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Metodologia</p>
                <p className="text-sm text-muted-foreground">Pesquisas de satisfacao pos-atendimento</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Dimensoes Avaliadas</p>
                <p className="text-sm text-muted-foreground">Comunicacao, tempo de espera, conforto, cuidado</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
