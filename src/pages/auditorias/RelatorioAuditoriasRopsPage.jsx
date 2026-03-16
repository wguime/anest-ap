import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav, Badge, useToast } from '@/design-system';
import { GraduationCap, ChevronLeft, FileBarChart, FileText, Download, Calendar, User, CheckCircle, AlertCircle, Clock } from 'lucide-react';

// ============================================================================
// DADOS DOS RELATORIOS DE AUDITORIAS DAS ROPS
// ============================================================================

const RELATORIOS = [
  {
    id: 'rel-2025-q1',
    titulo: 'Relatorio de Auditorias das ROPs 2.2025',
    periodo: 'Janeiro - Fevereiro 2025',
    dataPublicacao: '15/02/2025',
    responsavel: 'Comite de Qualidade',
    status: 'disponivel',
    arquivo: 'Documentos/7 - Ficha Tecnica Indicadores/Relatorio de Auditorias das ROPS 2.2025.pdf',
  },
  {
    id: 'rel-2024-q4',
    titulo: 'Relatorio de Auditorias das ROPs Q4.2024',
    periodo: 'Outubro - Dezembro 2024',
    dataPublicacao: '15/01/2025',
    responsavel: 'Comite de Qualidade',
    status: 'disponivel',
    arquivo: null,
  },
  {
    id: 'rel-2024-q3',
    titulo: 'Relatorio de Auditorias das ROPs Q3.2024',
    periodo: 'Julho - Setembro 2024',
    dataPublicacao: '15/10/2024',
    responsavel: 'Comite de Qualidade',
    status: 'disponivel',
    arquivo: null,
  },
];

const ROPS_AUDITADOS = [
  { id: 'rop1', nome: 'Identificacao do Paciente', status: 'conforme', percentual: 98 },
  { id: 'rop2', nome: 'Comunicacao Efetiva', status: 'conforme', percentual: 95 },
  { id: 'rop3', nome: 'Seguranca de Medicamentos', status: 'atencao', percentual: 88 },
  { id: 'rop4', nome: 'Cirurgia Segura', status: 'conforme', percentual: 97 },
  { id: 'rop5', nome: 'Prevencao de Quedas', status: 'conforme', percentual: 94 },
  { id: 'rop6', nome: 'Prevencao de Infeccoes', status: 'conforme', percentual: 92 },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioAuditoriasRopsPage({ onNavigate }) {
  const { toast } = useToast();
  const [activeNav, setActiveNav] = useState('shield');

  const handleNavigate = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  const handleOpenDocument = (arquivo, titulo) => {
    if (arquivo) {
      // Em producao, abriria o PDF
      toast({ title: titulo, description: 'Em produção, o PDF será aberto.' });
    } else {
      toast({ title: 'Indisponível', description: 'Documento não disponível no momento.', variant: 'destructive' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'conforme': return { bg: '#E8F5E9', text: '#059669', border: '#A5D6A7' };
      case 'atencao': return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' };
      case 'nao_conforme': return { bg: '#FEE2E2', text: '#dc2626', border: '#FCA5A5' };
      default: return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };
    }
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => handleNavigate('auditorias')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Relatorio de Auditorias das ROPs
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {/* Header Card */}
        <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-4 border border-[#C8E6C9] dark:border-[#2A3F36]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
              <FileBarChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[#004225] dark:text-white">Auditorias das ROPs</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">Consolidado das Praticas Organizacionais Requeridas</p>
            </div>
          </div>
        </div>

        {/* Status Geral das ROPs */}
        <SectionCard title="Status das ROPs" icon={<CheckCircle className="w-5 h-5 text-[#059669]" />}>
          <div className="space-y-2">
            {ROPS_AUDITADOS.map((rop) => {
              const colors = getStatusColor(rop.status);
              return (
                <div
                  key={rop.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-[#243530] rounded-lg border border-[#C8E6C9] dark:border-[#2A3F36]"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {rop.status === 'conforme' ? (
                      <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#B45309] flex-shrink-0" />
                    )}
                    <span className="text-sm text-[#004225] dark:text-white truncate">
                      {rop.nome}
                    </span>
                  </div>
                  <div
                    className="px-2 py-1 rounded text-xs font-semibold"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {rop.percentual}%
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Relatorios Disponiveis */}
        <SectionCard title="Relatorios Disponiveis" icon={<FileText className="w-5 h-5 text-[#2563eb]" />}>
          <div className="space-y-3">
            {RELATORIOS.map((relatorio) => (
              <button
                key={relatorio.id}
                onClick={() => handleOpenDocument(relatorio.arquivo, relatorio.titulo)}
                className="w-full bg-white dark:bg-[#243530] rounded-xl p-4 border border-[#C8E6C9] dark:border-[#2A3F36] hover:border-[#059669] dark:hover:border-[#2ECC71] transition-all active:scale-[0.98] text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#dc2626] to-[#991B1B] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#004225] dark:text-white text-sm mb-1">
                      {relatorio.titulo}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] dark:text-[#6B8178]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {relatorio.periodo}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {relatorio.responsavel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={relatorio.arquivo ? 'success' : 'secondary'}
                        size="sm"
                      >
                        {relatorio.arquivo ? 'Disponivel' : 'Em breve'}
                      </Badge>
                      {relatorio.arquivo && (
                        <span className="text-xs text-[#059669] dark:text-[#2ECC71] flex items-center gap-1">
                          <Download className="w-3 h-3" />
                          Clique para abrir
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Informacoes */}
        <div className="bg-[#DBEAFE] dark:bg-[#1e3a5f]/30 rounded-xl p-4 border border-[#93C5FD] dark:border-[#1e40af]">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-[#1e40af] dark:text-[#93C5FD] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#1e40af] dark:text-[#93C5FD] mb-1">
                Periodicidade
              </h4>
              <p className="text-sm text-[#2563eb] dark:text-[#60A5FA] leading-relaxed">
                Os relatorios de auditorias das ROPs sao elaborados trimestralmente
                pelo Comite de Qualidade e apresentados a Direcao. Os resultados
                sao utilizados para definir acoes de melhoria continua.
              </p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-[#6B7280] dark:text-[#6B8178]" fill="none" />, active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') handleNavigate('home');
          else if (item.id === 'shield') handleNavigate('gestao');
          else if (item.id === 'education') handleNavigate('educacao');
          else if (item.id === 'menu') handleNavigate('menuPage');
        }}
      />
    </div>
  );
}
