/**
 * UploadSubsidioModal - Modal para upload de documentos de subsídio
 * Permite upload múltiplo de PDFs pré-reunião com título e descrição
 */
import { useState } from 'react';
import { Modal, FileUpload, Input, Textarea, Button, Spinner, useToast } from '@/design-system';
import reunioesService from '@/services/reunioesService';

export default function UploadSubsidioModal({
  isOpen,
  onClose,
  reuniaoId,
  onSuccess,
  user
}) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleUpload = async () => {
    // Validação
    if (!files || files.length === 0) {
      setError('Por favor, selecione pelo menos um arquivo PDF');
      return;
    }

    if (!titulo.trim()) {
      setError('Por favor, informe um título');
      return;
    }

    // Validar se todos são PDFs
    const invalidFiles = files.filter(
      (file) => !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')
    );
    if (invalidFiles.length > 0) {
      setError('Apenas arquivos PDF são permitidos');
      return;
    }

    try {
      setUploading(true);
      setError('');

      const userInfo = {
        userId: user?.uid,
        userName: user?.displayName || user?.email || 'Usuário',
        userEmail: user?.email,
      };

      const metadata = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      };

      // Upload de cada arquivo como subsídio
      const uploadPromises = files.map((file) =>
        reunioesService.uploadDocumento(
          reuniaoId,
          file,
          'subsidio',
          metadata,
          userInfo
        )
      );

      await Promise.all(uploadPromises);

      // Sucesso
      toast({
        variant: 'success',
        title: 'Documentos Enviados',
        description: `${files.length} documento(s) de subsídio enviado(s) com sucesso!`,
        duration: 4000,
      });

      // Callback de sucesso
      onSuccess?.();

      // Limpar e fechar
      handleClose();
    } catch (error) {
      console.error('Erro ao fazer upload dos documentos:', error);
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
      setFiles([]);
      setTitulo('');
      setDescricao('');
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
        disabled={uploading || files.length === 0 || !titulo.trim()}
        className="flex-1"
      >
        {uploading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Enviando...
          </>
        ) : (
          `Enviar ${files.length > 0 ? `(${files.length})` : ''}`
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Upload de Documentos de Subsídio"
      description="Adicione documentos de apoio para a reunião"
      size="md"
      closeOnOverlayClick={!uploading}
      closeOnEscape={!uploading}
      footer={footerButtons}
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Título */}
          <Input
            label="Título *"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              setError('');
            }}
            placeholder="Ex: Material de Apoio - Comitê Janeiro 2026"
            disabled={uploading}
            maxLength={200}
          />

          {/* Descrição */}
          <Textarea
            label="Descrição"
            placeholder="Descreva o conteúdo dos documentos (opcional)"
            value={descricao}
            onChange={setDescricao}
            rows={3}
            maxLength={500}
            showCount
            disabled={uploading}
          />

          {/* Upload de Arquivos (múltiplos) */}
          <FileUpload
            label="Documentos PDF *"
            description="Selecione um ou mais arquivos PDF (máx. 15MB cada)"
            accept=".pdf,application/pdf"
            multiple
            value={files}
            onChange={(selectedFiles) => {
              setFiles(selectedFiles || []);
              setError('');
            }}
            disabled={uploading}
            maxSize={15 * 1024 * 1024}
            error={error}
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}
