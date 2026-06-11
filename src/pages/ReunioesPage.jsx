/**
 * ReunioesPage - Gestão de Reuniões
 * Displays upcoming meetings and past meetings grouped by type
 * Enhanced with: Skeleton loading, SearchBar filtering, Calendar view, Badge consistency
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { SectionCard, cn, Button, useToast, EmptyState } from '@/design-system';
import { PageHeader } from '@/components';
import { Badge } from '@/design-system/components/ui/badge';
import { Skeleton } from '@/design-system/components/ui/skeleton';
import { Calendar as CalendarDS } from '@/design-system/components/ui/calendar';
import { SearchBar } from '@/design-system/components/anest/search-bar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/design-system/components/ui/accordion';
import { useBreakpoint } from '@/design-system/hooks';
import { Plus, Calendar, X } from 'lucide-react';
import reunioesService from '@/services/reunioesService';
import { useReunioesStatusCheck } from '@/hooks/useReunioesStatusCheck';
import { useEventAlerts } from '@/contexts/EventAlertsContext';
import ReuniaoCard from '@/components/reunioes/ReuniaoCard';
import NovaReuniaoModal from '@/components/reunioes/NovaReuniaoModal';
import { normalizeRole } from '@/utils/userTypes';
import { formatDate } from '@/utils/formatters';
import { TIPOS_REUNIAO, getTipoReuniao } from '@/constants/reunioes';

export { TIPOS_REUNIAO };

/**
 * Skeleton mimicking ReuniaoCard shape during loading
 */
function ReuniaoCardSkeleton() {
  return (
    <div className="w-full flex gap-3 bg-card border border-border rounded-xl p-3.5">
      {/* Icon placeholder */}
      <Skeleton variant="custom" className="w-11 h-11 rounded-xl flex-shrink-0" />
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title + badge row */}
        <div className="flex items-start justify-between gap-2">
          <Skeleton variant="text" className="w-3/5" />
          <Skeleton variant="custom" className="w-16 h-5 rounded-[10px] flex-shrink-0" />
        </div>
        {/* Type badge */}
        <Skeleton variant="custom" className="w-24 h-4 rounded-full" />
        {/* Date + time row */}
        <div className="flex items-center gap-3">
          <Skeleton variant="custom" className="w-28 h-3.5 rounded-md" />
          <Skeleton variant="custom" className="w-14 h-3.5 rounded-md" />
        </div>
        {/* Location */}
        <Skeleton variant="custom" className="w-2/5 h-3.5 rounded-md" />
      </div>
    </div>
  );
}

