/**
 * ReunioesPage - Gestão de Reuniões
 * Displays upcoming meetings and past meetings grouped by type
 */
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
  BottomNav,
  cn,
  Button,
  Spinner,
  useToast,
  EmptyState,
} from '@/design-system';
import {
  ChevronLeft,
  ChevronDown,
  Users,
  ShieldCheck,
  Stethoscope,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Plus,
  Calendar,
} from 'lucide-react';
import reunioesService from '@/services/reunioesService';
import { useReunioesStatusCheck } from '@/hooks/useReunioesStatusCheck';
import { useEventAlerts } from '@/contexts/EventAlertsContext';
import ReuniaoCard from '@/components/reunioes/ReuniaoCard';
import NovaReuniaoModal from '@/components/reunioes/NovaReuniaoModal';

// Tipos de reunião do Qmentum (exported for use in NovaReuniaoModal)
export const TIPOS_REUNIAO = [
  {
    id: 'comite_qualidade',
    title: 'Comitê de Qualidade',
    subtitle: 'Análise crítica mensal',
    icon: ShieldCheck,
    color: '#059669',
    frequencia: 'Mensal',
  },
  {
    id: 'reuniao_equipe',
    title: 'Reunião de Equipe',
    subtitle: 'Alinhamento operacional',
    icon: Users,
    color: '#2563eb',
    frequencia: 'Semanal',
  },
  {
    id: 'morbimortalidade',
    title: 'Morbimortalidade',
    subtitle: 'Revisão de casos clínicos',
    icon: Stethoscope,
    color: '#dc2626',
    frequencia: 'Mensal',
  },
  {
    id: 'sessao_cientifica',
    title: 'Sessão Científica',
    subtitle: 'Atualização e educação',
    icon: BookOpen,
    color: '#7c3aed',
    frequencia: 'Quinzenal',
  },
  {
    id: 'planejamento',
    title: 'Planejamento',
    subtitle: 'Metas e estratégia',
    icon: CalendarClock,
    color: '#f59e0b',
    frequencia: 'Trimestral',
  },
  {
    id: 'auditoria_interna',
    title: 'Auditoria Interna',
    subtitle: 'Revisão de conformidade',
    icon: ClipboardList,
    color: '#64748b',
    frequencia: 'Semestral',
  },
];

export default function ReunioesPage({ onNavigate, user }) {
  const [activeNav, setActiveNav] = useState('shield');
  const [showNovaReuniaoModal, setShowNovaReuniaoModal] = useState(false);
  const [reunioesAgendadas, setReunioesAgendadas] = useState([]);
  const [reunioesPassadas, setReunioesPassadas] = useState([]);
  const [showAllReunioes, setShowAllReunioes] = useState(false);
  const [expandedTipos, setExpandedTipos] = useState({});
  const [showAllPerTipo, setShowAllPerTipo] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { scheduleEventAlerts } = useEventAlerts();

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
      setReunioesAgendadas(reunioes);
    } catch (error) {
      console.error('Erro ao carregar reuniões:', error);
      const isIndexError = error.message?.includes('requires an index');
      toast({
        variant: 'error',
        title: 'Erro ao carregar reuniões',
        description: isIndexError
          ? 'Sistema configurando índices do banco de dados. Aguarde 2-5 minutos e recarregue a página.'
          : 'Não foi possível carregar as reuniões. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReunioesPassadas = async () => {
    try {
      const reunioes = await reunioesService.getReunioes({
        dataFim: new Date(),
        orderBy: 'dataReuniao',
        order: 'desc',
      });
      setReunioesPassadas(reunioes);
    } catch (error) {
      console.error('Erro ao carregar reuniões passadas:', error);
    }
  };

  // Filtrar reuniões por perfil do usuário
  const filterByUserRole = (reunioes) => {
    if (!user) return reunioes;
    if (user.isAdmin) return reunioes; // Admin vê tudo
    return reunioes.filter(r => {
      if (!r.destinatariosTipos || r.destinatariosTipos.length === 0) return true;
      return r.destinatariosTipos.includes(user.role);
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

  // Group past meetings by type
  const reunioesPassadasPorTipo = useMemo(() => {
    const grupos = {};
    TIPOS_REUNIAO.forEach(tipo => { grupos[tipo.id] = []; });
    reunioesPassadasFiltradas.forEach(r => {
      const tipo = r.tipoReuniao || 'reuniao_equipe';
      if (grupos[tipo]) grupos[tipo].push(r);
    });
    return grupos;
  }, [reunioesPassadasFiltradas]);

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

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Reuniões
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={() => setShowNovaReuniaoModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Reunião</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Próximas Reuniões */}
        <SectionCard
          title="Próximas Reuniões"
          subtitle="Agenda atualizada"
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllReunioes ? reunioesAgendadasFiltradas : reunioesAgendadasFiltradas.slice(0, 3)).map(reuniao => (
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

              {reunioesAgendadasFiltradas.length > 3 && !showAllReunioes && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAllReunioes(true)}
                  className="w-full text-primary hover:bg-secondary"
                >
                  Ver todas ({reunioesAgendadasFiltradas.length - 3} mais)
                </Button>
              )}

              {reunioesAgendadasFiltradas.length > 3 && showAllReunioes && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAllReunioes(false)}
                  className="w-full text-primary hover:bg-secondary"
                >
                  Mostrar menos
                </Button>
              )}

              {reunioesAgendadasFiltradas.length === 0 && (
                <EmptyState
                  icon={<Calendar className="h-full w-full" />}
                  title="Nenhuma reunião agendada"
                  description="Clique em + Reunião para criar uma nova"
                />
              )}
            </div>
          )}
        </SectionCard>

        {/* Reuniões Realizadas por Tipo */}
        {reunioesPassadasFiltradas.length > 0 && (
          <SectionCard
            title="Reuniões Realizadas"
            subtitle={`${reunioesPassadasFiltradas.length} reunião(ões) por tipo`}
          >
            <div className="space-y-3">
              {TIPOS_REUNIAO.map(tipo => {
                const meetings = reunioesPassadasPorTipo[tipo.id];
                if (!meetings || meetings.length === 0) return null;

                const IconComponent = tipo.icon;
                const isExpanded = expandedTipos[tipo.id] !== false;
                const showAll = showAllPerTipo[tipo.id];
                const visibleMeetings = showAll ? meetings : meetings.slice(0, 3);

                return (
                  <div key={tipo.id}>
                    {/* Group Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedTipos(prev => ({
                        ...prev,
                        [tipo.id]: prev[tipo.id] === false ? true : false,
                      }))}
                      className={cn(
                        'flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl',
                        'hover:bg-secondary transition-colors'
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${tipo.color}15` }}
                      >
                        <IconComponent className="w-5 h-5" style={{ color: tipo.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-foreground">
                          {tipo.title}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({meetings.length})
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>

                    {/* Meetings List */}
                    {isExpanded && (
                      <div className="space-y-2 mt-2 ml-1">
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
                            className="w-full text-primary hover:bg-secondary text-sm"
                          >
                            Ver mais ({meetings.length - 3} restantes)
                          </Button>
                        )}

                        {meetings.length > 3 && showAll && (
                          <Button
                            variant="ghost"
                            onClick={() => setShowAllPerTipo(prev => ({ ...prev, [tipo.id]: false }))}
                            className="w-full text-primary hover:bg-secondary text-sm"
                          >
                            Mostrar menos
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'BarChart3', active: false, id: 'dashboard' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'dashboard') onNavigate('dashboardExecutivo');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
