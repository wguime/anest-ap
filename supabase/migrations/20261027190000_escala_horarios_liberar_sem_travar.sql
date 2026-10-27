-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — HORÁRIOS: LIBERAR SEM TRAVAR (dono 2026-10-27, 7 rodadas de protótipo
-- em .tmp/horarios-auditoria/, escolhas em ESCOLHAS.md).
--
-- Medido em outubro: 96% das 537 liberações desde a trava de 14/10 foram feitas por outra
-- pessoa, e 177 términos foram gravados por quem liberou com a HORA DO TOQUE (171 no mesmo
-- minuto da liberação — a cesariana do Leandro, 23/10, 14:23). A trava punia quem libera e
-- o término inventado entrava no aprendizado de tempos.
--
-- (1) "TERMINOU · HORÁRIO DEPOIS" — RPC nova `rpc_escala_terminar_sem_horario`: marca a
--     cirurgia Terminada SEM gravar a hora do toque como término e sem exigir o início. Liga
--     a flag de transação `escala.terminar_sem_horario`, que o gatilho lê. "A informar" =
--     terminada sem término; o limite ("terminou antes de 15:40") é `status_atualizado_em`,
--     e quem confirmou é `status_atualizado_por`. Vale para QUALQUER pessoa, inclusive o
--     anestesista do caso (dono: a folha é a mesma para todos, "para não haver confusão").
-- (2) TRAVA DA LIBERAÇÃO — `escala_caso_trava_liberacao` deixa de travar terminada sem
--     horário. Cirurgia ABERTA (agendada/iniciada, fora "passa para tarde" e dupla) continua
--     travando: ninguém sai com cirurgia aberta sem um fato (preencher, terminou, passar,
--     não aconteceu). Reabre 14/10 por decisão do dono.
-- (3) ESTIMADO QUE CONTA DO INÍCIO — colunas `duracao_estimada_min` (+ `_por`): na cirurgia
--     que ainda não começou, o tempo estimado é uma DURAÇÃO. No toque em Iniciada o gatilho
--     a converte em `termino_previsto` (início + duração) e a limpa. O autor do estimado
--     segue sendo quem escolheu a duração (adesão: "tempo da cirurgia" próprio). Reabre a
--     duração encadeada de 14/09. A duração do MAPA (`tempo_estimado`) não entra: 23/07,
--     tempo 100% manual.
-- (4) A captura do estimado (`tr_escala_caso_captura_update`) passa a escutar também
--     `status_cirurgia`: sem isso a conversão (3), feita por gatilho, não entrava no log de
--     estimativas — `UPDATE OF` só dispara pela coluna citada no comando.
-- (5) REPUBLICAR PRESERVA A DURAÇÃO — `rpc_publicar_escala_turno` é corrigida sobre a
--     definição VIVA (âncoras únicas + marcador de idempotência), como na migration de
--     gravidade (20260818140000): a duração estimada de manhã para a tarde não pode sumir
--     quando a tarde é republicada.
--
-- CHECK de escala_cirurgica_caso: nenhum muda (os existentes só validam formato e status).
-- Rollback: scripts/rollback-20261027190000-horarios-liberar-sem-travar.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- (3) a duração estimada da cirurgia que ainda não começou ─────────────────────
alter table public.escala_cirurgica_caso
  add column if not exists duracao_estimada_min smallint,
  add column if not exists duracao_estimada_por text;
do $$ begin
  alter table public.escala_cirurgica_caso
    add constraint escala_caso_duracao_estimada_min check (duracao_estimada_min is null or duracao_estimada_min between 1 and 720);
exception when duplicate_object then null; end $$;
comment on column public.escala_cirurgica_caso.duracao_estimada_min is
  'Tempo estimado de uma cirurgia que ainda não começou, em minutos (dono 27/10). Vira termino_previsto (início + duração) no toque em Iniciada, pelo gatilho escala_caso_horario_real.';
