/**
 * FaturamentoDashboardPage - Dashboard com gráficos e métricas
 */
import { createPortal } from 'react-dom';
import { ChevronLeft, Construction } from 'lucide-react';
import { BottomNav, Badge, SectionCard, CardContent, cn } from '@/design-system';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';

function DashboardContent({ onNavigate, goBack }) {

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Dashboard
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        <SectionCard
          className="mx-auto max-w-lg"
          variant="default"
        >
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className={cn(
              'w-20 h-20 rounded-2xl flex items-center justify-center mb-6',
              'bg-muted'
            )}>
              <Construction className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-black dark:text-white mb-2">
              Em Desenvolvimento
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              O módulo de Faturamento está em desenvolvimento e estará disponível em breve.
            </p>
            <Badge variant="outline" className="mt-4">
              Previsto para Q2 2026
            </Badge>
          </CardContent>
        </SectionCard>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}

export default function FaturamentoDashboardPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <DashboardContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
