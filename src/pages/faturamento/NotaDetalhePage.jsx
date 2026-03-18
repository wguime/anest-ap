/**
 * NotaDetalhePage - Visualização detalhada de uma nota fiscal
 */
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  Hash,
  ClipboardList,
} from 'lucide-react';
import { Badge, Button, BottomNav } from '@/design-system';
import { FaturamentoProvider, useFaturamento } from '../../contexts/FaturamentoContext';
import { formatarMoeda, STATUS_NOTA } from '../../data/cbhpmData';

function NotaDetalheContent({ onNavigate, goBack, params }) {
  const notaId = params?.id;
  const { notas, loading } = useFaturamento();

  const nota = useMemo(() => {
    return notas.find(n => n.id === notaId) || null;
  }, [notas, notaId]);

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
            Detalhe da Nota
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5 py-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[20px] p-4 bg-card border border-border animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!nota) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5 py-4">
          <div className="rounded-[20px] p-8 bg-card border border-border text-center">
            <p className="text-muted-foreground mb-4">Nota fiscal não encontrada</p>
            <Button variant="default" onClick={goBack}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_NOTA[nota.status?.toUpperCase()] || STATUS_NOTA.EMITIDA;

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Header Card */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">
                  Nota {nota.number}
                </h3>
              </div>
            </div>
            <Badge
              variant="default"
              badgeStyle="solid"
              style={{ backgroundColor: statusInfo.cor, color: 'white' }}
            >
              {statusInfo.descricao}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{nota.healthInsuranceName}</span>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-success" />
              <span className="text-2xl font-bold text-primary">
                {formatarMoeda(nota.totalValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="rounded-[20px] p-4 bg-card border border-border space-y-3">
          <p className="font-medium text-foreground mb-2">Informações</p>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="text-sm text-foreground">{nota.number || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Convênio</p>
                <p className="text-sm text-foreground">{nota.healthInsuranceName || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data de Emissão</p>
                <p className="text-sm text-foreground">{formatDate(nota.issueDate)}</p>
              </div>
            </div>

            {nota.dueDate && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="text-sm text-foreground">{formatDate(nota.dueDate)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Eventos vinculados */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Eventos Vinculados</span>
            <span className="text-xs text-muted-foreground">({nota.events?.length || 0})</span>
          </div>

          {nota.events && nota.events.length > 0 ? (
            <div className="space-y-2">
              {nota.events.map((eventoId, index) => (
                <button
                  key={eventoId}
                  type="button"
                  onClick={() => onNavigate('faturamentoEventoDetalhe', { id: eventoId })}
                  className="w-full flex items-center justify-between p-3 bg-background rounded-xl text-left hover:bg-muted dark:hover:bg-card transition-colors"
                >
                  <span className="text-sm text-foreground">
                    Evento #{index + 1}
                  </span>
                  <span className="text-xs text-primary">Ver detalhe</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum evento vinculado</p>
          )}
        </div>

        {/* Resumo Financeiro */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <p className="font-medium text-foreground mb-3">Resumo Financeiro</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Total</span>
              <span className="font-bold text-foreground">{formatarMoeda(nota.totalValue)}</span>
            </div>
            {nota.glosaValue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Glosa</span>
                <span className="font-bold text-destructive">-{formatarMoeda(nota.glosaValue)}</span>
              </div>
            )}
            {nota.paidValue > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Valor Pago</span>
                <span className="font-bold text-success">{formatarMoeda(nota.paidValue)}</span>
              </div>
            )}
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

export default function NotaDetalhePage({ onNavigate, goBack, params }) {
  return (
    <FaturamentoProvider>
      <NotaDetalheContent onNavigate={onNavigate} goBack={goBack} params={params} />
    </FaturamentoProvider>
  );
}
