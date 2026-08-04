-- ════════════════════════════════════════════════════════════════════════
-- 20260804120000_ferias_movimentacoes.sql
-- Extrato de Férias — MARCAÇÃO SELF-SERVICE (decisão do dono 2026-08-04).
--
-- Até aqui o módulo só LIA o Pega Plantão. Agora o app é AUTOR: cada sócio
-- do allowlist marca/desmarca as PRÓPRIAS férias, e cada movimentação vira
-- uma linha append-only aqui (gestão de escalas + auditoria). O extrato
-- passa a ler "registros efetivos" = registros do PP + movimentações
-- (src/lib/feriasMovimentacoes.js), então nada no downstream muda.
--
-- Ganho colateral: com timestamp REAL de cada marcação, as regras de PRAZO
-- do REGRAS ESCALAS.pdf (1 mês / 3 meses) passam a ser verificáveis — a API
-- do PP nunca expôs quando a marcação foi feita.
--
-- Prazos são checados no SERVIDOR (relógio do device é manipulável):
--   marcar    → só data FUTURA (dia corrente já está em escala publicada)
--   desmarcar → só a partir de depois de amanhã ("férias marcadas não podem
--               ser desmarcadas após a escala do dia sair à noite", pág. 5)
--
-- Append-only: sem UPDATE/DELETE. Desfazer = nova linha com a ação oposta.
-- Idempotente: create or replace / if not exists / drop policy if exists.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Nome do sócio (chave do Pega Plantão) a partir do e-mail do usuário
-- corrente. ESPELHA EMAIL_TO_SOCIO em src/pages/ferias/gate.js — mudar um
-- exige mudar o outro (o dono tem 2 contas apontando p/ o mesmo sócio).
create or replace function public.ferias_nome_socio()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case lower(trim(coalesce(p.email, '')))
    when 'wguime@yahoo.com.br'             then 'G. MELO'
    when 'anestesista.guilherme@gmail.com' then 'G. MELO'
    when 'guollofernanda@gmail.com'        then 'FERNANDA GUOLLO'
    when 'leandrobernardes03@hotmail.com'  then 'LEANDRO BERNARDES'
    else null
  end
  from public.profiles p
  where p.id = public.firebase_uid()
    and p.active is not false
$$;

revoke execute on function public.ferias_nome_socio() from public, anon;
grant execute on function public.ferias_nome_socio() to authenticated, service_role;

comment on function public.ferias_nome_socio() is
  'Nome do sócio no Pega Plantão (ex. G. MELO) do usuário corrente, pelo e-mail. Espelha EMAIL_TO_SOCIO de src/pages/ferias/gate.js; usado no WITH CHECK de ferias_movimentacoes para garantir que ninguém marque férias em nome de outro.';

create table if not exists public.ferias_movimentacoes (
  id             uuid primary key default gen_random_uuid(),
  ano            integer not null,
  nome           text not null,            -- chave do sócio no Pega Plantão
  data           date not null,            -- dia de férias marcado/desmarcado
  acao           text not null check (acao in ('marcar', 'desmarcar')),
  origem_dia     text not null check (origem_dia in ('app', 'pegaplantao')),
  codigo_pp      text,                     -- CodigoPlantao anulado (só desmarcar de dia do PP)
  -- custo declarado da 7ª vaga (3 dias, REGRAS pág. 3). Só é lido quando
  -- acao='marcar'; desmarcar grava 0.
  custo_dias     integer not null default 1 check (custo_dias in (0, 1, 3)),
  avisos_aceitos jsonb,                    -- warnings confirmados pelo usuário (auditoria)
  user_id        text not null,            -- firebase uid REAL do autor
  -- Idempotência do LOTE: uuid gerado no client por confirmação. Duplo toque,
  -- retry de rede ou re-submit após timeout que já commitou colidem no índice
  -- único em vez de duplicar o log (a PK é surrogate e não protege disso).
  req_id         text not null,
  criado_em      timestamptz not null default now(),

  -- ano sempre coerente com a data (evita movimentação órfã na virada).
  -- make_date em vez de extract: imutabilidade óbvia, sem depender de overload.
  constraint ferias_mov_ano_coerente
    check (data >= make_date(ano, 1, 1) and data < make_date(ano + 1, 1, 1)),
  -- marcar só existe com origem app (marcação no PP nasce lá, não aqui)
  constraint ferias_mov_marcar_eh_app
    check (acao = 'desmarcar' or origem_dia = 'app'),
  -- codigo_pp presente EXATAMENTE quando se desmarca um dia vindo do PP
  constraint ferias_mov_codigo_pp_coerente
    check ((codigo_pp is not null) = (acao = 'desmarcar' and origem_dia = 'pegaplantao')),
  constraint ferias_mov_codigo_pp_nao_vazio
    check (codigo_pp is null or length(btrim(codigo_pp)) > 0),
  constraint ferias_mov_req_id_nao_vazio
    check (length(btrim(req_id)) > 0)
);

comment on table public.ferias_movimentacoes is
  'Log append-only de marcações/desmarcações de férias feitas no app (Extrato de Férias). Replay cronológico sobre os registros do Pega Plantão produz os dias efetivos — LAST-WINS por (nome, data): o estado nunca vem da soma do log, e custo_dias só é lido em acao=marcar. Sem UPDATE/DELETE: desfazer = nova linha com a ação oposta. req_id (uuid do lote) + índice único tornam a confirmação retry-safe.';

create index if not exists idx_ferias_mov_ano_nome_data
  on public.ferias_movimentacoes (ano, nome, data, criado_em);
create index if not exists idx_ferias_mov_ano_criado
  on public.ferias_movimentacoes (ano, criado_em desc);
-- Idempotência: o mesmo (lote, dia, ação) só entra uma vez
create unique index if not exists uniq_ferias_mov_req
  on public.ferias_movimentacoes (req_id, data, acao);

alter table public.ferias_movimentacoes enable row level security;
alter table public.ferias_movimentacoes force row level security;

-- Leitura: todo o público do extrato (gestão de escalas vê o log inteiro)
drop policy if exists ferias_movimentacoes_select on public.ferias_movimentacoes;
create policy ferias_movimentacoes_select
  on public.ferias_movimentacoes
  for select
  to authenticated
  using ((select public.can_access_extrato_ferias()));

-- Escrita: self-service (só as próprias férias) + prazos no relógio do servidor
drop policy if exists ferias_movimentacoes_insert on public.ferias_movimentacoes;
create policy ferias_movimentacoes_insert
  on public.ferias_movimentacoes
  for insert
  to authenticated
  with check (
    (select public.can_access_extrato_ferias())
    and user_id = public.firebase_uid()
    and nome = (select public.ferias_nome_socio())
    and (
      (acao = 'marcar'
        and data > (now() at time zone 'America/Sao_Paulo')::date)
      or
      (acao = 'desmarcar'
        and data > ((now() at time zone 'America/Sao_Paulo')::date + 1))
    )
  );

-- Append-only: revoke all antes do grant mínimo (defaults do Supabase dão ALL)
revoke all on public.ferias_movimentacoes from authenticated;
revoke all on public.ferias_movimentacoes from anon;
grant select, insert on public.ferias_movimentacoes to authenticated;
grant all on public.ferias_movimentacoes to service_role;

COMMIT;
