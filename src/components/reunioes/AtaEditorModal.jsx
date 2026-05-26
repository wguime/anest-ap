/**
 * AtaEditorModal — Rich text editor for meeting minutes (ata).
 *
 * Standalone component consumed by the tab refactor of ReuniaoDetalhePage.
 * Uses the DS RichEditor (BlockNote) to write ata content as HTML.
 * The existing PDF upload flow (UploadAtaModal) remains as an alternative.
 */
import { useState, useCallback } from 'react';
import { Modal, Button, RichEditor, Spinner, useToast, cn } from '@/design-system';
import { Checkbox } from '@/design-system/components/ui/checkbox';
import { FileText, Save } from 'lucide-react';

// ============================================================================
// COMPONENT
// ============================================================================

export default function AtaEditorModal({
  open,
  onClose,
  reuniao,
  onSave,
}) {
  const { toast } = useToast();

  // HTML content state — initialize from existing ataContent if present
  const [content, setContent] = useState(() => reuniao?.ataContent || '');
  const [markAsCompleted, setMarkAsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEmptyContent = useCallback((html) => {
    if (!html) return true;
    // Strip tags and check if any visible text remains
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text.length === 0;
  }, []);

  const handleSave = useCallback(async () => {
    if (isEmptyContent(content)) {
      toast({
        variant: 'warning',
        title: 'Ata vazia',
        description: 'Escreva o conteudo da ata antes de salvar.',
        duration: 3000,
      });
      return;
    }

    try {
      setSaving(true);
      await onSave(content, { markAsCompleted });
      toast({
        variant: 'success',
        title: 'Ata salva',
        description: markAsCompleted
          ? 'Ata salva e reuniao marcada como concluida!'
          : 'O rascunho da ata foi salvo com sucesso.',
        duration: 4000,
      });
      onClose();
    } catch (error) {
      console.error('[AtaEditorModal] save error:', error);
      toast({
        variant: 'error',
        title: 'Erro ao salvar ata',
        description: error.message || 'Nao foi possivel salvar a ata. Tente novamente.',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }, [content, markAsCompleted, isEmptyContent, onSave, onClose, toast]);

  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const footerContent = (
    <div className="flex gap-3 w-full">
      <Button
        variant="outline"
        onClick={handleClose}
        disabled={saving}
        className="flex-1"
        aria-label="Cancelar edicao da ata"
      >
        Cancelar
      </Button>
      <Button
        onClick={handleSave}
        disabled={saving || isEmptyContent(content)}
        className="flex-1"
        aria-label="Salvar ata da reuniao"
      >
        {saving ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Salvando...
          </>
        ) : (
          <>
            <Save size={18} className="mr-2" aria-hidden="true" />
            Salvar Ata
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Escrever Ata"
      description={reuniao?.titulo ? `Reuniao: ${reuniao.titulo}` : undefined}
      size="xl"
      closeOnOverlayClick={!saving}
      closeOnEscape={!saving}
      footer={footerContent}
      aria-label="Modal de edicao da ata da reuniao"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Info banner */}
          <div className={cn(
            'flex items-start gap-3 rounded-2xl p-3',
            'bg-info/10 text-info border border-info/20'
          )}>
            <FileText size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-relaxed">
              Escreva a ata da reuniao usando o editor abaixo. O conteudo sera salvo como
              rascunho e podera ser editado posteriormente. Voce tambem pode fazer upload de
              um PDF como alternativa.
            </p>
          </div>

          {/* Rich Editor */}
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Escreva a ata da reuniao..."
            disabled={saving}
            label="Conteudo da Ata"
            ariaLabel="Editor de texto da ata da reuniao"
            className="min-h-[280px] sm:min-h-[360px]"
          />

          {/* Mark as completed checkbox */}
          <Checkbox
            checked={markAsCompleted}
            onChange={setMarkAsCompleted}
            label="Marcar reuniao como concluida"
            description="Ao salvar a ata, a reuniao sera automaticamente marcada como concluida"
            disabled={saving}
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}
