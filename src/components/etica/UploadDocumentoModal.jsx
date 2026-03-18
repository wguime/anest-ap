/**
 * UploadDocumentoModal - Modal para upload de documentos de Etica
 */
import { useState } from 'react';
import { Modal, Button, FileUpload, FormField, Input, Textarea } from '@/design-system';

/**
 * UploadDocumentoModal Component
 * @param {Object} props
 * @param {boolean} props.open - Se o modal esta aberto
 * @param {Function} props.onClose - Callback ao fechar
 * @param {Object} props.config - Configuracao do tipo de documento
 * @param {Function} props.onUpload - Callback ao fazer upload (file, metadata)
 * @param {boolean} props.loading - Se esta carregando
 */
export function UploadDocumentoModal({
  open,
  onClose,
  config,
  onUpload,
  loading = false,
}) {
  const [file, setFile] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [error, setError] = useState(null);

  // Limpar estado ao fechar
  const handleClose = () => {
    if (loading) return;
    setFile(null);
    setTitulo('');
    setObservacoes('');
    setError(null);
    onClose();
  };

  // Submeter upload
  const handleSubmit = async () => {
    if (!file) {
      setError('Selecione um arquivo PDF');
      return;
    }

    setError(null);

    try {
      await onUpload(file, {
        titulo: titulo.trim() || file.name.replace('.pdf', ''),
        observacoes: observacoes.trim(),
      });
      handleClose();
    } catch (err) {
      setError(err.message || 'Erro ao fazer upload');
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo Documento"
      description={config?.titulo || 'Adicionar documento de etica'}
      size="md"
      closeOnOverlayClick={!loading}
      showCloseButton={!loading}
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!file || loading}
            loading={loading}
            className="bg-primary hover:bg-primary dark:hover:bg-[#1E8449]"
          >
            Enviar Documento
          </Button>
        </>
      }
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Upload de arquivo */}
          <FileUpload
            value={file}
            onChange={setFile}
            accept=".pdf"
            maxSize={10485760} // 10MB
            label="Arquivo PDF"
            description="Arraste ou clique para selecionar um arquivo PDF (max 10MB)"
            disabled={loading}
            error={error && !file ? 'Selecione um arquivo' : undefined}
          />

          {/* Titulo */}
          <FormField
            label="Titulo do Documento"
            hint="Deixe em branco para usar o nome do arquivo"
          >
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Protocolo de Dilemas Bioeticos 2024"
              disabled={loading}
            />
          </FormField>

          {/* Observacoes */}
          <FormField
            label="Observacoes"
            hint="Opcional - Adicione notas ou descricao"
          >
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas sobre o documento..."
              rows={3}
              disabled={loading}
            />
          </FormField>

          {/* Erro */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default UploadDocumentoModal;
