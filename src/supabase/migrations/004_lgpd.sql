-- ============================================================================
-- Migration 004: LGPD Compliance
-- View publica do changelog (sem email) + funcao de anonimizacao
-- ============================================================================

-- View publica do changelog sem user_email (para usuarios nao-admin)
CREATE OR REPLACE VIEW public.vw_changelog_publico
WITH (security_invoker = true) AS
SELECT id, documento_id, action, user_id, user_name, changes, comment, created_at
FROM public.documento_changelog;

-- Funcao para anonimizar dados pessoais com mais de 5 anos
-- Conforme Politica de Privacidade LGPD (secao 10 - Retencao de dados)
CREATE OR REPLACE FUNCTION rpc_anonimizar_dados_antigos()
RETURNS integer AS $$
DECLARE rows_affected integer;
BEGIN
  UPDATE public.documento_changelog
  SET user_name = 'Usuario Anonimizado',
      user_email = NULL,
      user_id = 'anonimizado'
  WHERE created_at < NOW() - INTERVAL '5 years'
    AND user_id != 'anonimizado';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
