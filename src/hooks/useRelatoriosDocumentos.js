/**
 * useRelatoriosDocumentos Hook
 * Gerencia documentos de Relatorios de Seguranca com Firebase
 */
import { useState, useCallback, useEffect } from 'react';
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
import { getRelatorioConfig } from '../data/relatoriosConfig';

/**
 * Hook para gerenciar documentos de Relatorios
 * @param {string} tipo - Tipo de relatorio (trimestral, incidentes, indicadores)
 * @returns {Object} Funcoes e estados do hook
 */
export function useRelatoriosDocumentos(tipo = null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [relatorios, setRelatorios] = useState([]);
  const [counts, setCounts] = useState({ trimestral: 0, incidentes: 0, indicadores: 0, total: 0 });

  /**
   * Carrega relatorios por tipo
   * @param {string} tipoParam - Tipo do relatorio (opcional, usa o tipo do hook se nao fornecido)
   */
  const loadRelatorios = useCallback(async (tipoParam) => {
    const tipoToLoad = tipoParam || tipo;
    if (!tipoToLoad) {
      setError('Tipo de relatorio nao especificado');
      return [];
    }

    const config = getRelatorioConfig(tipoToLoad);
    if (!config) {
      setError('Tipo de relatorio invalido');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, config.collection),
        limit(50)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setRelatorios([]);
        setLoading(false);
        return [];
      }

      const docs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.ativo !== false)
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return new Date(dateB) - new Date(dateA);
        });

      setRelatorios(docs);
      setLoading(false);
      return docs;
    } catch (err) {
      console.error('Erro ao carregar relatorios:', err);

      if (err.code === 'permission-denied') {
        setError('Sem permissao para acessar relatorios. Faca login novamente.');
      } else if (err.code === 'unavailable') {
        setError('Servico indisponivel. Verifique sua conexao.');
      } else if (err.code === 'not-found' || err.message?.includes('NOT_FOUND')) {
        setRelatorios([]);
        setLoading(false);
        return [];
      } else {
        console.warn('Aviso ao carregar relatorios:', err.message);
        setRelatorios([]);
      }

      setLoading(false);
      return [];
    }
  }, [tipo]);

  /**
   * Carrega todos os relatorios de todos os tipos
   * @returns {Promise<Array>} Lista de todos os relatorios
   */
  const loadAllRelatorios = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Carregar de todas as colecoes
      const tipos = ['trimestral', 'incidentes', 'indicadores'];
      const allDocs = [];

      for (const t of tipos) {
        const config = getRelatorioConfig(t);
        if (config) {
          try {
            const q = query(collection(db, config.collection), limit(50));
            const snapshot = await getDocs(q);

            snapshot.docs.forEach(d => {
              const data = d.data();
              if (data.ativo !== false) {
                allDocs.push({ id: d.id, tipo: t, ...data });
              }
            });
          } catch (e) {
            console.warn(`Erro ao carregar relatorios ${t}:`, e);
          }
        }
      }

      // Ordenar por data de criacao (mais recente primeiro)
      allDocs.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return new Date(dateB) - new Date(dateA);
      });

      setRelatorios(allDocs);
      setLoading(false);
      return allDocs;
    } catch (err) {
      console.error('Erro ao carregar todos os relatorios:', err);
      setError('Erro ao carregar relatorios');
      setLoading(false);
      return [];
    }
  }, []);

  /**
   * Carrega contagem de relatorios por tipo
   */
  const loadCounts = useCallback(async () => {
    try {
      // Contar cada colecao
      const countData = { trimestral: 0, incidentes: 0, indicadores: 0, total: 0 };

      const tipos = ['trimestral', 'incidentes', 'indicadores'];
      for (const t of tipos) {
        const config = getRelatorioConfig(t);
        if (config) {
          try {
            const snapshot = await getDocs(collection(db, config.collection));
            countData[t] = snapshot.size;
          } catch (e) {
            countData[t] = 0;
          }
        }
      }

      countData.total = countData.trimestral + countData.incidentes + countData.indicadores;
      setCounts(countData);
      return countData;
    } catch (err) {
      console.error('Erro ao carregar contagens:', err);
      return { trimestral: 0, incidentes: 0, indicadores: 0, total: 0 };
    }
  }, []);

  /**
   * Faz upload de um novo relatorio
   * @param {string} tipoParam - Tipo do relatorio
   * @param {File} file - Arquivo PDF para upload
   * @param {Object} metadata - Metadados do relatorio
   * @param {Object} user - Usuario atual
   */
  const uploadRelatorio = useCallback(async (tipoParam, file, metadata, user) => {
    const tipoToUse = tipoParam || tipo;
    const config = getRelatorioConfig(tipoToUse);
    if (!config) {
      throw new Error('Tipo de relatorio invalido');
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
      // Upload para Firebase
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${config.storagePath}/${timestamp}_${safeFileName}`;

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const docData = {
        tipo: tipoToUse,
        titulo: metadata.titulo || file.name.replace('.pdf', ''),
        periodo: metadata.periodo || '',
        dataInicio: metadata.dataInicio || '',
        dataFim: metadata.dataFim || '',
        arquivoURL: downloadURL,
        arquivoNome: file.name,
        arquivoTamanho: file.size,
        storagePath: storagePath,
        responsavel: metadata.responsavel || '',
        observacoes: metadata.observacoes || '',
        status: 'publicado',
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'unknown',
        createdByName: user?.displayName || user?.firstName || 'Usuario',
        dataPublicacao: new Date().toISOString().split('T')[0],
        ativo: true,
      };

      const docRef = await addDoc(collection(db, config.collection), docData);

      const newDoc = {
        id: docRef.id,
        ...docData,
        createdAt: new Date(),
      };

      // Recarregar lista
      await loadRelatorios(tipoToUse);
      return newDoc;
    } catch (err) {
      console.error('Erro ao fazer upload:', err);

      if (err.code === 'permission-denied') {
        setError('Sem permissao para enviar relatorios');
      } else {
        setError('Erro ao fazer upload do relatorio');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tipo, loadRelatorios]);

  /**
   * Exclui um relatorio
   * @param {string} tipoParam - Tipo do relatorio
   * @param {string} docId - ID do documento no Firestore
   * @param {string} storagePath - Caminho do arquivo no Storage
   */
  const deleteRelatorio = useCallback(async (tipoParam, docId, storagePath) => {
    const tipoToUse = tipoParam || tipo;
    const config = getRelatorioConfig(tipoToUse);
    if (!config) {
      throw new Error('Tipo de relatorio invalido');
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
        }
      }

      // Recarregar lista
      await loadRelatorios(tipoToUse);
      return true;
    } catch (err) {
      console.error('Erro ao excluir relatorio:', err);

      if (err.code === 'permission-denied') {
        setError('Sem permissao para excluir relatorios');
      } else {
        setError('Erro ao excluir relatorio');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tipo, loadRelatorios]);

  /**
   * Limpa o estado
   */
  const clearRelatorios = useCallback(() => {
    setRelatorios([]);
    setError(null);
  }, []);

  /**
   * Limpa o erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Carregar relatorios automaticamente se tipo for especificado
  useEffect(() => {
    if (tipo) {
      loadRelatorios(tipo);
    }
  }, [tipo, loadRelatorios]);

  return {
    loading,
    error,
    relatorios,
    counts,
    loadRelatorios,
    loadAllRelatorios,
    loadCounts,
    uploadRelatorio,
    deleteRelatorio,
    clearRelatorios,
    clearError,
  };
}

export default useRelatoriosDocumentos;
