import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import { useMessages } from '../contexts/MessagesContext';
import { useEventAlerts } from '../contexts/EventAlertsContext';
import { useComunicados } from '../contexts/ComunicadosContext';
import {
  ATALHOS_DISPONIVEIS,
  carregarAtalhosSalvos,
} from '../data/atalhosConfig';
import { isExpirado } from '@/utils/comunicadosHelpers';
import { searchAll } from '../data/searchUtils';
import {
  Header,
  SearchBar,
  ComunicadosCard,
  QuickLinksGrid,
  SectionCard,
  Skeleton,
  PlantaoCard,
  FeriasCard,
  StaffScheduleCard,
  AssignStaffModal,
} from '@/design-system';
import {
  Calendar, User, BookOpen, RefreshCw, Pencil, ChevronRight,
  Calculator, CheckSquare, Wrench, FileCheck,
  DollarSign, CalendarDays, ShieldCheck, Briefcase, Receipt,
  AlertTriangle, TrendingUp, ClipboardCheck, Scale, ShieldAlert, Pill, AlertOctagon, FileBarChart,
  Library, Bug, FolderOpen,
  Target, Headphones, GraduationCap, BookMarked, Trophy,
  Network, Users, Megaphone, ClipboardList, Mail, FileSearch,
  Sun, Moon, Umbrella, Building2, FileText,
} from 'lucide-react';

// Mapa de ícones para busca inline (string → componente)
const iconMap = {
  Calculator, CheckSquare, Wrench, FileCheck,
  DollarSign, CalendarDays, ShieldCheck, Briefcase, Receipt,
  AlertTriangle, TrendingUp, ClipboardCheck, Scale, ShieldAlert, Pill, AlertOctagon, FileBarChart,
  BookOpen, Library, Bug, FolderOpen,
  Target, Headphones, GraduationCap, BookMarked, Trophy,
  Network, Users, Calendar,
  Megaphone, ClipboardList, Mail, FileSearch,
};
import { useCardPermissions } from '../hooks/useCardPermissions';
import { useEscalaDia } from '../hooks/usePegaPlantao';
import { useShiftReminders } from '../hooks/useShiftReminders';
import { useResidencia } from '../hooks/useResidencia';
import { useStaff } from '../hooks/useStaff';
import { EditEstagiosModal, EditPlantaoModal } from '../components/residencia';


// Ícone para Residente (R1/R2/R3) - DS green for dark mode
function ResidenteIcon({ ano }) {
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-[#E8F5E9] text-[#004225] dark:bg-[#1A2F23] dark:text-[#2ECC71]"
    >
      {ano}
    </div>
  );
}

