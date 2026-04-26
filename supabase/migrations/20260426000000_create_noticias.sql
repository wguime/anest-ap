-- ============================================================================
-- Tabela noticias — Central de Notícias de Anestesiologia
--
-- Agrega notícias de NEJM, Anesthesiology (ASA), BJA, Anesthesia & Analgesia,
-- ASA Monitor, SBA (Sociedade Brasileira de Anestesiologia) e BJAN
-- (Brazilian Journal of Anesthesiology) via Edge Function `fetch-noticias`
-- (RSS) executada diariamente pelo pg_cron.
--
-- Deduplicação em 3 camadas (aplicada na Edge Function):
--   1. DOI exato (UNIQUE partial, quando presente).
--   2. dedup_hash UNIQUE  → sha256(normalizeUrl(link) + '|' + normalizeTitle).
--   3. Trigram fuzzy (titulo_norm + janela ±7 dias) como fallback.
--
-- RLS: leitura para qualquer authenticated; escrita apenas service_role
--      (Edge Function), que bypassa RLS por padrão.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.noticias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conteúdo
  titulo          text NOT NULL,
  resumo          text,
  autores         text,
  idioma          text DEFAULT 'en',                 -- 'en' | 'pt-BR'

  -- Origem
  fonte           text NOT NULL,                     -- 'NEJM' | 'Anesthesiology' | 'BJA' | 'A&A' | 'ASA Monitor' | 'SBA' | 'BJAN'
  fonte_url       text NOT NULL,                     -- URL canônica (normalizada)
  raw_url         text,                              -- URL original (debug)
  categoria       text,                              -- 'pesquisa' | 'sociedade' | 'clinica' | 'noticia'

  -- Deduplicação
  doi             text,
  external_id     text,                              -- guid do RSS
  dedup_hash      text NOT NULL,                     -- sha256
  titulo_norm     text NOT NULL,                     -- title normalizado para trigram

  -- Datas
  publicado_em    timestamptz NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Mesma notícia republicada em outras fontes
  fontes_extras   jsonb NOT NULL DEFAULT '[]'::jsonb -- [{"fonte":"...","url":"..."}]
);

-- ──────────── Indexes ────────────
CREATE UNIQUE INDEX IF NOT EXISTS noticias_dedup_hash_uidx
  ON public.noticias (dedup_hash);

CREATE UNIQUE INDEX IF NOT EXISTS noticias_doi_uidx
  ON public.noticias (doi)
  WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS noticias_publicado_idx
  ON public.noticias (publicado_em DESC);

CREATE INDEX IF NOT EXISTS noticias_fonte_idx
  ON public.noticias (fonte);

CREATE INDEX IF NOT EXISTS noticias_categoria_idx
  ON public.noticias (categoria);

CREATE INDEX IF NOT EXISTS noticias_titulo_trgm_idx
  ON public.noticias USING gin (titulo_norm gin_trgm_ops);

-- ──────────── Trigger: updated_at ────────────
CREATE OR REPLACE FUNCTION public.set_noticias_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_noticias_updated_at ON public.noticias;
CREATE TRIGGER trg_noticias_updated_at
BEFORE UPDATE ON public.noticias
FOR EACH ROW
EXECUTE FUNCTION public.set_noticias_updated_at();

-- ──────────── RLS ────────────
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "noticias_read_authenticated" ON public.noticias;
CREATE POLICY "noticias_read_authenticated"
  ON public.noticias
  FOR SELECT
  TO authenticated
  USING (true);

-- Sem policies de INSERT/UPDATE/DELETE: somente service_role (Edge Function)
-- bypassa RLS e pode escrever. Usuários autenticados não podem mutar.
