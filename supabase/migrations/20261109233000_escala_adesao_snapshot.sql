-- Relatório de adesão: CÓPIA PRONTA no servidor (dono 09/11/2026: "relatórios de adesão podem
-- ser estruturados de uma maneira que não consuma tantos dados"). NÃO APLICADA: aguarda o dono.
--
-- Como era: `escala_adesao_relatorio(30|60)` recalcula tudo a cada chamada — 192 chamadas/dia de 51
-- pessoas (card da Home com cache de 30 min POR APARELHO + 2 chamadas a cada abertura da página),
-- mediana 2,4 s, máximo 10,2 s, 1 cancelada por timeout em 09/11; 3,7 % de todo o tempo de banco
-- desde fevereiro. O resultado é IGUAL para todo mundo (a função não depende de quem chama).
--
-- Como fica (dono: "o banco calcula uma vez ao final de cada turno"): o cálculo vira
-- `escala_adesao_relatorio_calc` (interno), um cron grava o resultado das duas janelas em
-- `escala_adesao_snapshot` ao FIM DE CADA TURNO — 7h10 (fim da noite), 13h10 (fim da manhã) e
-- 19h10 (fim da tarde), hora de Brasília — e `escala_adesao_relatorio` — mesmo nome, mesmo JSON, o
-- app não muda — devolve a linha gravada. São 6 cálculos por dia, fixos, em vez de ~190; a leitura
-- passa a ser 1 linha por chave primária.
--
-- O número na tela é o do fim do último turno. O dia de hoje entra na conta à noite, quando a escala
-- de amanhã é publicada (`escala_adesao_ultimo_dia`): com a cópia por turno isso aparece às 7h10 do
-- dia seguinte. Cópia com mais de 14 h (cron parado: o maior intervalo normal é 12 h, das 19h às 7h)
-- ou janela fora de 30/60 → calcula na hora, como antes: nunca devolve velho sem limite.
--
-- ⚠️ A PARTIR DAQUI, mudança na conta do relatório ao vivo é em `escala_adesao_relatorio_calc`.
-- `create or replace function public.escala_adesao_relatorio` com o corpo antigo apagaria a cópia
-- pronta (mesma classe do gate de publicação perdido em 23/09).
--
-- O corpo do cálculo é CLONADO da definição que está no banco (não recopiado à mão): troca o nome e
-- tira o bloco de acesso; aborta se não achar exatamente o esperado. Idempotente: com o `_calc` já
-- criado, o clone é pulado.
--
-- Rollback: scripts/rollback-20261109233000-adesao-snapshot.sql

begin;

-- teto: a 1ª cópia (30 e 60 dias) é calculada aqui dentro; cálculo lento desfaz tudo em vez de
-- esbarrar no tempo limite da API com a transação aberta
set local lock_timeout = '3s';
set local statement_timeout = '60s';

create table if not exists public.escala_adesao_snapshot (
  dias       integer primary key check (dias in (30, 60)),
  dados      jsonb not null,
  gerado_em  timestamptz not null default now()
);
comment on table public.escala_adesao_snapshot is
  'Cópia pronta do relatório de adesão (30 e 60 dias), regravada pelo cron escala-adesao-snapshot. Leitura só pela função escala_adesao_relatorio.';
alter table public.escala_adesao_snapshot enable row level security;
revoke all on table public.escala_adesao_snapshot from public, anon, authenticated;

-- ── 1. o cálculo vira função interna ─────────────────────────────────────────
do $mig$
declare
  v_def text;
  v_novo text;
begin
  if to_regprocedure('public.escala_adesao_relatorio_calc(integer)') is not null then
    raise notice 'escala_adesao_relatorio_calc já existe — clone pulado';
    return;
  end if;

  select pg_get_functiondef(p.oid) into strict v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'escala_adesao_relatorio';

  if position('escala_adesao_snapshot' in v_def) > 0 then
    raise exception 'escala_adesao_relatorio já lê a cópia pronta e o _calc não existe — estado inesperado';
  end if;
  if (length(v_def) - length(replace(v_def, '''acesso negado''', ''))) / length('''acesso negado''') <> 1 then
    raise exception 'bloco de acesso não encontrado exatamente uma vez em escala_adesao_relatorio';
  end if;

  v_novo := replace(v_def, 'FUNCTION public.escala_adesao_relatorio(', 'FUNCTION public.escala_adesao_relatorio_calc(');
  -- o bloco de acesso sai: o _calc só é chamado pelo cron e pela função pública, que confere
  v_novo := regexp_replace(v_novo, 'if public\.firebase_uid\(\) is null.*?end if;', '');

  if position('escala_adesao_relatorio_calc(' in v_novo) = 0 or position('acesso negado' in v_novo) > 0 then
    raise exception 'clone de escala_adesao_relatorio não saiu como esperado';
  end if;
  execute v_novo;
end
$mig$;

revoke all on function public.escala_adesao_relatorio_calc(integer) from public, anon, authenticated;

-- ── 2. quem grava a cópia ────────────────────────────────────────────────────
create or replace function public.escala_adesao_snapshot_atualizar()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  d integer;
begin
  foreach d in array array[30, 60] loop
    insert into public.escala_adesao_snapshot (dias, dados, gerado_em)
    values (d, public.escala_adesao_relatorio_calc(d), now())
    on conflict (dias) do update set dados = excluded.dados, gerado_em = excluded.gerado_em;
  end loop;
end;
$function$;
revoke all on function public.escala_adesao_snapshot_atualizar() from public, anon, authenticated;

-- ── 3. a função que o app chama: mesmo nome, mesmo JSON ──────────────────────
create or replace function public.escala_adesao_relatorio(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 30), 7), 90);
  v_dados jsonb;
begin
  -- Qualquer usuário ATIVO logado (decisão do dono: todos veem tudo) — igual ao original.
  if public.firebase_uid() is null
     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select s.dados into v_dados
    from public.escala_adesao_snapshot s
   where s.dias = v_dias and s.gerado_em > now() - interval '14 hours';
  if v_dados is not null then
    return v_dados;
  end if;
  -- sem cópia recente (cron parado, 1ª chamada, janela fora de 30/60): calcula na hora
  return public.escala_adesao_relatorio_calc(v_dias);
end;
$function$;

-- ── 4. cron: ao fim de cada turno — 7h10, 13h10 e 19h10 de Brasília (10h, 16h e 22h UTC) ──
-- Aos 10 min: os horários de término do turno que acabou de fechar já foram marcados.
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'escala-adesao-snapshot';
    perform cron.schedule(
      'escala-adesao-snapshot', '10 10,16,22 * * *',
      $job$select public.escala_adesao_snapshot_atualizar();$job$
    );
  else
    raise warning 'pg_cron ausente: a cópia pronta não será regravada (a função calcula na hora)';
  end if;
end
$cron$;

-- 1ª cópia já na aplicação
select public.escala_adesao_snapshot_atualizar();

commit;

-- Conferência (a Management API não devolve raise notice): 2 linhas, geradas agora, e o cron ativo.
select s.dias, s.gerado_em, pg_column_size(s.dados) as bytes,
       (select active from cron.job where jobname = 'escala-adesao-snapshot') as cron_ativo
  from public.escala_adesao_snapshot s order by s.dias;