export default function HomePage({ onNavigate }) {
  const { user } = useUser();
  const { totalUnreadCount } = useMessages();
  const { unreadCount: eventAlertsUnread } = useEventAlerts();
  const { publicados, loading: comunicadosLoading, isRead } = useComunicados();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [atalhosSelecionados, setAtalhosSelecionados] = useState(() => carregarAtalhosSalvos());

  // Busca live inline
  const results = useMemo(() => searchAll(search), [search]);
  const hasResults = results.pages.length > 0 || results.documents.length > 0;
  const showDropdown = search.trim().length > 0;
  const pendenciasCount = totalUnreadCount + eventAlertsUnread;

  // Compute unread comunicados count
  const unreadComunicados = useMemo(() => {
    if (!user?.id) return 0;
    return publicados.filter((c) => {
      if (c.destinatarios?.length > 0) {
        if (!c.destinatarios.includes((user?.role || '').toLowerCase())) return false;
      }
      if (c.arquivado || isExpirado(c)) return false;
      return !isRead(c, user.id);
    }).length;
  }, [publicados, user, isRead]);

  // Estados dos modais de residência
  const [showEstagiosModal, setShowEstagiosModal] = useState(false);
  const [showPlantaoModal, setShowPlantaoModal] = useState(false);

  // Hook para dados da residência (estágios e plantão)
  const {
    residentes,
    estagiosCardData,
    estagiosCardTurno,
    plantao,
    plantaoCardData,
    plantaoCardTurno,
    canEdit: canEditResidencia,
    saveEstagios,
    savePlantao,
    savingEstagios,
    savingPlantao,
  } = useResidencia();

  // Helper para formatar data/turno como texto exibido no card
  const formatCardMeta = (isoDate, turno) => {
    if (!isoDate && !turno) return null;
    const parts = [];
    if (isoDate) {
      const d = new Date(isoDate + 'T12:00:00');
      parts.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }));
    }
    const labels = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' };
    if (turno && labels[turno]) parts.push(labels[turno]);
    return parts.join(' · ');
  };

  // Hook para dados de staff (hospitais e consultório)
  const {
    staff,
    staffLoading,
    staffUsandoMock,
    canEdit: canEditStaff,
    saveStaff,
    savingStaff,
    getHospitalStaffByLocation,
    getAllHospitalStaff,
    getAllConsultorioStaff,
  } = useStaff();

  // Estado para modal de atribuição de staff
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(null); // 'hospitais' | 'consultorio' | null

  // Hook para dados da escala do dia (P1-P11)
  const {
    plantoesManha,
    plantoesTarde,
    ferias: feriasData,
    plantoes: plantoesCombinados,
    plantoesFDS,
    plantoesperiodoAtual,
    isWeekend,
    periodoAtual,
    totalPlantoes,
    expanded,
    toggleExpanded,
    loading: plantoesLoading,
    error: plantoesError,
    usandoMock: plantoesUsandoMock,
    refetch: refetchPlantoes,
  } = useEscalaDia();

  // Lembretes de plantão/férias na inbox (admin-only, 1x/dia)
  useShiftReminders({ dataLoaded: !plantoesLoading, usandoMock: plantoesUsandoMock })

  // Determinar subtítulo baseado no dia
  const getDiaSubtitle = () => {
    const hoje = new Date();
    const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    return diasSemana[hoje.getDay()];
  };

  // Helper: mapeia array de staff para items do card, garantindo todos os campos
  const mapStaffItems = (arr, statusOverride) =>
    arr.map(s => ({ ...s, status: statusOverride || s.status || 'ativa' }));

  // Transform hospital staff data for StaffScheduleCard
  const getHospitalSections = useMemo(() => {
    if (!staff) return [];

    const sections = [];
    const h = staff.hospitais || {};

    if (h.hro?.length)     sections.push({ label: 'HRO',      variant: 'default', items: mapStaffItems(h.hro) });
    if (h.unimed?.length)  sections.push({ label: 'UNIMED',   variant: 'default', items: mapStaffItems(h.unimed) });
    if (h.materno?.length) sections.push({ label: 'MATERNO',  variant: 'default', icon: <Building2 className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.materno) });
    if (h.ferias?.length)  sections.push({ label: 'Férias',   variant: 'default', items: mapStaffItems(h.ferias, 'ferias') });
    if (h.atestado?.length) sections.push({ label: 'ATESTADO', variant: 'default', icon: <FileText className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(h.atestado, 'atestado') });

    return sections;
  }, [staff]);

  // Transform consultorio staff data for StaffScheduleCard
  const getConsultorioSections = useMemo(() => {
    if (!staff) return [];

    const sections = [];
    const c = staff.consultorio || {};

    if (c.volanFinanceiro?.length)   sections.push({ label: 'VOLAN/FINANCEIRO',     variant: 'default', items: mapStaffItems(c.volanFinanceiro) });
    if (c.administrativo?.length)    sections.push({ label: 'ADMINISTRATIVO/RH',    variant: 'default', items: mapStaffItems(c.administrativo) });
    if (c.recepcao?.length)          sections.push({ label: 'RECEPÇÃO/ATENDIMENTO', variant: 'default', items: mapStaffItems(c.recepcao) });
    if (c.telefoneWhatsapp?.length)  sections.push({ label: 'TELEFONE/WHATSAPP',    variant: 'default', items: mapStaffItems(c.telefoneWhatsapp) });
    if (c.financeiro?.length)        sections.push({ label: 'FINANCEIRO',            variant: 'default', items: mapStaffItems(c.financeiro) });
    if (c.enfermagemQmentum?.length) sections.push({ label: 'ENFERMAGEM QMENTUM',   variant: 'default', items: mapStaffItems(c.enfermagemQmentum) });
    if (c.ferias?.length)            sections.push({ label: 'FÉRIAS',   variant: 'default', icon: <Umbrella className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(c.ferias, 'ferias') });
    if (c.atestado?.length)          sections.push({ label: 'ATESTADO', variant: 'default', icon: <FileText className="h-4 w-4" strokeWidth={2} />, items: mapStaffItems(c.atestado, 'atestado') });

    return sections;
  }, [staff]);

  // Recarregar atalhos quando a página for exibida (navegação de volta)
  useEffect(() => {
    setAtalhosSelecionados(carregarAtalhosSalvos());
  }, []);

  const { canAccessCard } = useCardPermissions();

  // Mapear atalhoId → cardId do NAV_STRUCTURE
  const ATALHO_TO_CARD = {
    calculadoras: 'calculadoras',
    criteriosUti: 'criterios_uti',
    reportar: 'relatar_notificacao',
    rops: 'rops_desafio',
    indicadores: 'painel_gestao',
    biblioteca: 'biblioteca',
    auditorias: 'auditorias',
    faturamento: 'faturamento',
    incidentes: 'incidentes',
    relatorios: 'relatorios',
    'gestao-documental': 'gestao_documental',
    'ranking-rops': 'rops_desafio',
    'qualidade-hub': 'qualidade',
    'educacao-continuada': 'educacao_continuada',
    reunioes: 'reunioes',
    escalas: 'escalas',
    desastres: 'desastres',
    organograma: 'organograma',
    comites: 'comites',
    'etica-bioetica': 'etica_bioetica',
    manutencao: 'manutencao',
    plantao: 'plantao',
  };

  // Montar items para QuickLinksGrid
  const quickLinkItems = atalhosSelecionados.map((id) => {
    const atalho = ATALHOS_DISPONIVEIS.find((a) => a.id === id);
    if (!atalho) return null;
    const cardId = ATALHO_TO_CARD[id] || id;
    if (!canAccessCard(cardId)) return null;
    return {
      icon: atalho.icon,
      label: atalho.label,
      onClick: () => handleAtalhoClick(id),
    };
  }).filter(Boolean);

  // Handler para clique nos atalhos
  const handleAtalhoClick = (id) => {
    // Manutenção abre URL externa (FixCare)
    if (id === 'manutencao') {
      window.open('https://app.fixcare.io/auth', '_blank');
      return;
    }

    // Mapear atalhos para navegação
    const navigationMap = {
      calculadoras: 'calculadoras',
      criteriosUti: 'criteriosUti',
      reportar: 'novoIncidente',
      rops: 'ropsDesafio',
      indicadores: 'painelGestao',
      auditorias: 'auditorias',
      etica: 'eticaBioetica',
      desastres: 'desastres',
      protocolos: 'biblioteca',
      biblioteca: 'biblioteca',
      infeccao: 'kpiInfeccao',
      podcasts: 'ropsPodcasts',
      residencia: 'residencia',
      organograma: 'organograma',
      comites: 'comites',
      comunicados: 'comunicados',
      pendencias: 'pendencias',
      financeiro: 'financeiro',
      escalas: 'escalas',
      'qualidade-hub': 'qualidade',
      'educacao-continuada': 'educacaoContinuada',
      reunioes: 'reunioes',
      // Novos atalhos v3.28
      faturamento: 'faturamento',
      incidentes: 'incidentes',
      relatorios: 'relatorios',
      'gestao-documental': 'gestaoDocumental',
      'ranking-rops': 'ropsRanking',
      mensagens: 'inbox',
      'meus-relatos': 'meusRelatos',
    };
    const page = navigationMap[id];
    if (page) {
      onNavigate(page);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-28">
      {/* Container scrollable com padding */}
      <div className="px-4 pt-6 sm:px-5 lg:px-6 xl:px-8">
        {/* Header nao fixo - rola com a pagina */}
        <Header
          greeting={`Olá, ${user.firstName}`}
          userName={`${user.firstName} ${user.lastName}`}
          notificationCount={pendenciasCount}
          onNotificationClick={() => onNavigate('inbox')}
          onAvatarClick={() => onNavigate('profile')}
          avatarSrc={user.avatar}
          showDateTime
        />

        {/* SearchBar com dropdown inline */}
        <div className="relative">
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSubmit={() => { document.activeElement?.blur(); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Buscar protocolos, ROPs..."
          />

          {showDropdown && searchFocused && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-2xl bg-white shadow-lg border border-[#A5D6A7] dark:bg-[#1A2420] dark:border-[#2A3F36]">
              {/* Seções do App */}
              {results.pages.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#6B8178] mb-1">Seções</p>
                  {results.pages.slice(0, 5).map((page) => {
                    const Icon = iconMap[page.icon];
                    return (
                      <button
                        key={page.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[#F0FFF4] dark:hover:bg-[#1A2F23] active:bg-[#E8F5E9] dark:active:bg-[#243D32]"
                        onClick={() => {
                          if (page.route) onNavigate(page.route);
                          setSearch('');
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#E8F5E9] dark:bg-[#1A2F23]">
                          {Icon && <Icon className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black dark:text-white truncate">{page.label}</p>
                          {page.descricao && (
                            <p className="text-xs text-[#6B7280] dark:text-[#6B8178] truncate">{page.descricao}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#9CA3AF] dark:text-[#6B8178]" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Documentos */}
              {results.documents.length > 0 && (
                <div className="px-3 pt-2 pb-3">
                  {results.pages.length > 0 && (
                    <div className="border-t border-[#E8F5E9] dark:border-[#2A3F36] mb-2" />
                  )}
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#6B8178] mb-1">Documentos</p>
                  {results.documents.slice(0, 4).map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[#F0FFF4] dark:hover:bg-[#1A2F23] active:bg-[#E8F5E9] dark:active:bg-[#243D32]"
                      onClick={() => {
                        onNavigate('documento-detalhe', { documentoId: doc.id });
                        setSearch('');
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#E8F5E9] dark:bg-[#1A2F23]">
                        <FileSearch className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">{doc.titulo}</p>
                        {doc.descricao && (
                          <p className="text-xs text-[#6B7280] dark:text-[#6B8178] truncate">{doc.descricao}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 text-[#9CA3AF] dark:text-[#6B8178]" />
                    </button>
                  ))}
                </div>
              )}

              {/* Sem resultados */}
              {!hasResults && (
                <div className="px-4 py-6 text-center text-sm text-[#9CA3AF] dark:text-[#6B8178]">
                  Nenhum resultado encontrado
                </div>
              )}

              {/* Ver todos os resultados */}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 border-t border-[#E8F5E9] dark:border-[#2A3F36] px-3 py-3 text-sm font-medium text-[#006837] dark:text-[#2ECC71] hover:bg-[#F0FFF4] dark:hover:bg-[#1A2F23] transition-colors"
                onClick={() => {
                  onNavigate('searchResults', { query: search });
                  setSearch('');
                }}
              >
                Ver todos os resultados
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Comunicados */}
        {canAccessCard('comunicados') && (
          <div className="mb-4">
            <ComunicadosCard
              label="ÚLTIMOS"
              title="Comunicados"
              badgeText={unreadComunicados > 0 ? `${unreadComunicados} novos` : null}
              items={publicados.slice(0, 3).map(c => c.titulo)}
              onViewAll={() => onNavigate('comunicados')}
            />
          </div>
        )}

        {/* Atalhos Rápidos */}
        <div className="mb-4">
          <QuickLinksGrid
            items={quickLinkItems}
            onCustomize={() => onNavigate('personalizarAtalhos')}
          />
        </div>

        {/* Card Plantões - Integrado com API Pega Plantao */}
        {canAccessCard('plantao') && (plantoesLoading ? (
          <div className="bg-white dark:bg-[#1A2420] rounded-[20px] p-5 mb-4 shadow-sm dark:shadow-none dark:border dark:border-[#2A3F36]">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
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
          <div className="mb-4">
            <PlantaoCard
              title="Plantões"
              subtitle={getDiaSubtitle()}
              items={isWeekend ? plantoesFDS : plantoesCombinados}
              itemsManha={[]}
              itemsTarde={[]}
              maxItems={4}
              showBadge={false}
              expandable={isWeekend && plantoesFDS.length > 4}
              expanded={expanded}
              onToggleExpand={toggleExpanded}
              onViewAll={!isWeekend || plantoesFDS.length <= 4 ? () => onNavigate('escalas') : undefined}
            />
            {plantoesUsandoMock && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dados de demonstração
                </p>
                <button
                  type="button"
                  onClick={refetchPlantoes}
                  disabled={plantoesLoading}
                  className="inline-flex items-center gap-1 text-xs text-[#006837] dark:text-[#2ECC71] hover:opacity-80 transition-opacity disabled:opacity-50"
                  aria-label="Atualizar plantões"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${plantoesLoading ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Card Férias Programadas - Apenas em dias úteis */}
        {canAccessCard('ferias') && !isWeekend && (
          <div className="mb-4">
            {plantoesLoading ? (
              <div className="bg-white dark:bg-[#1A2420] rounded-[20px] p-5 shadow-sm dark:shadow-none dark:border dark:border-[#2A3F36]">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-8 rounded" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3.5 py-3.5">
                      <Skeleton className="w-12 h-12 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <FeriasCard
                  title="Férias"
                  subtitle="EQUIPE"
                  items={feriasData}
                  maxItems={7}
                  showBadge={false}
                />
                {plantoesUsandoMock && feriasData.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                    Dados de demonstração
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Card Estágios Residência */}
        {canAccessCard('estagios_residencia') && <SectionCard
          title={<>Estágios Residência{formatCardMeta(estagiosCardData, estagiosCardTurno) && <p className="text-[13px] font-normal text-muted-foreground">{formatCardMeta(estagiosCardData, estagiosCardTurno)}</p>}</>}
          className="mb-4"
          headerAction={
            canEditResidencia && (
              <button
                type="button"
                onClick={() => setShowEstagiosModal(true)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#006837] dark:text-[#2ECC71] hover:bg-[#D4EDDA] dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
                aria-label="Editar estágios"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100 dark:border-[#2A3F36]">
                  <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider pr-2">
                    Residente
                  </th>
                  <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider px-2">
                    Estágio
                  </th>
                  <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider pl-2">
                    Cirurgião
                  </th>
                </tr>
              </thead>
              <tbody>
                {residentes.filter(r => r.nome).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-[#2A3F36] last:border-0">
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <ResidenteIcon ano={r.ano || 'R1'} />
                        <span className="text-sm font-medium text-black dark:text-white">
                          {(r.nome || '').split(' ')[0] || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-sm text-[#6B7280] dark:text-[#A3B8B0]">
                      {r.estagio || '-'}
                    </td>
                    <td className="py-2.5 pl-2 text-sm text-[#6B7280] dark:text-[#A3B8B0]">
                      {r.cirurgiao
                        ? r.cirurgiao.replace(/^(Dr\.|Dra\.)\s*/i, '').split(' ')[0]
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>}

        {/* Card Plantão Residência */}
        {canAccessCard('plantao_residencia') && <SectionCard
          title={<>Plantão Residência{formatCardMeta(plantaoCardData, plantaoCardTurno) && <p className="text-[13px] font-normal text-muted-foreground">{formatCardMeta(plantaoCardData, plantaoCardTurno)}</p>}</>}
          className="mb-4"
          headerAction={
            canEditResidencia && (
              <button
                type="button"
                onClick={() => setShowPlantaoModal(true)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#006837] dark:text-[#2ECC71] hover:bg-[#D4EDDA] dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
                aria-label="Editar plantão"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )
          }
        >
          <div className="flex items-center gap-3">
            <ResidenteIcon ano={plantao.ano} />
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-black dark:text-white">
                {plantao.residente}
              </p>
              <p className="text-[13px] text-[#9CA3AF] dark:text-[#6B8178]">
                {plantao.data}
              </p>
            </div>
            <span className="text-base font-bold text-[#9BC53D] dark:text-[#2ECC71]">
              {plantao.hora}
            </span>
          </div>
        </SectionCard>}

        {/* Card Escala de Funcionários */}
        {canAccessCard('escala_funcionarios') && (staffLoading ? (
          <div className="bg-white dark:bg-[#1A2420] rounded-[20px] p-5 mb-4 shadow-sm dark:shadow-none dark:border dark:border-[#2A3F36]">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3.5 py-3.5">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            {/* Hospitais - Técnicas de Enfermagem */}
            <StaffScheduleCard
              subtitle="HOSPITAIS"
              title="Técnicas de Enfermagem"
              meta={formatCardMeta(staff?.hospitaisCardData, staff?.hospitaisCardTurno)}
              sections={getHospitalSections}
              canEdit={canEditStaff}
              onEdit={() => setShowAssignStaffModal('hospitais')}
            />

            {/* Consultório - Secretárias */}
            <StaffScheduleCard
              subtitle="CONSULTÓRIO"
              title="Secretárias"
              meta={formatCardMeta(staff?.consultorioCardData, staff?.consultorioCardTurno)}
              sections={getConsultorioSections}
              canEdit={canEditStaff}
              onEdit={() => setShowAssignStaffModal('consultorio')}
            />

            {staffUsandoMock && (getHospitalSections.length > 0 || getConsultorioSections.length > 0) && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dados de demonstração
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('gestao', { tab: 'funcionarios' })}
                  className="inline-flex items-center gap-1 text-xs text-[#006837] dark:text-[#2ECC71] hover:opacity-80 transition-opacity"
                  aria-label="Ver todos os funcionários"
                >
                  <span>Ver todos</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Modais de Edição - Residência */}
        <EditEstagiosModal
          open={showEstagiosModal}
          onClose={() => setShowEstagiosModal(false)}
          residentes={residentes}
          cardData={estagiosCardData}
          cardTurno={estagiosCardTurno}
          onSave={saveEstagios}
          saving={savingEstagios}
        />

        <EditPlantaoModal
          open={showPlantaoModal}
          onClose={() => setShowPlantaoModal(false)}
          plantao={plantao}
          cardData={plantaoCardData}
          cardTurno={plantaoCardTurno}
          residentes={residentes}
          onSave={savePlantao}
          saving={savingPlantao}
        />

        {/* Modal de Atribuição de Staff */}
        {showAssignStaffModal !== null && staff && (
          <AssignStaffModal
            open
            type={showAssignStaffModal || 'hospitais'}
            staff={staff}
            cardData={staff?.[(showAssignStaffModal || 'hospitais') === 'hospitais' ? 'hospitaisCardData' : 'consultorioCardData']}
            cardTurno={staff?.[(showAssignStaffModal || 'hospitais') === 'hospitais' ? 'hospitaisCardTurno' : 'consultorioCardTurno']}
            onClose={() => setShowAssignStaffModal(null)}
            onSave={saveStaff}
            saving={savingStaff}
          />
        )}
      </div>
    </div>
  );
}
