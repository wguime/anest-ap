-- LGPD Solicitacoes table
-- Stores LGPD data deletion/portability requests separately from incidentes,
-- avoiding CHECK constraint violations (incidentes.tipo IN ('incidente','denuncia')).

CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  tipo text NOT NULL DEFAULT 'exclusao',
  status text NOT NULL DEFAULT 'pendente',
  dados_solicitante jsonb,
  motivo text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

ALTER TABLE lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests" ON lgpd_solicitacoes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own requests" ON lgpd_solicitacoes
  FOR SELECT USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
