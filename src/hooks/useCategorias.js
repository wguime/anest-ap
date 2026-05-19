/**
 * useCategorias — hook para listar categorias de cursos (Supabase-backed).
 *
 * Wave 1.7 T1.7.10. Substitui o `mockCategorias` hard-coded em educacaoUtils.js.
 *
 * Source-of-truth: tabela `public.educacao_categorias` (RLS authenticated SELECT all).
 *
 * Cache: sessionStorage TTL 5min (categorias mudam raramente, mas precisamos refletir
 * edições do admin sem F5). Para invalidar manualmente: `clearCategoriasCache()`.
 *
 * Uso:
 *   const { categorias, loading, error, refetch } = useCategorias();
 *   const { categorias } = useCategorias({ apenasAtivas: false }); // inclui inativas (admin)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';

const CACHE_KEY = 'categorias_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export function clearCategoriasCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // sessionStorage indisponível (SSR / private mode) — silencioso
  }
}

function readCache(apenasAtivas) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !Array.isArray(parsed.data)) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    if (parsed.apenasAtivas !== apenasAtivas) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data, apenasAtivas) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now(), apenasAtivas })
    );
  } catch {
    // silencioso
  }
}

export function useCategorias({ apenasAtivas = true } = {}) {
  const [data, setData] = useState(() => readCache(apenasAtivas) || []);
  const [loading, setLoading] = useState(() => readCache(apenasAtivas) === null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('educacao_categorias')
        .select('*')
        .order('ordem', { ascending: true });
      if (apenasAtivas) query = query.eq('ativa', true);
      const { data: rows, error: e } = await query;
      if (e) throw e;
      const normalized = (rows || []).map((row) => ({
        id: row.slug, // compat com mockCategorias (id era o slug)
        uuid: row.id,
        slug: row.slug,
        nome: row.nome,
        icone: row.icone || null,
        corToken: row.cor_token || null,
        ordem: row.ordem ?? 0,
        ativa: row.ativa ?? true,
      }));
      setData(normalized);
      writeCache(normalized, apenasAtivas);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[useCategorias] erro:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [apenasAtivas]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // se já temos cache em data, ainda revalidamos em background
      await fetchData();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apenasAtivas]);

  return { categorias: data, loading, error, refetch: fetchData };
}

export default useCategorias;
