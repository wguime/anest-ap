import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
  PlantaoCard,
  Skeleton,
} from '@/design-system';
import {
  ChevronLeft,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { useEscalaDia } from '../hooks/usePegaPlantao';

export default function EscalasPage({ onNavigate, goBack }) {
  const {
    plantoesManha,
    plantoesTarde,
    plantoes: plantoesCombinados,
    isWeekend,
    loading: plantoesLoading,
    usandoMock: plantoesUsandoMock,
    refetch: refetchPlantoes,
  } = useEscalaDia();

  // Obter dia da semana
  const getDiaSubtitle = () => {
    const hoje = new Date();
    const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    return diasSemana[hoje.getDay()];
  };

  // Obter data formatada
  const getDataFormatada = () => {
    const hoje = new Date();
    const dia = hoje.getDate().toString().padStart(2, '0');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mes = meses[hoje.getMonth()];
    const ano = hoje.getFullYear();
    return `${dia} de ${mes} de ${ano}`;
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack || (() => onNavigate('home'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Escala do Dia
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={refetchPlantoes}
              disabled={plantoesLoading}
              className="p-2 text-primary hover:opacity-70 transition-opacity disabled:opacity-50"
              aria-label="Atualizar"
            >
              <RefreshCw className={`w-5 h-5 ${plantoesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 pt-4">
        {/* Info do dia */}
        <div className="mb-4 p-4 bg-card rounded-[20px] border border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-black dark:text-white">
                {getDiaSubtitle()}
              </p>
              <p className="text-sm text-muted-foreground">
                {getDataFormatada()}
              </p>
            </div>
          </div>
        </div>

        {/* Card de Plantões - Mostra todos */}
        {plantoesLoading ? (
          <div className="bg-card rounded-[20px] p-5 mb-4 shadow-sm dark:shadow-none dark:border dark:border-border">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3.5 py-3.5">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Plantões do dia */}
            <PlantaoCard
              title="Plantões"
              subtitle={getDiaSubtitle()}
              items={plantoesCombinados}
              itemsManha={[]}
              itemsTarde={[]}
              maxItems={50}
              showBadge={true}
              expandable={false}
            />

            {/* Indicador de dados mock */}
            {plantoesUsandoMock && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dados de demonstração
                </p>
                <button
                  type="button"
                  onClick={refetchPlantoes}
                  disabled={plantoesLoading}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
                  aria-label="Atualizar plantões"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${plantoesLoading ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>
            )}

            {/* Mensagem se não houver plantões */}
            {!plantoesLoading && plantoesCombinados.length === 0 && plantoesManha.length === 0 && plantoesTarde.length === 0 && (
              <SectionCard title="Plantões" className="mb-4">
                <div className="py-8 text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum plantão encontrado para hoje
                  </p>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
