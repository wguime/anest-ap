-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — "SEU PREENCHIMENTO" CONTA A PARTIR DE 27/10, A DATA DA CAIXA (dono 2026-10-29).
--
-- Humberto, 29/10: "apesar de preencherem de forma adequada o percentual está diminuindo".
-- A porcentagem olhava os 6 dias encerrados desde 05/10, mas a caixa "Cirurgias sem horário"
-- só lista as de 27/10 em diante (CORTE_PENDENCIAS_MINHAS, dono 27/10). As faltas de 23 a
-- 26/10 pesavam no número sem aparecer na caixa — 50 cirurgias de 24 pessoas, que ninguém
-- conseguia preencher. O Humberto zeraria a caixa e ficaria em 85%, contra a regra de 28/10
-- ("100% só com a caixa vazia"). O dono escolheu contar a partir de 27/10; em 03/11 a janela
-- já cabe inteira depois do corte e o corte deixa de agir.
--
-- Só muda o início da janela de `escala_meu_preenchimento`; o relatório de adesão e a conta
-- única (`escala_horario_conta`) seguem como estão.
-- Rollback: scripts/rollback-20261029120000-preenchimento-desde-corte-caixa.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.escala_meu_preenchimento(p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid   text := public.firebase_uid();
  v_dias  integer := least(greatest(coalesce(p_dias, 7), 1), 30);
  -- dias operacionais encerrados (vira às 07:00, como a tela e o relatório); hoje a tela soma
  v_ate   date := ((now() at time zone 'America/Sao_Paulo') - interval '7 hours')::date - 1;
  v_desde date;
  v_res   jsonb;
begin
  if v_uid is null or v_uid = ''
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  -- a caixa da aba Minhas começa em 27/10 (CORTE_PENDENCIAS_MINHAS): o que ela não mostra não conta
  v_desde := greatest(v_ate - (v_dias - 1), date '2026-10-27');

  with conta as (
    select * from public.escala_horario_conta(v_desde, v_ate)
  ),
  -- dicionário apelido → login na chave da tela (normApelido: sem acento, sem "PED", em
  -- maiúsculas); o apelido que normaliza igual para dois logins não resolve ninguém
  apelidos as (
    select regexp_replace(k, '^PED ', '') as chave, min(coalesce(p.conta_duplicada_de, a.user_id)) as uid
      from public.escala_anestesista_alias a
      left join public.profiles p on p.id = a.user_id
      cross join lateral unnest(public.escala_pessoas_caso(a.apelido)) as k
     group by 1
    having count(distinct coalesce(p.conta_duplicada_de, a.user_id)) = 1
  ),
  -- quem responde por cada cirurgia: o login gravado no caso; sem ele (a dupla "A + B"),
  -- cada nome pelo dicionário (aba Minhas: anestesistaDoCasoEh)
  casos as (
    select c.anestesista_user_id as uid, c.falta is null as ok
      from conta c
     where c.anestesista_user_id is not null
    union all
    select distinct on (c.id, ap.uid) ap.uid, c.falta is null
      from conta c
      cross join lateral unnest(public.escala_pessoas_caso(c.anestesista)) as n
      join apelidos ap on ap.chave = regexp_replace(n, '^PED ', '')
     where c.anestesista_user_id is null
  ), por_pessoa as (
    select uid, count(*) as n, count(*) filter (where ok) as completos,
           100.0 * count(*) filter (where ok) / count(*) as pct
      from casos group by uid
  ), top as (
    -- mesmas exclusões do relatório de adesão (conta de teste, duplicada, Iara)
    select pp.pct from por_pessoa pp
      join public.profiles p on p.id = pp.uid
     where pp.n >= 5 and p.active
       and coalesce(p.email, '') not like '%+e2e%'
       and p.conta_duplicada_de is null
       and p.id <> '567JGBfHyfQB9RG2jESJFQtwcQ23'
     order by pp.pct desc limit 5
  )
  select jsonb_build_object(
    'desde', v_desde,
    'ate', v_ate,
    'casos', coalesce((select n from por_pessoa where uid = v_uid), 0),
    'completos', coalesce((select completos from por_pessoa where uid = v_uid), 0),
    'pct', (select round(pct, 1) from por_pessoa where uid = v_uid),
    -- com menos de 3 no topo a "média dos melhores" seria o número de uma pessoa só
    'top', (select case when count(*) >= 3 then round(avg(pct), 1) end from top),
    'top_n', (select count(*) from top)
  ) into v_res;
  return v_res;
end;
$$;

revoke execute on function public.escala_meu_preenchimento(integer) from public, anon;
grant execute on function public.escala_meu_preenchimento(integer) to authenticated, service_role;

commit;

-- conferência: a janela começa no corte da caixa
select position('date ''2026-10-27''' in pg_get_functiondef('public.escala_meu_preenchimento'::regproc)) > 0 as desde_corte,
       has_function_privilege('anon', 'public.escala_meu_preenchimento(integer)', 'execute') as anon;
