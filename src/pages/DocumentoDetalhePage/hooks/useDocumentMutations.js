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
  contextChangeStatus,
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

  // Bloco 5 — transições de status (workflow) a partir da página de detalhe.
  // Cobre: rascunho→pendente (enviar p/ aprovação), ativo→revisao_pendente
  // (enviar p/ revisão, com motivo opcional), revisao_pendente→pendente
  // (concluir revisão), rejeitado→rascunho (revisar/reenviar). Nenhuma leva a
  // 'ativo' (aprovação continua na fila ApprovalQueue, com guard de auto-aprovação).
  const handleChangeStatus = useCallback(
    async (newStatus, { comment } = {}) => {
      if (!documento) return false;
      const userInfo = {
        userId: firebaseUser?.uid,
        userName: currentUser?.nome || currentUser?.displayName || firebaseUser?.displayName || firebaseUser?.email,
        userEmail: firebaseUser?.email,
        ...(comment ? { comment } : {}),
      };
      try {
        const result = await contextChangeStatus(documento.category, documento.id, newStatus, userInfo);
        // service.changeStatus devolve {success:false, message} em transição inválida
        if (result && result.success === false) {
          toast({ title: 'Transição inválida', description: result.message, variant: 'error' });
          return false;
        }
        toast({ title: 'Status atualizado', variant: 'success' });
        return true;
      } catch (err) {
        toast({ title: 'Erro ao alterar status', description: err.message, variant: 'error' });
        return false;
      }
    },
    [documento, contextChangeStatus, firebaseUser, currentUser, toast]
  );

  return {
    handleEditSave,
    handleNewVersionSave,
    handleArchiveConfirm,
    handleChangeStatus,
  };
}

export default useDocumentMutations;
