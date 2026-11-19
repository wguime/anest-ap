-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — MOTIVO DA SUSPENSÃO E DO ATRASO (dono 2026-11-19, modelo em
-- .tmp/motivo-suspensa-atrasada.html).
--
-- "Humberto me passou essa cirurgia pois ela foi suspensa e não há como informar que ela
-- foi suspensa [...] quero que seja possível informar o motivo". O status já existia
-- (`status_extra` = 'suspensa' | 'atrasada'); faltava o PORQUÊ.
--
-- (1) Duas colunas de texto livre no caso. O app grava o rótulo do chip escolhido ou o
--     texto do "Outro" — texto, e não código, para a lista de motivos poder mudar sem
--     migration e o relatório ler direto. Teto de 200 caracteres. A suspensa e o atraso
--     ficam em colunas separadas porque a cirurgia atrasada pode depois ser suspensa e o
--     motivo do atraso continua sendo dado de qualidade.
--     LGPD: o campo livre pede "sem o nome do paciente" na tela; nada aqui identifica.
-- (2) O AUTOR de cada motivo (`*_por`, firebase uid) é carimbado por gatilho — o cliente
--     nunca escreve o autor (mesmo padrão de inicio_real_por / duracao_estimada_por).
-- (3) REPUBLICAR PRESERVA O MOTIVO — `rpc_publicar_escala_turno` corrigida sobre a
--     definição VIVA (âncoras únicas + marcador de idempotência), como em 20261027190000.
--
-- Rollback: scripts/rollback-20261119180000-escala-motivo-suspensa-atraso.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '3s';

-- (1) as colunas ───────────────────────────────────────────────────────────────
alter table public.escala_cirurgica_caso
  add column if not exists motivo_suspensao text,
  add column if not exists motivo_suspensao_por text,
  add column if not exists motivo_atraso text,
  add column if not exists motivo_atraso_por text;
do $$ begin
  alter table public.escala_cirurgica_caso
    add constraint escala_caso_motivo_suspensao_tam check (motivo_suspensao is null or char_length(motivo_suspensao) between 1 and 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.escala_cirurgica_caso
    add constraint escala_caso_motivo_atraso_tam check (motivo_atraso is null or char_length(motivo_atraso) between 1 and 200);
exception when duplicate_object then null; end $$;
comment on column public.escala_cirurgica_caso.motivo_suspensao is
  'Por que a cirurgia foi suspensa (dono 19/11): rótulo do chip ou texto livre, sem identificar paciente. Lido só com status_extra = suspensa.';
comment on column public.escala_cirurgica_caso.motivo_atraso is
  'Por que a cirurgia atrasou (dono 19/11): rótulo do chip ou texto livre. Opcional; o quanto atrasou é calculado (inicio_real − hora).';
comment on column public.escala_cirurgica_caso.motivo_suspensao_por is 'Quem informou o motivo da suspensão (firebase uid), pelo gatilho.';
comment on column public.escala_cirurgica_caso.motivo_atraso_por is 'Quem informou o motivo do atraso (firebase uid), pelo gatilho.';

-- (2) o autor ──────────────────────────────────────────────────────────────────
create or replace function public.escala_caso_motivo_por()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  -- sem usuário (reparo por SQL/service role): cai em quem mexeu no status, como o gatilho do horário
  v_quem text := coalesce(nullif(public.firebase_uid(), ''), new.status_atualizado_por);
  -- a republicação (rpc_publicar_escala_turno) reinsere o caso com o autor ORIGINAL
  v_publicando boolean := coalesce(current_setting('anest.publicacao', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if v_publicando then return new; end if;
    -- caso manual nascendo com motivo: o autor é quem insere, nunca o que o cliente mandou
    new.motivo_suspensao_por := case when new.motivo_suspensao is null then null else v_quem end;
    new.motivo_atraso_por := case when new.motivo_atraso is null then null else v_quem end;
    return new;
  end if;
  if new.motivo_suspensao is distinct from old.motivo_suspensao then
    new.motivo_suspensao_por := case when new.motivo_suspensao is null then null else v_quem end;
  else
    new.motivo_suspensao_por := old.motivo_suspensao_por;
  end if;
  if new.motivo_atraso is distinct from old.motivo_atraso then
    new.motivo_atraso_por := case when new.motivo_atraso is null then null else v_quem end;
  else
    new.motivo_atraso_por := old.motivo_atraso_por;
  end if;
  return new;
end;
$$;
revoke execute on function public.escala_caso_motivo_por() from public, anon, authenticated;

drop trigger if exists tr_escala_caso_motivo_por on public.escala_cirurgica_caso;
create trigger tr_escala_caso_motivo_por
  before insert or update on public.escala_cirurgica_caso
  for each row execute function public.escala_caso_motivo_por();

-- (3) republicar preserva o motivo — sobre a definição VIVA ───────────────────
do $patch$
declare
  v_oid regprocedure := to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)');
  v_def text;
  v_ancora text;
  v_novo text;
  v_par text[];
  v_pares text[][] := array[
    array[$a$'duracao_estimada_min', x.duracao_estimada_min, 'duracao_estimada_por', x.duracao_estimada_por)), '[]'::jsonb)$a$,
          $a$'duracao_estimada_min', x.duracao_estimada_min, 'duracao_estimada_por', x.duracao_estimada_por,
           'motivo_suspensao', x.motivo_suspensao, 'motivo_suspensao_por', x.motivo_suspensao_por,
           'motivo_atraso', x.motivo_atraso, 'motivo_atraso_por', x.motivo_atraso_por)), '[]'::jsonb)$a$],
    array[$a$or x.duracao_estimada_min is not null;$a$,
          $a$or x.duracao_estimada_min is not null or x.motivo_suspensao is not null or x.motivo_atraso is not null;$a$],
    array[$a$termino_real_por,duracao_estimada_min,duracao_estimada_por)$a$,
          $a$termino_real_por,duracao_estimada_min,duracao_estimada_por,motivo_suspensao,motivo_suspensao_por,motivo_atraso,motivo_atraso_por)$a$],
    array[$a$a.duracao_estimada_min, a.duracao_estimada_por$a$,
          $a$a.duracao_estimada_min, a.duracao_estimada_por, a.motivo_suspensao, a.motivo_suspensao_por, a.motivo_atraso, a.motivo_atraso_por$a$],
    array[$a$duracao_estimada_min smallint, duracao_estimada_por text$a$,
          $a$duracao_estimada_min smallint, duracao_estimada_por text,
      motivo_suspensao text, motivo_suspensao_por text, motivo_atraso text, motivo_atraso_por text$a$]
  ];
begin
  if v_oid is null then
    raise exception 'rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb) não encontrada';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position('motivo_suspensao' in v_def) > 0 then
    raise notice 'rpc_publicar_escala_turno já preserva o motivo — nada a fazer';
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
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'escala_cirurgica_caso'
      and column_name in ('motivo_suspensao', 'motivo_suspensao_por', 'motivo_atraso', 'motivo_atraso_por')) = 4 as colunas,
  exists (select 1 from pg_trigger where tgname = 'tr_escala_caso_motivo_por') as gatilho,
  position('motivo_suspensao' in pg_get_functiondef('public.rpc_publicar_escala_turno'::regproc)) > 0 as publicar_preserva;