comment on column public.escala_cirurgica_caso.duracao_estimada_por is
  'Quem escolheu a duração estimada — vira termino_previsto_por na conversão.';

-- (1) + (3) o gatilho do horário ─────────────────────────────────────────────
create or replace function public.escala_caso_horario_real()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_ref timestamptz;
  v_quem text := coalesce(nullif(public.firebase_uid(), ''), new.status_atualizado_por);
  -- "Terminou · horário depois" (27/10): só a RPC rpc_escala_terminar_sem_horario liga
  v_sem_horario boolean := coalesce(current_setting('escala.terminar_sem_horario', true), '') = 'on';
begin
  -- 0. quem escolheu a duração estimada (antes da conversão, que lê este autor)
  if new.duracao_estimada_min is distinct from old.duracao_estimada_min then
    new.duracao_estimada_por := case when new.duracao_estimada_min is null then null else v_quem end;
  end if;
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
      -- ESTIMADO QUE CONTA DO INÍCIO (dono 27/10): a duração vira o horário de término
      if new.duracao_estimada_min is not null then
        new.termino_previsto := to_char(new.inicio_real::time + make_interval(mins => new.duracao_estimada_min), 'HH24:MI');
        new.termino_previsto_por := coalesce(new.duracao_estimada_por, v_quem);
        new.duracao_estimada_min := null;
        new.duracao_estimada_por := null;
      end if;
    elsif new.status_cirurgia = 'terminada' then
      if new.inicio_real is null and old.status_cirurgia = 'iniciada' and old.status_atualizado_em is not null then
        new.inicio_real := to_char(old.status_atualizado_em at time zone 'America/Sao_Paulo', 'HH24:MI');
      end if;
      -- "Terminou · horário depois": a hora do toque NÃO vira término — fica a informar
      if new.termino_real is null and not v_sem_horario then
        new.termino_real := to_char(v_ref at time zone 'America/Sao_Paulo', 'HH24:MI');
      end if;
      -- terminada não tem mais o que estimar (15/09: "Terminada zera o tempo")
      new.duracao_estimada_min := null;
      new.duracao_estimada_por := null;
    end if;
  end if;
  -- 2. TERMINADA EXIGE O INÍCIO (dono 14/10) — só na transição para terminada ou ao
  --    apagar o início de uma terminada; "Terminou · horário depois" (27/10) fica de fora
  if new.status_cirurgia = 'terminada' and new.inicio_real is null and not v_sem_horario
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

