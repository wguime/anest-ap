-- ==========================================================================
-- 005_incidents.sql — Tabela de Incidentes e Denuncias
-- Suporta: formulario publico (anon), app autenticado, rastreamento anonimo
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Tabela: incidentes
-- ──────────────────────────────────────────────

create table public.incidentes (
  id               uuid primary key default gen_random_uuid(),
  protocolo        text unique not null,
  tracking_code    text unique,
  status           text not null default 'pendente'
    check (status in ('pendente','em_analise','em_andamento','resolvido','encerrado','arquivado')),
  source           text not null default 'app'
    check (source in ('app','formulario_publico','externo')),
  tipo             text not null default 'incidente'
    check (tipo in ('incidente','denuncia')),

  -- Quem reportou (Firebase UID, null se anonimo/publico)
  user_id          text,

  -- Dados aninhados como JSONB
  notificante      jsonb default '{}',
  incidente_data   jsonb default '{}',
  impacto          jsonb default '{}',
  contexto_anest   jsonb default '{}',
  denuncia_data    jsonb default '{}',
  denunciante      jsonb default '{}',
  admin_data       jsonb default '{}',

  -- Gestao interna
  gestao_interna   jsonb default '{"responsavel":null,"dataAnalise":null,"parecer":null,"acaoCorretiva":null,"dataResolucao":null}',

  -- Anexos
  attachments      jsonb default '[]',

  -- LGPD
  lgpd_consent_at  timestamptz,
  anonymized_at    timestamptz,

  -- Timestamps
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indices
create index idx_incidentes_status on incidentes(status);
create index idx_incidentes_user_id on incidentes(user_id);
create index idx_incidentes_tipo on incidentes(tipo);
create index idx_incidentes_created_at on incidentes(created_at desc);
create index idx_incidentes_tracking on incidentes(tracking_code) where tracking_code is not null;
create index idx_incidentes_protocolo on incidentes(protocolo);

-- Auto-update updated_at
create trigger tr_incidentes_updated_at before update on incidentes
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────
-- 2. Funcoes: gerar protocolo e tracking code
-- ──────────────────────────────────────────────

create or replace function generate_protocolo()
returns trigger as $$
declare
  prefix text;
  seq_num integer;
  date_part text;
begin
  -- Prefixo baseado no tipo
  prefix := case new.tipo
    when 'denuncia' then 'DEN'
    else 'INC'
  end;

  date_part := to_char(now(), 'YYYYMMDD');

  -- Contar registros do dia para sequencia
  select count(*) + 1 into seq_num
  from incidentes
  where protocolo like prefix || '-' || date_part || '-%';

  new.protocolo := prefix || '-' || date_part || '-' || lpad(seq_num::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger tr_incidentes_protocolo
  before insert on incidentes
  for each row
  when (new.protocolo is null or new.protocolo = '')
  execute function generate_protocolo();

create or replace function generate_tracking_code()
returns trigger as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
begin
  -- Gerar codigo de 8 caracteres
  for i in 1..8 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;

  new.tracking_code := 'ANEST-' || to_char(now(), 'YYYY') || '-' || code;
  return new;
end;
$$ language plpgsql;

create trigger tr_incidentes_tracking
  before insert on incidentes
  for each row
  when (new.tracking_code is null)
  execute function generate_tracking_code();

-- ──────────────────────────────────────────────
-- 3. RLS: Incidentes
-- ──────────────────────────────────────────────

alter table incidentes enable row level security;

-- Admin ve tudo
create policy "inc_select_admin" on incidentes
  for select to authenticated
  using (is_admin());

-- Usuario ve apenas seus proprios
create policy "inc_select_own" on incidentes
  for select to authenticated
  using (user_id = public.firebase_uid());

-- Qualquer autenticado pode criar
create policy "inc_insert_auth" on incidentes
  for insert to authenticated
  with check (true);

-- INSERT publico (anon) para formulario externo
create policy "inc_insert_anon" on incidentes
  for insert to anon
  with check (source in ('formulario_publico', 'externo'));

-- SELECT anon para rastreamento por tracking_code
create policy "inc_select_anon_tracking" on incidentes
  for select to anon
  using (tracking_code is not null);

-- Admin pode atualizar tudo
create policy "inc_update_admin" on incidentes
  for update to authenticated
  using (is_admin());

-- Usuario pode atualizar seus proprios (status pendente apenas)
create policy "inc_update_own" on incidentes
  for update to authenticated
  using (user_id = public.firebase_uid() and status = 'pendente');

-- Admin pode deletar
create policy "inc_delete_admin" on incidentes
  for delete to authenticated
  using (is_admin());

-- ──────────────────────────────────────────────
-- 4. RPC: Buscar por tracking code (anonimo)
-- ──────────────────────────────────────────────

create or replace function rpc_fetch_by_tracking_code(p_tracking_code text)
returns json as $$
  select row_to_json(t) from (
    select
      id, protocolo, tracking_code, status, tipo,
      incidente_data, impacto, created_at, updated_at,
      admin_data->>'parecer' as parecer,
      gestao_interna->>'acaoCorretiva' as acao_corretiva
    from incidentes
    where tracking_code = p_tracking_code
  ) t;
$$ language sql stable security definer;

-- ──────────────────────────────────────────────
-- 5. RPC: Anonimizar incidente (LGPD)
-- ──────────────────────────────────────────────

create or replace function rpc_anonimizar_incidente(p_id uuid)
returns void as $$
begin
  update incidentes set
    user_id = null,
    notificante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
    denunciante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
    anonymized_at = now()
  where id = p_id;
end;
$$ language plpgsql security definer;
