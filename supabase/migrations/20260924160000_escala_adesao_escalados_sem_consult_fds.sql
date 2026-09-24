-- ============================================================================
-- Adesão à Escala — dia trabalhado: sem "(CONSULT)" e sem fila de FDS vazia (dono 2026-09-24)
-- ============================================================================
-- Auditoria de 24/09 (30 dias, 862 pessoa-dias na escala) achou dois jeitos de contar como dia
-- TRABALHADO um dia em que a pessoa não estava na sala:
--   • 3 dias só por um nome do rodapé anotado "(CONSULT)" / "(CONSULTORIO)" — estava no consultório
--   • 19 dias só pela fila do fim de semana (linha 'fds'), sem nenhuma cirurgia — em geral P5+
--     liberado / domingo sem eletiva
-- O dono mandou corrigir ("corrija e prossiga"). Regra nova de `escala_adesao_escalados`:
--   caso publicado com a pessoa como anestesista (qualquer linha, fim de semana incluído)
--   OU nome no rodapé de unimed/hro/materno SEM anotação de consultório.
-- A linha 'fds' não conta sozinha: no fim de semana, o dia entra pela cirurgia.
--
-- Histórico: dias até 30 atrás são regravados pelo mesmo caminho do cron; nos congelados só
-- DESMARCA `escalado` onde a regra nova não reconhece o dia (nunca marca — reaplicar é seguro).
--
-- Rollback: reaplicar `escala_adesao_escalados` de 20260924120000 e regravar os 30 dias.
-- Idempotente.

create or replace function public.escala_adesao_escalados(p_desde date, p_ate date)
returns table (data date, user_id text)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select e.data, c.anestesista_user_id
  from public.escala_cirurgica_caso c
  join public.escala_cirurgica e on e.id = c.escala_id
  where e.status = 'publicada' and e.data between p_desde and p_ate
    and c.anestesista_user_id is not null and not c.sem_anestesista
  union
  select e.data, a.user_id
  from public.escala_cirurgica e
  cross join lateral (
    -- rodapé por turno ({matutino, vespertino}, desde 20260804180000) ou lista única (antes)
    select jsonb_array_elements_text(case when jsonb_typeof(e.ordem_liberacao) = 'array' then e.ordem_liberacao
                                          when jsonb_typeof(e.ordem_liberacao -> 'matutino') = 'array'
                                          then e.ordem_liberacao -> 'matutino' else '[]'::jsonb end)
    union all
    select jsonb_array_elements_text(case when jsonb_typeof(e.ordem_liberacao -> 'vespertino') = 'array'
                                          then e.ordem_liberacao -> 'vespertino' else '[]'::jsonb end)
  ) r(n)
  join public.escala_anestesista_alias a
    on translate(upper(trim(a.apelido)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
     = translate(upper(trim(regexp_replace(r.n, '\s*\(.*$', ''))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
  where e.status = 'publicada' and e.data between p_desde and p_ate
    and e.hospital <> 'fds'                 -- fila do FDS não conta sozinha
    and r.n !~* '\(\s*consult'              -- "(CONSULT)", "(CONSULT.)", "(CONSULTORIO)", "(CONSULT DOR)"
    and jsonb_typeof(e.ordem_liberacao) in ('object', 'array')
$function$;

revoke execute on function public.escala_adesao_escalados(date, date) from public, anon, authenticated;
grant execute on function public.escala_adesao_escalados(date, date) to service_role;

do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_min date := (select min(data) from public.escala_adesao_dia);
  d date;
begin
  if v_min is null then return; end if;
  for d in select g::date from generate_series(greatest(v_min, v_hoje - 30), v_hoje - 1, interval '1 day') g loop
    perform public.escala_adesao_gravar_dia(d);
  end loop;
  if v_min < v_hoje - 30 then
    update public.escala_adesao_dia a
       set escalado = false
     where a.escalado and a.data < v_hoje - 30
       and not exists (select 1 from public.escala_adesao_escalados(a.data, a.data) e where e.user_id = a.user_id);
  end if;
end $$;
