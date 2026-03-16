/**
 * ViewPdfModal - Modal para visualizacao de PDF
 */
import { Modal, PDFViewer } from '@/design-system';

/**
 * ViewPdfModal Component
 * @param {Object} props
 * @param {boolean} props.open - Se o modal esta aberto
 * @param {Function} props.onClose - Callback ao fechar
 * @param {Object} props.documento - Documento a ser exibido
 * @param {string} props.title - Titulo do modal
 */
export function ViewPdfModal({
  open,
  onClose,
  documento,
  title,
}) {
  if (!documento) return null;

  const pdfUrl = documento.arquivoURL || documento.url;
  const pdfTitle = title || documento.titulo || 'Documento PDF';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pdfTitle}
      size="full"
      closeOnOverlayClick={true}
      showCloseButton={true}
    >
      <Modal.Body>
        <div className="h-[calc(80vh-120px)] min-h-[400px]">
          <PDFViewer
            src={pdfUrl}
            title={pdfTitle}
            showTitle={false}
            height="100%"
            className="h-full"
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default ViewPdfModal;
