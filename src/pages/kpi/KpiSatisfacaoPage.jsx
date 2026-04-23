import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
} from '@/design-system';
import {
  GraduationCap,
  ChevronLeft,
  Star,
  FileText,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';

export default function KpiSatisfacaoPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('painelGestao')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Satisfacao do Paciente
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

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
