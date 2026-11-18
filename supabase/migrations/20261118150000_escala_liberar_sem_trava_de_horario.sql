-- LIBERAR NÃO TRAVA POR HORÁRIO (dono 18/11/2026)
--
-- "Só não quero mais que a mensagem [Antes de liberar] apareça, para não travar as liberações.
-- Nada muda com relação aos débitos de quem deixou em aberto; se outra pessoa assume o
-- procedimento, o débito é transferido."
--
-- Revoga a trava de 14/10 (20261014200000) e 15/10 (20261015230000): a liberação de verdade
-- (`liberadoEm`) não consulta mais as cirurgias da pessoa. O débito não depende disto: a conta
-- (`escala_horario_conta`) segue lendo o caso pelo `anestesista_user_id` — quem assume a
-- cirurgia leva o débito junto, como já era.
--
-- Dados de 29/10–17/11 que sustentam: 599 de 650 liberações feitas por outra pessoa; em 279
-- cirurgias quem liberava fechou o caso do colega nos 4 min antes, 112 com o término = hora do toque.
--
-- `escala_caso_trava_liberacao` fica (sem uso) para o rollback
-- (`scripts/rollback-20261118150000-liberar-sem-trava.sql`).

create or replace function public.rpc_escala_patch_liberacao(p_escala_id uuid, p_campo text, p_chave text, p_valor jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_caller text := public.firebase_uid();
  v_remove boolean := (p_valor is null or jsonb_typeof(p_valor) = 'null');
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  if p_campo not in ('liberacoes', 'linha_overrides', 'urgencias_meta') then
    raise exception 'campo_invalido: %', p_campo;
  end if;
  if p_chave is null or btrim(p_chave) = '' then
    raise exception 'chave_invalida';
  end if;
  -- urgencias_meta é chaveado por TURNO de publicação, nunca por linha.
  if p_campo = 'urgencias_meta' and p_chave not in ('matutino', 'vespertino') then
    raise exception 'turno_invalido: %', p_chave;
  end if;

  -- Audit server-side também dentro do valor: 'por'/'em' são carimbados aqui,
  -- nunca aceitos do cliente (mesma regra do created_by/published_by).
  if not v_remove and jsonb_typeof(p_valor) = 'object' then
    p_valor := jsonb_set(jsonb_set(p_valor, '{por}', to_jsonb(v_caller)), '{em}', to_jsonb(now()));
  end if;

  if p_campo = 'liberacoes' then
    update public.escala_cirurgica set
      liberacoes = case when v_remove then liberacoes - p_chave
                        else jsonb_set(liberacoes, array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  elsif p_campo = 'linha_overrides' then
    update public.escala_cirurgica set
      linha_overrides = case when v_remove then linha_overrides - p_chave
                             else jsonb_set(linha_overrides, array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  else
    update public.escala_cirurgica set
      urgencias_meta = case when v_remove then coalesce(urgencias_meta, '{}'::jsonb) - p_chave
                            else jsonb_set(coalesce(urgencias_meta, '{}'::jsonb), array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  end if;

  if not found then
    raise exception 'escala_nao_encontrada';
  end if;
end;
$function$;

revoke all on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) from public, anon;
grant execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) to authenticated, service_role;

-- conferência: true = trava removida
select position('horario_pendente' in pg_get_functiondef('public.rpc_escala_patch_liberacao'::regproc)) = 0 as trava_removida;