export default function ReunioesPage({ onNavigate, user }) {
  const [_activeNav, _setActiveNav] = useState('shield');
  const [showNovaReuniaoModal, setShowNovaReuniaoModal] = useState(false);
  const [reunioesAgendadas, setReunioesAgendadas] = useState([]);
  const [reunioesPassadas, setReunioesPassadas] = useState([]);
  const [showAllReunioes, setShowAllReunioes] = useState(false);
  const [showAllPerTipo, setShowAllPerTipo] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, _setViewMode] = useState('list'); // 'list' | 'calendar'
  const [selectedDate, setSelectedDate] = useState(null);
  const { toast } = useToast();
  const { scheduleEventAlerts } = useEventAlerts();
  const { isMobile } = useBreakpoint();

  // Use status check hook for auto-promotion
  const { isChecking, lastCheckTime, promotedCount } = useReunioesStatusCheck();

  // Carregar reuniões
  useEffect(() => {
    if (!user) return;
    loadReunioesAgendadas();
    loadReunioesPassadas();
  }, [user]);

  // Reload when status check completes and promoted meetings
  useEffect(() => {
    if (!isChecking && lastCheckTime && promotedCount > 0) {
      loadReunioesAgendadas();
      loadReunioesPassadas();
    }
  }, [isChecking, lastCheckTime, promotedCount]);

  const loadReunioesAgendadas = async () => {
    try {
      setLoading(true);
      const reunioes = await reunioesService.getReunioes({
        status: ['agendada', 'em_preparacao', 'em_andamento'],
        orderBy: 'dataReuniao',
        order: 'asc',
      });
      setReunioesAgendadas(reunioes || []);
    } catch (error) {
      console.error('[ReunioesPage] Erro ao carregar reuniões:', error);
      const isIndexError = error.message?.includes('requires an index');
      toast({
        variant: 'error',
        title: 'Erro ao carregar reuniões',
        description: isIndexError
          ? 'Sistema configurando índices do banco de dados. Aguarde 2-5 minutos e recarregue a página.'
          : `Não foi possível carregar: ${error?.message || 'erro desconhecido'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReunioesPassadas = async () => {
    try {
      // Use date filter (same field as orderBy → no composite index needed)
      const reunioes = await reunioesService.getReunioes({
        dataFim: new Date(),
        orderBy: 'dataReuniao',
        order: 'desc',
      });
      // Exclude archived/soft-deleted meetings
      const filtered = (reunioes || []).filter(r => r.status !== 'arquivada');
      setReunioesPassadas(filtered);
    } catch (error) {
      console.error('[ReunioesPage] Erro ao carregar reuniões passadas:', error);
    }
  };

  // Filtrar reuniões por perfil do usuário
  const filterByUserRole = (reunioes) => {
    if (!user) return reunioes;
    if (user.isAdmin || user.isCoordenador) return reunioes;
    const canonicalRole = normalizeRole(user.role);
    return reunioes.filter(r => {
      if (!r.destinatariosTipos || r.destinatariosTipos.length === 0) return true;
      if (!canonicalRole) return true;
      const targets = r.destinatariosTipos.map(normalizeRole).filter(Boolean);
      return targets.includes(canonicalRole);
    });
  };

  // Ordenar reuniões por data + horário
  const sortByDateTime = (reunioes, order = 'asc') => {
    return [...reunioes].sort((a, b) => {
      const dateA = new Date(a.dataReuniao);
      const dateB = new Date(b.dataReuniao);
      if (a.horario) {
        const [hA, mA] = a.horario.split(':').map(Number);
        dateA.setHours(hA, mA, 0, 0);
      }
      if (b.horario) {
        const [hB, mB] = b.horario.split(':').map(Number);
        dateB.setHours(hB, mB, 0, 0);
      }
      return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };

  const reunioesAgendadasFiltradas = useMemo(
    () => sortByDateTime(filterByUserRole(reunioesAgendadas), 'asc'),
    [reunioesAgendadas, user]
  );

  const reunioesPassadasFiltradas = useMemo(
    () => sortByDateTime(filterByUserRole(reunioesPassadas), 'desc'),
    [reunioesPassadas, user]
  );

  // --- Search + Date filter ---
  const normalizeSearch = useCallback((text) => {
    if (!text) return '';
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }, []);

  const matchesSearch = useCallback((reuniao, query) => {
    if (!query) return true;
    const q = normalizeSearch(query);
    const tipoConfig = getTipoReuniao(reuniao.tipoReuniao);
    const fields = [
      reuniao.titulo,
      reuniao.local,
      tipoConfig?.title,
    ].filter(Boolean);
    return fields.some(f => normalizeSearch(f).includes(q));
  }, [normalizeSearch]);

  const matchesDate = useCallback((reuniao, date) => {
    if (!date) return true;
    if (!reuniao.dataReuniao) return false;
    const rDate = new Date(
      typeof reuniao.dataReuniao === 'string' && !reuniao.dataReuniao.includes('T')
        ? reuniao.dataReuniao + 'T00:00:00'
        : reuniao.dataReuniao
    );
    return (
      rDate.getFullYear() === date.getFullYear() &&
      rDate.getMonth() === date.getMonth() &&
      rDate.getDate() === date.getDate()
    );
  }, []);

  const reunioesAgendadasVisiveis = useMemo(
    () => reunioesAgendadasFiltradas.filter(
      r => matchesSearch(r, searchQuery) && matchesDate(r, selectedDate)
    ),
    [reunioesAgendadasFiltradas, searchQuery, selectedDate, matchesSearch, matchesDate]
  );

  const reunioesPassadasVisiveis = useMemo(
    () => reunioesPassadasFiltradas.filter(
      r => matchesSearch(r, searchQuery) && matchesDate(r, selectedDate)
    ),
    [reunioesPassadasFiltradas, searchQuery, selectedDate, matchesSearch, matchesDate]
  );

  // Group past meetings by type (using filtered visible list)
  const reunioesPassadasPorTipo = useMemo(() => {
    const grupos = {};
    TIPOS_REUNIAO.forEach(tipo => { grupos[tipo.id] = []; });
    reunioesPassadasVisiveis.forEach(r => {
      const tipo = r.tipoReuniao || 'reuniao_equipe';
      if (grupos[tipo]) grupos[tipo].push(r);
    });
    return grupos;
  }, [reunioesPassadasVisiveis]);

  // Calendar events derived from all meetings
  const calendarEvents = useMemo(() => {
    const allMeetings = [...reunioesAgendadasFiltradas, ...reunioesPassadasFiltradas];
    return allMeetings.map(r => {
      const tipoConfig = getTipoReuniao(r.tipoReuniao);
      const colorMap = {
        comite_qualidade: 'hsl(var(--success))',
        reuniao_equipe: 'hsl(var(--info))',
        morbimortalidade: 'hsl(var(--destructive))',
        sessao_cientifica: 'hsl(var(--category-purple))',
        planejamento: 'hsl(var(--warning))',
        auditoria_interna: 'hsl(var(--muted-foreground))',
      };
      return {
        date: new Date(
          typeof r.dataReuniao === 'string' && !r.dataReuniao.includes('T')
            ? r.dataReuniao + 'T00:00:00'
            : r.dataReuniao
        ),
        label: r.titulo || tipoConfig?.title || 'Reunião',
        color: colorMap[r.tipoReuniao] || 'hsl(var(--info))',
      };
    });
  }, [reunioesAgendadasFiltradas, reunioesPassadasFiltradas]);

  // Handle calendar date selection
  const handleCalendarSelect = useCallback((date) => {
    if (selectedDate && date.getTime() === selectedDate.getTime()) {
      setSelectedDate(null); // Toggle off if same date clicked
    } else {
      setSelectedDate(date);
    }
  }, [selectedDate]);

  // Clear all filters
  const hasActiveFilters = searchQuery || selectedDate;
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedDate(null);
  }, []);

  // Agendar alertas (1 dia e 1 hora antes) para reuniões futuras do usuário
  useEffect(() => {
    if (!user || reunioesAgendadasFiltradas.length === 0) return;

    reunioesAgendadasFiltradas.forEach(reuniao => {
      const eventDate = new Date(reuniao.dataReuniao);
      if (reuniao.horario) {
        const [h, m] = reuniao.horario.split(':').map(Number);
        eventDate.setHours(h, m, 0, 0);
      }
      // scheduleEventAlerts lida com duplicatas internamente
      scheduleEventAlerts(
        `reuniao_${reuniao.id}`,
        reuniao.titulo,
        eventDate.toISOString()
      );
    });
  }, [reunioesAgendadasFiltradas, user, scheduleEventAlerts]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Reuniões"
        onBack={() => onNavigate('gestao')}
        actions={
          <Button
            size="sm"
            variant="default"
            className="h-7 min-h-0 px-2.5 text-xs"
            onClick={() => setShowNovaReuniaoModal(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Nova
          </Button>
        }
      />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Search Bar */}
        <SearchBar
          placeholder="Buscar por título, tipo ou local..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-0"
        />

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {searchQuery && (
              <Badge variant="info" badgeStyle="subtle">
                Busca: &quot;{searchQuery}&quot;
              </Badge>
            )}
            {selectedDate && (
              <Badge variant="info" badgeStyle="subtle">
                Data: {formatDate(selectedDate, 'medium')}
              </Badge>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
              aria-label="Limpar filtros"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          </div>
        )}

        {/* Calendar view (md+ only) */}
        {viewMode === 'calendar' && !isMobile && (
          <div className="flex justify-center">
            <CalendarDS
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              events={calendarEvents}
              className="w-full max-w-none md:max-w-[360px]"
            />
          </div>
        )}

        {/* Próximas Reuniões */}
        <SectionCard
          title="Próximas Reuniões"
          subtitle={loading ? 'Carregando...' : `${reunioesAgendadasVisiveis.length} reunião(ões)`}
        >
          {loading ? (
            <div className="space-y-3" aria-label="Carregando reuniões">
              {Array.from({ length: 3 }).map((_, i) => (
                <ReuniaoCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllReunioes ? reunioesAgendadasVisiveis : reunioesAgendadasVisiveis.slice(0, 3)).map(reuniao => (
                <ReuniaoCard
                  key={reuniao.id}
                  reuniao={{
                    titulo: reuniao.titulo,
                    data: reuniao.dataReuniao,
                    horario: reuniao.horario,
                    tipo: reuniao.tipoReuniao,
                    local: reuniao.local,
                    status: reuniao.status,
                  }}
                  onClick={() => onNavigate('reuniaoDetalhe', { id: reuniao.id })}
                />
              ))}

              {reunioesAgendadasVisiveis.length > 3 && !showAllReunioes && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAllReunioes(true)}
                  className="w-full text-primary hover:bg-secondary min-h-[44px]"
                >
                  Ver todas ({reunioesAgendadasVisiveis.length - 3} mais)
                </Button>
              )}

              {reunioesAgendadasVisiveis.length > 3 && showAllReunioes && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAllReunioes(false)}
                  className="w-full text-primary hover:bg-secondary min-h-[44px]"
                >
                  Mostrar menos
                </Button>
              )}

              {reunioesAgendadasVisiveis.length === 0 && !hasActiveFilters && (
                <EmptyState
                  icon={<Calendar className="h-full w-full" />}
                  title="Nenhuma reunião agendada"
                  description="Clique em + Reunião para criar uma nova"
                />
              )}

              {reunioesAgendadasVisiveis.length === 0 && hasActiveFilters && (
                <EmptyState
                  icon={<Calendar className="h-full w-full" />}
                  title="Nenhuma reunião encontrada"
                  description="Tente ajustar os filtros de busca"
                />
              )}
            </div>
          )}
        </SectionCard>

        {/* Reuniões Realizadas por Tipo */}
        {reunioesPassadasVisiveis.length > 0 && (
          <SectionCard
            title="Reuniões Realizadas"
            subtitle={`${reunioesPassadasVisiveis.length} reunião(ões) por tipo`}
          >
            <Accordion type="multiple" defaultValue={[]}>
              {TIPOS_REUNIAO.map(tipo => {
                const meetings = reunioesPassadasPorTipo[tipo.id];
                if (!meetings || meetings.length === 0) return null;

                const IconComponent = tipo.icon;
                const showAll = showAllPerTipo[tipo.id];
                const visibleMeetings = showAll ? meetings : meetings.slice(0, 3);

                return (
                  <AccordionItem key={tipo.id} value={tipo.id}>
                    <AccordionTrigger className="px-3 py-2.5 rounded-xl">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                            tipo.iconWrapperClass
                          )}
                        >
                          <IconComponent className={cn('w-5 h-5', tipo.iconClass)} />
                        </div>
                        <span className="font-semibold text-sm text-foreground">
                          {tipo.title}
                        </span>
                        <Badge variant="secondary" badgeStyle="subtle" className="ml-1">
                          {meetings.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pt-2">
                      <div className="space-y-2">
                        {visibleMeetings.map(reuniao => (
                          <ReuniaoCard
                            key={reuniao.id}
                            reuniao={{
                              titulo: reuniao.titulo,
                              data: reuniao.dataReuniao,
                              horario: reuniao.horario,
                              tipo: reuniao.tipoReuniao,
                              local: reuniao.local,
                              status: reuniao.status,
                            }}
                            onClick={() => onNavigate('reuniaoDetalhe', { id: reuniao.id })}
                          />
                        ))}

                        {meetings.length > 3 && !showAll && (
                          <Button
                            variant="ghost"
                            onClick={() => setShowAllPerTipo(prev => ({ ...prev, [tipo.id]: true }))}
                            className="w-full text-primary hover:bg-secondary text-sm min-h-[44px]"
                          >
                            Ver mais ({meetings.length - 3} restantes)
                          </Button>
                        )}

                        {meetings.length > 3 && showAll && (
                          <Button
                            variant="ghost"
                            onClick={() => setShowAllPerTipo(prev => ({ ...prev, [tipo.id]: false }))}
                            className="w-full text-primary hover:bg-secondary text-sm min-h-[44px]"
                          >
                            Mostrar menos
                          </Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </SectionCard>
        )}

        {/* Empty state for past meetings with active filters */}
        {reunioesPassadasVisiveis.length === 0 && reunioesPassadasFiltradas.length > 0 && hasActiveFilters && (
          <SectionCard
            title="Reuniões Realizadas"
            subtitle="Nenhum resultado"
          >
            <EmptyState
              icon={<Calendar className="h-full w-full" />}
              title="Nenhuma reunião realizada encontrada"
              description="Tente ajustar os filtros de busca"
            />
          </SectionCard>
        )}

      </div>

      {/* Nova Reunião Modal */}
      <NovaReuniaoModal
        isOpen={showNovaReuniaoModal}
        onClose={() => setShowNovaReuniaoModal(false)}
        onSuccess={() => {
          toast({
            variant: 'success',
            title: 'Reunião Criada',
            description: 'A reunião foi agendada com sucesso!',
            duration: 4000,
          });
          loadReunioesAgendadas();
          setShowNovaReuniaoModal(false);
        }}
        user={user}
      />

    </div>
  );
}
