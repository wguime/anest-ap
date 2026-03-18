/**
 * EventoDetalhePage - Visualização detalhada de um evento de faturamento
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Calendar,
  Building2,
  User,
  Stethoscope,
  DollarSign,
  FileText,
  Clock,
  Edit3,
  CheckCircle,
} from 'lucide-react';
import { Badge, Button, BottomNav } from '@/design-system';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';
import { useEvento } from '../../hooks/useFaturamento';
import { formatarMoeda, STATUS_EVENTO } from '../../data/cbhpmData';

function EventoDetalheContent({ onNavigate, goBack, params }) {
  const eventoId = params?.id;
  const { evento, loading, updateEvento } = useEvento(eventoId);
  const [updating, setUpdating] = useState(false);

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
            Detalhe do Evento
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    await updateEvento({ status: newStatus });
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5 py-4 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-[20px] p-4 bg-card border border-border animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5 py-4">
          <div className="rounded-[20px] p-8 bg-card border border-border text-center">
            <p className="text-muted-foreground mb-4">Evento não encontrado</p>
            <Button variant="default" onClick={goBack}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_EVENTO[evento.status?.toUpperCase()] || STATUS_EVENTO.RASCUNHO;

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Status e Valor */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <Badge
              variant="default"
              badgeStyle="solid"
              style={{ backgroundColor: statusInfo.cor, color: 'white' }}
            >
              {statusInfo.descricao}
            </Badge>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-success" />
              <span className="text-2xl font-bold text-primary">
                {formatarMoeda(evento.finalValue)}
              </span>
            </div>
          </div>
          {evento.porte && (
            <p className="text-xs text-muted-foreground">
              Porte: <span className="font-semibold text-foreground">{evento.porte}</span>
              {evento.baseValue ? ` (Base: ${formatarMoeda(evento.baseValue)})` : ''}
            </p>
          )}
        </div>

        {/* Paciente */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Paciente</span>
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            {evento.patientName}
          </h3>
          {evento.patientDocument && (
            <p className="text-sm text-muted-foreground">CPF: {evento.patientDocument}</p>
          )}
        </div>

        {/* Procedimento */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Procedimento</span>
          </div>
          {evento.procedureCode && (
            <p className="text-sm text-muted-foreground mb-1">Código: {evento.procedureCode}</p>
          )}
          <p className="text-sm text-foreground">
            {evento.procedureDescription || 'Não informado'}
          </p>
          {evento.type && (
            <p className="text-xs text-muted-foreground mt-2">
              Tipo: <span className="capitalize">{evento.type}</span>
            </p>
          )}
        </div>

        {/* Informações */}
        <div className="rounded-[20px] p-4 bg-card border border-border space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Informações</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm text-foreground">{formatDate(evento.eventDate)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Hospital</p>
                <p className="text-sm text-foreground">{evento.hospitalName || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Stethoscope className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Convênio</p>
                <p className="text-sm text-foreground">{evento.healthInsuranceName || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cirurgião</p>
                <p className="text-sm text-foreground">{evento.surgeonName || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Anestesista</p>
                <p className="text-sm text-foreground">{evento.anesthesiologistName || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Observações */}
        {evento.observations && (
          <div className="rounded-[20px] p-4 bg-card border border-border">
            <p className="text-sm font-medium text-foreground mb-2">Observações</p>
            <p className="text-sm text-muted-foreground">{evento.observations}</p>
          </div>
        )}

        {/* Ações */}
        <div className="rounded-[20px] p-4 bg-card border border-border space-y-2">
          <p className="text-sm font-medium text-foreground mb-2">Ações</p>
          <div className="flex gap-2">
            {evento.status === 'rascunho' && (
              <Button
                variant="default"
                size="sm"
                leftIcon={<CheckCircle className="w-4 h-4" />}
                onClick={() => handleStatusChange('pendente')}
                disabled={updating}
              >
                Enviar
              </Button>
            )}
            {evento.status === 'pendente' && (
              <Button
                variant="success"
                size="sm"
                leftIcon={<CheckCircle className="w-4 h-4" />}
                onClick={() => handleStatusChange('aprovado')}
                disabled={updating}
              >
                Aprovar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit3 className="w-4 h-4" />}
              onClick={goBack}
            >
              Voltar
            </Button>
          </div>
        </div>
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

export default function EventoDetalhePage({ onNavigate, goBack, params }) {
  return (
    <FaturamentoProvider>
      <EventoDetalheContent onNavigate={onNavigate} goBack={goBack} params={params} />
    </FaturamentoProvider>
  );
}
