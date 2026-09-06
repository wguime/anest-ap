-- ==========================================================================
-- 20260906140000_anexo_publico_parte2.sql
-- Fecha o envio público: só a edge `relato-publico` grava relato pelo QR code.
--
-- Parte 2 da entrega de 06/09/2026 (parte 1: 20260906120000). Aplicada SÓ agora
-- porque o front novo e a edge já estão em produção — antes disso, revogar
-- derrubaria o formulário publicado, que chamava a função direto.
--
-- Por que: `rpc_submit_public_incident` era executável pela chave anon, que está
-- no HTML por desenho. Sem IP e sem janela, dava para encher a caixa dos
-- responsáveis com relatos em massa. As três verify-*-public já tinham limite
-- por IP desde maio; esta não tinha nenhum. Agora todo envio passa pela edge, e
-- é lá que o limite é contado (10 preparar / 5 enviar por IP a cada 10 min).
--
-- ⚠️ `REVOKE FROM anon` sozinho NÃO fecha nada: os default privileges do schema
-- `public` concedem EXECUTE a PUBLIC, e `anon` é membro de PUBLIC. Tem de tirar
-- de PUBLIC também — foi o que o migration-validator apontou.
--
-- `authenticated` também sai: o app usa `rpc_submit_incidente`, nunca esta.
--
-- Rollback (se o canal público quebrar): reconceder e voltar o front.
--   GRANT EXECUTE ON FUNCTION public.rpc_submit_public_incident(
--     text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text, jsonb
--   ) TO anon;
-- ==========================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text, jsonb
) IS
  'Submit público do QR code. Desde 06/09/2026 só a edge `relato-publico` executa '
  '(service_role): é ela que conta o limite por IP e monta o caminho dos anexos. '
  'Chamada direta pela chave anon deixou de ser possível.';

COMMIT;
