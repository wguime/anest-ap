-- ============================================================================
-- Tabela uptodate_topics — Atualizações de Anestesiologia do UpToDate
--
-- Populada semanalmente via GitHub Actions + Playwright (.github/workflows/
-- uptodate-weekly.yml). O scraper faz login com credenciais armazenadas em
-- GitHub Secrets, parseia "What's New in Anesthesiology" e POSTa o payload
-- para a Edge Function `ingest-uptodate` (autenticada por HMAC-SHA256).
--
-- Deduplicação por dedup_hash UNIQUE: sha256(normalizeUrl + '|' + tituloNorm).
--
-- RLS: leitura para qualquer authenticated; escrita exclusiva via service_role
--      (Edge Function bypassa RLS).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.uptodate_topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conteúdo
  titulo          text NOT NULL,
  resumo_html     text,                                 -- HTML já sanitizado pelo scraper
  resumo_texto    text,                                 -- versão textual para busca
  topic_id        text,                                 -- slug derivado da URL canônica UTD

  -- Origem
  fonte           text NOT NULL DEFAULT 'UpToDate',
  fonte_url       text NOT NULL,                        -- URL canônica UTD (referência)
  categoria       text,                                 -- 'anesthesiology' | 'critical-care' | ...
  secao           text,                                 -- ex: "What's New in Anesthesiology"

  -- Deduplicação
  titulo_norm     text NOT NULL,                        -- title normalizado para trigram
  dedup_hash      text NOT NULL,                        -- sha256

  -- Datas
  publicado_em    timestamptz NOT NULL,                 -- "Last updated" do UTD
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Featured (top 10 do hero carrossel)
  is_featured     boolean NOT NULL DEFAULT false
);

-- ──────────── Indexes ────────────
CREATE UNIQUE INDEX IF NOT EXISTS uptodate_topics_dedup_uidx
  ON public.uptodate_topics (dedup_hash);

CREATE INDEX IF NOT EXISTS uptodate_topics_publicado_idx
  ON public.uptodate_topics (publicado_em DESC);

CREATE INDEX IF NOT EXISTS uptodate_topics_categoria_idx
  ON public.uptodate_topics (categoria);

CREATE INDEX IF NOT EXISTS uptodate_topics_featured_idx
  ON public.uptodate_topics (is_featured)
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS uptodate_topics_titulo_trgm_idx
  ON public.uptodate_topics USING gin (titulo_norm gin_trgm_ops);

-- ──────────── Trigger: updated_at ────────────
CREATE OR REPLACE FUNCTION public.set_uptodate_topics_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uptodate_topics_updated_at ON public.uptodate_topics;
CREATE TRIGGER trg_uptodate_topics_updated_at
BEFORE UPDATE ON public.uptodate_topics
FOR EACH ROW
EXECUTE FUNCTION public.set_uptodate_topics_updated_at();

-- ──────────── Função para refresh featured (chamada pela Edge Function) ────────────
CREATE OR REPLACE FUNCTION public.uptodate_refresh_featured()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.uptodate_topics SET is_featured = false WHERE is_featured = true;
  UPDATE public.uptodate_topics
  SET is_featured = true
  WHERE id IN (
    SELECT id FROM public.uptodate_topics
    ORDER BY publicado_em DESC
    LIMIT 10
  );
END;
$$;

REVOKE ALL ON FUNCTION public.uptodate_refresh_featured() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uptodate_refresh_featured() TO service_role;

-- ──────────── RLS ────────────
ALTER TABLE public.uptodate_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uptodate_read_authenticated" ON public.uptodate_topics;
CREATE POLICY "uptodate_read_authenticated"
  ON public.uptodate_topics
  FOR SELECT
  TO authenticated
  USING (true);

-- Sem policies de INSERT/UPDATE/DELETE: somente service_role (Edge Function).

COMMENT ON TABLE public.uptodate_topics IS
  'Atualizações UpToDate (anestesiologia). Coletada semanalmente via GitHub Actions + Playwright -> Edge Function ingest-uptodate. Cron: segunda 07:10 UTC.';
