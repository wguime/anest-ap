/**
 * GerenciarResidenciaPage
 * Página de gerenciamento de residentes, estágios e plantão
 */
import { useState } from 'react';
import { SectionCard, Button, Input, Select, Modal, useToast } from '@/design-system';
import { PageHeader } from '../components';
import { useResidencia } from '../hooks/useResidencia';
import { Users, Pencil, Save, X } from 'lucide-react';

// Badge de ano do residente (DS green for dark mode)
function ResidenteAno({ ano }) {
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-muted text-foreground dark:bg-muted dark:text-primary"
    >
      {ano}
    </span>
  );
}

export default function GerenciarResidenciaPage({ onNavigate }) {
  const { toast } = useToast();
  const {
    residentes,
    plantao,
    canEdit,
    saveEstagios,
    savePlantao,
    savingEstagios,
    savingPlantao,
  } = useResidencia();

  // Estados de edição
  const [editingResidentes, setEditingResidentes] = useState(false);
  const [editedResidentes, setEditedResidentes] = useState([]);
  const [showPlantaoModal, setShowPlantaoModal] = useState(false);
  const [editedPlantao, setEditedPlantao] = useState({});

  // Iniciar edição de residentes
  const startEditingResidentes = () => {
    setEditedResidentes(JSON.parse(JSON.stringify(residentes)));
    setEditingResidentes(true);
  };

  // Cancelar edição
  const cancelEditingResidentes = () => {
    setEditedResidentes([]);
    setEditingResidentes(false);
  };

  // Atualizar campo de residente
  const handleResidenteChange = (index, field, value) => {
    setEditedResidentes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Salvar residentes (cirurgião + override de estágio para o slot atual)
  const handleSaveResidentes = async () => {
    const cirurgiaos = {};
    const estagiosOverride = {};
    editedResidentes.forEach((r) => {
      if (r.cirurgiao && r.cirurgiao.trim()) cirurgiaos[r.id] = r.cirurgiao.trim();
      if (r.estagio && r.estagio.trim()) estagiosOverride[r.id] = r.estagio.trim();
    });

    const result = await saveEstagios({ cirurgiaos, estagiosOverride });
    if (result.success) {
      toast({
        title: 'Salvo',
        description: 'Dados dos residentes atualizados com sucesso',
        variant: 'success',
      });
      setEditingResidentes(false);
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível salvar',
        variant: 'destructive',
      });
    }
  };

  // Abrir modal de plantão (apenas residente é editável; data/hora vêm da escala)
  const openPlantaoModal = () => {
    setEditedPlantao({ residenteId: plantao.residenteId || '' });
    setShowPlantaoModal(true);
  };

  // Salvar plantão
  const handleSavePlantao = async () => {
    if (!editedPlantao.residenteId) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um residente',
        variant: 'warning',
      });
      return;
    }

    const result = await savePlantao({ residenteId: editedPlantao.residenteId });
    if (result.success) {
      toast({
        title: 'Salvo',
        description: 'Plantão atualizado com sucesso',
        variant: 'success',
      });
      setShowPlantaoModal(false);
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível salvar',
        variant: 'destructive',
      });
    }
  };

  const handlePlantaoResidenteChange = (residenteId) => {
    setEditedPlantao({ residenteId });
  };

  // Opções de residentes para o select do plantão
  const residenteOptions = residentes.map(r => ({
    value: r.id,
    label: `${r.nome} (${r.ano})`,
  }));

  if (!canEdit) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="px-4 pt-4 sm:px-5">
          <PageHeader
            title="Gerenciar Residência"
            subtitle="Sem permissão"
            onBack={() => onNavigate('profile')}
          />
          <div className="mt-8 text-center text-muted-foreground">
            <p>Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="px-4 pt-4 sm:px-5">
        <PageHeader
          title="Gerenciar Residência"
          subtitle="Administração"
          onBack={() => onNavigate('profile')}
        />

        {/* Card: Gerenciar Residentes */}
        <SectionCard
          title="Residentes"
          className="mb-4"
          headerAction={
            !editingResidentes ? (
              <button
                type="button"
                onClick={startEditingResidentes}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-primary/20 transition-colors"
                aria-label="Editar residentes"
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : null
          }
        >
          {editingResidentes ? (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground px-1">
                Nome e ano são fixos pela tabela 2026. Edite o estágio apenas para excepções (override vale só para o slot atual).
              </div>
              {editedResidentes.map((residente, index) => (
                <div
                  key={residente.id}
                  className="p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Nome</div>
                      <div className="text-sm font-medium text-black dark:text-white">{residente.nome}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Ano</div>
                      <ResidenteAno ano={residente.ano} />
                    </div>
                    <Input
                      label="Estágio"
                      value={residente.estagio || ''}
                      onChange={(e) => handleResidenteChange(index, 'estagio', e.target.value)}
                      placeholder="Ex: UTI Adulto"
                    />
                    <Input
                      label="Cirurgião"
                      value={residente.cirurgiao || ''}
                      onChange={(e) => handleResidenteChange(index, 'cirurgiao', e.target.value)}
                      placeholder="Ex: Roberto Silva"
                    />
                  </div>
                </div>
              ))}

              {/* Botões de ação */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={cancelEditingResidentes}
                  disabled={savingEstagios}
                  leftIcon={<X className="w-4 h-4" />}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveResidentes}
                  loading={savingEstagios}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                      Residente
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                      Ano
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                      Estágio
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                      Cirurgião
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {residentes.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-2 text-sm font-medium text-black dark:text-white">
                        {r.nome}
                      </td>
                      <td className="py-2.5 px-2">
                        <ResidenteAno ano={r.ano} />
                      </td>
                      <td className="py-2.5 px-2 text-sm text-muted-foreground">
                        {r.estagio}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-muted-foreground">
                        {r.cirurgiao || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Card: Plantão da Residência */}
        <SectionCard
          title="Plantão da Residência"
          className="mb-4"
          headerAction={
            <button
              type="button"
              onClick={openPlantaoModal}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-primary/20 transition-colors"
              aria-label="Editar plantão"
            >
              <Pencil className="w-4 h-4" />
            </button>
          }
        >
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 dark:bg-muted/10">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-muted text-foreground dark:bg-muted dark:text-primary"
            >
              {plantao.ano}
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-black dark:text-white">
                {plantao.residente}
              </p>
              <p className="text-sm text-muted-foreground">
                {plantao.dataFormatada || plantao.data}
              </p>
            </div>
            <span className="text-lg font-bold text-greenLight dark:text-primary">
              {plantao.hora}
            </span>
          </div>
        </SectionCard>

        {/* Informações */}
        <div className="p-4 rounded-xl bg-info/10 dark:bg-info/20 border border-info/30">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-info mt-0.5" />
            <div>
              <p className="text-sm font-medium text-info">
                Sincronização automática
              </p>
              <p className="text-xs text-info mt-1">
                As alterações feitas aqui serão refletidas automaticamente nos cards da página inicial.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição do Plantão */}
      <Modal
        open={showPlantaoModal}
        onClose={() => setShowPlantaoModal(false)}
        title="Editar Plantão"
        description="Atualize as informações do plantão da residência"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowPlantaoModal(false)}
              disabled={savingPlantao}
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePlantao} loading={savingPlantao}>
              Salvar
            </Button>
          </>
        }
      >
        <Modal.Body>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Plantão atual</p>
              <p className="font-semibold">{plantao.dataFormatada || plantao.data || '—'}</p>
              <p className="text-muted-foreground text-xs">Horário: {plantao.hora || '—'}</p>
            </div>
            <Select
              label="Residente"
              value={editedPlantao.residenteId || ''}
              onChange={handlePlantaoResidenteChange}
              options={residenteOptions}
              placeholder="Selecione o residente"
            />
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
