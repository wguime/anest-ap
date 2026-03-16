/**
 * BannerUpload.jsx
 * Componente reutilizável para upload de banners/thumbnails
 * Usado em TrilhaFormModal, CursoFormModal
 */

import { useState, useCallback } from 'react';
import {
  FileUpload,
  Progress,
  Button,
  AspectRatio,
  FormField,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { X, Image, Upload, Loader2 } from 'lucide-react';
import { uploadService } from '@/services/uploadService';

/**
 * BannerUpload - Componente para upload de banners/thumbnails
 *
 * @param {string} value - URL atual do banner
 * @param {function} onChange - Callback com nova URL
 * @param {string} entityId - ID da entidade (trilha/curso) - opcional para entidades novas
 * @param {string} entityType - 'trilha' | 'curso' | 'modulo' | 'aula'
 * @param {number} aspectRatio - Proporção do aspecto (default: 16/9)
 * @param {string} label - Label do campo
 * @param {string} hint - Hint do campo
 * @param {boolean} disabled - Desabilitar upload
 */
export function BannerUpload({
  value,
  onChange,
  entityId,
  entityType = 'curso',
  aspectRatio = 16 / 9,
  label = 'Banner (opcional)',
  hint = 'Recomendado: 1920x1080px (16:9)',
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(value || null);
  const [error, setError] = useState(null);

  // Handler de upload
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Criar preview local imediato
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      // Determinar ID para upload (usar timestamp se não tiver ID ainda)
      const uploadId = entityId || `temp_${Date.now()}`;

      // Upload usando o serviço
      const url = await uploadService.uploadBanner(
        file,
        uploadId,
        (progress) => setUploadProgress(progress)
      );

      // Atualizar com URL final
      setPreviewUrl(url);
      onChange?.(url);

      // Limpar blob URL após upload
      URL.revokeObjectURL(localPreview);
    } catch (err) {
      console.error('Erro no upload:', err);
      setError(err.message || 'Erro ao fazer upload da imagem');
      setPreviewUrl(value); // Reverter para valor anterior
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [entityId, onChange, value]);

  // Handler para remover banner
  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setError(null);
    onChange?.(null);
  }, [onChange]);

  return (
    <FormField label={label} hint={hint}>
      <div className="space-y-3">
        {/* Preview do banner */}
        {previewUrl ? (
          <div className="relative group">
            <AspectRatio ratio={aspectRatio} className="rounded-xl overflow-hidden border border-border bg-muted">
              <img
                src={previewUrl}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
              {/* Overlay escuro no hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={disabled || isUploading}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  leftIcon={<X className="w-4 h-4" />}
                >
                  Remover
                </Button>
              </div>
            </AspectRatio>

            {/* Progress overlay durante upload */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <Progress value={uploadProgress} size="sm" className="w-3/4" />
                <span className="text-white text-sm">{uploadProgress}%</span>
              </div>
            )}
          </div>
        ) : (
          /* Área de upload quando não tem banner */
          <div
            className={cn(
              "relative border-2 border-dashed rounded-xl transition-colors",
              disabled ? "border-muted bg-muted/50 cursor-not-allowed" : "border-border hover:border-primary/50 cursor-pointer",
              error && "border-destructive"
            )}
          >
            <AspectRatio ratio={aspectRatio}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                {isUploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                    <Progress value={uploadProgress} size="sm" className="w-3/4 max-w-[200px]" />
                    <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Image className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Clique ou arraste uma imagem
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG ou WebP até 10MB
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Input de arquivo invisível */}
              {!disabled && !isUploading && (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = ''; // Reset input
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              )}
            </AspectRatio>
          </div>
        )}

        {/* Mensagem de erro */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Botão alternativo para trocar imagem */}
        {previewUrl && !isUploading && (
          <div className="flex justify-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = '';
                }}
                className="hidden"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                leftIcon={<Upload className="w-4 h-4" />}
                asChild
              >
                <span>Trocar imagem</span>
              </Button>
            </label>
          </div>
        )}
      </div>
    </FormField>
  );
}

export default BannerUpload;
