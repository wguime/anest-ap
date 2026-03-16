-- ==========================================================================
-- 001_schema.sql — Schema completo para Gestão Documental Qmentum
-- Tabelas: documentos, documento_versoes, documento_changelog,
--          documento_aprovacoes, documento_distribuicao, admin_users
-- Views:   vw_compliance_por_categoria, vw_documentos_revisao_vencida
-- RPCs:    rpc_compliance_score_qmentum, rpc_search_documentos,
--          rpc_log_document_action
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Tabela principal: documentos
-- ──────────────────────────────────────────────

create table public.documentos (
  id            text primary key,
  codigo        text not null,
  titulo        text not null,
  descricao     text default '',
  tipo          text not null,
  categoria     text not null
    check (categoria in ('etica','comites','auditorias','relatorios','biblioteca','financeiro')),
  subcategoria  text,
  status        text not null default 'rascunho'
    check (status in ('rascunho','pendente','ativo','arquivado','rejeitado','revisao_pendente')),
  versao_atual  integer not null default 1,

  -- Responsáveis
  setor_id          text,
  setor_nome        text,
  responsavel       text,
  responsavel_revisao text,

  -- Arquivo
  arquivo_url       text,
  arquivo_nome      text,
  arquivo_tamanho   bigint,
  storage_path      text,

  -- Qmentum compliance
  proxima_revisao        timestamptz,
  intervalo_revisao_dias integer default 365,
  rop_area               text,
  qmentum_weight         numeric(3,1),
  approval_workflow      jsonb default '{"requiredApprovers":[],"currentStep":0,"status":"pending"}',

  -- Metadados
  tags           text[] default '{}',
  observacoes    text,
  view_count     integer default 0,
  download_count integer default 0,

  -- Autoria (Firebase UIDs)
  created_by       text not null,
  created_by_name  text not null,
  created_by_email text,
  updated_by       text,
  updated_by_name  text,

  -- Timestamps
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- FTS em português (mantido via trigger)
  fts tsvector
);

-- Índices
create index idx_doc_categoria on documentos(categoria);
create index idx_doc_status on documentos(status);
create index idx_doc_cat_status on documentos(categoria, status);
create index idx_doc_revisao on documentos(proxima_revisao) where status = 'ativo';
create index idx_doc_fts on documentos using gin(fts);
create index idx_doc_tags on documentos using gin(tags);
create index idx_doc_codigo on documentos(codigo);

-- Trigger auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_doc_updated_at before update on documentos
  for each row execute function update_updated_at();

-- Trigger para manter FTS atualizado (to_tsvector não é immutable, não pode ser GENERATED)
create or replace function update_documentos_fts()
returns trigger as $$
begin
  new.fts :=
    setweight(to_tsvector('portuguese', coalesce(new.titulo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.codigo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.descricao, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(new.tags, ' '), '')), 'C');
  return new;
end;
$$ language plpgsql;

create trigger tr_doc_fts before insert or update on documentos
  for each row execute function update_documentos_fts();


-- ──────────────────────────────────────────────
-- 2. Tabela: documento_versoes
-- ──────────────────────────────────────────────

create table public.documento_versoes (
  id                  uuid primary key default gen_random_uuid(),
  documento_id        text not null references documentos(id) on delete cascade,
  versao              integer not null,
  arquivo_url         text,
  arquivo_nome        text,
  arquivo_tamanho     bigint,
  storage_path        text,
  descricao_alteracao text default 'Versão inicial',
  motivo_alteracao    text default 'Criação do documento',
  status              text not null default 'ativo'
    check (status in ('ativo', 'arquivado', 'historico')),
  aprovado_por        text,
  data_aprovacao      timestamptz,
  created_by          text not null,
  created_by_name     text not null,
  created_at          timestamptz not null default now(),
  unique (documento_id, versao)
);

create index idx_ver_doc on documento_versoes(documento_id);


-- ──────────────────────────────────────────────
-- 3. Tabela: documento_changelog (audit trail)
-- ──────────────────────────────────────────────

create table public.documento_changelog (
  id            uuid primary key default gen_random_uuid(),
  documento_id  text not null references documentos(id) on delete cascade,
  action        text not null check (action in (
    'created','status_changed','updated','version_added',
    'approved','rejected','archived','restored','deleted',
    'viewed','downloaded','acknowledged','review_scheduled',
    'signature_added','comment_added'
  )),
  user_id       text not null,
  user_name     text not null,
  user_email    text,
  changes       jsonb default '{}',
  comment       text default '',
  created_at    timestamptz not null default now()
);

create index idx_cl_doc on documento_changelog(documento_id);
create index idx_cl_action on documento_changelog(action);
create index idx_cl_created on documento_changelog(created_at desc);
create index idx_cl_doc_created on documento_changelog(documento_id, created_at desc);


-- ──────────────────────────────────────────────
-- 4. Tabela: documento_aprovacoes
-- ──────────────────────────────────────────────

create table public.documento_aprovacoes (
  id             uuid primary key default gen_random_uuid(),
  documento_id   text not null references documentos(id) on delete cascade,
  versao         integer,
  step_order     integer not null default 0,
  approver_id    text not null,
  approver_name  text not null,
  approver_role  text,
  action         text not null default 'pending'
    check (action in ('pending', 'approved', 'rejected', 'signed')),
  comment        text default '',
  decided_at     timestamptz,
  signature_hash text,
  created_at     timestamptz not null default now()
);

