/**
 * StepTrilha.jsx
 * Etapa 1 do CascadeCreator: Criar ou selecionar uma Trilha
 */

import { useState, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Textarea,
  FormField,
  Checkbox,
  Badge,
} from '@/design-system';
import {
  GitBranch,
  Plus,
  Link2,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { EntitySelector } from './EntitySelector';
import { TIPOS_USUARIO } from '../../../../services/educacaoService';

export function StepTrilha({
  trilhas = [],
  onComplete,
  onSkip,
  addTrilha,
  isLoading,
  error,
  sessionId,
}) {
  const [mode, setMode] = useState('create'); // 'create' | 'select'
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tiposUsuario: [],
    obrigatoria: false,
    prazoConclusao: '',
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

  // Handler para salvar nova trilha
  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const tiposUsuario = Array.isArray(formData.tiposUsuario) ? formData.tiposUsuario : [];
      const isRestricted = tiposUsuario.length > 0;
      const visibilityMode = isRestricted ? 'RESTRICTED' : 'PUBLIC';
      const allowedUserTypes = isRestricted ? tiposUsuario : [];

      const created = await addTrilha({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || '',
        tiposUsuario,
        obrigatoria: formData.obrigatoria,
        prazoConclusao: formData.prazoConclusao ? Number(formData.prazoConclusao) : null,
        visibilityMode,
        allowedUserTypes,
        effectiveVisibility: isRestricted ? 'RESTRICTED' : 'PUBLIC',
        effectiveAllowedUserTypes: allowedUserTypes,
        status: 'DRAFT',
        createdInSessionId: sessionId,
        cursos: [],
        ativo: true,
        ordem: 999,
      });

      if (created?.id) {
        onComplete({ ...created, titulo: formData.titulo.trim() }, 'create');
      }
    } catch (e) {
      setFormErrors({ submit: e?.message || 'Erro ao criar trilha' });
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, addTrilha, sessionId, onComplete]);

  // Handler para selecionar trilha existente
  const handleSelect = useCallback((trilha) => {
    onComplete(trilha, 'select');
  }, [onComplete]);

  // Handler para toggle de tipo de usuário
  const handleToggleTipoUsuario = useCallback((tipo) => {
    setFormData(prev => ({
      ...prev,
      tiposUsuario: prev.tiposUsuario.includes(tipo)
        ? prev.tiposUsuario.filter(t => t !== tipo)
        : [...prev.tiposUsuario, tipo],
    }));
  }, []);

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">1. Trilha de Aprendizagem</h3>
            <p className="text-sm text-muted-foreground leading-snug">
              Crie uma nova trilha ou selecione uma existente
            </p>
          </div>
        </div>
      </div>

      {/* Tabs para modo */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={mode === 'create' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setMode('create')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Criar Nova
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
              placeholder="Ex: Segurança do Paciente"
            />
          </FormField>

          <FormField label="Descrição">
            <Textarea
              value={formData.descricao}
              onChange={(v) => setFormData(prev => ({ ...prev, descricao: v }))}
              placeholder="Descreva o objetivo desta trilha..."
              rows={3}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Prazo de Conclusão (dias)">
              <Input
                type="number"
                value={formData.prazoConclusao}
                onChange={(e) => setFormData(prev => ({ ...prev, prazoConclusao: e.target.value }))}
                placeholder="Ex: 30"
              />
            </FormField>

            <div className="flex items-end">
              <Checkbox
                checked={formData.obrigatoria}
                onChange={() => setFormData(prev => ({ ...prev, obrigatoria: !prev.obrigatoria }))}
                label="Trilha obrigatória"
              />
            </div>
          </div>

          <FormField
            label="Tipos de Usuário (público-alvo)"
            description="Apenas os tipos selecionados poderão acessar este conteúdo. Deixe vazio para torná-lo público."
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[1fr] gap-2">
              {Object.entries(TIPOS_USUARIO).map(([key, { label }]) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors",
                    formData.tiposUsuario.includes(key)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/60"
                  )}
                  onClick={() => handleToggleTipoUsuario(key)}
                >
                  <Checkbox
                    checked={formData.tiposUsuario.includes(key)}
                    onChange={() => {}}
                    compact
                  />
                  <span className="text-xs sm:text-sm leading-snug min-w-0">{label}</span>
                </div>
              ))}
            </div>
          </FormField>

          {(formErrors.submit || error) && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {formErrors.submit || error}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="w-full sm:w-auto"
            >
              Pular etapa
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isSaving || isLoading}
              leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              rightIcon={<ChevronRight className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              {isSaving ? 'Criando...' : 'Criar e Continuar'}
            </Button>
          </div>
        </div>
      )}

      {/* Seletor de trilha existente */}
      {mode === 'select' && (
        <div className="space-y-4">
          <EntitySelector
            entityType="trilha"
            entities={trilhas.filter(t => t.ativo !== false)}
            onSelect={handleSelect}
            emptyMessage="Nenhuma trilha encontrada. Crie uma nova."
          />
          
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={onSkip}
            >
              Pular etapa
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default StepTrilha;
