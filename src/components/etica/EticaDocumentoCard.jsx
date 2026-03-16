/**
 * EticaDocumentoCard - Card de documento de Etica
 * Exibe informacoes do documento com acoes de visualizar e excluir
 */
import { FileText, Eye, Trash2, Calendar, User } from 'lucide-react';
import { Button } from '@/design-system';
import { AdminOnly } from '@/design-system/components/anest/admin-only';

/**
 * Formata o tamanho do arquivo para exibicao
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formata data para exibicao
 */
function formatDate(timestamp) {
  if (!timestamp) return '';

  // Se for Timestamp do Firebase
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * EticaDocumentoCard Component
 * @param {Object} props
 * @param {Object} props.documento - Dados do documento
 * @param {Object} props.config - Configuracao do tipo de documento
 * @param {Function} props.onView - Callback ao clicar para visualizar
 * @param {Function} props.onDelete - Callback ao clicar para excluir
 * @param {Object} props.user - Usuario atual (para verificar permissoes)
 */
export function EticaDocumentoCard({
  documento,
  config,
  onView,
  onDelete,
  user,
}) {
  if (!documento) return null;

  return (
    <div className="bg-white dark:bg-[#1A2420] rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36] overflow-hidden">
      {/* Header com icone e titulo */}
      <div className="p-4 border-b border-[#C8E6C9] dark:border-[#2A3F36]">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] dark:bg-[#2A3F36] flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#004225] dark:text-white truncate">
              {documento.titulo || 'Documento sem titulo'}
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#6B8178] truncate">
              {documento.arquivoNome || 'arquivo.pdf'}
            </p>
          </div>
        </div>
      </div>

      {/* Metadados */}
      <div className="px-4 py-3 space-y-2 bg-[#F9FAFB] dark:bg-[#111916]">
        {documento.createdAt && (
          <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#6B8178]">
            <Calendar className="w-4 h-4" />
            <span>Enviado em {formatDate(documento.createdAt)}</span>
          </div>
        )}
        {documento.createdByName && (
          <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#6B8178]">
            <User className="w-4 h-4" />
            <span>Por {documento.createdByName}</span>
          </div>
        )}
        {documento.arquivoTamanho && (
          <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#6B8178]">
            <FileText className="w-4 h-4" />
            <span>{formatFileSize(documento.arquivoTamanho)}</span>
          </div>
        )}
        {documento.observacoes && (
          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] pt-1">
            {documento.observacoes}
          </p>
        )}
      </div>

      {/* Acoes */}
      <div className="p-4 flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onView}
          leftIcon={<Eye className="w-4 h-4" />}
          className="flex-1 bg-[#006837] hover:bg-[#004225] dark:bg-[#2ECC71] dark:hover:bg-[#1E8449]"
        >
          Visualizar PDF
        </Button>

        <AdminOnly user={user}>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Excluir
          </Button>
        </AdminOnly>
      </div>
    </div>
  );
}

export default EticaDocumentoCard;
