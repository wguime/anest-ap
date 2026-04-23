import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
} from '@/design-system';
import {
  GraduationCap,
  ChevronLeft,
  AlertTriangle,
  FileText,
  TrendingDown,
  Shield,
} from 'lucide-react';

export default function KpiEventosPage({ onNavigate }) {
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
            Eventos Adversos
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
            <div className="w-12 h-12 rounded-xl bg-destructive/10 dark:bg-destructive/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Eventos Adversos</h3>
              <p className="text-sm text-muted-foreground">Monitoramento de eventos</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-xs text-muted-foreground">Este Mes</p>
            </div>
            <div className="bg-background dark:bg-muted rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">&le;5</p>
              <p className="text-xs text-muted-foreground">Meta Mensal</p>
            </div>
          </div>
        </div>

        <SectionCard title="Sobre este Indicador">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Objetivo</p>
                <p className="text-sm text-muted-foreground">Identificar e prevenir eventos que causam dano ao paciente</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Metodologia</p>
                <p className="text-sm text-muted-foreground">Notificação espontânea e análise de causa raiz</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-category-purple-fg mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Categorias</p>
                <p className="text-sm text-muted-foreground">Quedas, erros de medicacao, lesoes por pressao</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
