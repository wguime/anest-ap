-- ============================================================================
-- Fix latente: rpc_aplicar_retencao_incidentes insere colunas inexistentes
--
-- Achado 2026-07-30 (durante o fechamento das pendências de anexos): o INSERT
-- de auditoria da função usa (user_id, action, resource_type, details,
-- created_at), mas public.permission_audit_log tem (target_user_id,
-- changed_by, action, old_value, new_value, ip_address, created_at).
-- O INSERT está dentro de IF (count > 0) e NUNCA executou (nada expira antes
-- de 2046 — retenção 20a, módulo nasceu 2026): o cron "sucede" todo dia por
-- não ter trabalho. No dia em que o primeiro registro expirar, a função
-- lançaria 42703 e TODA a rodada de anonimização reverteria (inclusive o
-- scrub de Storage da 20260730230000) — e falharia diariamente dali em diante.
--
-- Corpo copiado da versão viva (pg_get_functiondef); única mudança é o
-- INSERT corrigido para as colunas reais. Ator identificado como
-- 'pg_cron:lgpd-retencao' (job automatizado — não há usuário humano;
-- 'system' genérico é proibido pela rule de audit trail, ator nomeado não).
-- ============================================================================

BEGIN;

-- O CHECK de action era lista fechada de eventos de permissão; sem incluir
-- 'lgpd_retencao_aplicada' o INSERT novo falharia com 23514 no primeiro
-- vencimento (mesmo modo de falha do achado — validação 2026-07-30).
ALTER TABLE public.permission_audit_log
  DROP CONSTRAINT IF EXISTS permission_audit_log_action_check;
ALTER TABLE public.permission_audit_log
  ADD CONSTRAINT permission_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'role_change'::text, 'admin_toggle'::text, 'coordenador_toggle'::text,
    'permission_update'::text, 'user_delete'::text, 'user_create'::text,
    'lgpd_retencao_aplicada'::text, 'lgpd_anexos_cleanup'::text
  ]));

CREATE OR REPLACE FUNCTION public.rpc_aplicar_retencao_incidentes()
RETURNS TABLE(processed_count integer, incidentes_anon integer, denuncias_anon integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_inc_count integer := 0;
  v_den_count integer := 0;
  rec record;
begin
  -- Iterar registros vencidos
  for rec in
    select id, tipo
    from public.incidentes
    where retain_until < current_date
      and anonymized_at is null
    limit 1000  -- proteção contra long-running em primeira execução pós-backfill
  loop
    perform public.rpc_anonimizar_incidente(rec.id);

    if rec.tipo = 'denuncia' then
      v_den_count := v_den_count + 1;
    else
      v_inc_count := v_inc_count + 1;
    end if;
  end loop;

  -- Audit log da execução do job (colunas REAIS de permission_audit_log)
  if (v_inc_count + v_den_count) > 0 then
    insert into public.permission_audit_log (
      target_user_id, changed_by, action, new_value, created_at
    ) values (
      'incidentes',             -- alvo é o módulo (não há usuário-alvo)
      'pg_cron:lgpd-retencao',  -- ator automatizado identificado
      'lgpd_retencao_aplicada',
      jsonb_build_object(
        'incidentes_anonimizados', v_inc_count,
        'denuncias_anonimizadas',  v_den_count,
        'data_execucao', current_date,
        'base_legal', 'LGPD Art. 15 + CFM 1.821/2007 + Decreto 10.153/2019'
      ),
      now()
    );
  end if;

  processed_count := v_inc_count + v_den_count;
  incidentes_anon := v_inc_count;
  denuncias_anon  := v_den_count;
  return next;
end;
$function$;

COMMIT;
