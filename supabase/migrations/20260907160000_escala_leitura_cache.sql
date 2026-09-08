-- ============================================================================
-- Escala Cirúrgica — cache de 24 h da leitura, por hash da foto (Onda 4, 4.9).
--
-- Reanexar a MESMA foto paga a leitura inteira de novo. Isso não é hipótese: em
-- 17–18/08, com a chave da Anthropic sem crédito, a mesma escala foi reenviada
-- OITO vezes. E o fluxo normal reenvia por desenho — "reler com hint" depois de
-- resolver "de qual hospital é?" manda exatamente a mesma imagem outra vez.
--
-- A chave é sha256(imagem + hint + modo + versão do prompt + vocabulário), então
-- qualquer mudança que altere o resultado esperado gera chave nova: bumpar
-- PROMPT_VERSAO invalida o cache inteiro sozinho, sem precisar limpar nada.
--
-- LGPD — decisão do dono (07/09), dentro das regras da escala:
--   * guarda o JSON JÁ SANITIZADO, o mesmo que a tela recebe: paciente só por
--     INICIAIS, mais procedimento, cirurgião, convênio e anestesista;
--   * NUNCA guarda a imagem;
--   * leitura com `pacienteNome` (nome completo, que só existe em convênio
--     PARTICULAR puro, para a cobrança) NÃO ENTRA NO CACHE. A edge pula a
--     gravação nesse caso — 24 h de nome completo de paciente numa tabela de
--     conveniência não se justifica pelo que economiza;
--   * expira em 24 h, com purga de hora em hora, e a leitura já filtra por
--     `expira_em` (linha vencida nunca é servida, mesmo antes da purga passar).
--
-- ACESSO: RLS ligada, nenhuma policy, grant default revogado. Só `service_role`
-- (a edge) lê e escreve. Mesmo padrão de `escala_leitura_log`.
--
-- Rollback (manual) — ⚠️ DESTRUTIVO:
--   perform cron.unschedule('escala-leitura-cache-purge') from cron.job
--     where jobname = 'escala-leitura-cache-purge';   -- (dentro de um DO $$)
--   drop table if exists public.escala_leitura_cache;
--   drop function if exists public.escala_leitura_cache_purge();
-- ============================================================================

begin;

set local lock_timeout = '3s';

create table if not exists public.escala_leitura_cache (
  chave      text primary key,                 -- sha256(imagem+hint+modo+prompt+vocabulário)
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null default now() + interval '24 hours',
  modo       text not null default 'dia-util',
  prompt_versao text not null default '',
  resposta   jsonb not null,                   -- payload JÁ sanitizado, sem imagem

  constraint escala_leitura_cache_modo check (modo in ('dia-util', 'fds'))
);

comment on table public.escala_leitura_cache is
  'Cache de 24h da leitura da Vision por hash da foto (Onda 4 item 4.9). Guarda o JSON já sanitizado (paciente só por iniciais) e NUNCA a imagem; leitura com pacienteNome não entra. Service-role apenas.';

create index if not exists idx_escala_leitura_cache_expira
  on public.escala_leitura_cache (expira_em);

alter table public.escala_leitura_cache enable row level security;
revoke all on table public.escala_leitura_cache from anon, authenticated;

create or replace function public.escala_leitura_cache_purge()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  n integer;
begin
  delete from public.escala_leitura_cache where expira_em < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.escala_leitura_cache_purge() is
  'Apaga as leituras vencidas do cache da Vision. Agendada de hora em hora em escala-leitura-cache-purge.';

revoke all on function public.escala_leitura_cache_purge() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('escala-leitura-cache-purge')
      from cron.job where jobname = 'escala-leitura-cache-purge';
    -- de hora em hora: a retenção de 24h é a promessa de LGPD, e uma purga
    -- diária deixaria a linha viver até 48h no pior caso
    perform cron.schedule(
      'escala-leitura-cache-purge', '23 * * * *',
      $cron$select public.escala_leitura_cache_purge();$cron$
    );
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';

select to_regclass('public.escala_leitura_cache') is not null                       as tabela,
       (select relrowsecurity from pg_class
         where oid = 'public.escala_leitura_cache'::regclass)                        as rls_on,
       (select count(*) from pg_policies where tablename = 'escala_leitura_cache')   as policies_zero,
       (select count(*) from cron.job where jobname = 'escala-leitura-cache-purge')  as job,
       not has_table_privilege('anon', 'public.escala_leitura_cache', 'select')      as anon_bloqueado;