-- (1) a RPC do "Terminou · horário depois" ───────────────────────────────────
create or replace function public.rpc_escala_terminar_sem_horario(p_caso_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
  v_atual  text;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  select status_cirurgia into v_atual
    from public.escala_cirurgica_caso where id = p_caso_id
    for update;
  if not found then raise exception 'caso_nao_encontrado'; end if;
  if v_atual = 'terminada' then return; end if; -- idempotente: já fechada fica como está
  perform set_config('escala.terminar_sem_horario', 'on', true);
  update public.escala_cirurgica_caso
     set status_cirurgia       = 'terminada',
         status_extra          = null,
         status_atualizado_por = v_caller,
         status_atualizado_em  = now(),
         termino_previsto      = null, -- "Terminada zera o tempo" (15/09), como o app faz
         updated_at            = now()
   where id = p_caso_id;
  perform set_config('escala.terminar_sem_horario', '', true);
end;
$$;
revoke execute on function public.rpc_escala_terminar_sem_horario(uuid) from public, anon;
grant execute on function public.rpc_escala_terminar_sem_horario(uuid) to authenticated, service_role;

-- (2) a trava da liberação: só cirurgia ABERTA ───────────────────────────────
-- Mesma assinatura (a RPC de patch passa início e término; ficam sem uso de propósito).
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
     and coalesce(p_procedimento, '') !~* 'consult'  -- consultório tem horário definido (16/10)
     and coalesce(p_anestesista, '') not like '%+%'
     and not coalesce(p_sem_anestesista, false)
     and not coalesce(p_is_continuacao, false)
     -- ABERTA (dono 27/10): sem horário não trava mais; quem operou informa depois
     and coalesce(p_status, 'agendada') not in ('terminada', 'suspensa')
     and coalesce(p_extra, '') not in ('suspensa', 'passa_tarde')
$$;

-- (4) a captura do estimado escuta também o status ───────────────────────────
drop trigger if exists tr_escala_caso_captura_update on public.escala_cirurgica_caso;
create trigger tr_escala_caso_captura_update
  after update of termino_previsto, anestesista, anestesista_user_id, sem_anestesista, status_cirurgia
  on public.escala_cirurgica_caso
  for each row execute function public.captura_escala_caso_update();

-- (5) republicar preserva a duração — sobre a definição VIVA ──────────────────
do $patch$
declare
  v_def text := pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc);
  v_ancora text;
  v_novo text;
  v_par text[];
  v_pares text[][] := array[
    array[$a$'inicio_real_por', x.inicio_real_por, 'termino_real_por', x.termino_real_por)), '[]'::jsonb)$a$,
          $a$'inicio_real_por', x.inicio_real_por, 'termino_real_por', x.termino_real_por,
           'duracao_estimada_min', x.duracao_estimada_min, 'duracao_estimada_por', x.duracao_estimada_por)), '[]'::jsonb)$a$],
    array[$a$or x.inicio_real is not null or x.termino_real is not null;$a$,
          $a$or x.inicio_real is not null or x.termino_real is not null or x.duracao_estimada_min is not null;$a$],
    array[$a$inicio_real,termino_real,inicio_real_por,termino_real_por)$a$,
          $a$inicio_real,termino_real,inicio_real_por,termino_real_por,duracao_estimada_min,duracao_estimada_por)$a$],
    array[$a$a.inicio_real, a.termino_real, a.inicio_real_por, a.termino_real_por$a$,
          $a$a.inicio_real, a.termino_real, a.inicio_real_por, a.termino_real_por, a.duracao_estimada_min, a.duracao_estimada_por$a$],
    array[$a$inicio_real text, termino_real text, inicio_real_por text, termino_real_por text$a$,
          $a$inicio_real text, termino_real text, inicio_real_por text, termino_real_por text,
      duracao_estimada_min smallint, duracao_estimada_por text$a$]
  ];
begin
  if position('duracao_estimada_min' in v_def) > 0 then
    raise notice 'rpc_publicar_escala_turno já preserva a duração — nada a fazer';
    return;
  end if;
  v_novo := v_def;
  foreach v_par slice 1 in array v_pares loop
    v_ancora := v_par[1];
    if (length(v_novo) - length(replace(v_novo, v_ancora, ''))) / length(v_ancora) <> 1 then
      raise exception 'âncora ausente ou repetida na rpc_publicar_escala_turno: %', left(v_ancora, 60);
    end if;
    v_novo := replace(v_novo, v_ancora, v_par[2]);
  end loop;
  execute v_novo;
end
$patch$;

commit;

-- Conferência visível para quem aplica (a Management API não devolve notices):
select
  position('v_sem_horario' in pg_get_functiondef('public.escala_caso_horario_real'::regproc)) > 0 as gatilho_sem_horario,
  position('duracao_estimada_min' in pg_get_functiondef('public.escala_caso_horario_real'::regproc)) > 0 as gatilho_duracao,
  to_regprocedure('public.rpc_escala_terminar_sem_horario(uuid)') is not null as rpc_terminar,
  position('p_inicio is null' in pg_get_functiondef('public.escala_caso_trava_liberacao'::regproc)) = 0 as trava_so_aberta,
  position('duracao_estimada_min' in pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc)) > 0 as publicar_preserva;
