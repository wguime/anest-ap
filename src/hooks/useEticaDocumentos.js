/**
 * useEticaDocumentos Hook
 * Gerencia documentos de Ética e Bioética via Supabase (categoria='etica').
 *
 * API preservada da versão Firebase: loadDocumento, uploadDocumento,
 * deleteDocumento, clearDocumento, clearError. O `tipo` (dilemas, parecerUti,
 * diretrizes, emissaoParecer, codigoEtica) é gravado como `subcategoria`.
 */
import { useState, useCallback } from 'react';
import supabaseDocumentService from '@/services/supabaseDocumentService';
import { getEticaConfig } from '@/data/eticaConfig';
import { useUser } from '@/contexts/UserContext';

const CATEGORIA = 'etica';

function pickLatestAtivo(docs) {
  return docs
    .filter((d) => d.status !== 'arquivado')
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    })[0] || null;
}

async function ensureViewableUrl(doc) {
  if (!doc) return doc;
  if (doc.arquivoURL) return doc;
  if (!doc.storagePath) return doc;
  try {
    const signed = await supabaseDocumentService.getSignedUrl(doc.storagePath, 3600);
    return { ...doc, arquivoURL: signed };
  } catch {
    return doc;
  }
}

function buildUserInfo(user) {
  if (!user?.uid) return null;
  return {
    userId: user.uid,
    userName: user.displayName || user.firstName || user.email || 'Usuario',
    userEmail: user.email,
  };
}

export function useEticaDocumentos() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documento, setDocumento] = useState(null);

  const loadDocumento = useCallback(async (tipo) => {
    if (!getEticaConfig(tipo)) {
      setError('Tipo de documento invalido');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const docs = await supabaseDocumentService.fetchByCategory(CATEGORIA);
      const filtered = docs.filter((d) => d.subcategoria === tipo);
      const latest = pickLatestAtivo(filtered);
      const withUrl = await ensureViewableUrl(latest);
      setDocumento(withUrl);
      return withUrl;
    } catch (err) {
      console.error('Erro ao carregar documento:', err);
      setError('Erro ao carregar documento');
      setDocumento(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocumento = useCallback(async (tipo, file, metadata, callerUser) => {
    if (!getEticaConfig(tipo)) {
      throw new Error('Tipo de documento invalido');
    }
    if (!file) throw new Error('Arquivo nao selecionado');
    if (!file.type.includes('pdf')) {
      throw new Error('Apenas arquivos PDF sao permitidos');
    }
    const userInfo = buildUserInfo(callerUser || user);
    if (!userInfo) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    setLoading(true);
    setError(null);

    try {
      const docId = `doc-etica-${tipo}-${Date.now()}`;
      const uploaded = await supabaseDocumentService.uploadFile(file, CATEGORIA, docId, 1);

      const created = await supabaseDocumentService.createDocument(
        CATEGORIA,
        {
          id: docId,
          codigo: docId.toUpperCase(),
          titulo: metadata?.titulo || file.name.replace(/\.pdf$/i, ''),
          descricao: metadata?.observacoes || '',
          tipo: 'Documento',
          subcategoria: tipo,
          status: 'ativo',
          arquivoUrl: null,
          arquivoNome: file.name,
          arquivoTamanho: uploaded.size,
          storagePath: uploaded.path,
          observacoes: metadata?.observacoes || null,
        },
        userInfo
      );

      const withUrl = await ensureViewableUrl(created);
      setDocumento(withUrl);
      return withUrl;
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError(err.message || 'Erro ao fazer upload do documento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteDocumento = useCallback(async (tipo, docId, storagePath) => {
    if (!getEticaConfig(tipo)) {
      throw new Error('Tipo de documento invalido');
    }
    const userInfo = buildUserInfo(user);
    if (!userInfo) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    setLoading(true);
    setError(null);

    try {
      await supabaseDocumentService.deleteDocument(docId, userInfo);
      if (storagePath) {
        try {
          await supabaseDocumentService.deleteFile(storagePath);
        } catch (storageErr) {
          console.warn('Erro ao excluir arquivo do Storage:', storageErr);
        }
      }
      setDocumento(null);
      return true;
    } catch (err) {
      console.error('Erro ao excluir documento:', err);
      setError(err.message || 'Erro ao excluir documento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearDocumento = useCallback(() => {
    setDocumento(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    documento,
    loadDocumento,
    uploadDocumento,
    deleteDocumento,
    clearDocumento,
    clearError,
  };
}

export default useEticaDocumentos;
