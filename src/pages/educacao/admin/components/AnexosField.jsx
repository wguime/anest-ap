/**
 * AnexosField.jsx
 * Lista de anexos múltiplos por aula (Wave 1.3 T1.3.7b)
 */

import { useState, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical, FileText, Trash2, Plus, Loader2, FileImage, FileVideo, FileAudio, File as FileIcon } from 'lucide-react';
import { Button, Input } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { uploadService, MAX_DOCUMENT_SIZE } from '@/services/uploadService';

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function iconForMime(mime = '') {
  if (mime.startsWith('image/')) return FileImage;
  if (mime.startsWith('video/')) return FileVideo;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime === 'application/pdf') return FileText;
  return FileIcon;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnexosField({ value = [], onChange, aulaId, disabled = false }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handlePickFile = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_DOCUMENT_SIZE) {
      setUploadError(`Arquivo maior que ${Math.round(MAX_DOCUMENT_SIZE / 1024 / 1024)}MB.`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadService.upload(file, 'document', aulaId || 'tmp');
      const novo = {
        id: makeId(),
        url: result.url,
        mimeType: file.type || result.type || 'application/octet-stream',
        label: file.name.replace(/\.[^.]+$/, ''),
        size: file.size,
      };
      onChange?.([...(value || []), novo]);
    } catch (err) {
      setUploadError(err.message || 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleLabelChange = (id, label) => {
    onChange?.(value.map((a) => (a.id === id ? { ...a, label } : a)));
  };

  const handleRemove = (id) => {
    onChange?.(value.filter((a) => a.id !== id));
  };

  const handleReorder = (newOrder) => {
    onChange?.(newOrder);
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <Reorder.Group axis="y" values={value} onReorder={handleReorder} className="space-y-2">
          {value.map((anexo) => {
            const Icon = iconForMime(anexo.mimeType);
            return (
              <Reorder.Item
                key={anexo.id}
                value={anexo}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border bg-card p-3',
                  'cursor-grab active:cursor-grabbing'
                )}
                whileDrag={{ scale: 1.02, zIndex: 50 }}
              >
                <div className="shrink-0 text-muted-foreground">
                  <GripVertical className="w-5 h-5" aria-hidden="true" />
                </div>
                <div
                  className={cn(
                    'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-accent text-primary'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 grid gap-1">
                  <Input
                    value={anexo.label}
                    onChange={(e) => handleLabelChange(anexo.id, e.target.value)}
                    placeholder="Nome do material"
                    aria-label="Nome do material"
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground truncate">
                    {anexo.mimeType}
                    {anexo.size ? ` · ${formatSize(anexo.size)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(anexo.id)}
                  disabled={disabled}
                  className={cn(
                    'shrink-0 p-2 rounded-lg transition-colors',
                    'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                    'min-w-[44px] min-h-[44px] flex items-center justify-center'
                  )}
                  aria-label={`Remover ${anexo.label || 'anexo'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <Button
        type="button"
        variant="outline"
        onClick={handlePickFile}
        disabled={disabled || uploading}
        leftIcon={uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      >
        {uploading ? 'Enviando...' : 'Adicionar material'}
      </Button>

      {uploadError && (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}

export default AnexosField;
