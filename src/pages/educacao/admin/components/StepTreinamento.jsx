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
      // Herdar visibilidade diretamente da Trilha
      const effectiveVisibility =
        trilha?.effectiveVisibility ||
        trilha?.visibilityMode ||
        (Array.isArray(trilha?.tiposUsuario) && trilha.tiposUsuario.length ? 'RESTRICTED' : 'PUBLIC');
      const effectiveAllowedUserTypes =
        trilha?.effectiveAllowedUserTypes ||
        trilha?.allowedUserTypes ||
        (Array.isArray(trilha?.tiposUsuario) ? trilha.tiposUsuario : []);

      const created = await addCurso({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || '',
        duracaoMinutos: formData.duracaoMinutos ? Number(formData.duracaoMinutos) : 30,
        obrigatorio: formData.obrigatorio,
        visibilityMode: 'INHERIT',
        effectiveVisibility,
        effectiveAllowedUserTypes,
        createdInSessionId: sessionId,
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
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">2. Treinamento</h3>
            <p className="text-sm text-muted-foreground leading-snug">
              Crie um novo treinamento ou selecione um existente
            </p>
          </div>
        </div>
        {trilha && (
          <Badge
            variant="secondary"
            badgeStyle="subtle"
            className="sm:ml-auto self-start sm:self-auto max-w-full truncate"
            title={`Trilha: ${trilha.titulo}`}
          >
            Trilha: {trilha.titulo}
          </Badge>
        )}
      </div>

      {/* Tabs para modo */}
      <div className="flex flex-wrap gap-2 mb-6">
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

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
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
          </div>
        </div>
      )}
    </Card>
  );
}

export default StepTreinamento;
