/**
 * AulaFormModal.jsx
 * Modal para criar/editar aulas
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Select,
  FileUpload,
  FormField,
  Progress,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  Youtube,
  Video,
  Headphones,
  FileText,
  ExternalLink,
  Eye,
  X,
  Save,
  Loader2,
  Plus,
  BookOpen,
} from 'lucide-react';
import { AulaPreview } from '../components/AulaPlayer';
import { uploadService } from '@/services/uploadService';
import {
  TIPOS_MIDIA,
  extractYouTubeId,
  extractVimeoId,
} from '../data/educacaoUtils';
import { CursoFormModal } from './CursoFormModal';
import { ModuloFormModal } from './ModuloFormModal';

/**
 * AulaFormModal - Modal para criar/editar aula
 *
 * @param {boolean} open - Controle de abertura
 * @param {function} onClose - Callback de fechamento
 * @param {function} onSave - Callback de salvamento
 * @param {Object} aula - Aula para edição (null para criação)
 * @param {Array} cursos - Lista de cursos disponíveis
 * @param {Array} modulos - Lista de módulos disponíveis
 * @param {function} onCursoCreated - Callback quando um novo curso é criado
 * @param {function} onModuloCreated - Callback quando um novo módulo é criado
 */
export function AulaFormModal({
  open,
  onClose,
  onSave,
  aula = null,
  cursoId: initialCursoId = '',
  moduloId: initialModuloId = '',
  cursos: cursosProp = [],
  modulos: modulosProp = [],
  getModulosByCursoId,
  onCursoCreated,
  onModuloCreated,
}) {
  const isEditing = !!aula;

  // Form state
  const [formData, setFormData] = useState({
    cursoId: '',
    moduloId: '',
    titulo: '',
    descricao: '',
    tipo: 'youtube',
    url: '',
    mimeType: '',
    duracao: '',
    thumbnail: null,
    ativo: true,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDuration, setIsLoadingDuration] = useState(false);

  // Modais de criação
  const [showCursoModal, setShowCursoModal] = useState(false);
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [cursosLocais, setCursosLocais] = useState([]);
  const [modulosLocais, setModulosLocais] = useState([]);

  // Combinar cursos/módulos da prop + locais criados
  const cursos = useMemo(() => [...cursosProp, ...cursosLocais], [cursosProp, cursosLocais]);

  // Reset form quando modal abre/fecha
  useEffect(() => {
    if (open) {
      if (aula) {
        setFormData({
          cursoId: aula.cursoId || '',
          moduloId: aula.moduloId || '',
          titulo: aula.titulo || '',
          descricao: aula.descricao || '',
          tipo: aula.tipo || 'youtube',
          url: aula.url || '',
          mimeType: aula.mimeType || '',
          duracao: aula.duracao?.toString() || '',
          thumbnail: aula.thumbnail || null,
          ativo: aula.ativo !== false,
        });
      } else {
        setFormData({
          cursoId: initialCursoId || '',
          moduloId: initialModuloId || '',
          titulo: '',
          descricao: '',
          tipo: 'youtube',
          url: '',
          mimeType: '',
          duracao: '',
          thumbnail: null,
          ativo: true,
        });
      }
      setShowPreview(false);
      setErrors({});
    }
  }, [open, aula, initialCursoId, initialModuloId]);

  // Obter módulos do curso selecionado (das props + locais)
  const modulos = useMemo(() => {
    if (formData.cursoId && formData.cursoId !== '__new__') {
      const modulosDoCurso = typeof getModulosByCursoId === 'function'
        ? (getModulosByCursoId(formData.cursoId) || [])
        : modulosProp.filter(m => m.cursoId === formData.cursoId);
      const modulosLocaisDoCurso = modulosLocais.filter(m => m.cursoId === formData.cursoId);
      return [...modulosDoCurso, ...modulosLocaisDoCurso];
    }
    // Sem curso selecionado: permitir escolher qualquer módulo (útil para reuso real).
    return [...modulosProp, ...modulosLocais];
  }, [formData.cursoId, modulosProp, modulosLocais, getModulosByCursoId]);

  // Opções de treinamento para select (com opção de criar novo)
  const cursoOptions = useMemo(() => {
    return [
      { value: '__new__', label: '+ Criar Novo Treinamento' },
      ...cursos.map(c => ({
        value: c.id,
        label: c.titulo,
      })),
    ];
  }, [cursos]);

  // Opções de módulo para select (com opção de criar novo)
  const moduloOptions = useMemo(() => {
    if (formData.cursoId === '__new__') return [];
    return [
      { value: '__new__', label: '+ Criar Novo Módulo' },
      ...modulos.map(m => ({
        value: m.id,
        label: m.titulo,
      })),
    ];
  }, [modulos, formData.cursoId]);

  // Opções de tipo de mídia
  const tipoOptions = Object.entries(TIPOS_MIDIA).map(([value, { label }]) => ({
    value,
    label,
  }));

  // Handler de mudança de campo
  const handleChange = (field, value) => {
    // Interceptar seleção de criar novo
    if (field === 'cursoId' && value === '__new__') {
      setShowCursoModal(true);
      return;
    }
    if (field === 'moduloId' && value === '__new__') {
      setShowModuloModal(true);
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpar erro do campo
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Resetar módulo se mudar curso
    if (field === 'cursoId') {
      setFormData(prev => ({ ...prev, moduloId: '' }));
    }
  };

  // Handler para salvar novo curso
  const handleSaveCurso = async (cursoData) => {
    const saved = await onCursoCreated?.(cursoData);
    const cursoResolved = saved || cursoData;
    if (!cursoResolved?.id) throw new Error('Falha ao criar treinamento.');
    setCursosLocais(prev => [...prev, cursoResolved]);
    setFormData(prev => ({ ...prev, cursoId: cursoResolved.id, moduloId: '' }));
  };

  // Handler para salvar novo módulo
  const handleSaveModulo = async (moduloData) => {
    const saved = await onModuloCreated?.(moduloData);
    const moduloResolved = saved || moduloData;
    if (!moduloResolved?.id) throw new Error('Falha ao criar módulo.');
    setModulosLocais(prev => [...prev, moduloResolved]);
    setFormData(prev => ({ ...prev, moduloId: moduloResolved.id }));
  };

  // Buscar duração automática para vídeos Vimeo
  const fetchVideoDuration = async (url, tipo) => {
    try {
      if (tipo === 'vimeo') {
        const videoId = extractVimeoId(url);
        if (!videoId) return null;

        const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`);
        if (!response.ok) return null;

        const data = await response.json();
        return Math.ceil(data.duration / 60); // Converter segundos para minutos
      }
      // YouTube requer API key, então não buscamos automaticamente
      return null;
    } catch (error) {
      console.error('Erro ao buscar duração:', error);
      return null;
    }
  };

  // Effect para buscar duração automática
  useEffect(() => {
    const getDuration = async () => {
      if (!formData.url || formData.tipo !== 'vimeo') return;
      if (formData.duracao) return; // Já tem duração definida

      setIsLoadingDuration(true);
      const duracao = await fetchVideoDuration(formData.url, formData.tipo);
      if (duracao) {
        setFormData(prev => ({ ...prev, duracao: duracao.toString() }));
      }
      setIsLoadingDuration(false);
    };

    const timer = setTimeout(getDuration, 500);
    return () => clearTimeout(timer);
  }, [formData.url, formData.tipo]);

  // Handler de upload de arquivo
  const handleFileUpload = async (file) => {
    if (!file) {
      handleChange('url', '');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const aulaId = aula?.id || `aula-${Date.now()}`;
      let result;

      if (formData.tipo === 'audio') {
        result = await uploadService.uploadAudio(file, aulaId, (progress) => {
          setUploadProgress(progress);
        });
      } else if (formData.tipo === 'document') {
        result = await uploadService.uploadDocument(file, aulaId, (progress) => {
          setUploadProgress(progress);
        });
      } else {
        result = await uploadService.uploadVideo(file, aulaId, (progress) => {
          setUploadProgress(progress);
        });
      }

      handleChange('url', result.url);
      if (result.type) {
        handleChange('mimeType', result.type);
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        url: error.message,
      }));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handler de upload de thumbnail
  const handleThumbnailUpload = async (file) => {
    if (!file) {
      handleChange('thumbnail', null);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const aulaId = aula?.id || `aula-${Date.now()}`;
      const url = await uploadService.uploadThumbnail(file, aulaId, (progress) => {
        setUploadProgress(progress);
      });
      handleChange('thumbnail', url);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        thumbnail: error.message,
      }));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Validação
  const validate = () => {
    const newErrors = {};

    if (!formData.moduloId) {
      newErrors.moduloId = 'Selecione um módulo';
    }
    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }

    // text não exige URL nem duração obrigatória
    if (formData.tipo !== 'text') {
      if (!formData.url.trim()) {
        newErrors.url = 'URL é obrigatória';
      } else if (formData.tipo === 'youtube' && !extractYouTubeId(formData.url)) {
        newErrors.url = 'URL do YouTube inválida';
      } else if (formData.tipo === 'vimeo' && !extractVimeoId(formData.url)) {
        newErrors.url = 'URL do Vimeo inválida';
      } else if (formData.tipo === 'link') {
        try { new URL(formData.url); } catch { newErrors.url = 'URL inválida'; }
      }
    }

    if (formData.tipo !== 'text' && (!formData.duracao || parseInt(formData.duracao) <= 0)) {
      newErrors.duracao = 'Duração deve ser maior que 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de salvamento
  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);

    try {
      const aulaData = {
        ...formData,
        duracao: parseInt(formData.duracao),
        createdAt: aula?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const saved = await onSave?.(aulaData);
      const aulaIdResolved = aula?.id || saved?.id;
      if (!aulaIdResolved) {
        throw new Error('Falha ao salvar aula: ID não retornado.');
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

  // Determinar se URL ou upload
  const isUrlBased = formData.tipo === 'youtube' || formData.tipo === 'vimeo' || formData.tipo === 'link';
  const isTextBased = formData.tipo === 'text';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar Aula' : 'Nova Aula'}
      size="lg"
    >
      <div className="space-y-6 p-1 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Treinamento e Módulo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Treinamento (opcional)" error={errors.cursoId}>
            <Select
              value={formData.cursoId}
              onChange={(v) => handleChange('cursoId', v)}
              placeholder="Selecione o treinamento"
              options={cursoOptions}
            />
          </FormField>

          <FormField label="Módulo" error={errors.moduloId} required>
            <Select
              value={formData.moduloId}
              onChange={(v) => handleChange('moduloId', v)}
              placeholder="Selecione o módulo"
              options={moduloOptions}
              disabled={formData.cursoId === '__new__'}
            />
          </FormField>
        </div>

        {/* Título */}
        <FormField label="Título" error={errors.titulo} required>
          <Input
            value={formData.titulo}
            onChange={(e) => handleChange('titulo', e.target.value)}
            placeholder="Ex: Introdução ao Curso"
          />
        </FormField>

        {/* Descrição */}
        <FormField label="Descrição">
          <Textarea
            value={formData.descricao}
            onChange={(value) => handleChange('descricao', value)}
            placeholder="Descrição da aula..."
            rows={3}
          />
        </FormField>

        {/* Tipo de Mídia */}
        <FormField label="Tipo de Mídia" required>
          <div className="flex flex-wrap gap-2">
            {tipoOptions.map(({ value, label }) => {
              const iconMap = {
                youtube: Youtube,
                vimeo: Video,
                video: Video,
                audio: Headphones,
                document: FileText,
                text: BookOpen,
                link: ExternalLink,
              };
              const FinalIcon = iconMap[value] || Video;
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
                  <FinalIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </FormField>

        {/* URL ou Upload ou Texto */}
        {isTextBased ? (
          <FormField label="Conteúdo de Texto">
            <Textarea
              value={formData.descricao}
              onChange={(value) => handleChange('descricao', value)}
              placeholder="Digite o conteúdo da aula..."
              rows={6}
            />
          </FormField>
        ) : isUrlBased ? (
          <FormField
            label={formData.tipo === 'youtube' ? 'URL do YouTube' : formData.tipo === 'vimeo' ? 'URL do Vimeo' : 'URL do Link'}
            error={errors.url}
            required
          >
            <Input
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder={
                formData.tipo === 'youtube'
                  ? 'https://www.youtube.com/watch?v=...'
                  : formData.tipo === 'vimeo'
                    ? 'https://vimeo.com/...'
                    : 'https://...'
              }
            />
          </FormField>
        ) : (
          <FormField
            label={
              formData.tipo === 'audio'
                ? 'Arquivo de Áudio'
                : formData.tipo === 'document'
                  ? 'Arquivo (PDF/PPT/HTML)'
                  : 'Arquivo de Vídeo'
            }
            error={errors.url}
            required
          >
            {formData.url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Video className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{formData.url}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleChange('url', '')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div>
                <FileUpload
                  accept={
                    formData.tipo === 'audio'
                      ? 'audio/*'
                      : formData.tipo === 'document'
                        ? '.pdf,.ppt,.pptx,.html,.htm,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/html'
                        : 'video/*'
                  }
                  onChange={handleFileUpload}
                  maxSize={500 * 1024 * 1024}
                  disabled={isUploading}
                />
                {isUploading && (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={uploadProgress} className="flex-1" />
                    <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                  </div>
                )}
              </div>
            )}
          </FormField>
        )}

        {/* Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Duração (minutos)"
            error={errors.duracao}
            hint={formData.tipo === 'vimeo' ? 'Duração detectada automaticamente para Vimeo' : undefined}
            required
          >
            <div className="relative">
              <Input
                type="number"
                value={formData.duracao}
                onChange={(e) => handleChange('duracao', e.target.value)}
                placeholder="15"
                min={1}
                disabled={isLoadingDuration}
              />
              {isLoadingDuration && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </FormField>

          <FormField label="Thumbnail (opcional)">
            {formData.thumbnail ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <img
                  src={formData.thumbnail}
                  alt="Thumbnail"
                  loading="lazy"
                  className="w-12 h-8 object-cover rounded"
                />
                <span className="text-sm flex-1 truncate">Imagem selecionada</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleChange('thumbnail', null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div>
                <FileUpload
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  maxSize={10 * 1024 * 1024}
                  disabled={isUploading}
                />
                {isUploading && (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={uploadProgress} className="flex-1" />
                    <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                  </div>
                )}
              </div>
            )}
          </FormField>
        </div>

        {/* Preview */}
        {formData.url && (
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              leftIcon={<Eye className="w-4 h-4" />}
            >
              {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
            </Button>

            {showPreview && (
              <div className="rounded-xl overflow-hidden border border-border">
                <AulaPreview
                  tipo={formData.tipo}
                  url={formData.url}
                  titulo={formData.titulo}
                />
              </div>
            )}
          </div>
        )}

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
            disabled={isSaving || isUploading}
            leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Modal para criar novo curso */}
      <CursoFormModal
        open={showCursoModal}
        onClose={() => setShowCursoModal(false)}
        onSave={handleSaveCurso}
      />

      {/* Modal para criar novo módulo */}
      <ModuloFormModal
        open={showModuloModal}
        onClose={() => setShowModuloModal(false)}
        onSave={handleSaveModulo}
        cursoId={formData.cursoId !== '__new__' ? formData.cursoId : null}
      />
    </Modal>
  );
}

export default AulaFormModal;
