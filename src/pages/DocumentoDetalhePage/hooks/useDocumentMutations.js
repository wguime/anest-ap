/**
 * useDocumentMutations
 * -----------------------------------------------------------------------------
 * Empacota os callbacks de mutação para o documento corrente, encadeando
 * audit-info (userId/userName/userEmail) e fornecendo wrappers prontos para
 * passar a cada modal.
 *
 * Recebe handles de mutação do useDocumentDetail (que por sua vez vêm do
 * DocumentsContext) — não chamamos services diretamente daqui.
 */
import { useCallback } from 'react';
import { useToast } from '@/design-system';

export function useDocumentMutations({
  documento,
  firebaseUser,
  currentUser,
  contextUpdateDocument,
  contextAddVersion,
  contextArchiveDocument,
  onArchived,
}) {
  const { toast } = useToast();

  // Edit — onSave do EditDocumentModal
  const handleEditSave = useCallback(
    (updatedData) => {
      if (!documento) return;
      contextUpdateDocument(documento.category, documento.id, updatedData);
    },
    [documento, contextUpdateDocument]
  );

  // Nova Versão — onSave do NewVersionModal
  const handleNewVersionSave = useCallback(
    async (versionData) => {
      if (!documento) return;
      try {
        await contextAddVersion(documento.category, documento.id, versionData, {
          userId: firebaseUser?.uid,
          userName: currentUser?.displayName || firebaseUser?.email || 'Usuário',
          userEmail: firebaseUser?.email || null,
        });
        toast({ title: 'Nova versão criada', variant: 'success' });
      } catch (err) {
        toast({ title: 'Erro ao criar versão', description: err.message, variant: 'error' });
      }
    },
    [documento, contextAddVersion, firebaseUser, currentUser, toast]
  );

  // Arquivar — onConfirm do ArchiveDocumentModal
  const handleArchiveConfirm = useCallback(
    (archiveSubsection) => {
      if (!documento) return;
      contextArchiveDocument(
        documento.category,
        documento.id,
        {
          userId: firebaseUser?.uid,
          userName: currentUser?.nome || firebaseUser?.displayName,
          userEmail: firebaseUser?.email,
        },
        archiveSubsection
      );
      onArchived?.();
    },
    [documento, contextArchiveDocument, firebaseUser, currentUser, onArchived]
  );

  return {
    handleEditSave,
    handleNewVersionSave,
    handleArchiveConfirm,
  };
}

export default useDocumentMutations;
