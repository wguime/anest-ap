/**
 * useEticaDocumentos Hook
 * Gerencia documentos de Etica e Bioetica com Firebase
 */
import { useState, useCallback } from 'react';
import {
  collection,
  query,
  limit,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { getEticaConfig } from '../data/eticaConfig';

/**
 * Hook para gerenciar documentos de Etica
 * @returns {Object} Funcoes e estados do hook
 */
export function useEticaDocumentos() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documento, setDocumento] = useState(null);

  /**
   * Carrega o documento mais recente de um tipo
   * @param {string} tipo - Tipo do documento (ex: 'dilemas', 'parecerUti')
   */
  const loadDocumento = useCallback(async (tipo) => {
    const config = getEticaConfig(tipo);
    if (!config) {
      setError('Tipo de documento invalido');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Query simples sem orderBy para evitar necessidade de indice
      // Busca os documentos e ordena/filtra no cliente
      const q = query(
        collection(db, config.collection),
        limit(50)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setDocumento(null);
        setLoading(false);
        return null;
      }

      // Mapear, filtrar ativos e ordenar por data no cliente
      const docs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.ativo !== false)
        .sort((a, b) => {
          // Ordenar por createdAt decrescente
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return new Date(dateB) - new Date(dateA);
        });

      if (docs.length > 0) {
        setDocumento(docs[0]);
        setLoading(false);
        return docs[0];
      }

      setDocumento(null);
      setLoading(false);
      return null;
    } catch (err) {
      console.error('Erro ao carregar documento:', err);

      // Verificar tipo de erro
      if (err.code === 'permission-denied') {
        setError('Sem permissao para acessar documentos. Faca login novamente.');
      } else if (err.code === 'unavailable') {
        setError('Servico indisponivel. Verifique sua conexao.');
      } else if (err.code === 'not-found' || err.message?.includes('NOT_FOUND')) {
        // Colecao nao existe ainda - normal para novas colecoes
        setDocumento(null);
        setLoading(false);
        return null;
      } else {
        // Para outros erros, apenas logar mas nao mostrar erro ao usuario
        // A colecao pode simplesmente estar vazia
        console.warn('Aviso ao carregar documentos:', err.message);
        setDocumento(null);
      }

      setLoading(false);
      return null;
    }
  }, []);

  /**
   * Faz upload de um novo documento
   * @param {string} tipo - Tipo do documento
   * @param {File} file - Arquivo PDF para upload
   * @param {Object} metadata - Metadados do documento
   * @param {Object} user - Usuario atual
   */
  const uploadDocumento = useCallback(async (tipo, file, metadata, user) => {
    const config = getEticaConfig(tipo);
    if (!config) {
      throw new Error('Tipo de documento invalido');
    }

    if (!file) {
      throw new Error('Arquivo nao selecionado');
    }

    if (!file.type.includes('pdf')) {
      throw new Error('Apenas arquivos PDF sao permitidos');
    }

    setLoading(true);
    setError(null);

    try {
      // Gerar nome unico para o arquivo
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${config.storagePath}/${timestamp}_${safeFileName}`;

      // Upload para o Storage
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Criar documento no Firestore
      const docData = {
        titulo: metadata.titulo || file.name.replace('.pdf', ''),
        tipo: tipo,
        observacoes: metadata.observacoes || '',
        arquivoURL: downloadURL,
        arquivoNome: file.name,
        arquivoTamanho: file.size,
        storagePath: storagePath,
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'unknown',
        createdByName: user?.displayName || user?.firstName || 'Usuario',
        ativo: true,
      };

      const docRef = await addDoc(collection(db, config.collection), docData);

      const newDoc = {
        id: docRef.id,
        ...docData,
        createdAt: new Date(), // Para uso imediato
      };

      setDocumento(newDoc);
      return newDoc;
    } catch (err) {
      console.error('Erro ao fazer upload:', err);

      if (err.code === 'permission-denied') {
        setError('Sem permissao para enviar documentos');
      } else {
        setError('Erro ao fazer upload do documento');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Exclui um documento
   * @param {string} tipo - Tipo do documento
   * @param {string} docId - ID do documento no Firestore
   * @param {string} storagePath - Caminho do arquivo no Storage
   */
  const deleteDocumento = useCallback(async (tipo, docId, storagePath) => {
    const config = getEticaConfig(tipo);
    if (!config) {
      throw new Error('Tipo de documento invalido');
    }

    setLoading(true);
    setError(null);

    try {
      // Excluir do Firestore
      await deleteDoc(doc(db, config.collection, docId));

      // Excluir do Storage (se existir path)
      if (storagePath) {
        try {
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn('Erro ao excluir arquivo do Storage:', storageErr);
          // Continuar mesmo se nao conseguir excluir do Storage
        }
      }

      setDocumento(null);
      return true;
    } catch (err) {
      console.error('Erro ao excluir documento:', err);

      if (err.code === 'permission-denied') {
        setError('Sem permissao para excluir documentos');
      } else {
        setError('Erro ao excluir documento');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Limpa o estado do documento
   */
  const clearDocumento = useCallback(() => {
    setDocumento(null);
    setError(null);
  }, []);

  /**
   * Limpa o erro
   */
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
