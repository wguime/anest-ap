/**
 * NewVersionModal — extraído de DocumentoDetalhePage.jsx (W3-2).
 * Lazy-loaded: chunk separado, fetched apenas quando admin abre.
 *
 * Wave 0b — usa Firebase UID real em createBy (NUNCA hardcode).
 * Upload: supabaseDocumentService.uploadFile(...) → retorna apenas path;
 * URL signed gerada on-demand pelo PDFViewer.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/design-system';
import { FileUpload } from '@/design-system/components/ui/file-upload';
import { Loader2, Upload, X } from 'lucide-react';
import supabaseDocumentService from '@/services/supabaseDocumentService';
import { useOcrPipeline } from '@/hooks/useOcrPipeline';
import { useModalA11y } from '@/hooks/useModalA11y';
import { isOcrEnabled } from '@/utils/featureFlags';

export default function NewVersionModal({ documento, currentUser, onClose, onSave }) {
  const versaoSugerida = String((documento?.versaoAtual || 0) + 1);
  const versoesExistentes = useMemo(
    () => (documento?.versoes || []).map((v) => String(v.versao)),
    [documento?.versoes]
  );
  const { startOcr } = useOcrPipeline();
  const containerRef = useRef(null);
  const versaoId = useId();
  const descricaoId = useId();
  const motivoId = useId();
  const arquivoId = useId();
  useModalA11y({ containerRef, onClose });

  const [novaVersao, setNovaVersao] = useState(versaoSugerida);
  const [novoArquivo, setNovoArquivo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    descricaoAlteracao: '',
    motivoAlteracao: '',
    enviarParaAprovacao: false,
  });

  const versaoDuplicada =
    versoesExistentes.includes(novaVersao.trim()) && novaVersao.trim() !== '';

  const handleSubmit = async () => {
    if (versaoDuplicada) return;
    if (!currentUser?.uid) {
      // audit-trail.md exige userId real (Wave 0b)
      onSave({ __error: 'Sessão expirada. Faça login novamente.' });
      return;
    }

    setUploading(true);
    try {
      let arquivoFields = {};
      if (novoArquivo) {
        const uploaded = await supabaseDocumentService.uploadFile(
          novoArquivo,
          documento.category || documento.categoria || 'biblioteca',
          documento.id,
          parseFloat(novaVersao) || (documento.versaoAtual || 0) + 1
        );
        arquivoFields = {
          arquivoURL: null, // signed URL gerada on-demand pelo PDFViewer
          arquivoNome: novoArquivo.name,
          arquivoTamanho: novoArquivo.size,
          storagePath: uploaded.path,
        };
      }

      onSave({
        ...formData,
        ...arquivoFields,
        versao: parseFloat(novaVersao) || (documento.versaoAtual || 0) + 1,
        status: formData.enviarParaAprovacao ? 'pendente' : 'ativo',
        createdAt: new Date().toISOString(),
        // Audit fields — Firebase UID real (Wave 0b root cause #3)
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email || 'Usuário',
      });

      // Sprint 4 / O2-2: OCR em background na nova versão (apenas PDF).
      if (
        isOcrEnabled() &&
        novoArquivo &&
        novoArquivo.type === 'application/pdf' &&
        documento?.id
      ) {
        Promise.resolve().then(() =>
          startOcr({
            docId: documento.id,
            file: novoArquivo,
            userInfo: {
              userId: currentUser.uid,
              userName: currentUser.displayName || currentUser.email || 'Usuário',
              userEmail: currentUser.email || null,
            },
          })
        );
      }
    } catch (err) {
      onSave({ __error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 z-modal flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-version-modal-title"
      aria-describedby="new-version-modal-desc"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-lg min-h-[50vh] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2
              id="new-version-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              Nova Versao
            </h2>
            <p id="new-version-modal-desc" className="text-sm text-muted-foreground">
              {documento?.codigo} - versao atual: v{documento?.versaoAtual}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted dark:hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label htmlFor={versaoId} className="block text-sm font-medium text-foreground mb-1">
              Numero da Nova Versao *
            </label>
            <input
              id={versaoId}
              type="text"
              value={novaVersao}
              onChange={(e) => setNovaVersao(e.target.value)}
              placeholder="Ex: 2, 2.1, 3.0"
              className={`w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
                versaoDuplicada
                  ? 'border-destructive dark:border-destructive focus:ring-destructive/30'
                  : 'border-border focus:ring-primary/30'
              }`}
            />
            {versaoDuplicada && (
              <p className="text-xs text-destructive mt-1">
                Esta versao ja existe neste documento. Escolha um numero diferente.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={descricaoId} className="block text-sm font-medium text-foreground mb-1">
              Descricao das Alteracoes *
            </label>
            <textarea
              id={descricaoId}
              value={formData.descricaoAlteracao}
              onChange={(e) =>
                setFormData({ ...formData, descricaoAlteracao: e.target.value })
              }
              rows={3}
              placeholder="Descreva as alteracoes realizadas..."
              className="w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border border-border text-foreground resize-none placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label htmlFor={motivoId} className="block text-sm font-medium text-foreground mb-1">
              Motivo da Alteracao *
            </label>
            <textarea
              id={motivoId}
              value={formData.motivoAlteracao}
              onChange={(e) =>
                setFormData({ ...formData, motivoAlteracao: e.target.value })
              }
              rows={2}
              placeholder="Ex: Revisao anual, Correcao de erro, Atualizacao normativa..."
              className="w-full px-3 py-2 rounded-xl bg-muted dark:bg-muted border border-border text-foreground resize-none placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label htmlFor={arquivoId} className="block text-sm font-medium text-foreground mb-1">
              Arquivo da Nova Versão
            </label>
            <FileUpload
              id={arquivoId}
              variant="dropzone"
              accept=".pdf,.docx,.xlsx"
              maxSize={20 * 1024 * 1024}
              value={novoArquivo}
              onChange={setNovoArquivo}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX ou XLSX até 20 MB. O arquivo será associado à nova versão.
            </p>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enviarParaAprovacao}
              onChange={(e) =>
                setFormData({ ...formData, enviarParaAprovacao: e.target.checked })
              }
              className="w-5 h-5 rounded border-border"
            />
            <div>
              <span className="text-sm font-medium text-foreground">
                Enviar para aprovacao
              </span>
              <p className="text-xs text-muted-foreground">
                A nova versao ficara pendente ate ser aprovada
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={
              uploading ||
              !formData.descricaoAlteracao ||
              !formData.motivoAlteracao ||
              !novaVersao.trim() ||
              versaoDuplicada
            }
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? 'Enviando...' : 'Criar Versao'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
