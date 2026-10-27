-- Rollback de supabase/migrations/20261027190000_escala_horarios_liberar_sem_travar.sql
-- Volta o gatilho e a trava ao corpo de 14/10 + 16/10, tira a RPC nova, devolve a captura
-- ao gatilho de antes, desfaz o patch da republicação e apaga as colunas da duração.
-- ⚠️ Apagar as colunas perde as durações estimadas ainda não convertidas (aceito: o
-- rollback volta ao estimado como horário). Cirurgias já fechadas sem horário continuam
-- terminadas sem término — o relatório de adesão as conta, como antes.
--
-- ORDEM (de preferência fora do turno):
--   1. reverter e publicar o APP antes (o app novo grava duracao_estimada_min — PGRST204 sem a
--      coluna — e chama rpc_escala_terminar_sem_horario — 404 sem a RPC);
--   2. se quiser guardar as durações ainda não convertidas:
--      select id, duracao_estimada_min, duracao_estimada_por from escala_cirurgica_caso
--       where duracao_estimada_min is not null;
--   3. rodar este arquivo. No meio de um turno, quem tem cirurgia terminada sem horário volta
--      a ser barrado na liberação.

begin;
set local lock_timeout = '3s';

create or replace function public.escala_caso_horario_real()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_ref timestamptz;
  v_quem text := coalesce(nullif(public.firebase_uid(), ''), new.status_atualizado_por);
begin
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
  if new.status_cirurgia = 'terminada' and new.inicio_real is null
     and (new.status_cirurgia is distinct from old.status_cirurgia or old.inicio_real is not null) then
    raise exception 'inicio_obrigatorio: informe o início da cirurgia antes de marcar Terminada'
      using errcode = '23514';
  end if;
  if new.inicio_real is distinct from old.inicio_real then
    new.inicio_real_por := case when new.inicio_real is null then null else v_quem end;
  end if;
  if new.termino_real is distinct from old.termino_real then
    new.termino_real_por := case when new.termino_real is null then null else v_quem end;
  end if;
  return new;
end;
$$;

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
     and coalesce(p_status, 'agendada') <> 'suspensa'
     and coalesce(p_extra, '') <> 'suspensa'
     and (
       (coalesce(p_status, 'agendada') <> 'terminada' and coalesce(p_extra, '') <> 'passa_tarde')
       or (p_status = 'terminada' and (p_inicio is null or p_termino is null))
     )
$$;

drop function if exists public.rpc_escala_terminar_sem_horario(uuid);

create or replace trigger tr_escala_caso_captura_update
  after update of termino_previsto, anestesista, anestesista_user_id, sem_anestesista
  on public.escala_cirurgica_caso
  for each row
  when (old.termino_previsto is distinct from new.termino_previsto
     or old.anestesista is distinct from new.anestesista
     or old.anestesista_user_id is distinct from new.anestesista_user_id
     or old.sem_anestesista is distinct from new.sem_anestesista)
  execute function public.captura_escala_caso_update();

-- desfaz o patch da republicação (os mesmos pares, ao contrário)
do $patch$
declare
  v_oid regprocedure := to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)');
  v_def text;
  v_par text[];
  v_pares text[][] := array[
    array[$a$'inicio_real_por', x.inicio_real_por, 'termino_real_por', x.termino_real_por,
           'duracao_estimada_min', x.duracao_estimada_min, 'duracao_estimada_por', x.duracao_estimada_por)), '[]'::jsonb)$a$,
          $a$'inicio_real_por', x.inicio_real_por, 'termino_real_por', x.termino_real_por)), '[]'::jsonb)$a$],
    array[$a$or x.inicio_real is not null or x.termino_real is not null or x.duracao_estimada_min is not null;$a$,
          $a$or x.inicio_real is not null or x.termino_real is not null;$a$],
    array[$a$inicio_real,termino_real,inicio_real_por,termino_real_por,duracao_estimada_min,duracao_estimada_por)$a$,
          $a$inicio_real,termino_real,inicio_real_por,termino_real_por)$a$],
    array[$a$a.inicio_real, a.termino_real, a.inicio_real_por, a.termino_real_por, a.duracao_estimada_min, a.duracao_estimada_por$a$,
          $a$a.inicio_real, a.termino_real, a.inicio_real_por, a.termino_real_por$a$],
    array[$a$inicio_real text, termino_real text, inicio_real_por text, termino_real_por text,
      duracao_estimada_min smallint, duracao_estimada_por text$a$,
          $a$inicio_real text, termino_real text, inicio_real_por text, termino_real_por text$a$]
  ];
begin
  if v_oid is null then
    raise exception 'rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb) não encontrada';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('duracao_estimada_min' in v_def) = 0 then return; end if;
  foreach v_par slice 1 in array v_pares loop
    -- a mesma conferência da migration: cada âncora exatamente uma vez
    if (length(v_def) - length(replace(v_def, v_par[1], ''))) / length(v_par[1]) <> 1 then
      raise exception 'âncora ausente ou repetida ao desfazer a publicação: %', left(v_par[1], 60);
    end if;
    v_def := replace(v_def, v_par[1], v_par[2]);
  end loop;
  execute v_def;
end
$patch$;

-- trava final: a publicação não pode continuar citando as colunas que vão sumir
do $$ begin
  if position('duracao_estimada_min' in pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)'))) > 0 then
    raise exception 'rpc_publicar_escala_turno ainda cita duracao_estimada_min — rollback abortado antes do drop column';
  end if;
end $$;

alter table public.escala_cirurgica_caso drop constraint if exists escala_caso_duracao_estimada_min;
alter table public.escala_cirurgica_caso drop column if exists duracao_estimada_min, drop column if exists duracao_estimada_por;

commit;

select position('duracao_estimada_min' in pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc)) = 0 as publicar_revertida,
       to_regprocedure('public.rpc_escala_terminar_sem_horario(uuid)') is null as rpc_removida;
