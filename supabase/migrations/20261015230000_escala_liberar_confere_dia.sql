-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — LIBERAR CONFERE O DIA INTEIRO (dono 2026-10-15).
--
-- Relatório das 24 cirurgias com "Horário pendente" na faixa das 19h de 15/10, causa 1:
-- a trava de 14/10 contava só as cirurgias do MESMO hospital e do MESMO turno da fila.
-- O Oscar foi liberado no HRO às 12h25 com 2 cirurgias abertas na Unimed; Marílio,
-- Leonardo, Raul e Guilherme Xavier foram liberados à tarde com a cirurgia da manhã sem
-- horário. Agora conta a pessoa em qualquer hospital publicado da data, no turno da chave
-- e nos anteriores (liberar de manhã não olha a tarde, que ainda não aconteceu).
--
-- Só muda o SELECT de `v_pend` em `rpc_escala_patch_liberacao`; o resto do corpo é o de
-- 20261014200000, idêntico. A tela faz a mesma conta (`pendenciasDoDiaParaLiberar`,
-- src/lib/escalaHorarioPendente.js) e, como antes, o banco enxerga só o caso com
-- `anestesista_user_id` — recusa um SUBCONJUNTO do que a tela recusa.
--
-- Rollback: scripts/rollback-20261015230000-liberar-confere-dia.sql (o corpo de 14/10).
-- ════════════════════════════════════════════════════════════════════════════

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

  -- SEM HORÁRIO NÃO SE LIBERA (dono 14/10; o dia inteiro desde 15/10) — só a liberação de verdade (`liberadoEm`);
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
        -- O DIA INTEIRO, NOS TRÊS HOSPITAIS (dono 15/10): as cirurgias da pessoa em qualquer
        -- hospital publicado da data, no turno da chave e nos anteriores (de manhã, só a
        -- manhã — a da tarde ainda não aconteceu). Vale igual para a fila única ('fds'),
        -- cujos casos sempre moraram nas linhas dos hospitais.
        if v_uid is null then
          v_pend := 0;
        else
          select count(*) into v_pend
            from public.escala_cirurgica_caso c
            join public.escala_cirurgica e on e.id = c.escala_id
           where e.data = v_data and e.hospital <> 'fds' and e.status = 'publicada'
             and (c.turno = v_turno or (v_turno = 'vespertino' and c.turno = 'matutino'))
             and c.anestesista_user_id = v_uid
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

-- Conferência visível para quem aplica (a Management API não devolve notices):
select position('O DIA INTEIRO, NOS TRÊS HOSPITAIS' in pg_get_functiondef('public.rpc_escala_patch_liberacao'::regproc)) > 0 as trava_confere_dia;
