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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
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
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5 py-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] animate-pulse">
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
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="px-4 sm:px-5 py-4">
          <div className="rounded-[20px] p-8 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] text-center">
            <p className="text-[#6B7280] mb-4">Nota fiscal não encontrada</p>
            <Button variant="default" onClick={goBack}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_NOTA[nota.status?.toUpperCase()] || STATUS_NOTA.EMITIDA;

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Header Card */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#004225]/10 dark:bg-[#2ECC71]/10 rounded-lg">
                <FileText className="w-5 h-5 text-[#004225] dark:text-[#2ECC71]" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#004225] dark:text-white">
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
            <span className="text-sm text-[#6B7280]">{nota.healthInsuranceName}</span>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-[#34C759]" />
              <span className="text-2xl font-bold text-[#006837] dark:text-[#2ECC71]">
                {formatarMoeda(nota.totalValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] space-y-3">
          <p className="font-medium text-[#004225] dark:text-white mb-2">Informações</p>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-[#6B7280]" />
              <div>
                <p className="text-xs text-[#6B7280]">Número</p>
                <p className="text-sm text-[#004225] dark:text-white">{nota.number || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-[#6B7280]" />
              <div>
                <p className="text-xs text-[#6B7280]">Convênio</p>
                <p className="text-sm text-[#004225] dark:text-white">{nota.healthInsuranceName || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#6B7280]" />
              <div>
                <p className="text-xs text-[#6B7280]">Data de Emissão</p>
                <p className="text-sm text-[#004225] dark:text-white">{formatDate(nota.issueDate)}</p>
              </div>
            </div>

            {nota.dueDate && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[#6B7280]" />
                <div>
                  <p className="text-xs text-[#6B7280]">Vencimento</p>
                  <p className="text-sm text-[#004225] dark:text-white">{formatDate(nota.dueDate)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Eventos vinculados */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36]">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-[#004225] dark:text-[#2ECC71]" />
            <span className="font-medium text-[#004225] dark:text-white">Eventos Vinculados</span>
            <span className="text-xs text-[#6B7280]">({nota.events?.length || 0})</span>
          </div>

          {nota.events && nota.events.length > 0 ? (
            <div className="space-y-2">
              {nota.events.map((eventoId, index) => (
                <button
                  key={eventoId}
                  type="button"
                  onClick={() => onNavigate('faturamentoEventoDetalhe', { id: eventoId })}
                  className="w-full flex items-center justify-between p-3 bg-[#F0FFF4] dark:bg-[#111916] rounded-xl text-left hover:bg-[#E8F5E9] dark:hover:bg-[#1A2420] transition-colors"
                >
                  <span className="text-sm text-[#004225] dark:text-white">
                    Evento #{index + 1}
                  </span>
                  <span className="text-xs text-[#006837] dark:text-[#2ECC71]">Ver detalhe</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6B7280] text-center py-2">Nenhum evento vinculado</p>
          )}
        </div>

        {/* Resumo Financeiro */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36]">
          <p className="font-medium text-[#004225] dark:text-white mb-3">Resumo Financeiro</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Valor Total</span>
              <span className="font-bold text-[#004225] dark:text-white">{formatarMoeda(nota.totalValue)}</span>
            </div>
            {nota.glosaValue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Glosa</span>
                <span className="font-bold text-[#DC2626]">-{formatarMoeda(nota.glosaValue)}</span>
              </div>
            )}
            {nota.paidValue > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-[#E8F5E9] dark:border-[#2A3F36]">
                <span className="text-[#6B7280]">Valor Pago</span>
                <span className="font-bold text-[#34C759]">{formatarMoeda(nota.paidValue)}</span>
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
