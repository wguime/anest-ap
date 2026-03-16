/**
 * useDocumentActions - Hook for CRUD operations with toast feedback
 *
 * Provides:
 * - Add, update, delete, archive, restore operations
 * - Status workflow: changeStatus, approveDocument, rejectDocument
 * - Version management: addVersion
 * - Automatic toast notifications on success/error
 * - Loading state for each operation
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/design-system'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { getCategoryLabel, DOCUMENT_STATUS, STATUS_LABELS } from '@/types/documents'

export function useDocumentActions(category) {
  const context = useDocumentsContext()
  const { toast } = useToast()

  const {
    addDocument: contextAddDocument,
    updateDocument: contextUpdateDocument,
    deleteDocument: contextDeleteDocument,
    archiveDocument: contextArchiveDocument,
    restoreDocument: contextRestoreDocument,
    changeStatus: contextChangeStatus,
    addVersion: contextAddVersion,
  } = context

  // Loading states for each operation
  const [isAdding, setIsAdding] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [isAddingVersion, setIsAddingVersion] = useState(false)

  // Combined loading state
  const isLoading = isAdding || isUpdating || isDeleting || isArchiving || isRestoring || isChangingStatus || isAddingVersion

  // Category label for toast messages
  const categoryLabel = getCategoryLabel(category)

  // Add document
  const addDocument = useCallback(
    async (documentData) => {
      setIsAdding(true)

      try {
        const newDoc = await contextAddDocument(category, documentData)

        toast({
          title: 'Documento adicionado',
          description: `"${documentData.titulo || 'Novo documento'}" foi adicionado a ${categoryLabel}.`,
          variant: 'success',
        })

        return { success: true, document: newDoc }
      } catch (error) {
        console.error('Error adding document:', error)

        toast({
          title: 'Erro ao adicionar',
          description: error.message || 'Nao foi possivel adicionar o documento.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsAdding(false)
      }
    },
    [category, categoryLabel, contextAddDocument, toast]
  )

  // Update document
  const updateDocument = useCallback(
    async (documentId, updates, userInfo = {}) => {
      setIsUpdating(true)

      try {
        await contextUpdateDocument(category, documentId, updates, userInfo)

        toast({
          title: 'Documento atualizado',
          description: 'As alteracoes foram salvas com sucesso.',
          variant: 'success',
        })

        return { success: true }
      } catch (error) {
        console.error('Error updating document:', error)

        toast({
          title: 'Erro ao atualizar',
          description: error.message || 'Nao foi possivel atualizar o documento.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsUpdating(false)
      }
    },
    [category, contextUpdateDocument, toast]
  )

  // Delete document
  const deleteDocument = useCallback(
    async (documentId, documentTitle) => {
      setIsDeleting(true)

      try {
        await contextDeleteDocument(category, documentId)

        toast({
          title: 'Documento excluido',
          description: `"${documentTitle || 'Documento'}" foi excluido permanentemente.`,
          variant: 'default',
        })

        return { success: true }
      } catch (error) {
        console.error('Error deleting document:', error)

        toast({
          title: 'Erro ao excluir',
          description: error.message || 'Nao foi possivel excluir o documento.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsDeleting(false)
      }
    },
    [category, contextDeleteDocument, toast]
  )

  // Archive document
  const archiveDocument = useCallback(
    async (documentId, documentTitle, userInfo = {}) => {
      setIsArchiving(true)

      try {
        await contextArchiveDocument(category, documentId, userInfo)

        toast({
          title: 'Documento arquivado',
          description: `"${documentTitle || 'Documento'}" foi movido para arquivados.`,
          variant: 'default',
        })

        return { success: true }
      } catch (error) {
        console.error('Error archiving document:', error)

        toast({
          title: 'Erro ao arquivar',
          description: error.message || 'Nao foi possivel arquivar o documento.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsArchiving(false)
      }
    },
    [category, contextArchiveDocument, toast]
  )

  // Restore document
  const restoreDocument = useCallback(
    async (documentId, documentTitle, userInfo = {}) => {
      setIsRestoring(true)

      try {
        await contextRestoreDocument(category, documentId, userInfo)

        toast({
          title: 'Documento restaurado',
          description: `"${documentTitle || 'Documento'}" foi restaurado com sucesso.`,
          variant: 'success',
        })

        return { success: true }
      } catch (error) {
        console.error('Error restoring document:', error)

        toast({
          title: 'Erro ao restaurar',
          description: error.message || 'Nao foi possivel restaurar o documento.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsRestoring(false)
      }
    },
    [category, contextRestoreDocument, toast]
  )

  // Change document status with workflow validation
  const changeStatus = useCallback(
    async (documentId, newStatus, userInfo = {}) => {
      setIsChangingStatus(true)

      try {
        const result = await contextChangeStatus(category, documentId, newStatus, userInfo)

        if (!result.success) {
          toast({
            title: 'Transicao nao permitida',
            description: result.message,
            variant: 'error',
          })
          return result
        }

        const statusLabel = STATUS_LABELS[newStatus] || newStatus
        toast({
          title: 'Status atualizado',
          description: `Documento alterado para "${statusLabel}".`,
          variant: 'success',
        })

        return result
      } catch (error) {
        console.error('Error changing status:', error)

        toast({
          title: 'Erro ao alterar status',
          description: error.message || 'Nao foi possivel alterar o status do documento.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsChangingStatus(false)
      }
    },
    [category, contextChangeStatus, toast]
  )

  // Approve document (pendente -> ativo)
  const approveDocument = useCallback(
    async (documentId, userInfo = {}) => {
      return changeStatus(documentId, DOCUMENT_STATUS.ATIVO, {
        ...userInfo,
        comment: userInfo.comment || 'Documento aprovado',
      })
    },
    [changeStatus]
  )

  // Reject document (pendente -> rejeitado)
  const rejectDocument = useCallback(
    async (documentId, userInfo = {}) => {
      return changeStatus(documentId, DOCUMENT_STATUS.REJEITADO, {
        ...userInfo,
        comment: userInfo.comment || 'Documento rejeitado',
      })
    },
    [changeStatus]
  )

  // Submit document for approval (rascunho -> pendente)
  const submitForApproval = useCallback(
    async (documentId, userInfo = {}) => {
      return changeStatus(documentId, DOCUMENT_STATUS.PENDENTE, {
        ...userInfo,
        comment: userInfo.comment || 'Enviado para aprovacao',
      })
    },
    [changeStatus]
  )

  // Add new version to a document
  const addVersion = useCallback(
    async (documentId, versionData, userInfo = {}) => {
      setIsAddingVersion(true)

      try {
        const version = await contextAddVersion(category, documentId, versionData, userInfo)

        if (!version) {
          toast({
            title: 'Erro ao adicionar versao',
            description: 'Documento nao encontrado.',
            variant: 'error',
          })
          return { success: false, error: 'Documento nao encontrado' }
        }

        toast({
          title: 'Nova versao adicionada',
          description: `Versao ${version.versao} do documento foi criada com sucesso.`,
          variant: 'success',
        })

        return { success: true, version }
      } catch (error) {
        console.error('Error adding version:', error)

        toast({
          title: 'Erro ao adicionar versao',
          description: error.message || 'Nao foi possivel adicionar a nova versao.',
          variant: 'error',
        })

        return { success: false, error: error.message }
      } finally {
        setIsAddingVersion(false)
      }
    },
    [category, contextAddVersion, toast]
  )

  return {
    // CRUD Actions
    addDocument,
    updateDocument,
    deleteDocument,
    archiveDocument,
    restoreDocument,

    // Workflow Actions
    changeStatus,
    approveDocument,
    rejectDocument,
    submitForApproval,

    // Version Management
    addVersion,

    // Loading states
    isLoading,
    isAdding,
    isUpdating,
    isDeleting,
    isArchiving,
    isRestoring,
    isChangingStatus,
    isAddingVersion,
  }
}

export default useDocumentActions
