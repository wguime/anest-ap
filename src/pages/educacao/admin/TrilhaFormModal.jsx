/**
 * TrilhaFormModal.jsx
 * Modal para criar/editar trilhas
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Checkbox,
  FormField,
  Select,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  Save,
  Loader2,
  X,
  BookOpen,
  Plus,
} from 'lucide-react';
import { TIPOS_USUARIO } from '../data/educacaoUtils';
import { CursoFormModal } from './CursoFormModal';
import { BannerUpload } from './components/BannerUpload';

/**
 * TrilhaFormModal - Modal para criar/editar trilha
 *
 * @param {boolean} open - Controle de abertura
 * @param {function} onClose - Callback de fechamento
 * @param {function} onSave - Callback de salvamento
 * @param {Object} trilha - Trilha para edição (null para criação)
 * @param {Array} cursos - Lista de cursos disponíveis
 * @param {Array} trilhas - Lista de trilhas disponíveis (para CursoFormModal aninhado)
 * @param {function} onCursoCreated - Callback quando um novo curso é criado (opcional)
 */
export function TrilhaFormModal({
  open,
  onClose,
  onSave,
  trilha = null,
  cursos = [],
  trilhas = [],
  onCursoCreated,
}) {
  const isEditing = !!trilha;

  const defaultTiposUsuario = useMemo(() => [], []);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tiposUsuario: defaultTiposUsuario,
    obrigatoria: false,
    isOrientacao: false,
    prazoConclusao: '',
    cursos: [],
    ativo: true,
    banner: null, // URL do banner/thumbnail
  });

  const [selectedCurso, setSelectedCurso] = useState('');
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // State para modal de criação de curso
  const [showCursoModal, setShowCursoModal] = useState(false);
  const [cursosLocais, setCursosLocais] = useState([]);

  // Reset form quando modal abre/fecha
  useEffect(() => {
    if (open) {
      if (trilha) {
        setFormData({
          titulo: trilha.titulo || '',
          descricao: trilha.descricao || '',
          tiposUsuario: trilha.tiposUsuario?.length ? trilha.tiposUsuario : defaultTiposUsuario,
          obrigatoria: trilha.obrigatoria || false,
          isOrientacao: trilha.isOrientacao || false,
          prazoConclusao: trilha.prazoConclusao?.toString() || '',
          cursos: trilha.cursos || [],
          ativo: trilha.ativo !== false,
          banner: trilha.banner || null,
        });
      } else {
        setFormData({
          titulo: '',
          descricao: '',
          tiposUsuario: defaultTiposUsuario,
          obrigatoria: false,
          isOrientacao: false,
          prazoConclusao: '',
          cursos: [],
          ativo: true,
          banner: null,
        });
      }
      setErrors({});
      setSelectedCurso('');
      setCursosLocais([]);
    }
  }, [open, trilha, defaultTiposUsuario]);

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

  // Toggle tipo de usuário
  const handleToggleTipoUsuario = (tipo) => {
    setFormData(prev => {
      const current = prev.tiposUsuario;
      if (current.includes(tipo)) {
        return { ...prev, tiposUsuario: current.filter(t => t !== tipo) };
      }
      return { ...prev, tiposUsuario: [...current, tipo] };
    });
  };

  // Remover curso
  const handleRemoveCurso = (cursoId) => {
    setFormData(prev => ({
      ...prev,
      cursos: prev.cursos.filter(c => c !== cursoId),
    }));
  };

  // Adicionar curso selecionado
  const handleAddCurso = () => {
    if (selectedCurso && !formData.cursos.includes(selectedCurso)) {
      setFormData(prev => ({
        ...prev,
        cursos: [...prev.cursos, selectedCurso],
      }));
      setSelectedCurso('');
      // Limpar erro se existir
      if (errors.cursos) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.cursos;
          return newErrors;
        });
      }
    }
  };

  // Todos os cursos (prop + locais criados nesta sessão)
  const todosCursos = useMemo(() => {
    return [...cursos, ...cursosLocais];
  }, [cursos, cursosLocais]);

  // Cursos disponíveis para adicionar
  const cursosDisponiveis = useMemo(() => {
    return todosCursos.filter(c => !formData.cursos.includes(c.id));
  }, [formData.cursos, todosCursos]);

  // Handler de criação de novo curso
  const handleCursoCreated = async (novoCurso) => {
    const saved = await onCursoCreated?.(novoCurso);
    const cursoResolved = saved || novoCurso;
    if (!cursoResolved?.id) {
      throw new Error('Falha ao criar treinamento.');
    }

    // Adiciona o curso à lista local
    setCursosLocais(prev => [...prev, cursoResolved]);

    // Adiciona automaticamente à trilha
    setFormData(prev => ({
      ...prev,
      cursos: [...prev.cursos, cursoResolved.id],
    }));

    // Limpar erro de cursos se existir
    if (errors.cursos) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cursos;
        return newErrors;
      });
    }

    // onCursoCreated já foi chamado acima para persistir (quando disponível)
  };

  // Validação
  const validate = (cursosValue = formData.cursos) => {
    const newErrors = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }
    if (formData.tiposUsuario.length === 0) {
      newErrors.tiposUsuario = 'Selecione pelo menos um tipo de usuário';
    }
    if (cursosValue.length === 0) {
      newErrors.cursos = 'Adicione pelo menos um treinamento';
    }
    if (formData.obrigatoria && !formData.prazoConclusao) {
      newErrors.prazoConclusao = 'Prazo é obrigatório para trilhas obrigatórias';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de salvamento
  const handleSave = async () => {
    const cursosFinal =
      selectedCurso && !formData.cursos.includes(selectedCurso)
        ? [...formData.cursos, selectedCurso]
        : formData.cursos;

    if (!validate(cursosFinal)) return;

    setIsSaving(true);

    try {
      const trilhaData = {
        ...formData,
        cursos: cursosFinal,
        prazoConclusao: formData.prazoConclusao ? parseInt(formData.prazoConclusao) : null,
        banner: formData.banner || null,
        createdAt: trilha?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const saved = await onSave?.(trilhaData);
      const trilhaIdResolved = trilha?.id || saved?.id;
      if (!trilhaIdResolved) {
        throw new Error('Falha ao salvar trilha: ID não retornado.');
      }
      onClose?.();
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
      title={isEditing ? 'Editar Trilha' : 'Nova Trilha'}
      size="lg"
    >
      <div className="space-y-6 p-1 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Título */}
        <FormField label="Título" error={errors.titulo} required>
          <Input
            value={formData.titulo}
            onChange={(e) => handleChange('titulo', e.target.value)}
            placeholder="Ex: Onboarding - Enfermagem"
          />
        </FormField>

        {/* Banner/Thumbnail */}
        <BannerUpload
          value={formData.banner}
          onChange={(url) => handleChange('banner', url)}
          entityId={trilha?.id}
          entityType="trilha"
          label="Banner da Trilha (opcional)"
          hint="Imagem de capa. Recomendado: 1920x1080px (16:9)"
        />

        {/* Descrição */}
        <FormField label="Descrição">
          <Textarea
            value={formData.descricao}
            onChange={(value) => handleChange('descricao', value)}
            placeholder="Descrição da trilha..."
            rows={3}
          />
        </FormField>

        {/* Tipos de Usuário */}
        <FormField
          label="Tipos de Usuário"
          hint="Selecione quais tipos de usuário verão esta trilha"
          error={errors.tiposUsuario}
          required
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(TIPOS_USUARIO).map(([key, { label }]) => (
              <div
                key={key}
                onClick={() => handleToggleTipoUsuario(key)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  formData.tiposUsuario.includes(key)
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:bg-muted"
                )}
              >
                <Checkbox
                  checked={formData.tiposUsuario.includes(key)}
                  onChange={() => {}}
                  compact
                />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </FormField>

        {/* Obrigatoriedade */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.obrigatoria}
                onChange={(checked) => handleChange('obrigatoria', checked)}
                label="Trilha Obrigatória"
                compact
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Trilhas obrigatórias exigem prazo de conclusão
            </p>
          </div>

          {formData.obrigatoria && (
            <FormField
              label="Prazo (dias)"
              error={errors.prazoConclusao}
              className="w-32"
            >
              <Input
                type="number"
                value={formData.prazoConclusao}
                onChange={(e) => handleChange('prazoConclusao', e.target.value)}
                placeholder="30"
                min={1}
              />
            </FormField>
          )}
        </div>

        {/* Orientação (Onboarding) */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.isOrientacao}
                onChange={(checked) => handleChange('isOrientacao', checked)}
                label="Trilha de Orientação (Onboarding)"
                compact
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Trilhas de orientação são atribuídas automaticamente a novos colaboradores.
              O prazo é calculado a partir da data de admissão do colaborador.
            </p>
          </div>
        </div>

        {/* Treinamentos na Trilha */}
        <FormField
          label="Treinamentos na Trilha"
          error={errors.cursos}
          required
          hint="Selecione treinamentos existentes. Um mesmo treinamento pode pertencer a múltiplas trilhas."
        >
          <div className="space-y-3">
            {/* Lista de treinamentos adicionados */}
            {formData.cursos.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum treinamento adicionado</p>
              </div>
            ) : (
              formData.cursos.map((cursoId, index) => {
                const curso = todosCursos.find(c => c.id === cursoId);
                return (
                  <div
                    key={cursoId}
                    className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium">
                        {curso?.titulo || 'Treinamento não encontrado'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCurso(cursoId)}
                      className="p-1.5 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}

            {/* Seleção de novos treinamentos */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Select
                  value={selectedCurso}
                  onChange={setSelectedCurso}
                  placeholder="Selecione um treinamento..."
                  options={
                    cursosDisponiveis.length === 0
                      ? [{ value: '', label: 'Todos os treinamentos já foram adicionados', disabled: true }]
                      : cursosDisponiveis.map(c => ({
                          value: c.id,
                          label: c.titulo,
                        }))
                  }
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  onClick={handleAddCurso}
                  disabled={!selectedCurso || cursosDisponiveis.length === 0}
                >
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCursoModal(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Novo Treinamento
                </Button>
              </div>
            </div>
          </div>
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
            onClick={handleSave}
            disabled={isSaving}
            leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Modal de criação de curso */}
      <CursoFormModal
        open={showCursoModal}
        onClose={() => setShowCursoModal(false)}
        onSave={handleCursoCreated}
        curso={null}
        trilhas={trilhas}
      />
    </Modal>
  );
}

export default TrilhaFormModal;
