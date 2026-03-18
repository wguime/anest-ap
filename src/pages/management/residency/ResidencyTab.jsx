import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, Button, Input, Select, Modal, useToast } from '@/design-system';
import { GraduationCap, Pencil, Plus, Trash2, Save, X, Users } from 'lucide-react';

/**
 * ResidencyTab - Manages medical residency (Residência) information.
 *
 * @param {Object} props
 * @param {Array<{ id: string, nome: string, ano: string, estagio: string, cirurgiao: string }>} props.residentes - List of residents
 * @param {{ residente: string, ano: string, data: string, hora: string }} props.plantao - Current on-call resident info
 * @param {(residentes: Array) => Promise<void>} props.onSaveResidentes - Callback to save residents
 * @param {(plantao: Object) => Promise<void>} props.onSavePlantao - Callback to save on-call info
 * @param {boolean} props.loading - Loading state
 */
function ResidencyTab({
  residentes = [],
  plantao = { residente: '', ano: 'R1', data: '', hora: '' },
  onSaveResidentes,
  onSavePlantao,
  loading = false,
  canEdit = true,
  connectionStatus,
}) {
  const { toast } = useToast();
  // Internal state for editing residentes
  const [editingResidentes, setEditingResidentes] = useState(false);
  const [editedResidentes, setEditedResidentes] = useState([]);
  const [savingResidentes, setSavingResidentes] = useState(false);

  // Internal state for plantao modal
  const [showPlantaoModal, setShowPlantaoModal] = useState(false);
  const [editedPlantao, setEditedPlantao] = useState({ ...plantao });
  const [savingPlantao, setSavingPlantao] = useState(false);

  // Sync editedPlantao when plantao prop changes (e.g. after Firestore fetch)
  useEffect(() => {
    if (plantao) setEditedPlantao(plantao);
  }, [plantao]);

  // Ano options for Select component
  const anoOptions = [
    { value: 'R1', label: 'R1 - Primeiro Ano' },
    { value: 'R2', label: 'R2 - Segundo Ano' },
    { value: 'R3', label: 'R3 - Terceiro Ano' },
  ];

  // Ano color mapping (DS green for dark mode support)
  const anoBadgeClasses = 'bg-muted text-foreground dark:bg-muted dark:text-primary';

  // Generate resident options for plantao select
  const residenteOptions = useMemo(() => {
    return residentes
      .filter((r) => r.nome && r.nome.trim() !== '')
      .map((r) => ({
        value: r.nome,
        label: `${r.nome} (${r.ano || 'R1'})`,
      }));
  }, [residentes]);

  // ============================================================================
  // RESIDENTES HANDLERS
  // ============================================================================

  const startEditingResidentes = () => {
    setEditedResidentes([...residentes.map((r) => ({ ...r }))]);
    setEditingResidentes(true);
  };

  const cancelEditingResidentes = () => {
    setEditedResidentes([]);
    setEditingResidentes(false);
  };

  const handleResidenteChange = (index, field, value) => {
    setEditedResidentes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddResidente = () => {
    const newResidente = {
      id: `temp-${Date.now()}`,
      nome: '',
      ano: 'R1',
      estagio: '',
      cirurgiao: '',
    };
    setEditedResidentes((prev) => [...prev, newResidente]);
  };

  const handleRemoveResidente = (index) => {
    setEditedResidentes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveResidentes = async () => {
    if (!onSaveResidentes) return;

    setSavingResidentes(true);
    try {
      // Ordenar residentes por ano (R1, R2, R3) antes de salvar
      const sortedResidentes = [...editedResidentes].sort((a, b) => {
        const anoA = a.ano || 'R1';
        const anoB = b.ano || 'R1';
        return anoA.localeCompare(anoB);
      });

      await onSaveResidentes(sortedResidentes);
      setEditingResidentes(false);
      setEditedResidentes([]);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'error' });
    } finally {
      setSavingResidentes(false);
    }
  };

  // ============================================================================
  // PLANTAO HANDLERS
  // ============================================================================

  const openPlantaoModal = () => {
    setEditedPlantao({ ...plantao });
    setShowPlantaoModal(true);
  };

  const handlePlantaoResidenteChange = (value) => {
    // Find the resident to get their ano
    const selectedResident = residentes.find((r) => r.nome === value);
    setEditedPlantao((prev) => ({
      ...prev,
      residente: value,
      ano: selectedResident?.ano || prev.ano,
    }));
  };

  const handleSavePlantao = async () => {
    if (!onSavePlantao) return;

    setSavingPlantao(true);
    try {
      await onSavePlantao(editedPlantao);
      setShowPlantaoModal(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'error' });
    } finally {
      setSavingPlantao(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderAnoBadge = (ano, size = 'sm') => {
    const sizeClasses =
      size === 'lg'
        ? 'w-10 h-10 text-sm'
        : 'px-2 py-0.5 text-xs';

    return (
      <span
        className={`inline-flex items-center justify-center rounded font-bold ${sizeClasses} ${anoBadgeClasses}`}
      >
        {ano || 'R1'}
      </span>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Connection status badge */}
      {connectionStatus && connectionStatus !== 'connected' && (
        <div className="mb-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#FEF3C7] dark:bg-[#422006] text-[#92400E] dark:text-warning w-fit">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionStatus === 'reconnecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          {connectionStatus === 'reconnecting' ? 'Reconectando...' : 'Desconectado'}
        </div>
      )}
      {connectionStatus === 'connected' && (
        <div className="mb-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#D1FAE5] dark:bg-[#064E3B] text-[#065F46] dark:text-[#6EE7B7] w-fit">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Conectado
        </div>
      )}

      {/* Info banner */}
      <div className="mb-4 p-4 rounded-xl bg-muted border border-border">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary">
              Gerenciamento da Residência
            </p>
            <p className="text-xs text-[#4A7C59] dark:text-muted-foreground mt-1">
              Gerencie os dados dos residentes e o plantão. As alterações serão refletidas nos cards da página inicial.
            </p>
          </div>
        </div>
      </div>

      {/* Card: Gerenciar Residentes */}
      <Card className="mb-4 border-border">
        <CardContent className="p-6">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-black dark:text-white">
              Residentes
            </h3>
            {!editingResidentes && canEdit && (
              <button
                type="button"
                onClick={startEditingResidentes}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
                aria-label="Editar residentes"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          {editingResidentes ? (
            <div className="space-y-4">
              {editedResidentes.map((residente, index) => (
                <div
                  key={residente.id}
                  className="p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border relative"
                >
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveResidente(index)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    aria-label="Excluir residente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                    <Input
                      label="Nome Completo"
                      value={residente.nome || ''}
                      onChange={(e) =>
                        handleResidenteChange(index, 'nome', e.target.value)
                      }
                      placeholder="Nome do residente"
                    />
                    <Select
                      label="Ano"
                      value={residente.ano}
                      onChange={(value) =>
                        handleResidenteChange(index, 'ano', value)
                      }
                      options={anoOptions}
                    />
                    <Input
                      label="Estágio"
                      value={residente.estagio || ''}
                      onChange={(e) =>
                        handleResidenteChange(index, 'estagio', e.target.value)
                      }
                      placeholder="Ex: UTI Adulto"
                    />
                    <Input
                      label="Cirurgião"
                      value={residente.cirurgiao || ''}
                      onChange={(e) =>
                        handleResidenteChange(index, 'cirurgiao', e.target.value)
                      }
                      placeholder="Ex: Roberto Silva"
                    />
                  </div>
                </div>
              ))}

              {/* Add resident button */}
              <button
                type="button"
                onClick={handleAddResidente}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-border text-primary hover:bg-muted dark:hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Adicionar Residente</span>
              </button>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={cancelEditingResidentes}
                  disabled={savingResidentes}
                  leftIcon={<X className="w-4 h-4" />}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveResidentes}
                  loading={savingResidentes}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="-mx-2">
              {residentes.filter((r) => r.nome).length === 0 ? (
                <div className="text-center py-8">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum residente cadastrado.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use o botão de edição para adicionar os residentes reais do programa.
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100 dark:border-border">
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
                    {residentes
                      .filter((r) => r.nome)
                      .map((r) => {
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-gray-50 dark:border-border last:border-0"
                          >
                            <td className="py-2.5 px-2 text-sm font-medium text-black dark:text-white">
                              {r.nome || '-'}
                            </td>
                            <td className="py-2.5 px-2">
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${anoBadgeClasses}`}
                              >
                                {r.ano || 'R1'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-sm text-muted-foreground">
                              {r.estagio || '-'}
                            </td>
                            <td className="py-2.5 px-2 text-sm text-muted-foreground">
                              {r.cirurgiao || '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card: Plantão da Residência */}
      <Card className="mb-4 border-border">
        <CardContent className="p-6">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-black dark:text-white">
              Plantão da Residência
            </h3>
            {canEdit && (
              <button
                type="button"
                onClick={openPlantaoModal}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-muted dark:hover:bg-[rgba(46,204,113,0.15)] transition-colors"
                aria-label="Editar plantão"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Plantao display */}
          {plantao.residente ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 dark:bg-muted/10">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${anoBadgeClasses}`}
              >
                {plantao.ano}
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-black dark:text-white">
                  {plantao.residente}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plantao.data}
                </p>
              </div>
              <span className="text-lg font-bold text-[#9BC53D] dark:text-primary">
                {plantao.hora}
              </span>
            </div>
          ) : (
            <div className="text-center py-6">
              <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhum plantão configurado.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique no ícone de edição para configurar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info adicional */}
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
              onChange={(e) =>
                setEditedPlantao((prev) => ({ ...prev, data: e.target.value }))
              }
              placeholder="Ex: Quarta, 15 Jan"
            />
            <Input
              label="Hora"
              value={editedPlantao.hora || ''}
              onChange={(e) =>
                setEditedPlantao((prev) => ({ ...prev, hora: e.target.value }))
              }
              placeholder="Ex: 19:00"
            />
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ResidencyTab;
