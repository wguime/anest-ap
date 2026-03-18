/**
 * ResidenciaHubPage
 * Hub/landing page para a seção Residência Médica.
 * Exibe cards de acesso rápido (Assistente IA, Trocas de Plantão),
 * tabela de estágios, card de plantão e botão admin para gerenciar.
 */
import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '../components';
import { useResidencia } from '../hooks/useResidencia';
import { EditEstagiosModal } from '../components/residencia/EditEstagiosModal';
import { EditPlantaoModal } from '../components/residencia/EditPlantaoModal';
import { Bot, ArrowLeftRight, Settings, Pencil } from 'lucide-react';

function ResidenteIcon({ ano }) {
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-muted text-foreground dark:bg-muted dark:text-primary"
    >
      {ano}
    </div>
  );
}

export default function ResidenciaHubPage({ onNavigate, goBack }) {
  const {
    residentes,
    plantao,
    canEdit,
    saveEstagios,
    savingEstagios,
    savePlantao,
    savingPlantao,
    estagiosUsandoMock,
    plantaoUsandoMock,
  } = useResidencia();

  const [showEstagiosModal, setShowEstagiosModal] = useState(false);
  const [showPlantaoModal, setShowPlantaoModal] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Residência Médica" onBack={goBack} />

      <div className="flex-1 px-4 pb-24 pt-4 max-w-lg mx-auto w-full">
        {/* Cards de acesso rápido */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          {/* Assistente IA — em standby (Edge Function deploy pendente)
          <button
            type="button"
            onClick={() => onNavigate('assistenteResidencia')}
            className="bg-card rounded-[20px] border border-border p-4 shadow-sm dark:shadow-none text-left hover:shadow-md transition-shadow active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-muted">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-black dark:text-white">Assistente IA</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dúvidas médicas e escalas</p>
          </button>
          */}

          <button
            type="button"
            onClick={() => onNavigate('trocasPlantao')}
            className="bg-card rounded-[20px] border border-border p-4 shadow-sm dark:shadow-none text-left hover:shadow-md transition-shadow active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-muted">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-black dark:text-white">Trocas de Plantão</p>
            <p className="text-xs text-muted-foreground mt-0.5">Solicitar e gerenciar</p>
          </button>
        </div>

        {/* Plantão Residência */}
        <SectionCard
          title="Plantão Residência"
          className="mb-4"
          headerAction={
            canEdit && (
              <button
                type="button"
                onClick={() => setShowPlantaoModal(true)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
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
              <p className="text-[13px] text-muted-foreground">
                {plantao.data}
              </p>
            </div>
            <span className="text-base font-bold text-[#9BC53D] dark:text-primary">
              {plantao.hora}
            </span>
          </div>
          {plantaoUsandoMock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
              Dados de demonstração
            </p>
          )}
        </SectionCard>

        {/* Estágios Residência */}
        <SectionCard
          title="Estágios Residência"
          className="mb-4"
          headerAction={
            canEdit && (
              <button
                type="button"
                onClick={() => setShowEstagiosModal(true)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
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
                <tr className="text-left border-b border-gray-100 dark:border-border">
                  <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pr-2">
                    Residente
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                    Estágio
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pl-2">
                    Cirurgião
                  </th>
                </tr>
              </thead>
              <tbody>
                {residentes.filter(r => r.nome).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-border last:border-0">
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <ResidenteIcon ano={r.ano || 'R1'} />
                        <span className="text-sm font-medium text-black dark:text-white">
                          {(r.nome || '').split(' ')[0] || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-sm text-muted-foreground">
                      {r.estagio || '-'}
                    </td>
                    <td className="py-2.5 pl-2 text-sm text-muted-foreground">
                      {r.cirurgiao
                        ? r.cirurgiao.replace(/^(Dr\.|Dra\.)\s*/i, '').split(' ')[0]
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {estagiosUsandoMock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
              Dados de demonstração
            </p>
          )}
        </SectionCard>

        {/* Botão Gerenciar Residência (somente admin/coordenador) */}
        {canEdit && (
          <button
            type="button"
            onClick={() => onNavigate('gerenciarResidencia')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-card border border-border text-primary font-semibold text-sm shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
          >
            <Settings className="w-4 h-4" />
            Gerenciar Residência
          </button>
        )}

        {/* Modais de Edição */}
        <EditEstagiosModal
          open={showEstagiosModal}
          onClose={() => setShowEstagiosModal(false)}
          residentes={residentes}
          onSave={saveEstagios}
          saving={savingEstagios}
        />

        <EditPlantaoModal
          open={showPlantaoModal}
          onClose={() => setShowPlantaoModal(false)}
          plantao={plantao}
          residentes={residentes}
          onSave={savePlantao}
          saving={savingPlantao}
        />
      </div>
    </div>
  );
}
