-- Rollback da migration 20261109233000_escala_adesao_snapshot.sql.
-- Devolve o cálculo ao nome público (com o bloco de acesso) e remove a cópia pronta.
begin;

do $rb$
declare
  v_def text;
  v_novo text;
begin
  if to_regprocedure('public.escala_adesao_relatorio_calc(integer)') is null then
    raise notice 'escala_adesao_relatorio_calc não existe — nada a desfazer';
    return;
  end if;
  v_def := pg_get_functiondef('public.escala_adesao_relatorio_calc(integer)'::regprocedure);
  v_novo := replace(v_def, 'FUNCTION public.escala_adesao_relatorio_calc(', 'FUNCTION public.escala_adesao_relatorio(');
  -- o bloco de acesso volta logo depois do `begin` do corpo
  v_novo := regexp_replace(v_novo, E'\\nbegin\\n',
    E'\nbegin\n  if public.firebase_uid() is null\n     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active) then\n    raise exception ''acesso negado'' using errcode = ''42501'';\n  end if;\n');
  if position('acesso negado' in v_novo) = 0 then
    raise exception 'não foi possível recolocar o bloco de acesso';
  end if;
  execute v_novo;
  drop function public.escala_adesao_relatorio_calc(integer);
end
$rb$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'escala-adesao-snapshot';
  end if;
end
$cron$;

drop function if exists public.escala_adesao_snapshot_atualizar();
drop table if exists public.escala_adesao_snapshot;

commit;
