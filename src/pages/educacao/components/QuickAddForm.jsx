/**
 * QuickAddForm.jsx
 * Formularios inline compactos para criacao rapida de conteudo
 */

import { useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  FormField,
  Checkbox,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  Save,
  X,
  Loader2,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Youtube,
  Headphones,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { TIPOS_MIDIA, TIPOS_USUARIO } from '../data/educacaoUtils';

/**
 * QuickAddTrilha - Formulário inline para criar trilha
 */
export function QuickAddTrilha({ onSave, onCancel, cursos = [] }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tiposUsuario: [],
    obrigatoria: false,
    prazoConclusao: '',
    cursos: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.titulo.trim()) return;

    setIsSaving(true);
    try {
      await onSave?.({
        ...formData,
        ativo: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTipo = (tipo) => {
    setFormData(prev => ({
      ...prev,
      tiposUsuario: prev.tiposUsuario.includes(tipo)
        ? prev.tiposUsuario.filter(t => t !== tipo)
        : [...prev.tiposUsuario, tipo],
    }));
  };

  return (
    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-200 dark:border-purple-800 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
        <GitBranch className="w-5 h-5" />
        <span className="font-semibold">Nova Trilha</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Titulo" required>
          <Input
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Onboarding - Enfermagem"
            autoFocus
          />
        </FormField>

        <FormField label="Prazo (dias)">
          <Input
            type="number"
            value={formData.prazoConclusao}
            onChange={(e) => setFormData(prev => ({ ...prev, prazoConclusao: e.target.value }))}
            placeholder="30"
            min={1}
          />
        </FormField>
      </div>

      <FormField label="Descricao">
        <Textarea
          value={formData.descricao}
          onChange={(value) => setFormData(prev => ({ ...prev, descricao: value }))}
          placeholder="Descricao da trilha..."
          rows={2}
        />
      </FormField>

      <FormField label="Tipos de Usuario">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TIPOS_USUARIO).map(([key, { label }]) => (
            <label
              key={key}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors",
                formData.tiposUsuario.includes(key)
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-border hover:bg-muted"
              )}
            >
              <Checkbox
                checked={formData.tiposUsuario.includes(key)}
                onChange={() => toggleTipo(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={formData.obrigatoria}
          onChange={(checked) => setFormData(prev => ({ ...prev, obrigatoria: checked }))}
        />
        <span className="text-sm">Trilha Obrigatoria</span>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-purple-200 dark:border-purple-800">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!formData.titulo.trim() || isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

/**
 * QuickAddCurso - Formulário inline para criar curso
 */
export function QuickAddCurso({ onSave, onCancel, trilhaId }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    obrigatorio: false,
    cor: '#1976D2',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.titulo.trim()) return;

    setIsSaving(true);
    try {
      await onSave?.({
        ...formData,
        trilhaId,
        ativo: true,
        modulos: [],
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cores = [
    { value: '#1976D2', label: 'Azul' },
    { value: '#2E7D32', label: 'Verde' },
    { value: '#F57C00', label: 'Laranja' },
    { value: '#7B1FA2', label: 'Roxo' },
    { value: '#C62828', label: 'Vermelho' },
  ];

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
        <BookOpen className="w-5 h-5" />
        <span className="font-semibold">Novo Curso</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Titulo" required>
          <Input
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Boas Praticas de Higiene"
            autoFocus
          />
        </FormField>

        <FormField label="Cor">
          <div className="flex gap-2">
            {cores.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, cor: value }))}
                className={cn(
                  "w-8 h-8 rounded-lg transition-all",
                  formData.cor === value && "ring-2 ring-offset-2 ring-primary"
                )}
                style={{ backgroundColor: value }}
                title={label}
              />
            ))}
          </div>
        </FormField>
      </div>

      <FormField label="Descricao">
        <Textarea
          value={formData.descricao}
          onChange={(value) => setFormData(prev => ({ ...prev, descricao: value }))}
          placeholder="Descricao do curso..."
          rows={2}
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={formData.obrigatorio}
          onChange={(checked) => setFormData(prev => ({ ...prev, obrigatorio: checked }))}
        />
        <span className="text-sm">Curso Obrigatorio</span>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!formData.titulo.trim() || isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

/**
 * QuickAddModulo - Formulário inline para criar módulo
 */
export function QuickAddModulo({ onSave, onCancel, cursoId }) {
  const [formData, setFormData] = useState({
    titulo: '',
    tipo: 'video',
    duracao: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.titulo.trim()) return;

    setIsSaving(true);
    try {
      await onSave?.({
        ...formData,
        cursoId,
        duracao: formData.duracao ? parseInt(formData.duracao) : 0,
        ativo: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tipoOptions = [
    { value: 'conteudo', label: 'Conteúdo' },
    { value: 'video', label: 'Video' },
    { value: 'leitura', label: 'Leitura' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'pratico', label: 'Prático' },
  ];

  return (
    <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-200 dark:border-orange-800 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
        <FolderOpen className="w-5 h-5" />
        <span className="font-semibold">Novo Modulo</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Titulo" required className="sm:col-span-2">
          <Input
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Introducao"
            autoFocus
          />
        </FormField>

        <FormField label="Duracao (min)">
          <Input
            type="number"
            value={formData.duracao}
            onChange={(e) => setFormData(prev => ({ ...prev, duracao: e.target.value }))}
            placeholder="15"
            min={1}
          />
        </FormField>
      </div>

      <FormField label="Tipo">
        <div className="flex gap-2">
          {tipoOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, tipo: value }))}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                formData.tipo === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </FormField>

      <div className="flex justify-end gap-2 pt-2 border-t border-orange-200 dark:border-orange-800">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!formData.titulo.trim() || isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

/**
 * QuickAddAula - Formulário inline para criar aula
 */
export function QuickAddAula({ onSave, onCancel, moduloId, cursoId }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'youtube',
    url: '',
    duracao: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.titulo.trim()) return;

    setIsSaving(true);
    try {
      await onSave?.({
        ...formData,
        moduloId,
        cursoId,
        duracao: formData.duracao ? parseInt(formData.duracao) : 0,
        ativo: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tipoIcon = {
    youtube: Youtube,
    vimeo: Video,
    video: Video,
    audio: Headphones,
    document: FileText,
    text: BookOpen,
    link: ExternalLink,
  };

  const TipoIcon = tipoIcon[formData.tipo] || Video;

  return (
    <div className="p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <Video className="w-5 h-5" />
        <span className="font-semibold">Nova Aula</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Titulo" required>
          <Input
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Introducao ao Curso"
            autoFocus
          />
        </FormField>

        <FormField label="Duracao (min)">
          <Input
            type="number"
            value={formData.duracao}
            onChange={(e) => setFormData(prev => ({ ...prev, duracao: e.target.value }))}
            placeholder="15"
            min={1}
          />
        </FormField>
      </div>

      <FormField label="Tipo de Midia">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TIPOS_MIDIA).map(([value, { label }]) => {
            const Icon = tipoIcon[value] || Video;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, tipo: value }))}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                  formData.tipo === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </FormField>

      <FormField label="URL" required>
        <Input
          value={formData.url}
          onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
          placeholder={
            formData.tipo === 'youtube'
              ? 'https://youtube.com/watch?v=...'
              : formData.tipo === 'vimeo'
              ? 'https://vimeo.com/...'
              : 'URL do arquivo...'
          }
        />
      </FormField>

      <FormField label="Descricao">
        <Textarea
          value={formData.descricao}
          onChange={(value) => setFormData(prev => ({ ...prev, descricao: value }))}
          placeholder="Descricao da aula..."
          rows={2}
        />
      </FormField>

      <div className="flex justify-end gap-2 pt-2 border-t border-green-200 dark:border-green-800">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!formData.titulo.trim() || isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

/**
 * QuickAddForm - Componente wrapper que renderiza o form correto baseado no tipo
 */
export function QuickAddForm({ type, parentType, parentId, onSave, onCancel, ...props }) {
  switch (type) {
    case 'trilha':
      return <QuickAddTrilha onSave={onSave} onCancel={onCancel} {...props} />;
    case 'curso':
      return <QuickAddCurso onSave={onSave} onCancel={onCancel} trilhaId={parentId} {...props} />;
    case 'modulo':
      return <QuickAddModulo onSave={onSave} onCancel={onCancel} cursoId={parentId} {...props} />;
    case 'aula':
      return <QuickAddAula onSave={onSave} onCancel={onCancel} moduloId={parentId} {...props} />;
    default:
      return null;
  }
}

export default QuickAddForm;
