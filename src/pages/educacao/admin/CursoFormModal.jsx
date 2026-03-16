/**
 * CursoFormModal.jsx
 * Modal para criar/editar cursos
 */

import { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Select,
  FormField,
  Checkbox,
} from '@/design-system';
import {
  Save,
  Loader2,
  GitBranch,
  Plus,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { mockCategorias } from '../data/mockEducacaoData';
import { ReorderableList } from './components/ReorderableList';
import { BannerUpload } from './components/BannerUpload';

/**
 * CursoFormModal - Modal para criar/editar curso
 *
 * @param {boolean} open - Controle de abertura
 * @param {function} onClose - Callback de fechamento
 * @param {function} onSave - Callback de salvamento
 * @param {Object} curso - Curso para edição (null para criação)
 * @param {Array} trilhas - Lista de trilhas disponíveis para vinculação
 * @param {function} onTrilhasUpdate - Callback para atualizar trilhas quando curso é vinculado
 */
export function CursoFormModal({
  open,
  onClose,
  onSave,
  curso = null,
  trilhas = [],
  onTrilhasUpdate,
  modulos = [],
  cursoModulosRel = [],
  onLinkModuloToCurso,
  onUnlinkModuloFromCurso,
  onReorderModulosInCurso,
  onAfterSaveOpenModulo,
}) {
  const isEditing = !!curso;

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    categoriaId: 'sem-categoria',
    duracaoMinutos: '',
    metaPorcentagem: '100',
    obrigatorio: false,
    ativo: true,
    statusPublicacao: 'published', // published | draft | scheduled
    releaseAt: '',
    trilhaIds: [], // IDs das trilhas às quais este curso pertence
    banner: null, // URL do banner/thumbnail
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedModuloId, setSelectedModuloId] = useState('');

  // Calcular trilhaIds do curso em edição
  const getTrilhaIdsForCurso = (cursoId) => {
    if (!cursoId || !trilhas?.length) return [];
    return trilhas
      .filter(t => t.cursos?.includes(cursoId))
      .map(t => t.id);
  };

  // Reset form quando modal abre/fecha
  useEffect(() => {
    if (open) {
      if (curso) {
        setFormData({
          titulo: curso.titulo || '',
          descricao: curso.descricao || '',
          categoriaId: curso.categoriaId || 'sem-categoria',
          duracaoMinutos: curso.duracaoMinutos?.toString() || '',
          metaPorcentagem: curso.metaPorcentagem?.toString() || '100',
          obrigatorio: curso.obrigatorio || false,
          ativo: curso.ativo !== false,
          statusPublicacao: curso.statusPublicacao || 'published',
          releaseAt: curso.releaseAt ? new Date(curso.releaseAt).toISOString().slice(0, 16) : '',
          trilhaIds: getTrilhaIdsForCurso(curso.id),
          banner: curso.banner || null,
        });
      } else {
        setFormData({
          titulo: '',
          descricao: '',
          categoriaId: 'sem-categoria',
          duracaoMinutos: '',
          metaPorcentagem: '100',
          obrigatorio: false,
          ativo: true,
          statusPublicacao: 'draft',
          releaseAt: '',
          trilhaIds: [],
          banner: null,
        });
      }
      setErrors({});
      setSelectedModuloId('');
    }
  }, [open, curso, trilhas]);

  const linkedModuloIds = useMemo(() => {
    if (!curso?.id) return [];
    const rels = (cursoModulosRel || [])
      .filter(r => r.cursoId === curso.id)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (rels.length) return rels.map(r => r.moduloId);
    return curso.moduloIds || [];
  }, [curso?.id, curso?.moduloIds, cursoModulosRel]);

  const linkedModulos = useMemo(() => {
    const byId = new Map((modulos || []).map(m => [m.id, m]));
    return linkedModuloIds
      .map(id => byId.get(id))
      .filter(Boolean);
  }, [linkedModuloIds, modulos]);

  const modulosDisponiveis = useMemo(() => {
    const linked = new Set(linkedModuloIds);
    return (modulos || [])
      .filter(m => !linked.has(m.id))
      .map(m => ({ value: m.id, label: m.titulo }));
  }, [modulos, linkedModuloIds]);

  // Opções de categoria
  const categoriaOptions = mockCategorias.map(c => ({
    value: c.id,
    label: c.nome,
  }));

  // Handler de mudança de campo
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpar erro do campo
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handler para toggle de trilha (adicionar/remover curso da trilha)
  const handleToggleTrilha = (trilhaId) => {
    setFormData(prev => {
      const current = prev.trilhaIds || [];
      if (current.includes(trilhaId)) {
        return { ...prev, trilhaIds: current.filter(id => id !== trilhaId) };
      }
      return { ...prev, trilhaIds: [...current, trilhaId] };
    });
  };

  // Validação
  const validate = () => {
    const newErrors = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }
    if (!formData.descricao.trim()) {
      newErrors.descricao = 'Descrição é obrigatória';
    }
    if (!formData.duracaoMinutos || parseInt(formData.duracaoMinutos) <= 0) {
      newErrors.duracaoMinutos = 'Duração deve ser maior que 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de salvamento
  const handleSave = async (next = null) => {
    if (!validate()) return;

    setIsSaving(true);

    try {
      // Preparar dados do curso (sem trilhaIds, que vai para as trilhas)
      const { trilhaIds, ...cursoFields } = formData;
      const cursoData = {
        ...cursoFields,
        duracaoMinutos: parseInt(formData.duracaoMinutos),
        metaPorcentagem: parseInt(formData.metaPorcentagem),
        dataLiberacao: curso?.dataLiberacao || new Date(),
        statusPublicacao: formData.statusPublicacao || 'published',
        releaseAt:
          formData.statusPublicacao === 'scheduled' && formData.releaseAt
            ? new Date(formData.releaseAt).toISOString()
            : null,
        modulos: curso?.modulos || [],
        conteudos: curso?.conteudos || [],
        pontosAoCompletar: curso?.pontosAoCompletar || 2.0,
        ordem: curso?.ordem || 999,
        createdAt: curso?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      // Salvar o curso
      const saved = await onSave?.(cursoData);
      const cursoIdResolved = curso?.id || saved?.id;
      if (!cursoIdResolved) {
        throw new Error('Falha ao salvar treinamento: ID não retornado.');
      }

      // Atualizar trilhas (adicionar/remover curso das trilhas selecionadas)
      if (onTrilhasUpdate && trilhas?.length > 0) {
        const trilhaIdsAntigos = getTrilhaIdsForCurso(cursoIdResolved);
        const trilhaIdsNovos = trilhaIds || [];

        // Trilhas onde adicionar o curso
        const trilhasParaAdicionar = trilhaIdsNovos.filter(id => !trilhaIdsAntigos.includes(id));

        // Trilhas de onde remover o curso
        const trilhasParaRemover = trilhaIdsAntigos.filter(id => !trilhaIdsNovos.includes(id));

        // Atualizar cada trilha
        for (const trilhaId of trilhasParaAdicionar) {
          const trilha = trilhas.find(t => t.id === trilhaId);
          if (trilha) {
            const cursos = [...(trilha.cursos || []), cursoIdResolved];
            await onTrilhasUpdate(trilhaId, { cursos });
          }
        }

        for (const trilhaId of trilhasParaRemover) {
          const trilha = trilhas.find(t => t.id === trilhaId);
          if (trilha) {
            const cursos = (trilha.cursos || []).filter(id => id !== cursoIdResolved);
            await onTrilhasUpdate(trilhaId, { cursos });
          }
        }
      }

      onClose?.();
      if (next === 'modulo') {
        setTimeout(() => {
          onAfterSaveOpenModulo?.(cursoIdResolved);
        }, 150);
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        submit: error.message,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Treinamento' : 'Novo Treinamento'}
      size="lg"
    >
      <div className="space-y-6 p-1 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Título */}
        <FormField label="Título do Treinamento" error={errors.titulo} required>
          <Input
            value={formData.titulo}
            onChange={(e) => handleChange('titulo', e.target.value)}
            placeholder="Ex: Boas Práticas na Prevenção de Infecções"
          />
        </FormField>

        {/* Descrição */}
        <FormField label="Descrição" error={errors.descricao} required>
          <Textarea
            value={formData.descricao}
            onChange={(value) => handleChange('descricao', value)}
            placeholder="Descrição do curso..."
            rows={3}
          />
        </FormField>

        {/* Banner/Thumbnail */}
        <BannerUpload
          value={formData.banner}
          onChange={(url) => handleChange('banner', url)}
          entityId={curso?.id}
          entityType="curso"
          label="Banner do Treinamento (opcional)"
          hint="Imagem de capa exibida nos cards. Recomendado: 1920x1080px (16:9)"
        />

        {/* Categoria e Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Categoria">
            <Select
              value={formData.categoriaId}
              onChange={(v) => handleChange('categoriaId', v)}
              options={categoriaOptions}
            />
          </FormField>

          <FormField label="Publicação" hint="Controle a visibilidade para usuários">
            <Select
              value={formData.statusPublicacao}
              onChange={(v) => handleChange('statusPublicacao', v)}
              options={[
                { value: 'draft', label: 'Rascunho (não visível)' },
                { value: 'published', label: 'Publicado (visível)' },
                { value: 'scheduled', label: 'Agendado (visível após data)' },
              ]}
            />
          </FormField>
        </div>

        {formData.statusPublicacao === 'scheduled' && (
          <FormField label="Liberar em" hint="Data/hora para ficar visível aos usuários">
            <Input
              type="datetime-local"
              value={formData.releaseAt}
              onChange={(e) => handleChange('releaseAt', e.target.value)}
            />
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Duração estimada (minutos)" error={errors.duracaoMinutos} required>
            <Input
              type="number"
              value={formData.duracaoMinutos}
              onChange={(e) => handleChange('duracaoMinutos', e.target.value)}
              placeholder="45"
              min={1}
            />
          </FormField>
        </div>

        {/* Meta e Obrigatório */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Meta de conclusão (%)" hint="Porcentagem mínima para conclusão">
            <Input
              type="number"
              value={formData.metaPorcentagem}
              onChange={(e) => handleChange('metaPorcentagem', e.target.value)}
              placeholder="100"
              min={1}
              max={100}
            />
          </FormField>

          <div className="flex flex-col">
            <Checkbox
              checked={formData.obrigatorio}
              onChange={(checked) => handleChange('obrigatorio', checked)}
              label="Treinamento Obrigatório"
              compact
            />
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Treinamentos obrigatórios devem ser concluídos
            </p>
          </div>
        </div>

        {/* Vincular a Trilhas */}
        {trilhas?.length > 0 && (
          <FormField
            label="Vincular a Trilhas"
            hint="Selecione as trilhas onde este treinamento aparecerá (opcional)"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {trilhas.filter(t => t?.id).map((trilha) => (
                <div
                  key={trilha.id}
                  onClick={() => handleToggleTrilha(trilha.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    formData.trilhaIds?.includes(trilha.id)
                      ? "bg-primary/10 border-primary"
                      : "bg-card border-border hover:bg-muted"
                  )}
                >
                  <Checkbox
                    checked={formData.trilhaIds?.includes(trilha.id) || false}
                    onChange={() => {}}
                    compact
                  />
                  <span className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">{trilha.titulo || 'Sem título'}</span>
                  </span>
                </div>
              ))}
            </div>
            {formData.trilhaIds?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {formData.trilhaIds.length} {formData.trilhaIds.length === 1 ? 'trilha selecionada' : 'trilhas selecionadas'}
              </p>
            )}
          </FormField>
        )}

        {/* Módulos do Treinamento */}
        <FormField
          label="Módulos deste Treinamento"
          hint={isEditing
            ? "Vincule módulos existentes ou crie novos. A ordem aqui controla a sequência para o usuário."
            : "Salve o treinamento para começar a adicionar módulos."}
        >
          {isEditing ? (
            <div className="space-y-3">
              {linkedModulos.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum módulo vinculado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <ReorderableList
                    items={linkedModulos}
                    onReorder={(newIds) => onReorderModulosInCurso?.(curso.id, newIds)}
                    renderItem={(modulo) => (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{modulo.titulo}</p>
                          <p className="text-xs text-muted-foreground truncate">{modulo.tipo || '—'}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onUnlinkModuloFromCurso?.(curso.id, modulo.id)}
                          title="Remover do treinamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select
                    value={selectedModuloId}
                    onChange={setSelectedModuloId}
                    placeholder="Vincular módulo existente..."
                    options={
                      modulosDisponiveis.length === 0
                        ? [{ value: '', label: 'Nenhum módulo disponível', disabled: true }]
                        : modulosDisponiveis
                    }
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!selectedModuloId) return;
                      onLinkModuloToCurso?.(curso.id, selectedModuloId);
                      setSelectedModuloId('');
                    }}
                    disabled={!selectedModuloId}
                  >
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onClose?.();
                      setTimeout(() => onAfterSaveOpenModulo?.(curso.id), 150);
                    }}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Novo Módulo
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground border border-border rounded-xl">
              Salve o treinamento para começar a adicionar módulos e organizar a sequência de aulas.
            </div>
          )}
        </FormField>

        {/* Erro geral */}
        {errors.submit && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {errors.submit}
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave('modulo')}
              disabled={isSaving}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {isSaving ? 'Salvando...' : 'Salvar e criar módulo'}
            </Button>
          )}
          <Button
            onClick={() => handleSave(null)}
            disabled={isSaving}
            leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CursoFormModal;