create index idx_aprov_doc on documento_aprovacoes(documento_id);
create index idx_aprov_pending on documento_aprovacoes(action) where action = 'pending';


-- ──────────────────────────────────────────────
-- 5. Tabela: documento_distribuicao
-- ──────────────────────────────────────────────

create table public.documento_distribuicao (
  id              uuid primary key default gen_random_uuid(),
  documento_id    text not null references documentos(id) on delete cascade,
  user_id         text not null,
  user_name       text not null,
  user_role       text,
  distribuido_em  timestamptz not null default now(),
  visualizado_em  timestamptz,
  reconhecido_em  timestamptz,
  notificado_em   timestamptz,
  lembrete_em     timestamptz,
  unique (documento_id, user_id)
);

create index idx_dist_doc on documento_distribuicao(documento_id);
create index idx_dist_user on documento_distribuicao(user_id);
create index idx_dist_pending on documento_distribuicao(documento_id) where reconhecido_em is null;


-- ──────────────────────────────────────────────
-- 6. Tabela auxiliar: admin_users (para RLS)
-- ──────────────────────────────────────────────

create table public.admin_users (
  firebase_uid text primary key,
  email        text not null,
  role         text not null default 'admin',
  created_at   timestamptz default now()
);

-- Seed dos admins (UIDs reais do Firebase Auth)
insert into admin_users (firebase_uid, email) values
  ('pPdKZ75E9zNdPnLz50qisPiHfJw1', 'wguime@yahoo.com.br'),
  ('oluXLzNwosZuAnNOMzMjWLQF35B2', 'anestesistaguilherme@gmail.com');


-- ──────────────────────────────────────────────
-- 7. Views para Dashboard de Compliance
-- ──────────────────────────────────────────────

-- Compliance por categoria
create or replace view vw_compliance_por_categoria as
select
  categoria,
  count(*) as total,
  count(*) filter (where status = 'ativo') as ativos,
  count(*) filter (where status = 'pendente') as pendentes,
  count(*) filter (where status = 'ativo' and proxima_revisao < now()) as revisoes_vencidas,
  count(*) filter (where status = 'ativo'
    and proxima_revisao between now() and now() + interval '30 days') as revisoes_proximas,
  greatest(0, least(100,
    100
    - (count(*) filter (where status='ativo' and proxima_revisao < now()) * 10)
    - (count(*) filter (where status='pendente') * 5)
  )) as score
from documentos
group by categoria;

-- Documentos com revisão vencida
create or replace view vw_documentos_revisao_vencida as
select d.*, extract(day from now() - d.proxima_revisao) as dias_vencido
from documentos d
where d.status = 'ativo' and d.proxima_revisao < now()
order by d.proxima_revisao asc;


-- ──────────────────────────────────────────────
-- 8. Funções RPC
-- ──────────────────────────────────────────────

-- Score Qmentum ponderado
create or replace function rpc_compliance_score_qmentum()
returns json as $$
  select json_build_object(
    'score', coalesce(round(
      sum(cat_score * weight) / nullif(sum(weight), 0)
    ), 100),
    'categories', coalesce(json_agg(json_build_object(
      'categoria', categoria, 'score', cat_score,
      'weight', weight, 'total', total,
      'ativos', ativos, 'vencidos', overdue, 'pendentes', pending
    )), '[]'::json)
  )
  from (
    select categoria,
      count(*) as total,
      count(*) filter (where status='ativo') as ativos,
      count(*) filter (where status='ativo' and proxima_revisao < now()) as overdue,
      count(*) filter (where status='pendente') as pending,
      case categoria
        when 'auditorias' then 1.5 when 'etica' then 1.2
        when 'comites' then 1.0 when 'biblioteca' then 1.0
        when 'relatorios' then 0.8 when 'financeiro' then 0.8 else 1.0
      end as weight,
      greatest(0, least(100,
        100 - (count(*) filter (where status='ativo' and proxima_revisao < now()) * 10)
            - (count(*) filter (where status='pendente') * 5)
      )) as cat_score
    from documentos group by categoria
  ) sub;
$$ language sql stable security definer;

-- Busca full-text em português
create or replace function rpc_search_documentos(
  search_query text,
  filter_categoria text default null,
  filter_status text default null,
  result_limit integer default 50
) returns setof documentos as $$
  select d.* from documentos d
  where (filter_categoria is null or d.categoria = filter_categoria)
    and (filter_status is null or d.status = filter_status)
    and (d.fts @@ plainto_tsquery('portuguese', search_query)
      or d.titulo ilike '%' || search_query || '%'
      or d.codigo ilike '%' || search_query || '%')
  order by ts_rank(d.fts, plainto_tsquery('portuguese', search_query)) desc,
    d.updated_at desc
  limit result_limit;
$$ language sql stable security definer;

-- Registrar ação no changelog (atomicamente)
create or replace function rpc_log_document_action(
  p_documento_id text,
  p_action text,
  p_user_id text,
  p_user_name text,
  p_user_email text default null,
  p_changes jsonb default '{}',
  p_comment text default ''
) returns uuid as $$
declare log_id uuid;
begin
  insert into documento_changelog
    (documento_id, action, user_id, user_name, user_email, changes, comment)
  values (p_documento_id, p_action, p_user_id, p_user_name, p_user_email, p_changes, p_comment)
  returning id into log_id;
  return log_id;
end;
$$ language plpgsql security definer;
