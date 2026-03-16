import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/design-system';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Search,
  FileText,
  Calendar,
  ChevronLeft,
  EyeOff,
  Info,
} from 'lucide-react';
import { STATUS_CONFIG, INCIDENT_TYPES, DENUNCIA_TYPES } from '@/data/incidentesConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { useUser } from '@/contexts/UserContext';

// Cores distintas para cada status (baseadas em STATUS_CONFIG)
const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
      // Amarelo - Pendente
      return { bg: 'bg-[#FEF3C7] dark:bg-[#78350F]/30', text: 'text-[#D97706] dark:text-[#FBBF24]' };
    case 'in_review':
      // Azul - Em Análise
      return { bg: 'bg-[#DBEAFE] dark:bg-[#1E3A8A]/30', text: 'text-[#2563EB] dark:text-[#60A5FA]' };
    case 'investigating':
      // Roxo - Em Investigação
      return { bg: 'bg-[#EDE9FE] dark:bg-[#5B21B6]/30', text: 'text-[#7C3AED] dark:text-[#A78BFA]' };
    case 'action_required':
      // Rosa - Ação Requerida
      return { bg: 'bg-[#FCE7F3] dark:bg-[#9D174D]/30', text: 'text-[#DB2777] dark:text-[#F472B6]' };
    case 'resolved':
      // Verde - Resolvido
      return { bg: 'bg-[#DCFCE7] dark:bg-[#166534]/30', text: 'text-[#16A34A] dark:text-[#4ADE80]' };
    case 'closed':
      // Cinza - Encerrado
      return { bg: 'bg-[#F3F4F6] dark:bg-[#374151]/30', text: 'text-[#4B5563] dark:text-[#9CA3AF]' };
    default:
      return { bg: 'bg-[#F3F4F6] dark:bg-[#374151]/30', text: 'text-[#6B7280] dark:text-[#9CA3AF]' };
  }
};

// Formatar data
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Obter título do card baseado no tipo
function getCardTitle(relato, isIncidente) {
  if (isIncidente) {
    const tipoConfig = INCIDENT_TYPES[relato.incidente?.tipo];
    return tipoConfig?.label || 'Incidente';
  }
  // Para denúncias, usar o título ou o tipo como fallback
  if (relato.denuncia?.titulo) {
    return relato.denuncia.titulo;
  }
  const tipoConfig = DENUNCIA_TYPES.find(t => t.value === relato.denuncia?.tipo);
  return tipoConfig?.label || 'Denúncia';
}

// Obter descrição truncada
function getCardDescription(relato, isIncidente) {
  const descricao = isIncidente
    ? relato.incidente?.descricao
    : relato.denuncia?.descricao;

  if (!descricao) return null;

  // Truncar para aproximadamente 80 caracteres
  if (descricao.length > 80) {
    return descricao.substring(0, 80).trim() + '...';
  }
  return descricao;
}

