-- Migration 019: Comunicados system
-- Provides backend for ComunicadosMonitorTab

-- ──────────────────────────────────────────────
-- 1. Main comunicados table
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comunicados (
  id                  TEXT PRIMARY KEY DEFAULT 'com-' || substr(gen_random_uuid()::text, 1, 8),
  tipo                TEXT NOT NULL DEFAULT 'Geral'
    CHECK (tipo IN ('Urgente','Importante','Informativo','Evento','Geral')),
  titulo              TEXT NOT NULL,
  conteudo            TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aprovado','publicado')),
  leitura_obrigatoria BOOLEAN NOT NULL DEFAULT false,
  destinatarios       TEXT[] DEFAULT '{}',
  rop_area            TEXT NOT NULL DEFAULT 'geral',
  acoes_requeridas    JSONB DEFAULT '[]',
  link                TEXT,
  data_evento         TIMESTAMPTZ,
  anexos              JSONB DEFAULT '[]',
  prazo_confirmacao   TIMESTAMPTZ,
  data_validade       TIMESTAMPTZ,
  aprovado_por        JSONB,
  autor_id            TEXT NOT NULL,
  autor_nome          TEXT NOT NULL,
  arquivado           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comunicados_status ON comunicados(status);
CREATE INDEX idx_comunicados_tipo ON comunicados(tipo);
CREATE INDEX idx_comunicados_rop_area ON comunicados(rop_area);
CREATE INDEX idx_comunicados_created_at ON comunicados(created_at DESC);

CREATE TRIGGER tr_comunicados_updated_at BEFORE UPDATE ON comunicados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────
-- 2. Reading confirmations
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comunicado_confirmacoes (
  id              SERIAL PRIMARY KEY,
  comunicado_id   TEXT NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  user_name       TEXT NOT NULL,
  confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comunicado_id, user_id)
);

CREATE INDEX idx_com_conf_comunicado ON comunicado_confirmacoes(comunicado_id);
CREATE INDEX idx_com_conf_user ON comunicado_confirmacoes(user_id);

-- ──────────────────────────────────────────────
-- 3. Action completions
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comunicado_acoes_completadas (
  id              SERIAL PRIMARY KEY,
  comunicado_id   TEXT NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
  acao_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  user_name       TEXT NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comunicado_id, acao_id, user_id)
);

CREATE INDEX idx_com_acoes_comunicado ON comunicado_acoes_completadas(comunicado_id);

-- ──────────────────────────────────────────────
-- 4. RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicado_confirmacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicado_acoes_completadas ENABLE ROW LEVEL SECURITY;

-- Comunicados: anyone authenticated can read, admin can write
CREATE POLICY comunicados_select ON comunicados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY comunicados_insert ON comunicados
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY comunicados_update ON comunicados
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY comunicados_delete ON comunicados
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = auth.uid()::text)
  );

-- Confirmacoes: anyone can read, authenticated can insert own
CREATE POLICY com_conf_select ON comunicado_confirmacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY com_conf_insert ON comunicado_confirmacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- Acoes completadas: anyone can read, authenticated can insert own
CREATE POLICY com_acoes_select ON comunicado_acoes_completadas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY com_acoes_insert ON comunicado_acoes_completadas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);
