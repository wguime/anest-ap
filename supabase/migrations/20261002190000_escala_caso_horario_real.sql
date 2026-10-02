-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — HORÁRIO REAL de início e de término de cada cirurgia
-- (dono 2026-10-02, modelo A escolhido em protótipo `.tmp/inicio-termino-cirurgia.html`):
-- "quero que seja possível adicionar o horário de início e fim de cada procedimento".
--
-- Duas colunas "HH:MM" no caso, o mesmo formato de `hora` e `termino_previsto`:
--   · inicio_real  — quando a cirurgia COMEÇOU.
--   · termino_real — quando TERMINOU. Enquanto ela corre, o "término" da tela continua
--     sendo `termino_previsto` (a previsão que dirige a fila, a pílula e o quadro) —
--     nada disso muda. `termino_real` só existe depois de "Terminada".
-- Mais o AUTOR de cada um (`inicio_real_por`/`termino_real_por`, firebase uid), no
-- padrão de `termino_previsto_por` (24/09): quem marcou ou corrigiu por último.
--
-- O horário ANDA JUNTO com o status (decisão do dono, 02/10), por trigger — vale para
-- todo caminho que muda o status (RPC do toque, desfazer, faixa de urgências, scripts):
--   · → iniciada : início = hora da marcação, se ainda vazio; o término real some
--                  (cirurgia reaberta não terminou).
--   · → terminada: término = hora da marcação, se vazio; início vazio de quem estava
--                  iniciada = a hora em que foi marcada iniciada (o carimbo que o
--                  UPDATE está prestes a sobrescrever — sem isto ele se perde).
--   · → agendada : os dois somem (nada aconteceu ainda).
-- Valor informado à mão NUNCA é sobrescrito pelo toque (o trigger só preenche vazio):
-- é isso que conserta a marcação feita em lote (41% das marcações, revisão 25/09).
-- "A hora da marcação" é o carimbo NOVO do próprio UPDATE quando ele carimba (a RPC
-- grava now(); o "Desfazer" restaura o carimbo original, e o início volta a ser o de
-- antes); UPDATE que muda o status SEM carimbar (script, SQL de reparo) usa now() —
-- nunca o carimbo da transição anterior, que daria duração zero.
-- ⚠️ "→ iniciada" apaga um término real que só um script conseguiria ter gravado numa
-- cirurgia agendada (a tela só edita o término real depois de Terminada).
--
-- Republicar o turno PRESERVA os quatro junto com o andamento (23/09): mesma captura e
-- mesmo INSERT de `rpc_publicar_escala_turno`. A função abaixo é a definição VIVA
-- (pg_get_functiondef em 02/10, já com o patch revisao-swap-snapshot-v2 de 23/09) com
-- só as colunas novas acrescentadas ao bloco do andamento.
--
-- Rollback (nesta ordem — a RPC antes do DROP, senão toda publicação falha; e o APP
-- revertido antes do DROP, senão o updateCaso({inicioReal}) recebe PGRST204):
--   1. exportar os horários já gravados (o DROP COLUMN apaga de vez);
--   2. reaplicar o bloco da função de 20260923160000_escala_republicar_preserva_andamento.sql
--      e depois 20260923200000_escala_republicacao_swap.sql (dá o corpo vivo de antes);
--   3. drop trigger if exists tr_escala_caso_horario_real on public.escala_cirurgica_caso;
--      drop function if exists public.escala_caso_horario_real();
--   4. alter table public.escala_cirurgica_caso drop column if exists inicio_real,
--        drop column if exists termino_real, drop column if exists inicio_real_por,
--        drop column if exists termino_real_por;
-- ════════════════════════════════════════════════════════════════════════════

begin;
-- ADD COLUMN/CONSTRAINT pedem ACCESS EXCLUSIVE: sem teto, uma espera de lock enfileira
-- todas as leituras da escala atrás dela
set local lock_timeout = '3s';

