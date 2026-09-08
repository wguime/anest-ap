-- ============================================================================
-- Escala Cirúrgica — uma linha por leitura da Vision (Onda 4, item 4.1).
--
-- A auditoria de 02/09 fechou com esta frase: "não há como medir taxa de erro
-- por leitura". A edge `parse-escala-cirurgica` roda desde 01/07 e nunca gravou
-- tokens, latência, `stop_reason`, modelo, versão do prompt nem as dimensões da
-- foto. Sem esse número, toda mudança na leitura (prompt, schema, cache, troca
-- de modelo) é palpite: não existe ANTES para comparar com o DEPOIS. E a
-- hipótese mais forte para os erros — 70% das fotos chegam recomprimidas a
-- 1280px pelo WhatsApp, com a letra do rodapé em 8–10px — não podia ser
-- confirmada nem refutada.
--
-- LGPD: esta tabela NÃO guarda dado de paciente. Nem iniciais, nem
-- procedimento, nem nome de anestesista — só contagens, tokens, tempos, o mime
-- e as dimensões da imagem, e o hash dela. O `uid` é o mesmo que a função já
-- registra hoje em `console.log` e responde "quem mandou esta foto" na trilha
-- de auditoria. Retenção de 180 dias (purga abaixo): é telemetria operacional,
-- não prontuário.
--
-- ACESSO: RLS ligada e NENHUMA policy, de propósito. Ninguém lê pelo app —
-- `service_role` (a edge) escreve e a Management API (scripts de diagnóstico do
-- dono) lê. Toda policy que existisse aqui abriria telemetria de uso para o
-- grupo sem necessidade nenhuma.
--
-- Rollback (manual) — ⚠️ DESTRUTIVO: leva junto toda a telemetria acumulada.
--   perform cron.unschedule('escala-leitura-log-purge') from cron.job
--     where jobname = 'escala-leitura-log-purge';   -- (dentro de um DO $$)
--   drop table if exists public.escala_leitura_log;
--   drop function if exists public.escala_leitura_log_purge();
-- Nenhuma tabela existente é tocada: só criação.
--
-- ORDEM: esta migration ANTES do deploy da edge. Na ordem inversa cada leitura
-- loga PGRST205 no console e a telemetria some sem sintoma visível — o insert é
-- fire-and-forget e a leitura da escala não quebra por causa dele.
-- ============================================================================

begin;

set local lock_timeout = '3s';

create table if not exists public.escala_leitura_log (
  id                 uuid primary key default gen_random_uuid(),
  criado_em          timestamptz not null default now(),

  -- quem pediu (Firebase uid) e em que fluxo
  uid                text not null default '',
  modo               text not null default 'dia-util',   -- dia-util | fds
  origem             text not null default 'modelo',     -- modelo | cache

  -- o que foi mandado
  hospital_hint      text not null default '',           -- '' = o lote descobre
  imagem_hash        text not null default '',           -- sha256 do base64
  imagem_mime        text not null default '',
  imagem_largura     integer,
  imagem_altura      integer,
  imagem_bytes       integer not null default 0,

  -- com o quê
  modelo             text not null default '',
  prompt_versao      text not null default '',

  -- o que voltou
  hospital_detectado text not null default '',
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cache_write_tokens integer not null default 0,
  stop_reason        text not null default '',
  latencia_ms        integer not null default 0,
  casos              integer not null default 0,
  rodape             integer not null default 0,
  ajuda              integer not null default 0,
  -- quantas vezes cada normalização determinística precisou agir (item 4.2):
  -- {"iniciais": 2, "hora": 1, "sala": 3} — é o placar de quanto o modelo erra
  -- de FORMA, separado de quanto erra de CONTEÚDO
  normalizacoes      jsonb  not null default '{}'::jsonb,
  erro               text not null default '',

  -- `erro` é a única porta por onde texto vindo do modelo poderia entrar num
  -- call site futuro. Hoje quem barra é o JS (`montarLinhaLog` trunca em 200 e
  -- copia de uma lista fechada); com a tabela ainda vazia, o CHECK custa zero e
  -- passa a barrar no servidor também.
  constraint escala_leitura_log_erro_curto check (char_length(erro) <= 200),
  constraint escala_leitura_log_modo   check (modo in ('dia-util', 'fds')),
  constraint escala_leitura_log_origem check (origem in ('modelo', 'cache'))
);

