-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — "SEU PREENCHIMENTO" na aba Minhas (dono 2026-10-14, modelo A de
-- `.tmp/melhorias-preenchimento.html`).
--
-- Retorno INDIVIDUAL na tela de uso diário (Ivers et al., Cochrane 2025; Brehaut et al.,
-- Ann Intern Med 2016): a % das cirurgias da PRÓPRIA pessoa com início E término nos
-- últimos 7 dias encerrados, ao lado da média dos 5 melhores da equipe (não da média).
--
-- Só devolve o número de QUEM CHAMA + a média dos 5 melhores (sem nomes); o ranking com
-- nomes segue só no relatório de adesão. Cirurgia conta com os mesmos cortes de
-- `pendenciasParaLiberar` / `escala_caso_trava_liberacao`: com procedimento, com login do
-- anestesista, não dupla, não continuação, não suspensa. Hoje fica fora (turno em
-- andamento), e o "passa para a tarde" aberto fica com quem
-- assumiu a continuação. Para entrar nos "5 melhores" a pessoa precisa de 5+ cirurgias na janela.
--
-- Rollback: drop function public.escala_meu_preenchimento(integer);
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
  v_ate   date := (now() at time zone 'America/Sao_Paulo')::date - 1;
  v_desde date;
  v_res   jsonb;
begin
  if v_uid is null or v_uid = ''
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  -- as colunas inicio_real/termino_real nasceram em 02/10: antes disso ninguém tinha como preencher
  v_desde := greatest(v_ate - (v_dias - 1), date '2026-10-02');

  with casos as (
    select c.anestesista_user_id as uid,
           (c.inicio_real is not null and c.termino_real is not null) as ok
      from public.escala_cirurgica_caso c
      join public.escala_cirurgica e on e.id = c.escala_id
     where e.data between v_desde and v_ate
       and e.hospital <> 'fds'
       and e.status = 'publicada'
       and c.anestesista_user_id is not null
       and btrim(coalesce(c.procedimento, '')) <> ''
       and coalesce(c.anestesista, '') not like '%+%'
       and not coalesce(c.sem_anestesista, false)
       and not coalesce(c.is_continuacao, false)
       and coalesce(c.status_cirurgia, 'agendada') <> 'suspensa'
       and coalesce(c.status_extra, '') <> 'suspensa'
       -- "passa para a tarde" ainda aberto é de quem ficou com a continuação (como na trava)
       and not (coalesce(c.status_extra, '') = 'passa_tarde' and coalesce(c.status_cirurgia, 'agendada') <> 'terminada')
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

select position('top_n' in pg_get_functiondef('public.escala_meu_preenchimento(integer)'::regprocedure)) > 0 as funcao_criada;