alter table public.escala_cirurgica_caso add column if not exists inicio_real text;
alter table public.escala_cirurgica_caso add column if not exists termino_real text;
alter table public.escala_cirurgica_caso add column if not exists inicio_real_por text;
alter table public.escala_cirurgica_caso add column if not exists termino_real_por text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'escala_caso_inicio_real_hhmm'
                  and conrelid = 'public.escala_cirurgica_caso'::regclass) then
    alter table public.escala_cirurgica_caso add constraint escala_caso_inicio_real_hhmm
      check (inicio_real is null or inicio_real ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'escala_caso_termino_real_hhmm'
                  and conrelid = 'public.escala_cirurgica_caso'::regclass) then
    alter table public.escala_cirurgica_caso add constraint escala_caso_termino_real_hhmm
      check (termino_real is null or termino_real ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;

comment on column public.escala_cirurgica_caso.inicio_real is
  'HH:MM em que a cirurgia começou (dono 02/10/2026). Preenchido pelo toque em Iniciada (trigger tr_escala_caso_horario_real) e corrigível à mão; agendada limpa.';
comment on column public.escala_cirurgica_caso.termino_real is
  'HH:MM em que a cirurgia terminou (dono 02/10/2026). Preenchido pelo toque em Terminada e corrigível à mão; reabrir (iniciada/agendada) limpa. Enquanto corre, a previsão é termino_previsto.';
comment on column public.escala_cirurgica_caso.inicio_real_por is
  'Quem marcou/corrigiu inicio_real por último (firebase uid), gravado pelo trigger tr_escala_caso_horario_real.';
comment on column public.escala_cirurgica_caso.termino_real_por is
  'Quem marcou/corrigiu termino_real por último (firebase uid), gravado pelo trigger tr_escala_caso_horario_real.';

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
  -- 2. quem mexeu por último em cada horário (pelo toque ou à mão)
  if new.inicio_real is distinct from old.inicio_real then
    new.inicio_real_por := case when new.inicio_real is null then null else v_quem end;
  end if;
  if new.termino_real is distinct from old.termino_real then
    new.termino_real_por := case when new.termino_real is null then null else v_quem end;
  end if;
  return new;
end;
$$;

-- função de trigger não é chamável por ninguém (mesma higiene de 20260925220000)
revoke execute on function public.escala_caso_horario_real() from public, anon, authenticated;

drop trigger if exists tr_escala_caso_horario_real on public.escala_cirurgica_caso;
create trigger tr_escala_caso_horario_real
  before update on public.escala_cirurgica_caso
  for each row execute function public.escala_caso_horario_real();

-- ── Republicar preserva o horário real (bloco do andamento de 23/09) ──────────
create or replace function public.rpc_publicar_escala_turno(p_data date, p_hospital text, p_turno text, p_header jsonb, p_casos jsonb, p_linha_overrides jsonb DEFAULT NULL::jsonb, p_preservar jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_id uuid;
  v_caller text := public.firebase_uid();
  v_status text := coalesce(nullif(p_header->>'status',''), 'publicada');
  v_old jsonb;
  v_ordem jsonb;
  v_ajuda jsonb;
  v_lib jsonb;
  v_over jsonb;
  v_turnos jsonb;
  v_pub jsonb;
  v_result jsonb;
  v_chave text;
  -- decisões e preservação (05/09)
  v_prefixo text := p_turno || ':';
  v_lo jsonb := nullif(p_linha_overrides, 'null'::jsonb);
  v_pres jsonb := nullif(p_preservar, 'null'::jsonb);
  v_over_antigo jsonb;
  v_lib_antigo jsonb;
  v_campos jsonb;
  v_linha jsonb;
  v_cand text;
  v_ant jsonb;
  v_keep jsonb;
  v_campo text;
  v_valor jsonb;
  v_asm jsonb;
  v_apelido text;
  v_ids jsonb;
  -- andamento dos casos importados que a republicação substitui (23/09)
  v_andamento jsonb;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_turno not in ('matutino','vespertino') then
    raise exception 'turno_invalido' using errcode = '22023';
  end if;
  -- 'fds' = linha da fila única do fim de semana (2026-08-15); os demais são
  -- hospitais reais. Casos publicados numa linha 'fds' devem vir vazios (a
  -- fila deriva dos casos por hospital), mas a RPC não bloqueia — a conferência
  -- é quem publica e manda casos [].
  if p_hospital not in ('unimed','hro','materno','fds') then
    raise exception 'hospital_invalido' using errcode = '22023';
  end if;
  if v_status not in ('rascunho','publicada') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_header->'ordem_liberacao','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_header->'ajuda_externa','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_casos,'[]'::jsonb)) <> 'array' then
    raise exception 'payload_formato_invalido' using errcode = '22023';
  end if;
  -- fds_meta pertence à linha 'fds' (COMMENT da coluna) — payload de hospital
  -- real com o campo é bug de cliente e é rejeitado, não gravado em silêncio.
  if p_header ? 'fds_meta' then
    if p_hospital <> 'fds' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    if jsonb_typeof(p_header->'fds_meta') not in ('object','null') then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
  end if;
  -- decisões: objeto de objetos, sem estado de execução/toque (que só nasce na fila)
  if v_lo is not null then
    if jsonb_typeof(v_lo) <> 'object' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    for v_chave, v_valor in select key, value from jsonb_each(v_lo) loop
      if btrim(v_chave) = '' or jsonb_typeof(v_valor) <> 'object'
         or v_valor ? 'assumidaPor' or v_valor ? 'liberadoEm' or v_valor ? 'escalado' then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
    end loop;
  end if;
  if v_pres is not null then
    if jsonb_typeof(v_pres) <> 'object'
       or jsonb_typeof(coalesce(v_pres->'campos','[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_pres->'linhas','[]'::jsonb)) <> 'array' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    -- Cada campo é um NOME de campo do override. `por`/`em` ficam de fora porque são o
    -- carimbo do servidor: eles voltam junto com o que for preservado (mais abaixo), nunca
    -- por pedido do cliente. Chamada direta da RPC, fora do app, cai aqui.
    for v_campo in select jsonb_array_elements_text(coalesce(v_pres->'campos','[]'::jsonb)) loop
      if btrim(coalesce(v_campo,'')) = '' or v_campo in ('por','em') then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
    end loop;
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;

  -- O trigger de rastro (log_escala_troca) lê este GUC para rotular o que a
  -- PUBLICAÇÃO apagou/declarou; local à transação — some no commit/rollback.
  perform set_config('anest.publicacao', '1', true);

  -- Upsert e lock explícito: concorrência no mesmo dia/hospital fica serializada.
  insert into public.escala_cirurgica (data,hospital,status,created_by,created_at,updated_at)
  values (p_data,p_hospital,case when v_status='publicada' then 'publicada' else 'rascunho' end,v_caller,now(),now())
  on conflict (data,hospital) do nothing;
  select e.id, e.ordem_liberacao, e.ajuda_externa, e.liberacoes,
         e.linha_overrides, e.publicacao_turnos
    into v_id, v_ordem, v_ajuda, v_lib, v_over, v_turnos
    from public.escala_cirurgica e
   where e.data=p_data and e.hospital=p_hospital
   for update;

  -- Legado array/objeto é normalizado sem mover o estado do outro turno.
  v_ordem := case when jsonb_typeof(coalesce(v_ordem,'{}'))='array'
                  then jsonb_build_object('matutino',coalesce(v_ordem,'[]'))
                  else coalesce(v_ordem,'{}') end;
  v_ajuda := case when jsonb_typeof(coalesce(v_ajuda,'{}'))='array'
                  then jsonb_build_object('matutino',coalesce(v_ajuda,'[]'))
                  when jsonb_typeof(coalesce(v_ajuda,'{}'))='object' then coalesce(v_ajuda,'{}')
                  else '{}'::jsonb end;
  v_ordem := case when jsonb_typeof(v_ordem)='object' then v_ordem else '{}'::jsonb end;
  v_lib := case when jsonb_typeof(coalesce(v_lib,'{}'))='object' then coalesce(v_lib,'{}') else '{}'::jsonb end;
  v_over := case when jsonb_typeof(coalesce(v_over,'{}'))='object' then coalesce(v_over,'{}') else '{}'::jsonb end;
  v_turnos := case when jsonb_typeof(coalesce(v_turnos,'{}'))='object' then coalesce(v_turnos,'{}') else '{}'::jsonb end;
  -- `liberacoes` e `linha_overrides` permanecem mapas planos: os leitores e
  -- triggers existentes usam a chave estável da linha, não o turno.

  -- O que estava marcado ANTES desta publicação — é daqui que a preservação copia.
  v_over_antigo := v_over;
  v_lib_antigo := v_lib;

  -- O estado novo usa chaves namespaced (turno:chave). Assim, o reset do
  -- matutino nunca remove a mesma pessoa no vespertino. Chaves sem namespace
  -- são legado e permanecem até migração explícita, evitando perda silenciosa.
  for v_chave in select jsonb_object_keys(coalesce(v_lib, '{}'::jsonb)) loop
    if left(v_chave, length(p_turno) + 1) = p_turno || ':' then
      v_lib := v_lib - v_chave;
    end if;
  end loop;
  for v_chave in select jsonb_object_keys(coalesce(v_over, '{}'::jsonb)) loop
    if left(v_chave, length(p_turno) + 1) = p_turno || ':' then
      v_over := v_over - v_chave;
    end if;
  end loop;

  -- PRESERVAÇÃO (dono 05/09): de quem segue na escala, os campos pedidos do
  -- override antigo voltam — com o carimbo ORIGINAL (preservar não é ação nova).
  -- A entrada antiga é procurada pela chave atual e, na falta, pelas candidatas.
  if v_pres is not null then
    v_campos := coalesce(v_pres->'campos', '[]'::jsonb);
    for v_linha in select value from jsonb_array_elements(coalesce(v_pres->'linhas','[]'::jsonb)) loop
      v_chave := btrim(coalesce(v_linha->>'chave',''));
      if v_chave = '' or jsonb_typeof(v_linha) <> 'object' then continue; end if;
      v_ant := null;
      for v_cand in
        select v_chave
        union all
        select jsonb_array_elements_text(case when jsonb_typeof(v_linha->'candidatas') = 'array' then v_linha->'candidatas' else '[]'::jsonb end)
      loop
        if jsonb_typeof(v_over_antigo -> (v_prefixo || v_cand)) = 'object' then
          v_ant := v_over_antigo -> (v_prefixo || v_cand);
          exit;
        end if;
      end loop;
      if v_ant is not null then
        v_keep := '{}'::jsonb;
        for v_campo in select jsonb_array_elements_text(v_campos) loop
          if v_ant ? v_campo then
            v_keep := v_keep || jsonb_build_object(v_campo, v_ant -> v_campo);
          end if;
        end loop;
        if v_keep <> '{}'::jsonb then
          v_keep := v_keep || jsonb_build_object(
            'por', coalesce(v_ant -> 'por', to_jsonb(v_caller)),
            'em',  coalesce(v_ant -> 'em',  to_jsonb(now())));
          v_over := jsonb_set(v_over, array[v_prefixo || v_chave], v_keep, true);
        end if;
      end if;
      -- liberação (marca de Liberado / marcador do repasse): SÓ quando a linha pede.
      -- Hoje o cliente nunca pede (regra de 23/07 mantida pelo dono em 05/09).
      -- guarda de tipo em vez de cast cru: valor não-booleano tem de virar o mesmo
      -- `payload_formato_invalido` do resto, não um erro de cast do Postgres na tela
      if v_linha ? 'liberacao' and jsonb_typeof(v_linha->'liberacao') <> 'boolean' then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
      if coalesce((v_linha->>'liberacao')::boolean, false) then
        for v_cand in
          select v_chave
          union all
          select jsonb_array_elements_text(case when jsonb_typeof(v_linha->'candidatas') = 'array' then v_linha->'candidatas' else '[]'::jsonb end)
        loop
          if v_lib_antigo ? (v_prefixo || v_cand) then
            v_lib := jsonb_set(v_lib, array[v_prefixo || v_chave], v_lib_antigo -> (v_prefixo || v_cand), true);
            exit;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  -- DECISÕES da conferência: mescladas por cima do que foi preservado, com o
  -- carimbo do servidor (mesma regra da RPC de patch: `por`/`em` nunca vêm do cliente).
  if v_lo is not null then
    for v_chave, v_valor in select key, value from jsonb_each(v_lo) loop
      v_over := jsonb_set(
        v_over,
        array[v_prefixo || v_chave],
        coalesce(v_over -> (v_prefixo || v_chave), '{}'::jsonb)
          || (v_valor - 'por' - 'em')
          || jsonb_build_object('por', v_caller, 'em', now()),
        true);
    end loop;
  end if;

  -- REPUBLICAR PRESERVA O ANDAMENTO E OS CASOS MANUAIS (dono 23/09).
  -- Antes, o turno inteiro era apagado e reinserido: sumiam o status das cirurgias
  -- (iniciada/terminada/suspensa) e os casos adicionados à mão no app (quase sempre
  -- urgência, ~5 por dia útil). Agora:
  --  1. casos `origem='manual'` NÃO são apagados — a foto não os conhece. Se a foto
  --     nova também trouxer a urgência, ela aparece duplicada (risco aceito pelo dono;
  --     exclui-se pelo "Excluir caso").
  --  2. o andamento dos casos IMPORTADOS volta no caso novo que tem a MESMA sala, hora e
  --     iniciais do paciente (casamento um-para-um pela ordem dentro da chave). É escrito
  --     no próprio INSERT, e não num UPDATE depois: o trigger de status
  --     (tr_escala_caso_evento_status) registraria como marcação nova, do publicador.
  -- A captura sai do PRÓPRIO delete (returning): o que volta é exatamente o que foi
  -- apagado — uma marcação feita por outro aparelho entre um SELECT e o DELETE não se perde.
  with del as (
    delete from public.escala_cirurgica_caso
     where escala_id = v_id and turno = p_turno and origem <> 'manual'
    returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'k', x.k, 'n', x.rn,
           'status_cirurgia', x.status_cirurgia, 'status_extra', x.status_extra,
           'status_atualizado_em', x.status_atualizado_em, 'status_atualizado_por', x.status_atualizado_por,
           'termino_previsto', x.termino_previsto,
           -- horário real de início/término (dono 02/10): volta junto com o status
           'inicio_real', x.inicio_real, 'termino_real', x.termino_real,
           'inicio_real_por', x.inicio_real_por, 'termino_real_por', x.termino_real_por)), '[]'::jsonb)
    into v_andamento
    from (
      select d.*,
             lower(btrim(d.sala)) || '|' || coalesce(btrim(d.hora),'') || '|' || upper(coalesce(btrim(d.paciente_iniciais),'')) as k,
             row_number() over (
               partition by lower(btrim(d.sala)) || '|' || coalesce(btrim(d.hora),'') || '|' || upper(coalesce(btrim(d.paciente_iniciais),''))
               order by d.ordem, d.created_at, d.id) as rn
        from del d
    ) x
   where x.status_cirurgia <> 'agendada' or x.status_extra is not null or x.termino_previsto is not null
      or x.inicio_real is not null or x.termino_real is not null;

  if jsonb_typeof(coalesce(p_casos,'[]'))='array' and jsonb_array_length(coalesce(p_casos,'[]'))>0 then
    insert into public.escala_cirurgica_caso
      (escala_id,sala,ordem,hora,tempo_estimado,termino_previsto,paciente_iniciais,idade,
       procedimento,convenio,cirurgiao,cirurgiao_display,anestesista,anestesista_user_id,
       residente,residente_user_id,bloco,is_continuacao,sem_anestesista,tipo,gravidade,turno,
       status_cirurgia,status_extra,status_atualizado_em,status_atualizado_por,
       inicio_real,termino_real,inicio_real_por,termino_real_por)
    select v_id, coalesce(c->>'sala',''), coalesce((nullif(c->>'ordem',''))::int,0),
      nullif(c->>'hora',''), nullif(c->>'tempo_estimado',''),
      coalesce(nullif(c->>'termino_previsto',''), a.termino_previsto),
      nullif(c->>'paciente_iniciais',''), nullif(c->>'idade',''), nullif(c->>'procedimento',''),
      nullif(c->>'convenio',''), nullif(c->>'cirurgiao',''), nullif(c->>'cirurgiao_display',''),
      nullif(c->>'anestesista',''), nullif(c->>'anestesista_user_id',''), nullif(c->>'residente',''),
      nullif(c->>'residente_user_id',''), coalesce(nullif(c->>'bloco',''),'normal'),
      coalesce((nullif(c->>'is_continuacao',''))::boolean,false), coalesce((nullif(c->>'sem_anestesista',''))::boolean,false),
      coalesce(nullif(c->>'tipo',''),'eletiva'), nullif(c->>'gravidade',''), p_turno,
      coalesce(a.status_cirurgia, 'agendada'), a.status_extra, a.status_atualizado_em, a.status_atualizado_por,
      a.inicio_real, a.termino_real, a.inicio_real_por, a.termino_real_por
    from (
      select e.c,
             lower(btrim(coalesce(e.c->>'sala',''))) || '|' || coalesce(btrim(nullif(e.c->>'hora','')),'') || '|' || upper(coalesce(btrim(nullif(e.c->>'paciente_iniciais','')),'')) as k,
             row_number() over (
               partition by lower(btrim(coalesce(e.c->>'sala',''))) || '|' || coalesce(btrim(nullif(e.c->>'hora','')),'') || '|' || upper(coalesce(btrim(nullif(e.c->>'paciente_iniciais','')),''))
               -- mesma ordem do lado antigo (ordem dentro da sala), a posição no array desempata
               order by coalesce((nullif(e.c->>'ordem',''))::int,0), e.ord) as rn
        from jsonb_array_elements(coalesce(p_casos,'[]')) with ordinality as e(c, ord)
    ) novo
    left join jsonb_to_recordset(v_andamento) as a(
      k text, n int, status_cirurgia text, status_extra text,
      status_atualizado_em timestamptz, status_atualizado_por text, termino_previsto text,
      inicio_real text, termino_real text, inicio_real_por text, termino_real_por text
    ) on a.k = novo.k and a.n = novo.rn;
  end if;

  -- RE-APONTAR pelo snapshot original: A→B não vira entrada de B→A.
  -- revisao-swap-snapshot-v2 (marcador de idempotência da migration)
  declare
    v_casos_originais jsonb;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'uid', c.anestesista_user_id)), '[]'::jsonb)
      into v_casos_originais
      from public.escala_cirurgica_caso c
     where c.escala_id = v_id and c.turno = p_turno and c.origem <> 'manual';
  for v_chave, v_valor in select key, value from jsonb_each(v_over) loop
    if left(v_chave, length(v_prefixo)) <> v_prefixo then continue; end if;
    v_asm := v_valor -> 'assumidaPor';
    if jsonb_typeof(v_asm) is distinct from 'object' then continue; end if;
    if coalesce(v_asm->>'uid','') = '' or coalesce(v_asm->'de'->>'uid','') = ''
       or v_asm->>'uid' = v_asm->'de'->>'uid' then continue; end if;
    -- apelido canônico = o primeiro em ordem alfabética (é o `apelidos[0]` do roster)
    select a.apelido into v_apelido
      from public.escala_anestesista_alias a
     where a.user_id = v_asm->>'uid'
     order by a.apelido
     limit 1;
    if v_apelido is null then
      v_apelido := upper(split_part(btrim(coalesce(v_asm->>'nome','')), ' ', 1));
    end if;
    with upd as (
      update public.escala_cirurgica_caso c
         set anestesista_user_id = v_asm->>'uid',
             anestesista = coalesce(nullif(v_apelido,''), c.anestesista),
             sem_anestesista = false
       where c.escala_id = v_id and c.turno = p_turno
         and c.id in (
           select (original->>'id')::uuid
             from jsonb_array_elements(v_casos_originais) original
            where original->>'uid' = v_asm->'de'->>'uid'
         )
       returning c.id
    )
    select coalesce(jsonb_agg(u.id), '[]'::jsonb) into v_ids from upd u;
    -- Recibo sem caso agora fica vazio, nunca retém IDs apagados pelo DELETE.
    v_over := jsonb_set(v_over, array[v_chave, 'assumidaPor', 'casoIds'], v_ids, true);
  end loop;

  end;

  v_pub := jsonb_build_object('status',v_status,'publishedAt',case when v_status='publicada' then now() else null end,
    'publishedBy',case when v_status='publicada' then v_caller else null end,
    'publishedByName',nullif(p_header->>'published_by_name',''),
    'casos', (select count(*) from public.escala_cirurgica_caso where escala_id=v_id and turno=p_turno));
  v_turnos := jsonb_set(coalesce(v_turnos,'{}'), array[p_turno], v_pub, true);

  update public.escala_cirurgica set
    status=case when v_status='publicada' then 'publicada' else status end,
    ordem_liberacao=jsonb_set(v_ordem,array[p_turno],coalesce(nullif(p_header->'ordem_liberacao','null'::jsonb),'[]'::jsonb),true),
    ajuda_externa=jsonb_set(v_ajuda,array[p_turno],coalesce(nullif(p_header->'ajuda_externa','null'::jsonb),'[]'::jsonb),true),
    liberacoes=coalesce(v_lib,'{}'::jsonb),
    linha_overrides=coalesce(v_over,'{}'::jsonb),
    publicacao_turnos=v_turnos,
    -- fds_meta: só quando o payload traz (e o gate acima garante hospital='fds').
    -- Ausente ou jsonb null = preserva o atual (republicação de UM turno reenvia
    -- o meta completo por convenção da conferência; não existe "limpar" via RPC —
    -- zerar exige UPDATE direto, decisão consciente).
    fds_meta=coalesce(nullif(p_header->'fds_meta','null'::jsonb),fds_meta),
    source_image_path=coalesce(nullif(p_header->>'source_image_path',''),source_image_path),
    published_at=case when v_status='publicada' then now() else published_at end,
    published_by=case when v_status='publicada' then v_caller else published_by end,
    published_by_name=case when v_status='publicada' then coalesce((select p.nome from public.profiles p where p.id=v_caller),nullif(p_header->>'published_by_name','')) else published_by_name end,
    updated_at=now()
  where id=v_id;

  -- Auditoria da publicação: não replica dados do paciente; registra apenas
  -- quem publicou, qual turno e quantos casos foram substituídos.
  if to_regclass('public.escala_cirurgica_evento') is not null then
    begin
      insert into public.escala_cirurgica_evento (tipo, escala_id, data, hospital, detalhe, por)
      values ('publicacao', v_id, p_data, p_hospital,
        jsonb_build_object('turno', p_turno, 'casos', jsonb_array_length(coalesce(p_casos,'[]'::jsonb)), 'status', v_status), v_caller);
    exception when others then
      raise warning 'auditoria_publicacao indisponivel: %', sqlerrm;
    end;
  end if;

  select jsonb_build_object('header',(select to_jsonb(e.*) from public.escala_cirurgica e where e.id=v_id),
    'casos',coalesce((select jsonb_agg(c.* order by c.sala,c.ordem) from public.escala_cirurgica_caso c where c.escala_id=v_id),'[]'::jsonb)) into v_result;
  return v_result;
end;
$function$;

comment on function public.rpc_publicar_escala_turno(date, text, text, jsonb, jsonb, jsonb, jsonb) is
  'Publica/substitui UM turno da escala cirúrgica numa transação. p_linha_overrides = decisões da conferência por chave (sem prefixo de turno; por/em carimbados aqui; assumidaPor/liberadoEm recusados). p_preservar = {campos, linhas:[{chave, candidatas, liberacao}]}: de quem segue na escala, os campos listados do override antigo voltam (05/09: rastro sobrevive, liberação zera). Posição assumida preservada re-aponta os casos do dono antigo. 23/09: casos origem=manual não são apagados e o andamento (status, término) dos importados volta no caso novo de mesma sala+hora+iniciais, escrito no INSERT (sem evento de status). 02/10: o horário real (inicio_real/termino_real e autores) volta junto com o andamento. Liga o GUC anest.publicacao para o trigger de rastro.';

commit;