comment on table public.escala_leitura_log is
  'Telemetria por leitura da Vision da escala (Onda 4 item 4.1). SEM dado de paciente. Escrita pela edge parse-escala-cirurgica com service-role; leitura só pela Management API.';

create index if not exists idx_escala_leitura_log_criado
  on public.escala_leitura_log (criado_em desc);
create index if not exists idx_escala_leitura_log_hash
  on public.escala_leitura_log (imagem_hash);

-- Deny-all para anon/authenticated: nenhuma policy, RLS ligada. `service_role`
-- ignora RLS por definição — é a edge, e é a única que escreve.
alter table public.escala_leitura_log enable row level security;

-- O grant DEFAULT do Supabase dá select/insert/update/delete a anon e
-- authenticated em toda tabela nova de `public`; hoje só a RLS segura. Uma
-- policy `using (true)` bem-intencionada, ou um `disable row level security`
-- num troubleshooting, abriria a telemetria de uso do grupo sem passar por
-- revisão. Mesmo remédio de `documento_api_rate_limit` e de
-- `cirurgias_particulares_verificacao`. `service_role` não é afetado.
revoke all on table public.escala_leitura_log from anon, authenticated;

-- Retenção: 180 dias bastam para comparar duas edições do prompt e uma troca de
-- modelo. Idempotente e barata (índice em criado_em).
create or replace function public.escala_leitura_log_purge()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  n integer;
begin
  delete from public.escala_leitura_log where criado_em < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.escala_leitura_log_purge() is
  'Retenção de 180 dias da telemetria de leitura da Vision. Agendada em escala-leitura-log-purge (domingo 01:17 BRT).';

revoke all on function public.escala_leitura_log_purge() from public, anon, authenticated;

-- Agenda só se o pg_cron existir (o projeto usa; o guard mantém a migration
-- aplicável num banco sem a extensão). O `from cron.job where` protege a
-- PRIMEIRA aplicação: `cron.unschedule` de nome inexistente levanta exceção.
-- Na segunda, `cron.schedule` faz upsert por (jobname, username) e não duplica.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('escala-leitura-log-purge')
      from cron.job where jobname = 'escala-leitura-log-purge';
    -- 04:17 UTC domingo = 01:17 BRT (o app roda em America/Sao_Paulo)
    perform cron.schedule(
      'escala-leitura-log-purge', '17 4 * * 0',
      $cron$select public.escala_leitura_log_purge();$cron$
    );
  end if;
end;
$$;

commit;

-- O PostgREST precisa enxergar a tabela nova para o insert da edge funcionar.
-- Aqui isso importa mais que o normal: o writer é fire-and-forget e só faz
-- `console.error` — sem o reload, a telemetria ficaria zerada em silêncio, que
-- é exatamente o que esta tabela existe para acabar.
notify pgrst, 'reload schema';

-- Conferência (o applier imprime só o último statement; o job é invisível)
select to_regclass('public.escala_leitura_log') is not null                        as tabela,
       (select relrowsecurity from pg_class
         where oid = 'public.escala_leitura_log'::regclass)                         as rls_on,
       (select count(*) from pg_policies where tablename = 'escala_leitura_log')    as policies_zero,
       (select count(*) from cron.job where jobname = 'escala-leitura-log-purge')   as job,
       not has_table_privilege('anon', 'public.escala_leitura_log', 'select')       as anon_bloqueado;
