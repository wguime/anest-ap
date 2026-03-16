/**
 * UploadAtaModal - Modal para upload de ata de reunião
 * Permite upload de PDF, observações e marcar reunião como concluída
 */
import { useState } from 'react';
import { Modal, FileUpload, Textarea, Checkbox, Button, Spinner, useToast } from '@/design-system';
import reunioesService from '@/services/reunioesService';

export default function UploadAtaModal({
  isOpen,
  onClose,
  reuniaoId,
  onSuccess,
  user
}) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [observacoes, setObservacoes] = useState('');
  const [markAsCompleted, setMarkAsCompleted] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleUpload = async () => {
    // Validação
    if (!file) {
      setError('Por favor, selecione um arquivo PDF');
      return;
    }

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Apenas arquivos PDF são permitidos');
      return;
    }

    try {
      setUploading(true);
      setError('');

      // Upload da ata via service
      const userInfo = {
        userId: user?.uid,
        userName: user?.displayName || user?.email || 'Usuário',
        userEmail: user?.email,
      };

      await reunioesService.uploadAta(
        reuniaoId,
        file,
        { observacoes },
        userInfo,
        markAsCompleted
      );

      // Sucesso
      toast({
        variant: 'success',
        title: 'Ata Enviada',
        description: markAsCompleted
          ? 'Ata enviada e reunião marcada como concluída!'
          : 'Ata enviada com sucesso!',
        duration: 4000,
      });

      // Callback de sucesso
      onSuccess?.();

      // Limpar e fechar
      handleClose();
    } catch (error) {
      console.error('Erro ao fazer upload da ata:', error);
      const errorMsg = error.message || 'Erro ao fazer upload. Tente novamente.';
      setError(errorMsg);

      toast({
        variant: 'error',
        title: 'Erro ao Enviar',
        description: errorMsg,
        duration: 5000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setObservacoes('');
      setMarkAsCompleted(false);
      setError('');
      onClose();
    }
  };

  const footerButtons = (
    <div className="flex gap-3 w-full">
      <Button
        variant="outline"
        onClick={handleClose}
        disabled={uploading}
        className="flex-1"
      >
        Cancelar
      </Button>
      <Button
        onClick={handleUpload}
        disabled={uploading || !file}
        className="flex-1"
      >
        {uploading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Enviando...
          </>
        ) : (
          'Enviar Ata'
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Upload de Ata"
      description="Adicione a ata da reunião em formato PDF"
      size="md"
      closeOnOverlayClick={!uploading}
      closeOnEscape={!uploading}
      footer={footerButtons}
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Upload de Arquivo PDF */}
          <FileUpload
            label="Arquivo da Ata *"
            description="Selecione um arquivo PDF com a ata da reunião"
            accept=".pdf,application/pdf"
            value={file}
            onChange={(selectedFile) => {
              setFile(selectedFile);
              setError('');
            }}
            disabled={uploading}
            error={error}
          />

          {/* Observações */}
          <Textarea
            label="Observações"
            placeholder="Adicione observações sobre a reunião (opcional)"
            value={observacoes}
            onChange={setObservacoes}
            rows={4}
            maxLength={500}
            showCount
            disabled={uploading}
          />

          {/* Checkbox para marcar como concluída */}
          <Checkbox
            checked={markAsCompleted}
            onChange={setMarkAsCompleted}
            label="Marcar reunião como concluída"
            description="Ao enviar a ata, a reunião será automaticamente marcada como concluída"
            disabled={uploading}
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}
