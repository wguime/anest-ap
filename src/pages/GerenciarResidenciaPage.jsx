/**
 * GerenciarResidenciaPage
 * Página de gerenciamento de residentes, estágios e plantão
 */
import { useState } from 'react';
import {
  SectionCard,
  Button,
  Input,
  Select,
  Modal,
  useToast,
} from '@/design-system';
import { PageHeader } from '../components';
import { useResidencia } from '../hooks/useResidencia';
import { Users, GraduationCap, Calendar, Pencil, Save, X, Plus, Trash2, AlertTriangle } from 'lucide-react';

// Badge de ano do residente (DS green for dark mode)
function ResidenteAno({ ano }) {
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-[#E8F5E9] text-[#004225] dark:bg-[#1A2F23] dark:text-[#2ECC71]"
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

  // Estados para exclusão de residente
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [residenteToDelete, setResidenteToDelete] = useState(null);

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

  // Salvar residentes
  const handleSaveResidentes = async () => {
    const result = await saveEstagios(editedResidentes);
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

  // Abrir modal de plantão
  const openPlantaoModal = () => {
    setEditedPlantao({ ...plantao });
    setShowPlantaoModal(true);
  };

  // Salvar plantão
  const handleSavePlantao = async () => {
    if (!editedPlantao.residente || !editedPlantao.data || !editedPlantao.hora) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos',
        variant: 'warning',
      });
      return;
    }

    const result = await savePlantao(editedPlantao);
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

  // Handler para mudança de residente no plantão
  const handlePlantaoResidenteChange = (residenteNome) => {
    const residenteSelecionado = residentes.find(r => r.nome === residenteNome);
    if (residenteSelecionado) {
      setEditedPlantao(prev => ({
        ...prev,
        residente: residenteNome,
        ano: residenteSelecionado.ano,
      }));
    }
  };

  // Opções de ano
  const anoOptions = [
    { value: 'R1', label: 'R1' },
    { value: 'R2', label: 'R2' },
    { value: 'R3', label: 'R3' },
  ];

  // Opções de residentes para o select do plantão
  const residenteOptions = residentes.map(r => ({
    value: r.nome,
    label: `${r.nome} (${r.ano})`,
  }));

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
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
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
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
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#006837] dark:text-[#2ECC71] hover:bg-[#D4EDDA] dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
                aria-label="Editar residentes"
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : null
          }
        >
          {editingResidentes ? (
            <div className="space-y-4">
              {editedResidentes.map((residente, index) => (
                <div
                  key={residente.id}
                  className="p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Input
                      label="Nome Completo"
                      value={residente.nome || ''}
                      onChange={(e) => handleResidenteChange(index, 'nome', e.target.value)}
                      placeholder="Nome do residente"
                    />
                    <Select
                      label="Ano"
                      value={residente.ano}
                      onChange={(value) => handleResidenteChange(index, 'ano', value)}
                      options={anoOptions}
                    />
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
                  <tr className="text-left border-b border-gray-100 dark:border-[#2A3F36]">
                    <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider px-2">
                      Residente
                    </th>
                    <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider px-2">
                      Ano
                    </th>
                    <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider px-2">
                      Estágio
                    </th>
                    <th className="pb-2 text-xs font-medium text-[#9CA3AF] dark:text-[#6B8178] uppercase tracking-wider px-2">
                      Cirurgião
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {residentes.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-[#2A3F36] last:border-0">
                      <td className="py-2.5 px-2 text-sm font-medium text-black dark:text-white">
                        {r.nome}
                      </td>
                      <td className="py-2.5 px-2">
                        <ResidenteAno ano={r.ano} />
                      </td>
                      <td className="py-2.5 px-2 text-sm text-[#6B7280] dark:text-[#A3B8B0]">
                        {r.estagio}
                      </td>
                      <td className="py-2.5 px-2 text-sm text-[#6B7280] dark:text-[#A3B8B0]">
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
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#006837] dark:text-[#2ECC71] hover:bg-[#D4EDDA] dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
              aria-label="Editar plantão"
            >
              <Pencil className="w-4 h-4" />
            </button>
          }
        >
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 dark:bg-muted/10">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-[#E8F5E9] text-[#004225] dark:bg-[#1A2F23] dark:text-[#2ECC71]"
            >
              {plantao.ano}
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-black dark:text-white">
                {plantao.residente}
              </p>
              <p className="text-sm text-[#9CA3AF] dark:text-[#6B8178]">
                {plantao.data}
              </p>
            </div>
            <span className="text-lg font-bold text-[#9BC53D] dark:text-[#2ECC71]">
              {plantao.hora}
            </span>
          </div>
        </SectionCard>

        {/* Informações */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Sincronização automática
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
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
            <Select
              label="Residente"
              value={editedPlantao.residente || ''}
              onChange={handlePlantaoResidenteChange}
              options={residenteOptions}
              placeholder="Selecione o residente"
            />
            <Input
              label="Data"
              value={editedPlantao.data || ''}
              onChange={(e) => setEditedPlantao(prev => ({ ...prev, data: e.target.value }))}
              placeholder="Ex: Quarta, 15 Jan"
            />
            <Input
              label="Hora"
              value={editedPlantao.hora || ''}
              onChange={(e) => setEditedPlantao(prev => ({ ...prev, hora: e.target.value }))}
              placeholder="Ex: 19:00"
            />
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
