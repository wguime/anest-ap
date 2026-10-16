-- Rollback de 20261015230000_escala_liberar_confere_dia.sql: devolve o corpo de
-- `rpc_escala_patch_liberacao` de 20261014200000 (trava só no hospital e turno da fila).
begin;

create or replace function public.rpc_escala_patch_liberacao(
  p_escala_id uuid,
  p_campo     text,   -- 'liberacoes' | 'linha_overrides' | 'urgencias_meta'
  p_chave     text,   -- chave da linha; em urgencias_meta, o TURNO
  p_valor     jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
  v_remove boolean := (p_valor is null or jsonb_typeof(p_valor) = 'null');
  v_turno  text;
  v_alvo   text;
  v_uid    text;
  v_data   date;
  v_hosp   text;
  v_ov     jsonb;
  v_pend   integer;
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

  -- SEM HORÁRIO NÃO SE LIBERA (dono 14/10) — só a liberação de verdade (`liberadoEm`);
  -- o marcador {escalado:true} e o desfazer (null) passam sem consulta.
  if p_campo = 'liberacoes' and not v_remove and jsonb_typeof(p_valor) = 'object' and p_valor ? 'liberadoEm' then
    v_turno := split_part(p_chave, ':', 1);
    v_alvo  := substr(p_chave, length(v_turno) + 2);
    if v_turno in ('matutino', 'vespertino') and v_alvo <> '' then
      select e.data, e.hospital, e.linha_overrides into v_data, v_hosp, v_ov
        from public.escala_cirurgica e where e.id = p_escala_id;
      if v_data >= date '2026-10-14' then
        -- slot assumido: quem SAI é quem assumiu, não o dono original da chave; assumido
        -- por alguém SEM login → o servidor não sabe de quem são os casos e não trava
        -- (a tela confere pelo nome)
        if jsonb_typeof(v_ov -> p_chave -> 'assumidaPor') = 'object' then
          v_uid := nullif(v_ov -> p_chave -> 'assumidaPor' ->> 'uid', '');
        else
          v_uid := v_alvo;
        end if;
        -- dois SELECTs (fila única × hospital) em vez de CASE no WHERE: plano previsível
        -- e o índice do uid sempre usado (o Nano saturou em 16/09)
        if v_uid is null then
          v_pend := 0;
        elsif v_hosp = 'fds' then
          select count(*) into v_pend
            from public.escala_cirurgica_caso c
            join public.escala_cirurgica e on e.id = c.escala_id
           where e.data = v_data and e.hospital <> 'fds' and e.status = 'publicada'
             and c.turno = v_turno and c.anestesista_user_id = v_uid
             and public.escala_caso_trava_liberacao(c.procedimento, c.anestesista, c.sem_anestesista, c.is_continuacao,
                                                    c.status_cirurgia, c.status_extra, c.inicio_real, c.termino_real);
        else
          select count(*) into v_pend
            from public.escala_cirurgica_caso c
           where c.escala_id = p_escala_id
             and c.turno = v_turno and c.anestesista_user_id = v_uid
             and public.escala_caso_trava_liberacao(c.procedimento, c.anestesista, c.sem_anestesista, c.is_continuacao,
                                                    c.status_cirurgia, c.status_extra, c.inicio_real, c.termino_real);
        end if;
        if v_pend > 0 then
          raise exception 'horario_pendente: % cirurgia(s) sem horário — preencha início e término ou passe a um colega antes de liberar', v_pend
            using errcode = 'P0001';
        end if;
      end if;
    end if;
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
$$;

revoke execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) from public, anon;
grant execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) to authenticated, service_role;

commit;
