/**
 * ModuloFormModal.jsx
 * Modal para criar/editar módulos
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Input,
  Select,
  FormField,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  Save,
  Loader2,
  Video,
  FileText,
  HelpCircle,
  BookOpen,
  Wrench,
  Plus,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { ReorderableList } from './components/ReorderableList';

const TIPOS_MODULO = [
  { value: 'conteudo', label: 'Conteúdo', icon: BookOpen },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'leitura', label: 'Leitura', icon: FileText },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
  { value: 'pratico', label: 'Prático', icon: Wrench },
];

/**
 * ModuloFormModal - Modal para criar/editar módulo
 *
 * @param {boolean} open - Controle de abertura
 * @param {function} onClose - Callback de fechamento
 * @param {function} onSave - Callback de salvamento
 * @param {Object} modulo - Módulo para edição (null para criação)
 * @param {string} cursoId - ID do curso (opcional, pré-seleciona o curso)
 * @param {Array} cursos - Lista de cursos disponíveis (opcional)
 */
export function ModuloFormModal({
  open,
  onClose,
  onSave,
  modulo = null,
  cursoId = null,
  cursos: cursosProp = null,
  aulas = [],
  moduloAulasRel = [],
  onLinkAulaToModulo,
  onUnlinkAulaFromModulo,
  onReorderAulasInModulo,
  onAfterSaveOpenAula,
}) {
  // Usar cursos da prop ou fallback para array vazio
  const cursos = cursosProp || [];
  const isEditing = !!modulo;

  // Form state
  const [formData, setFormData] = useState({
    cursoId: '',
    titulo: '',
    tipo: 'video',
    duracao: '',
    ordem: '',
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAulaId, setSelectedAulaId] = useState('');

  // Reset form quando modal abre/fecha
  useEffect(() => {
    if (open) {
      if (modulo) {
        setFormData({
          cursoId: modulo.cursoId || cursoId || '',
          titulo: modulo.titulo || '',
          tipo: modulo.tipo || 'video',
          duracao: modulo.duracao?.toString() || '',
          ordem: modulo.ordem?.toString() || '',
        });
      } else {
        setFormData({
          cursoId: cursoId || '',
          titulo: '',
          tipo: 'video',
          duracao: '',
          ordem: '',
        });
      }
      setErrors({});
      setSelectedAulaId('');
    }
  }, [open, modulo, cursoId]);

  const isEditingExisting = !!modulo?.id;

  const linkedAulaIds = useMemo(() => {
    if (!modulo?.id) return [];
    const rels = (moduloAulasRel || [])
      .filter(r => r.moduloId === modulo.id)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (rels.length) return rels.map(r => r.aulaId);
    return modulo.aulaIds || [];
  }, [modulo?.id, modulo?.aulaIds, moduloAulasRel]);

  const linkedAulas = useMemo(() => {
    const byId = new Map((aulas || []).map(a => [a.id, a]));
    return linkedAulaIds.map(id => byId.get(id)).filter(Boolean);
  }, [linkedAulaIds, aulas]);

  const aulasDisponiveis = useMemo(() => {
    const linked = new Set(linkedAulaIds);
    return (aulas || [])
      .filter(a => !linked.has(a.id))
      .filter(a => a.ativo !== false)
      .map(a => ({ value: a.id, label: a.titulo }));
  }, [aulas, linkedAulaIds]);

  // Opções de treinamento
  const cursoOptions = useMemo(() => {
    return cursos.map(c => ({
      value: c.id,
      label: c.titulo,
    }));
  }, [cursos]);

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

  // Validação
  const validate = () => {
    const newErrors = {};

    if (!formData.cursoId) {
      newErrors.cursoId = 'Selecione um treinamento';
    }
    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }
    if (!formData.duracao || parseInt(formData.duracao) <= 0) {
      newErrors.duracao = 'Duração deve ser maior que 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de salvamento
  const handleSave = async (next = null) => {
    if (!validate()) return;

    setIsSaving(true);

    try {
      const moduloData = {
        cursoId: formData.cursoId,
        titulo: formData.titulo,
        tipo: formData.tipo,
        duracao: parseInt(formData.duracao),
        ...(formData.ordem ? { ordem: parseInt(formData.ordem) || 1 } : {}),
      };

      const saved = await onSave?.(moduloData);
      const moduloIdResolved = modulo?.id || saved?.id;
      if (!moduloIdResolved) {
        throw new Error('Falha ao salvar módulo: ID não retornado.');
      }

      onClose?.();
      if (next === 'aula') {
        setTimeout(() => {
          onAfterSaveOpenAula?.(formData.cursoId, moduloIdResolved);
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
      title={isEditing ? 'Editar Módulo' : 'Novo Módulo'}
      size="lg"
    >
      <div className="space-y-6 p-1 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Treinamento */}
        <FormField label="Treinamento" error={errors.cursoId} required>
          <Select
            value={formData.cursoId}
            onChange={(v) => handleChange('cursoId', v)}
            placeholder="Selecione o treinamento"
            options={cursoOptions}
            disabled={!!cursoId}
          />
        </FormField>

        {/* Título */}
        <FormField label="Título do Módulo" error={errors.titulo} required>
          <Input
            value={formData.titulo}
            onChange={(e) => handleChange('titulo', e.target.value)}
            placeholder="Ex: Introdução ao Curso"
          />
        </FormField>

        {/* Tipo de Módulo */}
        <FormField label="Tipo de Conteúdo" required>
          <div className="flex flex-wrap gap-2">
            {TIPOS_MODULO.map(({ value, label, icon: Icon }) => {
              const isActive = formData.tipo === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleChange('tipo', value)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </FormField>

        {/* Duração e Ordem */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Duração (minutos)" error={errors.duracao} required>
            <Input
              type="number"
              value={formData.duracao}
              onChange={(e) => handleChange('duracao', e.target.value)}
              placeholder="15"
              min={1}
            />
          </FormField>

          <FormField label="Ordem (compatibilidade)" hint="A ordem real por treinamento é controlada pelos vínculos.">
            <Input
              type="number"
              value={formData.ordem}
              onChange={(e) => handleChange('ordem', e.target.value)}
              placeholder="1"
              min={1}
            />
          </FormField>
        </div>

        {/* Aulas do Módulo */}
        <FormField
          label="Aulas deste Módulo"
          hint={isEditingExisting
            ? "Vincule aulas existentes ou crie novas. A ordem aqui controla a sequência para o usuário."
            : "Salve o módulo para começar a adicionar aulas."}
        >
          {isEditingExisting ? (
            <div className="space-y-3">
              {linkedAulas.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma aula vinculada</p>
                </div>
              ) : (
                <ReorderableList
                  items={linkedAulas}
                  onReorder={(newIds) => onReorderAulasInModulo?.(modulo.id, newIds)}
                  renderItem={(aula) => (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{aula.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">{aula.tipo || '—'}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onUnlinkAulaFromModulo?.(modulo.id, aula.id)}
                        title="Remover do módulo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                />
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select
                    value={selectedAulaId}
                    onChange={setSelectedAulaId}
                    placeholder="Vincular aula existente..."
                    options={
                      aulasDisponiveis.length === 0
                        ? [{ value: '', label: 'Nenhuma aula disponível', disabled: true }]
                        : aulasDisponiveis
                    }
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!selectedAulaId) return;
                      onLinkAulaToModulo?.(modulo.id, selectedAulaId);
                      setSelectedAulaId('');
                    }}
                    disabled={!selectedAulaId}
                  >
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onClose?.();
                      setTimeout(() => onAfterSaveOpenAula?.(formData.cursoId, modulo.id), 150);
                    }}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Nova Aula
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground border border-border rounded-xl">
              Salve o módulo para começar a adicionar aulas e organizar a sequência de mídias.
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
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave('aula')}
            disabled={isSaving || isEditingExisting}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {isSaving ? 'Salvando...' : 'Salvar e criar aula'}
          </Button>
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

export default ModuloFormModal;
