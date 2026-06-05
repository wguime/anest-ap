/**
 * DocumentoDetalhePage — orchestrator (W3-2).
 * -----------------------------------------------------------------------------
 * Composição:
 *   • DocumentHeader   — header fixo + barra de ações (Download/Imprimir/Share)
 *   • DocumentMetadata — card com badge tipo, código, setor, versão, datas...
 *   • DocumentVersions — modal de histórico de versões (DS Modal)
 *   • DocumentApproval — botoeira admin + tabs (Documento / Distribuicao / Hist)
 *   • DocumentAuditTrail — painel da aba histórico (AuditTrailViewer)
 *   • Modais lazy: EditDocumentModal, NewVersionModal, ArchiveDocumentModal
 *     — fetched apenas quando admin clica no botão correspondente
 *
 * SSOT: TIPO_DISPLAY_CONFIG vem de '@/types/documents' (W3-2).
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Button, PageSkeleton, PDFViewer } from '@/design-system';
import { FileText, History, Loader2, Tag, Upload } from 'lucide-react';
import { useToast } from '@/design-system';
import { DOCUMENT_STATUS } from '@/types/documents';
import DistributionPanel from '@/components/documents/DistributionPanel';

import DocumentHeader, { DocumentActionBar } from './DocumentHeader';
import DocumentMetadata from './DocumentMetadata';
import DocumentVersions from './DocumentVersions';
import DocumentApproval from './DocumentApproval';
import DocumentAuditTrail from './DocumentAuditTrail';
import { useDocumentDetail } from './hooks/useDocumentDetail';
import { useDocumentMutations } from './hooks/useDocumentMutations';

// Lazy-load dos 3 modais — chunks separados, fetched on-demand
const EditDocumentModal = lazy(() => import('./modals/EditDocumentModal'));
const NewVersionModal = lazy(() => import('./modals/NewVersionModal'));
const ArchiveDocumentModal = lazy(() => import('./modals/ArchiveDocumentModal'));
const SendToReviewModal = lazy(() => import('./modals/SendToReviewModal'));

// eslint-disable-next-line no-unused-vars
export default function DocumentoDetalhePage({ onNavigate, goBack, params, isAdmin = false }) {
  const { toast } = useToast();
  const [showVersoes, setShowVersoes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState('documento');

  const documentoId = params?.documentoId;

  const {
    documento,
    loading,
    versoes,
    pdfDisplayUrl,
    firebaseUser,
    currentUser,
    contextUpdateDocument,
    contextArchiveDocument,
    contextAddVersion,
    contextChangeStatus,
  } = useDocumentDetail(documentoId);

  const handleGoBack = () => {
    goBack?.();
  };

  const { handleEditSave, handleNewVersionSave, handleArchiveConfirm, handleChangeStatus } =
    useDocumentMutations({
      documento,
      firebaseUser,
      currentUser,
      contextUpdateDocument,
      contextAddVersion,
      contextArchiveDocument,
      contextChangeStatus,
      onArchived: handleGoBack,
    });

  // Bloco 5 — mapeia a ação de workflow (por status) para a transição correta.
  const handleWorkflowAction = (actionKey) => {
    switch (actionKey) {
      case 'submitForApproval': // rascunho → pendente
        return handleChangeStatus(DOCUMENT_STATUS.PENDENTE);
      case 'sendToReview': // ativo → revisao_pendente (com motivo, via modal)
        return setShowReviewModal(true);
      case 'completeReview': // revisao_pendente → pendente (volta p/ fila de aprovação)
        return handleChangeStatus(DOCUMENT_STATUS.PENDENTE);
      case 'resubmit': // rejeitado → rascunho
        return handleChangeStatus(DOCUMENT_STATUS.RASCUNHO);
      default:
        return undefined;
    }
  };

  // Auto-open edit modal when editMode is passed in params
  useEffect(() => {
    if (params?.editMode && documento && !loading) {
      setShowEditModal(true);
    }
  }, [params?.editMode, documento, loading]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <DocumentHeader documento={null} goBack={handleGoBack} isErrorState />
        <PageSkeleton variant="detail" header={false} />
      </div>
    );
  }

  // Documento não encontrado
  if (!documento) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <DocumentHeader documento={null} goBack={handleGoBack} isErrorState />

        <div className="px-4 sm:px-5">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-destructive dark:text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Documento nao encontrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              O documento solicitado nao existe ou foi removido.
            </p>
            <Button onClick={handleGoBack}>Voltar para Biblioteca</Button>
          </div>
        </div>
      </div>
    );
  }

  // Render full state
  return (
    <div className="min-h-dvh bg-background pb-24">
      <DocumentHeader documento={documento} goBack={handleGoBack} />

      <div className="px-4 sm:px-5">
        {/* Metadata card com action bar inline (Download/Imprimir/Compartilhar) */}
        <DocumentMetadata
          documento={documento}
          actionBarSlot={
            <DocumentActionBar documento={documento} pdfDisplayUrl={pdfDisplayUrl} />
          }
        />

        {/* Botoes admin + Tabs */}
        <DocumentApproval
          isAdmin={isAdmin}
          status={documento.status}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onEdit={() => setShowEditModal(true)}
          onNewVersion={() => setShowVersionModal(true)}
          onShowVersions={() => setShowVersoes(true)}
          onArchive={() => setShowDeleteConfirm(true)}
          onWorkflowAction={handleWorkflowAction}
        />

        {/* Tab content: Documento */}
        {activeTab === 'documento' && (
          <>
            {/* PDFViewer com signed URL on-demand */}
            <div className="mb-4">
              {pdfDisplayUrl ? (
                <PDFViewer src={pdfDisplayUrl} title={documento.titulo} height="500px" />
              ) : (
                <div className="bg-card rounded-2xl p-8 shadow-sm border border-border text-center">
                  <div className="w-16 h-16 rounded-2xl bg-warning/10 dark:bg-warning/20 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-warning dark:text-warning" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    PDF nao disponivel
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
                    O arquivo PDF deste documento ainda nao foi carregado no sistema.
                  </p>
                  {isAdmin && (
                    <Button
                      onClick={() =>
                        toast({
                          title: 'Em desenvolvimento',
                          description: 'Em breve você poderá fazer upload de PDFs.',
                        })
                      }
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Fazer Upload
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Botao de versoes */}
            <div className="mb-4">
              <Button variant="outline" className="w-full" onClick={() => setShowVersoes(true)}>
                <History className="w-4 h-4 mr-2" />
                Historico de Versoes ({versoes.length})
              </Button>
            </div>

            {/* Descricao */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Descricao
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{documento.descricao}</p>
            </div>

            {/* Tags */}
            {documento.tags && documento.tags.length > 0 && (
              <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {documento.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab content: Distribuicao (admin only) */}
        {activeTab === 'distribuicao' && (
          <DistributionPanel documentoId={documento.id} isAdmin={isAdmin} />
        )}

        {/* Tab content: Audit Trail (visível para todos, ações restritas a admin) */}
        {activeTab === 'historico' && (
          <DocumentAuditTrail documentoId={documento.id} isAdmin={isAdmin} />
        )}
      </div>

      {/* Modal de Versoes (não-lazy: pequeno e usado por todos) */}
      <DocumentVersions
        open={showVersoes}
        onClose={() => setShowVersoes(false)}
        versoes={versoes}
      />

      {/* Modais lazy — chunks fetched apenas quando abertos */}
      {showEditModal && documento && (
        <Suspense fallback={
          <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/30"
            role="status"
            aria-label="Carregando modal"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <EditDocumentModal
            documento={documento}
            isAdmin={isAdmin}
            firebaseUser={firebaseUser}
            currentUser={currentUser}
            onClose={() => setShowEditModal(false)}
            onSave={(updatedData) => {
              handleEditSave(updatedData);
              setShowEditModal(false);
            }}
          />
        </Suspense>
      )}

      {showVersionModal && documento && (
        <Suspense fallback={
          <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/30"
            role="status"
            aria-label="Carregando modal"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <NewVersionModal
            documento={documento}
            currentUser={firebaseUser}
            onClose={() => setShowVersionModal(false)}
            onSave={async (versionData) => {
              if (versionData?.__error) {
                toast({
                  title: 'Erro ao criar versão',
                  description: versionData.__error,
                  variant: 'error',
                });
                return;
              }
              await handleNewVersionSave(versionData);
              setShowVersionModal(false);
            }}
          />
        </Suspense>
      )}

      {showDeleteConfirm && documento && (
        <Suspense fallback={
          <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/30"
            role="status"
            aria-label="Carregando modal"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <ArchiveDocumentModal
            documento={documento}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={(archiveSubsection) => {
              handleArchiveConfirm(archiveSubsection);
              setShowDeleteConfirm(false);
            }}
          />
        </Suspense>
      )}

      {showReviewModal && documento && (
        <Suspense fallback={
          <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/30"
            role="status"
            aria-label="Carregando modal"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <SendToReviewModal
            open={showReviewModal}
            document={documento}
            onClose={() => setShowReviewModal(false)}
            onConfirm={async ({ comment }) => {
              await handleChangeStatus(DOCUMENT_STATUS.REVISAO_PENDENTE, { comment });
              setShowReviewModal(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
