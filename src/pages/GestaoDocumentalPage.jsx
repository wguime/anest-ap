import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, ComunicadosCard, WidgetCard } from '@/design-system';
import {
  GraduationCap,
  FolderOpen,
  BookOpen,
  Users,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { useDocuments } from '@/hooks/useDocuments';

export default function GestaoDocumentalPage({ onNavigate, goBack }) {
  const [activeNav, setActiveNav] = useState('shield');

  // Document counts from SSOT
  const { counts, overdueDocuments, pendingApproval } = useDocuments();

  const bibliotecaItems = useMemo(() => [
    `${counts.biblioteca || 0} documentos ativos`,
    overdueDocuments.length > 0
      ? `${overdueDocuments.length} revisao(oes) vencida(s)`
      : 'Revisoes em dia',
  ], [counts.biblioteca, overdueDocuments.length]);

  const comitesItems = useMemo(() => [
    `${counts.comites || 0} documentos ativos`,
    pendingApproval.length > 0
      ? `${pendingApproval.length} pendente(s) de aprovacao`
      : 'Sem pendencias',
  ], [counts.comites, pendingApproval.length]);

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Gestão Documental
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

      {/* Espacador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Header com icone e titulo */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "flex items-center justify-center",
              "w-12 h-12 rounded-xl",
              "bg-[#E8F5E9] dark:bg-[#243530]"
            )}
          >
            <FolderOpen className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Gestão Documental</h2>
            <p className="text-sm text-muted-foreground">
              Biblioteca e Comitês Institucionais
            </p>
          </div>
        </div>

        {/* Card: Biblioteca de Documentos */}
        <div className="mb-3">
          <ComunicadosCard
            label="DOCUMENTOS"
            title="Biblioteca de Documentos"
            badgeText="Acessar"
            items={bibliotecaItems}
            onViewAll={() => onNavigate('biblioteca')}
          />
        </div>

        {/* Card: Comitês Institucionais */}
        <div className="mb-4">
          <ComunicadosCard
            label="GOVERNANÇA"
            title="Comitês Institucionais"
            badgeText="Acessar"
            items={comitesItems}
            onViewAll={() => onNavigate('comites')}
          />
        </div>

        {/* Info Footer */}
        <div
          className={cn(
            "mt-6 p-4 rounded-xl",
            "bg-[#E8F5E9] dark:bg-[#1A2420]",
            "border border-[#A5D6A7] dark:border-[#2A3F36]"
          )}
        >
          <p className="text-xs text-muted-foreground">
            <strong>Sobre a Gestão Documental:</strong> Acesse a Biblioteca de Documentos
            para protocolos, políticas, formulários e manuais. Os Comitês Institucionais
            contêm documentos de governança, atas de reuniões e regulamentos internos.
          </p>
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-[#6B7280] dark:text-[#6B8178]"
                fill="none"
              />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
