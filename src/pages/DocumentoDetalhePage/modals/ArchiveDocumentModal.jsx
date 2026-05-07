/**
 * ArchiveDocumentModal — extraído de DocumentoDetalhePage.jsx (W3-2).
 * Lazy-loaded: chunk separado, fetched apenas quando admin abre.
 *
 * W2-2: usa DS <ConfirmDialog> (role="alertdialog", focus trap, ESC).
 */
import { useState } from 'react';
import { ConfirmDialog, FormField, Select } from '@/design-system';
import { Archive } from 'lucide-react';
import { CATEGORY_SUBSECTIONS } from '@/types/documents';

export default function ArchiveDocumentModal({ documento, onClose, onConfirm }) {
  const [archiveSubsection, setArchiveSubsection] = useState('');
  const [showError, setShowError] = useState(false);

  const obsoletosOptions = CATEGORY_SUBSECTIONS.obsoletos || [];

  const handleConfirm = () => {
    if (!archiveSubsection) {
      setShowError(true);
      return;
    }
    onConfirm(archiveSubsection);
  };

  return (
    <ConfirmDialog
      open={true}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Arquivar Documento?"
      description={`O documento "${documento?.titulo}" será movido para a seção 10 Obsoletos. Selecione a subseção de destino.`}
      confirmText="Arquivar"
      cancelText="Cancelar"
      variant="danger"
      icon={<Archive className="h-7 w-7" aria-hidden="true" />}
    >
      <FormField
        label="Subseção em Obsoletos"
        required
        error={showError && !archiveSubsection ? 'Selecione uma subseção.' : ''}
      >
        <Select
          value={archiveSubsection}
          onChange={(val) => {
            setArchiveSubsection(val);
            if (val) setShowError(false);
          }}
          placeholder="Selecione a subseção"
          options={obsoletosOptions}
        />
      </FormField>
    </ConfirmDialog>
  );
}
