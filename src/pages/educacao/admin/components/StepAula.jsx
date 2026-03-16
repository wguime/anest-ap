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
import { ContentPreviewInline } from './ContentPreviewInline';

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
    url: '',
    arquivo: null,
    conteudo: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Validar formulário
  const validateForm = useCallback(() => {
    const errors = {};
    if (!formData.titulo?.trim()) {
      errors.titulo = 'Título é obrigatório';
    }
    
    // Validar campos específicos por tipo
    if (formData.tipo === 'youtube' && !formData.url?.trim()) {
      errors.url = 'URL do YouTube é obrigatória';
    }
    if (formData.tipo === 'vimeo' && !formData.url?.trim()) {
      errors.url = 'URL do Vimeo é obrigatória';
    }
    if (formData.tipo === 'video' && !formData.arquivo) {
      errors.arquivo = 'Arquivo de vídeo é obrigatório';
    }
    if (formData.tipo === 'audio' && !formData.arquivo) {
      errors.arquivo = 'Arquivo de áudio é obrigatório';
    }
    if (formData.tipo === 'document' && !formData.arquivo) {
      errors.arquivo = 'Documento é obrigatório';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handler para salvar nova aula
  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Herdar visibilidade diretamente do Módulo
      const effectiveVisibility =
        modulo?.effectiveVisibility ||
        modulo?.visibilityMode ||
        'PUBLIC';
      const effectiveAllowedUserTypes =
        modulo?.effectiveAllowedUserTypes ||
        modulo?.allowedUserTypes ||
        [];

      // Criar bloco inicial baseado no tipo
      let initialBlock = {
        id: crypto?.randomUUID?.() || `b_${Date.now()}`,
        type: formData.tipo,
        data: {},
      };

      // Preencher data baseado no tipo
      switch (formData.tipo) {
        case 'text':
          initialBlock.data = {
            html: formData.conteudo || '<p>Digite o conteúdo aqui...</p>',
          };
          break;
        case 'youtube':
        case 'vimeo':
          initialBlock.data = {
            url: formData.url,
            title: formData.titulo.trim(),
          };
          break;
        case 'video':
        case 'audio':
        case 'document':
          // Para arquivos, armazenaremos o nome temporariamente
          // O upload real será feito na aba "Estrutura"
          initialBlock.data = {
            url: '',
            fileName: formData.arquivo?.name || '',
            fileSize: formData.arquivo?.size || 0,
            fileType: formData.arquivo?.type || '',
            title: formData.titulo.trim(),
            pendingUpload: true,
          };
          break;
        default:
          initialBlock.data = { title: formData.titulo.trim() };
      }

      const created = await addAula({
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || '',
        duracao: formData.duracao ? Number(formData.duracao) : 10,
        tipo: formData.tipo,
        visibilityMode: 'INHERIT',
        effectiveVisibility,
        effectiveAllowedUserTypes,
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
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">4. Aula</h3>
            <p className="text-sm text-muted-foreground leading-snug">
              Crie uma nova aula ou selecione uma existente
            </p>
          </div>
        </div>
        {modulo && (
          <Badge
            variant="secondary"
            badgeStyle="subtle"
            className="sm:ml-auto self-start sm:self-auto max-w-full truncate"
            title={`Módulo: ${modulo.titulo}`}
          >
            Módulo: {modulo.titulo}
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
        <div className="space-y-6">
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

          {/* Campos específicos por tipo de conteúdo */}
          {formData.tipo === 'youtube' && (
            <FormField label="URL do YouTube" required>
              <Input
                type="url"
                value={formData.url || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </FormField>
          )}

          {formData.tipo === 'vimeo' && (
            <FormField label="URL do Vimeo" required>
              <Input
                type="url"
                value={formData.url || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://vimeo.com/..."
              />
            </FormField>
          )}

          {formData.tipo === 'video' && (
            <FormField label="Upload de Vídeo" required>
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData(prev => ({ ...prev, arquivo: file }));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: MP4, WebM, MOV (máx. 500MB)
              </p>
            </FormField>
          )}

          {formData.tipo === 'audio' && (
            <FormField label="Upload de Áudio" required>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData(prev => ({ ...prev, arquivo: file }));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: MP3, WAV, OGG (máx. 100MB)
              </p>
            </FormField>
          )}

          {formData.tipo === 'document' && (
            <FormField label="Upload de Documento" required>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData(prev => ({ ...prev, arquivo: file }));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: PDF, DOC, DOCX, PPT, PPTX (máx. 50MB)
              </p>
            </FormField>
          )}

          {formData.tipo === 'text' && (
            <FormField label="Conteúdo de Texto">
              <textarea
                value={formData.conteudo || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, conteudo: e.target.value }))}
                placeholder="Digite o conteúdo da aula..."
                className="w-full min-h-[120px] p-3 rounded-lg border border-input bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Você poderá adicionar mais blocos de conteúdo depois na aba "Estrutura"
              </p>
            </FormField>
          )}

          <div className="p-3 rounded-lg bg-info/10 text-info text-sm">
            <Sparkles className="w-4 h-4 inline mr-2" />
            Após criar a aula, você poderá editar o conteúdo completo (blocos) na aba "Estrutura".
          </div>

          {(formErrors.submit || error) && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {formErrors.submit || error}
            </div>
          )}

          </div>

          {/* Preview inline (sempre visível) */}
          <ContentPreviewInline key={formData.tipo} formData={formData} />

          {/* Botões de Ação */}
          <div className="pt-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Voltar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={onFinish}
                className="w-full sm:w-auto"
              >
                Finalizar sem aula
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={isSaving || isLoading}
                leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                {isSaving ? 'Criando...' : 'Criar e Finalizar'}
              </Button>
            </div>
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

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Voltar
            </Button>
            <Button
              variant="secondary"
              onClick={onFinish}
              className="w-full sm:w-auto"
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
