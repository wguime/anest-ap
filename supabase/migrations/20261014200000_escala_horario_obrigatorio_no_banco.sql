-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — AS REGRAS DE 14/10 TAMBÉM NO BANCO (dono 2026-10-14: "quero que
-- todos os caminhos tenham as novas atualizações").
--
-- A v5.12.55 pôs duas regras na TELA: (1) "Terminada" exige o início; (2) quem tem
-- cirurgia aberta ou sem início/término no turno não é liberado. Fora da tela elas
-- não valiam: aparelho ainda no bundle anterior (até 15 min, ou até reabrir), chamada
-- direta das RPCs, SQL de reparo, script. Aqui as duas passam a valer no servidor.
--
-- (1) TERMINADA EXIGE O INÍCIO — no trigger `tr_escala_caso_horario_real` (BEFORE
--     UPDATE), depois de ele preencher o que sabe preencher: a passagem iniciada →
--     terminada recebe o início do carimbo do "Iniciada" (regra de 02/10), então só
--     recusa quem nunca começou (agendada → terminada direto) ou quem apaga o início
--     de uma terminada. Linha antiga já terminada sem início NÃO é tocada: a recusa só
--     dispara quando o STATUS vira terminada ou o INÍCIO é apagado, não em qualquer
--     UPDATE (editar o anestesista de um caso de setembro continua funcionando).
--     INSERT não passa por aqui (a republicação preserva o andamento como está).
--
-- (2) LIBERAR COM CIRURGIA PENDENTE — em `rpc_escala_patch_liberacao`, só quando grava
--     uma liberação de verdade (`liberadoEm`; o marcador `{escalado:true}` e o desfazer
--     passam). Mesmos cortes de `pendenciasParaLiberar` (src/lib/escalaHorarioPendente.js),
--     pelo LADO SEGURO: o banco só enxerga o caso com `anestesista_user_id` da pessoa
--     (dupla "A + B" tem uid nulo por desenho e fica com a tela), no turno da chave,
--     a partir de 14/10. Chave de slot ASSUMIDO lê o uid de quem assumiu
--     (`linha_overrides[chave].assumidaPor.uid`). Fila única ('fds'): os casos moram
--     nas linhas dos hospitais do mesmo dia. Com isso o servidor recusa um SUBCONJUNTO
--     do que a tela recusa — nunca bloqueia o que a tela deixaria passar.
--
-- Rollback: scripts/rollback-20261014200000-horario-obrigatorio.sql (os dois corpos
-- anteriores, sem recriar mais nada, + drop da função auxiliar).
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.escala_caso_horario_real()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_ref timestamptz;
  v_quem text := coalesce(nullif(public.firebase_uid(), ''), new.status_atualizado_por);
begin
  -- 1. o status mudou: o horário acompanha (só preenche vazio; reabrir limpa)
  if new.status_cirurgia is distinct from old.status_cirurgia then
    v_ref := case when new.status_atualizado_em is distinct from old.status_atualizado_em
                  then coalesce(new.status_atualizado_em, now()) else now() end;
    if new.status_cirurgia = 'agendada' then
      new.inicio_real := null;
      new.termino_real := null;
    elsif new.status_cirurgia = 'iniciada' then
      new.termino_real := null;
      if new.inicio_real is null then
        new.inicio_real := to_char(v_ref at time zone 'America/Sao_Paulo', 'HH24:MI');
      end if;
    elsif new.status_cirurgia = 'terminada' then
      if new.inicio_real is null and old.status_cirurgia = 'iniciada' and old.status_atualizado_em is not null then
        new.inicio_real := to_char(old.status_atualizado_em at time zone 'America/Sao_Paulo', 'HH24:MI');
      end if;
      if new.termino_real is null then
        new.termino_real := to_char(v_ref at time zone 'America/Sao_Paulo', 'HH24:MI');
      end if;
    end if;
  end if;
  -- 2. TERMINADA EXIGE O INÍCIO (dono 14/10) — só na transição para terminada ou ao
  --    apagar o início de uma terminada; linha antiga intocada segue como está
  if new.status_cirurgia = 'terminada' and new.inicio_real is null
     and (new.status_cirurgia is distinct from old.status_cirurgia or old.inicio_real is not null) then
    raise exception 'inicio_obrigatorio: informe o início da cirurgia antes de marcar Terminada'
      using errcode = '23514';
  end if;
  -- 3. quem mexeu por último em cada horário (pelo toque ou à mão)
  if new.inicio_real is distinct from old.inicio_real then
    new.inicio_real_por := case when new.inicio_real is null then null else v_quem end;
  end if;
  if new.termino_real is distinct from old.termino_real then
    new.termino_real_por := case when new.termino_real is null then null else v_quem end;
  end if;
  return new;
end;
$$;

-- O caso TRAVA a liberação de quem o tem? Mesmos cortes de `pendenciasParaLiberar`
-- (src/lib/escalaHorarioPendente.js): com procedimento, com dono, não continuação,
-- não suspensa, não DUPLA (há 4 duplas legadas com uid — a dupla aberta segue com o
-- parceiro e a tela a deixa passar); aberta que não "passa para tarde", ou terminada
-- sem início/término.
create or replace function public.escala_caso_trava_liberacao(
  p_procedimento text, p_anestesista text, p_sem_anestesista boolean, p_is_continuacao boolean,
  p_status text, p_extra text, p_inicio text, p_termino text
)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select btrim(coalesce(p_procedimento, '')) <> ''
     and coalesce(p_anestesista, '') not like '%+%'
     and not coalesce(p_sem_anestesista, false)
     and not coalesce(p_is_continuacao, false)
     and coalesce(p_status, 'agendada') <> 'suspensa'
     and coalesce(p_extra, '') <> 'suspensa'
     and (
       (coalesce(p_status, 'agendada') <> 'terminada' and coalesce(p_extra, '') <> 'passa_tarde')
       or (p_status = 'terminada' and (p_inicio is null or p_termino is null))
     )
$$;

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

-- Conferência visível para quem aplica (a Management API não devolve notices):
select position('inicio_obrigatorio' in pg_get_functiondef('public.escala_caso_horario_real'::regproc)) > 0 as trigger_exige_inicio,
       position('horario_pendente' in pg_get_functiondef('public.rpc_escala_patch_liberacao'::regproc)) > 0 as rpc_trava_liberacao;
