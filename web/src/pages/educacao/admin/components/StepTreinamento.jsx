/**
 * StepTreinamento.jsx
 * Etapa 2 do CascadeCreator: Criar ou selecionar um Treinamento (Curso)
 */

import { useState, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Textarea,
  FormField,
  Select,
  Checkbox,
  Badge,
} from '@/design-system';
import {
  BookOpen,
  Plus,
  Link2,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { EntitySelector } from './EntitySelector';

export function StepTreinamento({
  cursos = [],
  trilha,
  onComplete,
  onBack,
  addCurso,
  isLoading,
  error,
  sessionId,
}) {
  const [mode, setMode] = useState('create'); // 'create' | 'select'
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    duracaoMinutos: '',
    obrigatorio: false,
    visibilityMode: 'INHERIT',
    allowedUserTypes: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Validar formulário
  const validateForm = useCallback(() => {
    const errors = {};
    if (!formData.titulo?.trim()) {
      errors.titulo = 'Título é obrigatório';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handler para salvar novo treinamento
  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Calcular visibilidade efetiva baseada na trilha pai
      let effectiveVisibility = 'PUBLIC';
      let effectiveAllowedUserTypes = [];
      
      if (formData.visibilityMode === 'RESTRICTED') {
        effectiveVisibility = 'RESTRICTED';
        effectiveAllowedUserTypes = formData.allowedUserTypes;
      } else if (formData.visibilityMode === 'INHERIT' && trilha) {
        effectiveVisibility = trilha.effectiveVisibility || trilha.visibilityMode || 'PUBLIC';
        effectiveAllowedUserTypes = trilha.effectiveAllowedUserTypes || trilha.allowedUserTypes || [];
      }

      const created = await addCurso({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || '',
        duracaoMinutos: formData.duracaoMinutos ? Number(formData.duracaoMinutos) : 30,
        obrigatorio: formData.obrigatorio,
        visibilityMode: formData.visibilityMode,
        allowedUserTypes: formData.allowedUserTypes,
        effectiveVisibility,
        effectiveAllowedUserTypes,
        status: 'DRAFT',
        createdInSessionId: sessionId,
        statusPublicacao: 'draft',
        metaPorcentagem: 100,
        moduloIds: [],
        ativo: true,
      });

      if (created?.id) {
        onComplete({ ...created, titulo: formData.titulo.trim() }, 'create');
      }
    } catch (e) {
      setFormErrors({ submit: e?.message || 'Erro ao criar treinamento' });
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, addCurso, sessionId, trilha, onComplete]);

  // Handler para selecionar curso existente
  const handleSelect = useCallback((curso) => {
    onComplete(curso, 'select');
  }, [onComplete]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">2. Treinamento</h3>
          <p className="text-sm text-muted-foreground">
            Crie um novo treinamento ou selecione um existente
          </p>
        </div>
        {trilha && (
          <Badge variant="secondary" badgeStyle="subtle" className="ml-auto">
            Trilha: {trilha.titulo}
          </Badge>
        )}
      </div>

      {/* Tabs para modo */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={mode === 'create' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setMode('create')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Criar Novo
        </Button>
        <Button
          variant={mode === 'select' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setMode('select')}
          leftIcon={<Link2 className="w-4 h-4" />}
        >
          Anexar Existente
        </Button>
      </div>

      {/* Formulário de criação */}
      {mode === 'create' && (
        <div className="space-y-4">
          <FormField label="Título" required error={formErrors.titulo}>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ex: Higiene das Mãos"
            />
          </FormField>

          <FormField label="Descrição">
            <Textarea
              value={formData.descricao}
              onChange={(v) => setFormData(prev => ({ ...prev, descricao: v }))}
              placeholder="Descreva o conteúdo deste treinamento..."
              rows={3}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Duração estimada (min)">
              <Input
                type="number"
                value={formData.duracaoMinutos}
                onChange={(e) => setFormData(prev => ({ ...prev, duracaoMinutos: e.target.value }))}
                placeholder="Ex: 30"
              />
            </FormField>

            <div className="flex items-end">
              <Checkbox
                checked={formData.obrigatorio}
                onChange={() => setFormData(prev => ({ ...prev, obrigatorio: !prev.obrigatorio }))}
                label="Treinamento obrigatório"
              />
            </div>
          </div>

          {/* Visibilidade */}
          <FormField label="Visibilidade">
            <Select
              value={formData.visibilityMode}
              onChange={(v) => setFormData(prev => ({ ...prev, visibilityMode: v }))}
              options={[
                { value: 'INHERIT', label: 'Herdar da Trilha' },
                { value: 'PUBLIC', label: 'Público' },
                { value: 'RESTRICTED', label: 'Restrito' },
              ]}
            />
            {formData.visibilityMode === 'INHERIT' && trilha && (
              <p className="text-xs text-muted-foreground mt-1">
                Efetivo: {trilha.effectiveVisibility || trilha.visibilityMode || 'PUBLIC'}
              </p>
            )}
          </FormField>

          {(formErrors.submit || error) && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {formErrors.submit || error}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isSaving || isLoading}
              leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              {isSaving ? 'Criando...' : 'Criar e Continuar'}
            </Button>
          </div>
        </div>
      )}

      {/* Seletor de curso existente */}
      {mode === 'select' && (
        <div className="space-y-4">
          <EntitySelector
            entityType="treinamento"
            entities={cursos.filter(c => c.ativo !== false)}
            onSelect={handleSelect}
            emptyMessage="Nenhum treinamento encontrado. Crie um novo."
          />
          
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default StepTreinamento;
