/**
 * useRelatoriosDocumentos Hook
 * Gerencia documentos de Relatórios via Supabase (categoria='relatorios').
 *
 * API preservada da versão Firebase: loadRelatorios, loadAllRelatorios,
 * loadCounts, uploadRelatorio, deleteRelatorio, clearRelatorios, clearError.
 * O `tipo` (trimestral, incidentes, indicadores) é gravado como `subcategoria`.
 */
import { useState, useCallback, useEffect } from 'react';
import supabaseDocumentService from '@/services/supabaseDocumentService';
import { getRelatorioConfig } from '@/data/relatoriosConfig';
import { useUser } from '@/contexts/UserContext';

const CATEGORIA = 'relatorios';
const TIPOS = ['trimestral', 'incidentes', 'indicadores'];

function sortByDateDesc(docs) {
  return [...docs].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });
}

function filterAtivos(docs) {
  return docs.filter((d) => d.status !== 'arquivado');
}

async function ensureViewableUrls(docs) {
  return Promise.all(docs.map(async (doc) => {
    if (doc.arquivoURL || !doc.storagePath) return doc;
    try {
      const signed = await supabaseDocumentService.getSignedUrl(doc.storagePath, 3600);
      return { ...doc, arquivoURL: signed };
    } catch {
      return doc;
    }
  }));
}

function buildUserInfo(user) {
  if (!user?.uid) return null;
  return {
    userId: user.uid,
    userName: user.displayName || user.firstName || user.email || 'Usuario',
    userEmail: user.email,
  };
}

export function useRelatoriosDocumentos(tipo = null) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [relatorios, setRelatorios] = useState([]);
  const [counts, setCounts] = useState({ trimestral: 0, incidentes: 0, indicadores: 0, total: 0 });

  const loadRelatorios = useCallback(async (tipoParam) => {
    const tipoToLoad = tipoParam || tipo;
    if (!tipoToLoad) {
      setError('Tipo de relatorio nao especificado');
      return [];
    }
    if (!getRelatorioConfig(tipoToLoad)) {
      setError('Tipo de relatorio invalido');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const all = await supabaseDocumentService.fetchByCategory(CATEGORIA);
      const filtered = sortByDateDesc(filterAtivos(all.filter((d) => d.subcategoria === tipoToLoad)));
      const withUrls = await ensureViewableUrls(filtered);
      setRelatorios(withUrls);
      return withUrls;
    } catch (err) {
      console.error('Erro ao carregar relatorios:', err);
      setError('Erro ao carregar relatorios');
      setRelatorios([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  const loadAllRelatorios = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const all = await supabaseDocumentService.fetchByCategory(CATEGORIA);
      const filtered = sortByDateDesc(filterAtivos(all)).map((d) => ({ ...d, tipo: d.subcategoria }));
      const withUrls = await ensureViewableUrls(filtered);
      setRelatorios(withUrls);
      return withUrls;
    } catch (err) {
      console.error('Erro ao carregar todos os relatorios:', err);
      setError('Erro ao carregar relatorios');
      setRelatorios([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const all = await supabaseDocumentService.fetchByCategory(CATEGORIA);
      const ativos = filterAtivos(all);
      const countData = { trimestral: 0, incidentes: 0, indicadores: 0, total: 0 };
      for (const doc of ativos) {
        if (TIPOS.includes(doc.subcategoria)) {
          countData[doc.subcategoria]++;
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

  const uploadRelatorio = useCallback(async (tipoParam, file, metadata, callerUser) => {
    const tipoToUse = tipoParam || tipo;
    if (!getRelatorioConfig(tipoToUse)) {
      throw new Error('Tipo de relatorio invalido');
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
      const docId = `doc-relatorios-${tipoToUse}-${Date.now()}`;
      const uploaded = await supabaseDocumentService.uploadFile(file, CATEGORIA, docId, 1);

      const created = await supabaseDocumentService.createDocument(
        CATEGORIA,
        {
          id: docId,
          codigo: docId.toUpperCase(),
          titulo: metadata?.titulo || file.name.replace(/\.pdf$/i, ''),
          descricao: metadata?.observacoes || '',
          tipo: 'Relatorio',
          subcategoria: tipoToUse,
          status: 'ativo',
          arquivoUrl: null,
          arquivoNome: file.name,
          arquivoTamanho: uploaded.size,
          storagePath: uploaded.path,
          observacoes: metadata?.observacoes || null,
          tags: [
            metadata?.periodo,
            metadata?.dataInicio,
            metadata?.dataFim,
            metadata?.responsavel,
          ].filter(Boolean),
        },
        userInfo
      );

      await loadRelatorios(tipoToUse);
      return created;
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError(err.message || 'Erro ao fazer upload do relatorio');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tipo, user, loadRelatorios]);

  // Bloco 2 — "nunca deletar, só arquivar". ARQUIVA (status='arquivado') em vez
  // de soft-delete que esconde. Sem 3º arg → preserva a subcategoria de domínio
  // ('trimestral'/'incidentes'/'indicadores'); filterAtivos já esconde arquivados.
  // O arquivo do Storage NÃO é apagado (recuperável). Nome mantido.
  const deleteRelatorio = useCallback(async (tipoParam, docId, _storagePath) => {
    const tipoToUse = tipoParam || tipo;
    if (!getRelatorioConfig(tipoToUse)) {
      throw new Error('Tipo de relatorio invalido');
    }
    const userInfo = buildUserInfo(user);
    if (!userInfo) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    setLoading(true);
    setError(null);

    try {
      await supabaseDocumentService.archiveDocument(docId, userInfo);
      await loadRelatorios(tipoToUse);
      return true;
    } catch (err) {
      console.error('Erro ao arquivar relatorio:', err);
      setError(err.message || 'Erro ao arquivar relatorio');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tipo, user, loadRelatorios]);

  const clearRelatorios = useCallback(() => {
    setRelatorios([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
