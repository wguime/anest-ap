/**
 * StepAula.jsx
 * Etapa 4 do CascadeCreator: Criar ou selecionar uma Aula
 */

import { useState, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Textarea,
  FormField,
  Select,
  Badge,
} from '@/design-system';
import {
  Video,
  Plus,
  Link2,
  Loader2,
  ChevronLeft,
  Check,
  Sparkles,
} from 'lucide-react';
import { EntitySelector } from './EntitySelector';

export function StepAula({
  aulas = [],
  modulo,
  onComplete,
  onBack,
  onFinish,
  addAula,
  isLoading,
  error,
  sessionId,
}) {
  const [mode, setMode] = useState('create'); // 'create' | 'select'
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    duracao: '',
    tipo: 'text',
    visibilityMode: 'INHERIT',
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

  // Handler para salvar nova aula
  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Calcular visibilidade efetiva baseada no módulo pai
      let effectiveVisibility = 'PUBLIC';
      let effectiveAllowedUserTypes = [];
      
      if (formData.visibilityMode === 'RESTRICTED') {
        effectiveVisibility = 'RESTRICTED';
        effectiveAllowedUserTypes = formData.allowedUserTypes || [];
      } else if (formData.visibilityMode === 'INHERIT' && modulo) {
        effectiveVisibility = modulo.effectiveVisibility || modulo.visibilityMode || 'PUBLIC';
        effectiveAllowedUserTypes = modulo.effectiveAllowedUserTypes || modulo.allowedUserTypes || [];
      }

      // Criar bloco inicial baseado no tipo
      const initialBlock = {
        id: crypto?.randomUUID?.() || `b_${Date.now()}`,
        type: formData.tipo === 'text' ? 'text' : formData.tipo,
        data: formData.tipo === 'text' 
          ? { html: '<p>Digite o conteúdo aqui...</p>' }
          : { url: '', title: formData.titulo.trim() },
      };

      const created = await addAula({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || '',
        duracao: formData.duracao ? Number(formData.duracao) : 10,
        tipo: formData.tipo,
        visibilityMode: formData.visibilityMode,
        effectiveVisibility,
        effectiveAllowedUserTypes,
        status: 'DRAFT',
        createdInSessionId: sessionId,
        blocks: [initialBlock],
        moduloId: null, // Será vinculado via junction table
        cursoId: null,
        ativo: true,
      });

      if (created?.id) {
        onComplete({ ...created, titulo: formData.titulo.trim() }, 'create');
      }
    } catch (e) {
      setFormErrors({ submit: e?.message || 'Erro ao criar aula' });
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, addAula, sessionId, modulo, onComplete]);

  // Handler para selecionar aula existente
  const handleSelect = useCallback((aula) => {
    onComplete(aula, 'select');
  }, [onComplete]);

  const tipoOptions = [
    { value: 'text', label: 'Texto' },
    { value: 'video', label: 'Vídeo (upload)' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'vimeo', label: 'Vimeo' },
    { value: 'audio', label: 'Áudio' },
    { value: 'document', label: 'Documento (PDF)' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Video className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">4. Aula</h3>
          <p className="text-sm text-muted-foreground">
            Crie uma nova aula ou selecione uma existente
          </p>
        </div>
        {modulo && (
          <Badge variant="secondary" badgeStyle="subtle" className="ml-auto">
            Módulo: {modulo.titulo}
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
              placeholder="Ex: O que é higiene das mãos?"
            />
          </FormField>

          <FormField label="Descrição">
            <Textarea
              value={formData.descricao}
              onChange={(v) => setFormData(prev => ({ ...prev, descricao: v }))}
              placeholder="Descreva o conteúdo desta aula..."
              rows={2}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Tipo de Conteúdo">
              <Select
                value={formData.tipo}
                onChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}
                options={tipoOptions}
              />
            </FormField>

            <FormField label="Duração estimada (min)">
              <Input
                type="number"
                value={formData.duracao}
                onChange={(e) => setFormData(prev => ({ ...prev, duracao: e.target.value }))}
                placeholder="Ex: 10"
              />
            </FormField>
          </div>

          {/* Visibilidade */}
          <FormField label="Visibilidade">
            <Select
              value={formData.visibilityMode}
              onChange={(v) => setFormData(prev => ({ ...prev, visibilityMode: v }))}
              options={[
                { value: 'INHERIT', label: 'Herdar do Módulo' },
                { value: 'PUBLIC', label: 'Público' },
                { value: 'RESTRICTED', label: 'Restrito' },
              ]}
            />
            {formData.visibilityMode === 'INHERIT' && modulo && (
              <p className="text-xs text-muted-foreground mt-1">
                Efetivo: {modulo.effectiveVisibility || modulo.visibilityMode || 'PUBLIC'}
              </p>
            )}
          </FormField>

          <div className="p-3 rounded-lg bg-info/10 text-info text-sm">
            <Sparkles className="w-4 h-4 inline mr-2" />
            Após criar a aula, você poderá editar o conteúdo completo (blocos) na aba "Estrutura".
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
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={onFinish}
              >
                Finalizar sem aula
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={isSaving || isLoading}
                leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              >
                {isSaving ? 'Criando...' : 'Criar e Finalizar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Seletor de aula existente */}
      {mode === 'select' && (
        <div className="space-y-4">
          <EntitySelector
            entityType="aula"
            entities={aulas.filter(a => a.ativo !== false)}
            onSelect={handleSelect}
            emptyMessage="Nenhuma aula encontrada. Crie uma nova."
          />
          
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
            <Button
              variant="secondary"
              onClick={onFinish}
            >
              Finalizar sem aula
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default StepAula;
