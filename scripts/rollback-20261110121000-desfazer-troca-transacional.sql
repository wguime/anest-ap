-- Rollback de 20261110121000_escala_desfazer_troca_transacional.sql
-- A função é nova: o rollback é só removê-la. ⚠️ Se o app já estiver chamando a RPC
-- (etapa 2: `desfazerSubstituicao` no context), volte o APP primeiro — sem a função o
-- "Desfazer troca" falha com 404 em vez de cair no caminho antigo.

begin;

drop function if exists public.rpc_escala_desfazer_troca(jsonb);

commit;

select to_regprocedure('public.rpc_escala_desfazer_troca(jsonb)') is null as rpc_removida;
