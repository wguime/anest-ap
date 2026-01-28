/**
 * StepModulo.jsx
 * Etapa 3 do CascadeCreator: Criar ou selecionar um Módulo
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
  FolderOpen,
  Plus,
  Link2,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { EntitySelector } from './EntitySelector';

export function StepModulo({
  modulos = [],
  treinamento,
  onComplete,
  onBack,
  addModulo,
  isLoading,
  error,
  sessionId,
}) {
  const [mode, setMode] = useState('create'); // 'create' | 'select'
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'conteudo',
    duracao: '',
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

  // Handler para salvar novo módulo
  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Calcular visibilidade efetiva baseada no treinamento pai
      let effectiveVisibility = 'PUBLIC';
      let effectiveAllowedUserTypes = [];
      
      if (formData.visibilityMode === 'RESTRICTED') {
        effectiveVisibility = 'RESTRICTED';
        effectiveAllowedUserTypes = formData.allowedUserTypes || [];
      } else if (formData.visibilityMode === 'INHERIT' && treinamento) {
        effectiveVisibility = treinamento.effectiveVisibility || treinamento.visibilityMode || 'PUBLIC';
        effectiveAllowedUserTypes = treinamento.effectiveAllowedUserTypes || treinamento.allowedUserTypes || [];
      }

      const created = await addModulo({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || '',
        tipo: formData.tipo,
        duracao: formData.duracao ? Number(formData.duracao) : 15,
        visibilityMode: formData.visibilityMode,
        effectiveVisibility,
        effectiveAllowedUserTypes,
        status: 'DRAFT',
        createdInSessionId: sessionId,
        aulaIds: [],
        cursoId: null, // Será vinculado via junction table
        ativo: true,
      });

      if (created?.id) {
        onComplete({ ...created, titulo: formData.titulo.trim() }, 'create');
      }
    } catch (e) {
      setFormErrors({ submit: e?.message || 'Erro ao criar módulo' });
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, addModulo, sessionId, treinamento, onComplete]);

  // Handler para selecionar módulo existente
  const handleSelect = useCallback((modulo) => {
    onComplete(modulo, 'select');
  }, [onComplete]);

  const tipoOptions = [
    { value: 'conteudo', label: 'Conteúdo' },
    { value: 'video', label: 'Vídeo' },
    { value: 'leitura', label: 'Leitura' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'pratico', label: 'Prático' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">3. Módulo</h3>
          <p className="text-sm text-muted-foreground">
            Crie um novo módulo ou selecione um existente
          </p>
        </div>
        {treinamento && (
          <Badge variant="secondary" badgeStyle="subtle" className="ml-auto">
            Treinamento: {treinamento.titulo}
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
              placeholder="Ex: Introdução"
            />
          </FormField>

          <FormField label="Descrição">
            <Textarea
              value={formData.descricao}
              onChange={(v) => setFormData(prev => ({ ...prev, descricao: v }))}
              placeholder="Descreva o conteúdo deste módulo..."
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
                placeholder="Ex: 15"
              />
            </FormField>
          </div>

          {/* Visibilidade */}
          <FormField label="Visibilidade">
            <Select
              value={formData.visibilityMode}
              onChange={(v) => setFormData(prev => ({ ...prev, visibilityMode: v }))}
              options={[
                { value: 'INHERIT', label: 'Herdar do Treinamento' },
                { value: 'PUBLIC', label: 'Público' },
                { value: 'RESTRICTED', label: 'Restrito' },
              ]}
            />
            {formData.visibilityMode === 'INHERIT' && treinamento && (
              <p className="text-xs text-muted-foreground mt-1">
                Efetivo: {treinamento.effectiveVisibility || treinamento.visibilityMode || 'PUBLIC'}
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

      {/* Seletor de módulo existente */}
      {mode === 'select' && (
        <div className="space-y-4">
          <EntitySelector
            entityType="modulo"
            entities={modulos.filter(m => m.ativo !== false)}
            onSelect={handleSelect}
            emptyMessage="Nenhum módulo encontrado. Crie um novo."
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

export default StepModulo;
