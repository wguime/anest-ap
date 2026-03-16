-- ==========================================================================
-- 002_rls.sql — Row Level Security para Gestão Documental Qmentum
-- ==========================================================================

-- ──────────────────────────────────────────────
-- Helper: obter Firebase UID do JWT
-- Usa schema public pois auth é gerenciado pelo Supabase
-- ──────────────────────────────────────────────

create or replace function public.firebase_uid() returns text as $$
begin
  return coalesce(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id'
  );
end;
$$ language plpgsql stable;

-- ──────────────────────────────────────────────
-- Helper: verificar admin
-- ──────────────────────────────────────────────

create or replace function public.is_admin() returns boolean as $$
begin
  return exists (select 1 from admin_users where firebase_uid = public.firebase_uid());
end;
$$ language plpgsql stable security definer;

-- ──────────────────────────────────────────────
-- Habilitar RLS em todas as tabelas
-- ──────────────────────────────────────────────

alter table documentos enable row level security;
alter table documento_versoes enable row level security;
alter table documento_changelog enable row level security;
alter table documento_aprovacoes enable row level security;
alter table documento_distribuicao enable row level security;
alter table admin_users enable row level security;

-- ──────────────────────────────────────────────
-- DOCUMENTOS: leitura todos autenticados, escrita admins
-- ──────────────────────────────────────────────

create policy "doc_select" on documentos
  for select to authenticated using (true);

create policy "doc_insert" on documentos
  for insert to authenticated with check (is_admin());

create policy "doc_update" on documentos
  for update to authenticated using (is_admin());

create policy "doc_update_own_draft" on documentos
  for update to authenticated
  using (created_by = public.firebase_uid() and status = 'rascunho');

create policy "doc_delete" on documentos
  for delete to authenticated using (is_admin());

-- ──────────────────────────────────────────────
-- VERSÕES: leitura todos, escrita admins
-- ──────────────────────────────────────────────

create policy "ver_select" on documento_versoes
  for select to authenticated using (true);

create policy "ver_insert" on documento_versoes
  for insert to authenticated with check (is_admin());

-- ──────────────────────────────────────────────
-- CHANGELOG: leitura todos, inserção pelo próprio usuário
-- ──────────────────────────────────────────────

create policy "cl_select" on documento_changelog
  for select to authenticated using (true);

create policy "cl_insert" on documento_changelog
  for insert to authenticated
  with check (user_id = public.firebase_uid());

-- ──────────────────────────────────────────────
-- APROVAÇÕES: leitura todos, inserção admins, update pelo aprovador
-- ──────────────────────────────────────────────

create policy "aprov_select" on documento_aprovacoes
  for select to authenticated using (true);

create policy "aprov_insert" on documento_aprovacoes
  for insert to authenticated with check (is_admin());

create policy "aprov_update" on documento_aprovacoes
  for update to authenticated
  using (approver_id = public.firebase_uid());

-- ──────────────────────────────────────────────
-- DISTRIBUIÇÃO: leitura própria ou admin, escrita admin, update próprio
-- ──────────────────────────────────────────────

create policy "dist_select" on documento_distribuicao
  for select to authenticated
  using (user_id = public.firebase_uid() or is_admin());

create policy "dist_insert" on documento_distribuicao
  for insert to authenticated with check (is_admin());

create policy "dist_update" on documento_distribuicao
  for update to authenticated
  using (user_id = public.firebase_uid());

-- ──────────────────────────────────────────────
-- ADMIN_USERS: somente leitura por admins
-- ──────────────────────────────────────────────

create policy "admin_select" on admin_users
  for select to authenticated using (is_admin());
