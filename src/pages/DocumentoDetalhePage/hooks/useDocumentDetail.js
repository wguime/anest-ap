/**
 * useDocumentDetail
 * -----------------------------------------------------------------------------
 * Encapsula data-fetching e estado derivado para a página de detalhe.
 *  - Busca documento via DocumentsContext (SSOT que cobre TODAS as categorias).
 *  - Adapta campos por categoria (etica, comites, biblioteca, relatorios, ...).
 *  - Gera signed URL on-demand para o PDF (renova 10min antes de expirar).
 *  - Resolve permissões/usuário corrente para os hooks de mutação.
 *
 * Mantém os mesmos efeitos colaterais e fluxos do componente monolítico anterior;
 * só extrai a lógica de fora do JSX.
 */
import { useEffect, useMemo, useState } from 'react';
import { useDocumentsContext } from '@/contexts/DocumentsContext';
import { useUser } from '@/contexts/UserContext';
import supabaseDocumentService from '@/services/supabaseDocumentService';
import { ETICA_CONFIGS } from '@/data/eticaConfig';
import { getComiteConfig } from '@/data/comitesConfig';

export function useDocumentDetail(documentoId) {
  const {
    findDocumentById,
    updateDocument,
    archiveDocument,
    addVersion,
    isLoading: contextLoading,
    isInitialized,
  } = useDocumentsContext();
  const { firebaseUser, user: currentUser } = useUser();

  // Documento adaptado por categoria — reativo ao contexto
  const documento = useMemo(() => {
    if (!documentoId || !isInitialized) return null;
    const found = findDocumentById(documentoId);
    if (!found) return null;

    // Etica
    if (found.category === 'etica' && !found.setorNome) {
      const eticaConfig = ETICA_CONFIGS?.[found.categoria] || {};
      return {
        ...found,
        setorNome: eticaConfig.titulo || found.setor || 'Comite de Etica',
        setorId: found.categoria || 'etica',
        tipo: found.tipo || 'etica',
        createdByName: found.createdByName || found.responsavel || 'Comite de Etica',
      };
    }
    // Comites
    if (found.category === 'comites' && !found.setorNome) {
      const comiteConfig = getComiteConfig(found.tipo);
      return {
        ...found,
        setorNome: comiteConfig?.label || found.setorNome || 'Comites',
        setorId: found.tipo || 'comites',
      };
    }
    // Biblioteca
    if (found.category === 'biblioteca' && !found.setorNome) {
      return {
        ...found,
        setorNome: found.categoria || 'Biblioteca',
        setorId: found.categoria || 'biblioteca',
      };
    }
    // Relatorios / Auditorias
    if ((found.category === 'relatorios' || found.category === 'auditorias') && !found.setorNome) {
      return {
        ...found,
        setorNome: found.responsavel || found.setorNome || 'Qualidade',
        setorId: found.setorId || 'qualidade',
      };
    }
    return found;
  }, [documentoId, isInitialized, findDocumentById]);

  const loading = contextLoading || !isInitialized;

  // Signed URL on-demand (Wave 0b): gera quando renderiza, renova 10min antes
  // de expirar (signed URL Supabase expira em 1h).
  const [pdfDisplayUrl, setPdfDisplayUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;

    async function fetchSignedUrl() {
      if (!documento?.storagePath) {
        // Documento legado pode ainda ter arquivoURL como string pública/expirada.
        if (documento?.arquivoURL && documento.arquivoURL !== '#') {
          setPdfDisplayUrl(documento.arquivoURL);
        } else {
          setPdfDisplayUrl(null);
        }
        return;
      }
      // Fallback p/ arquivoURL quando o storagePath não resolve (ex.: sessão
      // carregada antes de uma re-migração tem storagePath obsoleto). Evita o
      // estado "PDF não disponível" enquanto a lista em memória não atualiza.
      const fallback = () => {
        if (cancelled) return;
        setPdfDisplayUrl(documento?.arquivoURL && documento.arquivoURL !== '#' ? documento.arquivoURL : null);
      };
      try {
        const url = await supabaseDocumentService.getSignedUrl(documento.storagePath, 3600);
        if (cancelled) return;
        if (url) {
          setPdfDisplayUrl(url);
          refreshTimer = setTimeout(fetchSignedUrl, 50 * 60 * 1000);
        } else {
          fallback();
        }
      } catch (err) {
        console.warn('[DocumentoDetalhe] Falha ao gerar signed URL, tentando arquivoURL:', err.message);
        fallback();
      }
    }

    fetchSignedUrl();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [documento?.storagePath, documento?.arquivoURL]);

  // Versoes (do proprio documento ou fallback gerado)
  const versoes = useMemo(() => {
    if (documento?.versoes) return documento.versoes;
    return [
      {
        versao: documento?.versaoAtual || 1,
        arquivoURL: documento?.arquivoURL || '#',
        arquivoNome: `${documento?.codigo || 'DOC'}.pdf`,
        descricaoAlteracao: 'Versao inicial do documento',
        motivoAlteracao: 'Criacao do documento',
        status: 'ativo',
        createdAt: documento?.createdAt || new Date().toISOString(),
        createdBy: documento?.createdBy || 'sistema@anest.com.br',
        createdByName: documento?.createdByName || 'Sistema',
        aprovadoPor: 'Coordenador',
        dataAprovacao: documento?.createdAt || new Date().toISOString(),
      },
    ];
  }, [documento]);

  return {
    documento,
    loading,
    versoes,
    pdfDisplayUrl,
    firebaseUser,
    currentUser,
    // mutations exposed (used by useDocumentMutations + index)
    contextUpdateDocument: updateDocument,
    contextArchiveDocument: archiveDocument,
    contextAddVersion: addVersion,
  };
}

export default useDocumentDetail;
