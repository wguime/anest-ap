 'react';
import { SectionCard, PlantaoCard, Skeleton, WidgetCard } from '@/design-system';
import { PageHeader } from '@/components';
import { RefreshCw, Calendar, CalendarCheck, CalendarClock, ListOrdered, Flag } from 'lucide-react';
import { useEscalaDia } from '../hooks/usePegaPlantao';
import { formatDate } from '@/utils/formatters';
import { useUser } from '@/contexts/UserContext';
import { podeVerEscalaCirurgica } from './escala-cirurgica/gate';

export default function EscalasPage({ onNavigate, goBack }) {
  const { user } = useUser();
  const {
    plantoesManha,
    plantoesTarde,
    plantoes: plantoesCombinados,
    _isWeekend,
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

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala do Dia"
        onBack={goBack || (() => onNavigate('home'))}
        actions={
          <button
            type="button"
            onClick={refetchPlantoes}
            disabled={plantoesLoading}
            className="p-2 text-primary hover:opacity-70 transition-opacity disabled:opacity-50"
            aria-label="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 ${plantoesLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="px-4 sm:px-5 pt-4">
        {/* Hub de escalas (Gestão → Escalas, decisão 2026-07-14): Escala Cirúrgica
            (produção exclusiva do dono — piloto 2026-07-21) e Escalas Funcionárias. */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          {podeVerEscalaCirurgica(user) && (
            <WidgetCard
              size="small"
              icon={<CalendarClock className="w-6 h-6" />}
              title="Escala Cirúrgica"
              subtitle="Board do dia + liberações"
              variant="default"
              onClick={() => onNavigate('escalaCirurgica')}
            />
          )}
          <WidgetCard
            size="small"
            icon={<CalendarCheck className="w-6 h-6" />}
            title="Escalas Funcionárias"
            subtitle="Sobreaviso e trocas"
            variant="default"
            onClick={() => onNavigate('escalasFuncionarias')}
          />
          {/* Consulta da ordem de liberação pela escala numérica do grupo (dono 03/09):
              qualquer um vê a fila esperada do dia sem depender da conferência. */}
          <WidgetCard
            size="small"
            icon={<ListOrdered className="w-6 h-6" />}
            title="Escala Numérica"
            subtitle="Ordem de liberação do dia"
            variant="default"
            onClick={() => onNavigate('escalaNumerica')}
          />
          <WidgetCard
            size="small"
            icon={<Flag className="w-6 h-6" />}
            title="Feriados"
            subtitle="Ordem dos feriados do ano"
            variant="default"
            onClick={() => onNavigate('feriados')}
          />
        </div>

        {/* Card de Plantões - Mostra todos (a data vive no meta do card, como na Home) */}
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
              meta={formatDate(new Date(), 'medium')}
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
                <p className="text-xs text-warning">
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