// Card de Relato - Seguindo padrão DS
function RelatoCard({ relato, tipo, onClick }) {
  const statusConfig = STATUS_CONFIG[relato.status] || STATUS_CONFIG.pending;
  const statusColor = getStatusColor(relato.status);
  const isIncidente = tipo === 'incidente';

  const titulo = getCardTitle(relato, isIncidente);
  const descricao = getCardDescription(relato, isIncidente);

  const handleClick = (e) => {
    e.stopPropagation();
    onClick();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Ícone do status baseado no tipo
  const getStatusIcon = () => {
    switch (relato.status) {
      case 'resolved':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'closed':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'in_review':
        return <Search className="w-3 h-3" />;
      case 'investigating':
        return <Search className="w-3 h-3" />;
      case 'action_required':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className="cursor-pointer w-full text-left p-4 rounded-2xl bg-white dark:bg-[#1A2F23] border border-[#E5E7EB] dark:border-[#2D4A3E] hover:border-[#006837] dark:hover:border-[#2ECC71] hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        {/* Icone do tipo - Incidente: verde DS, Denúncia: vermelho */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isIncidente
            ? 'bg-[#E8F5E9] dark:bg-[#243530]'
            : 'bg-[#FEE2E2] dark:bg-[#3A2020]'
        }`}>
          {isIncidente ? (
            <AlertTriangle className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-[#EF4444] dark:text-[#F87171]" />
          )}
        </div>

        {/* Conteudo */}
        <div className="flex-1 min-w-0">
          {/* Protocolo */}
          <p className="text-xs font-mono text-[#6B7280] dark:text-[#6B8178] mb-1">
            {relato.protocolo}
          </p>

          {/* Titulo */}
          <h3 className="text-sm font-semibold text-[#111827] dark:text-white mb-1 line-clamp-1">
            {titulo}
          </h3>

          {/* Descrição truncada */}
          {descricao && (
            <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-2 line-clamp-2">
              {descricao}
            </p>
          )}

          {/* Data e Status - mesma linha */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#6B8178]">
              <Calendar className="w-3 h-3" />
              {formatDate(relato.createdAt)}
            </span>

            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
              {getStatusIcon()}
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty State
function EmptyState({ tipo }) {
  const Icon = tipo === 'incidentes' ? AlertTriangle : ShieldAlert;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#006837] dark:text-[#2ECC71]" />
      </div>
      <h3 className="text-lg font-semibold text-[#111827] dark:text-white mb-2">
        Nenhum registro encontrado
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#6B8178] max-w-xs">
        Você ainda não possui {tipo === 'incidentes' ? 'incidentes' : 'denúncias'} registrados.
      </p>
    </div>
  );
}

export default function MeusRelatosPage({ onNavigate }) {
  const { incidentes, denuncias } = useIncidents();
  const { user } = useUser();
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  // Filtrar relatos do usuário logado
  const meusIncidentes = useMemo(() => {
    if (!user?.id) return [];
    return incidentes.filter((inc) => inc.userId === user.id);
  }, [incidentes, user?.id]);

  const minhasDenuncias = useMemo(() => {
    if (!user?.id) return [];
    return denuncias.filter((den) => den.userId === user.id);
  }, [denuncias, user?.id]);

  // Combinar todos os relatos com tipo
  const todosRelatos = useMemo(() => {
    const incidentes = meusIncidentes.map(item => ({ ...item, _tipo: 'incidente' }));
    const denuncias = minhasDenuncias.map(item => ({ ...item, _tipo: 'denuncia' }));
    return [...incidentes, ...denuncias].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [meusIncidentes, minhasDenuncias]);

  const handleRelatoClick = (relato) => {
    if (relato._tipo === 'incidente') {
      onNavigate('acompanhamentoIncidente', { id: relato.id });
    } else {
      onNavigate('acompanhamentoDenuncia', { id: relato.id });
    }
  };

  // Filtrar relatos baseado no filtro ativo
  const relatosFiltrados = useMemo(() => {
    if (filtroAtivo === 'todos') return todosRelatos;
    if (filtroAtivo === 'incidentes') return todosRelatos.filter(r => r._tipo === 'incidente');
    return todosRelatos.filter(r => r._tipo === 'denuncia');
  }, [todosRelatos, filtroAtivo]);

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('incidentes')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Meus Relatos
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Banner informativo */}
        <Card className="mb-4 bg-[#E8F5E9] dark:bg-[#1A2F23] border-[#C8E6C9] dark:border-[#2D4A3E]">
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#006837]/10 dark:bg-[#2ECC71]/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#006837] dark:text-[#2ECC71] mb-0.5">
                Acompanhe seus registros
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                Clique em um relato para ver detalhes e atualizações.
              </p>
            </div>
          </div>
        </Card>

        {/* LGPD: Nota sobre relatos anônimos */}
        <div className="mb-4 p-3 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F59E0B]/30">
          <div className="flex items-start gap-2">
            <EyeOff className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#A16207] dark:text-[#FBBF24]">
              <strong>Relatos anônimos</strong> não aparecem aqui para proteger sua identidade. Use o <strong>código de rastreio</strong> recebido no envio para acompanhá-los na página de rastreamento.
            </p>
          </div>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFiltroAtivo('todos')}
            className={`p-3 rounded-xl border transition-all ${
              filtroAtivo === 'todos'
                ? 'bg-[#006837] border-[#006837] dark:bg-[#2ECC71] dark:border-[#2ECC71]'
                : 'bg-white dark:bg-[#1A2F23] border-[#E5E7EB] dark:border-[#2D4A3E]'
            }`}
          >
            <p className={`text-xl font-bold ${
              filtroAtivo === 'todos'
                ? 'text-white dark:text-[#111916]'
                : 'text-[#111827] dark:text-white'
            }`}>
              {todosRelatos.length}
            </p>
            <p className={`text-xs ${
              filtroAtivo === 'todos'
                ? 'text-white/80 dark:text-[#111916]/80'
                : 'text-[#6B7280] dark:text-[#6B8178]'
            }`}>
              Todos
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('incidentes')}
            className={`p-3 rounded-xl border transition-all ${
              filtroAtivo === 'incidentes'
                ? 'bg-[#006837] border-[#006837] dark:bg-[#2ECC71] dark:border-[#2ECC71]'
                : 'bg-white dark:bg-[#1A2F23] border-[#E5E7EB] dark:border-[#2D4A3E]'
            }`}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className={`w-4 h-4 ${
                filtroAtivo === 'incidentes' ? 'text-white dark:text-[#111916]' : 'text-[#006837] dark:text-[#2ECC71]'
              }`} />
              <span className={`text-xl font-bold ${
                filtroAtivo === 'incidentes' ? 'text-white dark:text-[#111916]' : 'text-[#111827] dark:text-white'
              }`}>
                {meusIncidentes.length}
              </span>
            </div>
            <p className={`text-xs ${
              filtroAtivo === 'incidentes' ? 'text-white/80 dark:text-[#111916]/80' : 'text-[#6B7280] dark:text-[#6B8178]'
            }`}>
              Incidentes
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAtivo('denuncias')}
            className={`p-3 rounded-xl border transition-all ${
              filtroAtivo === 'denuncias'
                ? 'bg-[#EF4444] border-[#EF4444]'
                : 'bg-white dark:bg-[#1A2F23] border-[#E5E7EB] dark:border-[#2D4A3E]'
            }`}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <ShieldAlert className={`w-4 h-4 ${
                filtroAtivo === 'denuncias' ? 'text-white' : 'text-[#EF4444]'
              }`} />
              <span className={`text-xl font-bold ${
                filtroAtivo === 'denuncias' ? 'text-white' : 'text-[#111827] dark:text-white'
              }`}>
                {minhasDenuncias.length}
              </span>
            </div>
            <p className={`text-xs ${
              filtroAtivo === 'denuncias' ? 'text-white/80' : 'text-[#6B7280] dark:text-[#6B8178]'
            }`}>
              Denúncias
            </p>
          </button>
        </div>

        {/* Lista de Relatos */}
        {relatosFiltrados.length > 0 ? (
          <div className="flex flex-col gap-3">
            {relatosFiltrados.map((relato) => (
              <RelatoCard
                key={`${relato._tipo}-${relato.id}`}
                relato={relato}
                tipo={relato._tipo}
                onClick={() => handleRelatoClick(relato)}
              />
            ))}
          </div>
        ) : (
          <EmptyState tipo={filtroAtivo === 'denuncias' ? 'denuncias' : 'incidentes'} />
        )}

        {/* Nota de privacidade */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
            Apenas você pode ver seus próprios relatos
          </p>
          <p className="text-xs text-[#9CA3AF] dark:text-[#4B5E55] mt-1">
            Seus dados estão protegidos conforme a LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
