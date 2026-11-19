-- Rollback de supabase/migrations/20261119180000_escala_motivo_suspensa_atraso.sql
-- Desfaz o patch da republicação, tira o gatilho do autor e apaga as colunas de motivo.
-- ⚠️ Apagar as colunas perde os motivos já informados. Para guardar antes:
--   select id, status_extra, motivo_suspensao, motivo_suspensao_por, motivo_atraso, motivo_atraso_por
--     from escala_cirurgica_caso where motivo_suspensao is not null or motivo_atraso is not null;
--
-- ORDEM: reverter e publicar o APP antes (o app novo grava motivo_* — PGRST204 sem a coluna).

begin;
set local lock_timeout = '3s';

do $patch$
declare
  v_oid regprocedure := to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)');
  v_def text;
  v_ancora text;
  v_novo text;
  v_par text[];
  -- o inverso dos pares da migration: [novo, antigo]
  v_pares text[][] := array[
    array[$a$'duracao_estimada_min', x.duracao_estimada_min, 'duracao_estimada_por', x.duracao_estimada_por,
           'motivo_suspensao', x.motivo_suspensao, 'motivo_suspensao_por', x.motivo_suspensao_por,
           'motivo_atraso', x.motivo_atraso, 'motivo_atraso_por', x.motivo_atraso_por)), '[]'::jsonb)$a$,
          $a$'duracao_estimada_min', x.duracao_estimada_min, 'duracao_estimada_por', x.duracao_estimada_por)), '[]'::jsonb)$a$],
    array[$a$or x.duracao_estimada_min is not null or x.motivo_suspensao is not null or x.motivo_atraso is not null;$a$,
          $a$or x.duracao_estimada_min is not null;$a$],
    array[$a$termino_real_por,duracao_estimada_min,duracao_estimada_por,motivo_suspensao,motivo_suspensao_por,motivo_atraso,motivo_atraso_por)$a$,
          $a$termino_real_por,duracao_estimada_min,duracao_estimada_por)$a$],
    array[$a$a.duracao_estimada_min, a.duracao_estimada_por, a.motivo_suspensao, a.motivo_suspensao_por, a.motivo_atraso, a.motivo_atraso_por$a$,
          $a$a.duracao_estimada_min, a.duracao_estimada_por$a$],
    array[$a$duracao_estimada_min smallint, duracao_estimada_por text,
      motivo_suspensao text, motivo_suspensao_por text, motivo_atraso text, motivo_atraso_por text$a$,
          $a$duracao_estimada_min smallint, duracao_estimada_por text$a$]
  ];
begin
  if v_oid is null then
    raise exception 'rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb) não encontrada';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('motivo_suspensao' in v_def) = 0 then
    raise notice 'rpc_publicar_escala_turno já está sem o motivo — nada a fazer';
    return;
  end if;
  v_novo := v_def;
  foreach v_par slice 1 in array v_pares loop
    v_ancora := v_par[1];
    if (length(v_novo) - length(replace(v_novo, v_ancora, ''))) / length(v_ancora) <> 1 then
      raise exception 'âncora ausente ou repetida: %', left(v_ancora, 60);
    end if;
    v_novo := replace(v_novo, v_ancora, v_par[2]);
  end loop;
  execute v_novo;
end
$patch$;

drop trigger if exists tr_escala_caso_motivo_por on public.escala_cirurgica_caso;
drop function if exists public.escala_caso_motivo_por();
alter table public.escala_cirurgica_caso
  drop column if exists motivo_suspensao,
  drop column if exists motivo_suspensao_por,
  drop column if exists motivo_atraso,
  drop column if exists motivo_atraso_por;

commit;

select position('motivo_suspensao' in pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc)) = 0 as publicar_sem_motivo;
