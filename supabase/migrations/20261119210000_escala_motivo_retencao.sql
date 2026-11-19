-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — RETENÇÃO DO MOTIVO EM TEXTO LIVRE (dono 2026-11-19, à noite:
-- "veja um prazo adequado e defina").
--
-- O motivo da suspensão/atraso (20261119180000) é o rótulo de um chip ou o texto livre do
-- "Outro". O RÓTULO não identifica ninguém e é o dado do indicador de qualidade: fica com o
-- caso. O TEXTO LIVRE é o único caminho por onde nome ou achado clínico do paciente entra
-- (revisão LGPD de 19/11): depois de **180 dias** pela data da escala ele vira só "Outro".
--
-- Por que 180 dias: o texto serve à conversa do turno e à revisão periódica dos motivos
-- (mensal/trimestral, onde o "Outro" recorrente vira chip novo); seis meses cobrem dois ciclos
-- trimestrais com folga e é o mesmo prazo da telemetria da escala (`escala_leitura_log`).
-- Base legal: LGPD Art. 11, II, "f" (tutela da saúde, gestão do serviço) e Art. 7, IX para o
-- autor; minimização (Art. 6, III) pelo expurgo. O autor (`*_por`) fica — trilha de auditoria.
--
-- (1) `escala_caso_motivo_purge()` — troca por 'Outro' o texto que não é rótulo de chip, de
--     escala com `data < current_date - 180`. ⚠️ O array é ESPELHO de `src/lib/escalaMotivoStatus.js`
--     (teste `escalaMotivoRetencaoSql` trava os dois iguais). Inclui o rótulo aposentado
--     "Cirurgião atrasado ou em outra sala" (19/11, à noite), que continua sendo de chip.
-- (2) O gatilho do autor preserva o `*_por` quando quem troca é o expurgo (GUC `anest.motivo_purge`).
-- (3) pg_cron diário 03:41 BRT (06:41 UTC).
-- (4) O rótulo aposentado vira o novo nos casos já gravados ("Cirurgião atrasado").
--
-- Rollback: scripts/rollback-20261119210000-escala-motivo-retencao.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '3s';

-- (2) o gatilho do autor: o expurgo não vira autor ──────────────────────────────
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
  -- o expurgo da retenção (escala_caso_motivo_purge) troca o texto sem trocar o autor
  v_purge boolean := coalesce(current_setting('anest.motivo_purge', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if v_publicando then return new; end if;
    -- caso manual nascendo com motivo: o autor é quem insere, nunca o que o cliente mandou
    new.motivo_suspensao_por := case when new.motivo_suspensao is null then null else v_quem end;
    new.motivo_atraso_por := case when new.motivo_atraso is null then null else v_quem end;
    return new;
  end if;
  if v_purge then
    new.motivo_suspensao_por := old.motivo_suspensao_por;
    new.motivo_atraso_por := old.motivo_atraso_por;
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

-- (1) o expurgo ────────────────────────────────────────────────────────────────
create or replace function public.escala_caso_motivo_purge()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  -- ESPELHO de MOTIVOS_SUSPENSAO + MOTIVOS_ATRASO (src/lib/escalaMotivoStatus.js) + aposentados
  v_rotulos text[] := array[
    -- suspensão
    'Condição clínica do paciente',
    'Decisão ou ausência do cirurgião',
    'Sem horário de sala (tempo excedido)',
    'Paciente não veio ou desistiu',
    'Sem vaga de UTI ou leito',
    'Exames ou avaliação pré-anestésica pendentes',
    'Paciente sem jejum',
    'Falta de material ou equipamento',
    'Sem autorização do convênio',
    -- atraso
    'Cirurgião atrasado',
    'Cirurgia anterior da sala atrasou',
    'Anestesista atrasado',
    'Anestesista em outra sala',
    'Paciente não chegou ou não preparado',
    'Sala ou RPA não liberada',
    'Material ou equipamento não pronto',
    'Paciente aguardando jejum',
    'Urgência passou na frente',
    -- aposentados (continuam sendo rótulo de chip)
    'Cirurgião atrasado ou em outra sala',
    -- o que o próprio expurgo grava
    'Outro'
  ];
  n integer;
begin
  perform set_config('anest.motivo_purge', '1', true);
  update public.escala_cirurgica_caso c
     set motivo_suspensao = case when c.motivo_suspensao is not null and not (c.motivo_suspensao = any (v_rotulos))
                                 then 'Outro' else c.motivo_suspensao end,
         motivo_atraso    = case when c.motivo_atraso is not null and not (c.motivo_atraso = any (v_rotulos))
                                 then 'Outro' else c.motivo_atraso end
    from public.escala_cirurgica e
   where e.id = c.escala_id
     and e.data < current_date - 180
     and ((c.motivo_suspensao is not null and not (c.motivo_suspensao = any (v_rotulos)))
       or (c.motivo_atraso is not null and not (c.motivo_atraso = any (v_rotulos))));
  get diagnostics n = row_count;
  perform set_config('anest.motivo_purge', '', true);
  return n;
end;
$$;

comment on function public.escala_caso_motivo_purge() is
  'Retenção de 180 dias do texto livre do motivo de suspensão/atraso (pela data da escala): vira "Outro"; rótulo de chip e autor ficam. Agendada em escala-caso-motivo-purge (diária, 03:41 BRT). Dono 2026-11-19.';

revoke all on function public.escala_caso_motivo_purge() from public, anon, authenticated;

-- (3) a agenda (molde de 20261008150000) ───────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('escala-caso-motivo-purge')
      from cron.job where jobname = 'escala-caso-motivo-purge';
    -- 06:41 UTC = 03:41 BRT, todo dia
    perform cron.schedule(
      'escala-caso-motivo-purge', '41 6 * * *',
      $cron$select public.escala_caso_motivo_purge();$cron$
    );
  end if;
end;
$$;

-- (4) o rótulo aposentado vira o novo (sem trocar o autor) ─────────────────────
select set_config('anest.motivo_purge', '1', true);
update public.escala_cirurgica_caso
   set motivo_atraso = 'Cirurgião atrasado'
 where motivo_atraso = 'Cirurgião atrasado ou em outra sala';

commit;

-- Conferência visível para quem aplica (a Management API não devolve notices):
select
  to_regprocedure('public.escala_caso_motivo_purge()') is not null as funcao,
  position('anest.motivo_purge' in pg_get_functiondef('public.escala_caso_motivo_por'::regproc)) > 0 as gatilho_preserva_autor,
  (select count(*) from cron.job where jobname = 'escala-caso-motivo-purge') as agendado;
