-- ============================================================================
-- WAVE 0a — Sprint 0 ANEST — 5 Migrations Consolidadas (apply order)
-- ============================================================================
-- Para aplicar tudo de uma vez via Dashboard SQL Editor, copiar/colar este
-- arquivo. Ou rodar localmente:
--
--   set -a && source .env.local && set +a && \
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
--     -h aws-0-us-west-2.pooler.supabase.com -p 5432 \
--     -U postgres.vjzrahruvjffyyqyhjny -d postgres \
--     -f supabase/migrations/_WAVE_0_CONSOLIDATED.sql
--
-- ============================================================================
-- O conteúdo abaixo é a UNIÃO em ordem das 5 migrations:
--   20260504100000_relax_doc_insert_rls.sql
--   20260504100100_extend_changelog_actions.sql
--   20260504100200_fix_permission_audit_rls.sql
--   20260504100300_soft_delete_documentos.sql
--   20260504100400_doc_updated_at_index.sql
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Relax doc_insert RLS (causa raiz #1 do bug "anexar documentos")
-- ────────────────────────────────────────────────────────────────────────────

drop policy if exists "doc_insert" on public.documentos;
drop policy if exists "doc_insert_authenticated" on public.documentos;
drop policy if exists "doc_insert_admin" on public.documentos;

create policy "doc_insert_authenticated" on public.documentos
  for insert to authenticated
  with check (
    created_by = public.firebase_uid()
    and status in ('rascunho', 'pendente')
  );

create policy "doc_insert_admin" on public.documentos
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "storage_doc_insert" on storage.objects;
drop policy if exists "Admins can upload documentos" on storage.objects;
drop policy if exists "storage_doc_insert_authenticated" on storage.objects;

create policy "storage_doc_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos');

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Estender CHECK constraint de documento_changelog.action
-- ────────────────────────────────────────────────────────────────────────────

alter table public.documento_changelog
  drop constraint if exists documento_changelog_action_check;

alter table public.documento_changelog
  add constraint documento_changelog_action_check
  check (action in (
    'created','status_changed','updated','version_added',
    'approved','rejected','archived','restored','deleted',
    'viewed','downloaded','acknowledged','review_scheduled',
    'signature_added','comment_added',
    'distributed','reminder_sent','approval_workflow_set',
    'legal_hold_set','legal_hold_released'
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Fix RLS de permission_audit_log (CRÍTICO segurança)
-- ────────────────────────────────────────────────────────────────────────────

drop policy if exists "Admins can view audit logs" on public.permission_audit_log;
drop policy if exists "Only admins can view audit logs" on public.permission_audit_log;
drop policy if exists "Anon can insert audit logs" on public.permission_audit_log;
drop policy if exists "Authenticated users can insert audit logs" on public.permission_audit_log;
drop policy if exists "Authenticated users can insert own audit logs" on public.permission_audit_log;

create policy "Only admins can view audit logs"
  on public.permission_audit_log for select
  to authenticated
  using (public.is_admin());

create policy "Authenticated users can insert own audit logs"
  on public.permission_audit_log for insert
  to authenticated
  with check (changed_by = public.firebase_uid());

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Soft delete em documentos
-- ────────────────────────────────────────────────────────────────────────────

alter table public.documentos
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists idx_doc_active
  on public.documentos(updated_at desc)
  where deleted_at is null;

alter table public.documento_changelog
  drop constraint if exists documento_changelog_documento_id_fkey;

alter table public.documento_changelog
  alter column documento_id drop not null;

alter table public.documento_changelog
  add constraint documento_changelog_documento_id_fkey
  foreign key (documento_id)
  references public.documentos(id)
  on delete set null;

create or replace function public.prevent_doc_hard_delete()
returns trigger as $$
begin
  if old.deleted_at is null then
    raise exception 'Hard delete bloqueado. Use UPDATE para soft delete (set deleted_at + deleted_by).'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists tr_prevent_doc_hard_delete on public.documentos;
create trigger tr_prevent_doc_hard_delete
  before delete on public.documentos
  for each row
  execute function public.prevent_doc_hard_delete();

create or replace view public.documentos_ativos as
select * from public.documentos
where deleted_at is null;

comment on view public.documentos_ativos is
  'Documentos não excluídos (deleted_at IS NULL). Use para listagens públicas.';

drop policy if exists "doc_select" on public.documentos;
create policy "doc_select" on public.documentos
  for select to authenticated
  using (
    deleted_at is null
    or public.is_admin()
  );

drop policy if exists "doc_soft_delete_own" on public.documentos;
create policy "doc_soft_delete_own" on public.documentos
  for update to authenticated
  using (
    created_by = public.firebase_uid()
    and deleted_at is null
  )
  with check (
    deleted_by = public.firebase_uid()
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Índice em documentos.updated_at + documentos.setor_id
-- ────────────────────────────────────────────────────────────────────────────

create index if not exists idx_doc_updated_at
  on public.documentos(updated_at desc);

create index if not exists idx_doc_setor
  on public.documentos(setor_id)
  where setor_id is not null;

commit;

-- ============================================================================
-- VALIDAÇÃO PÓS-APLICAÇÃO (rodar como usuário não-admin)
-- ============================================================================
-- 1. Listar policies novas:
--    SELECT polname FROM pg_policy WHERE polrelid = 'public.documentos'::regclass;
--    SELECT polname FROM pg_policy WHERE polrelid = 'public.permission_audit_log'::regclass;
-- 2. Confirmar que CHECK aceita 'distributed':
--    INSERT INTO documento_changelog(documento_id, action, user_id, user_name)
--    VALUES (NULL, 'distributed', 'TEST', 'Test'); -- deve funcionar
--    DELETE FROM documento_changelog WHERE user_id = 'TEST';
-- 3. Confirmar trigger anti hard-delete:
--    DELETE FROM documentos WHERE id = 'algum-id'; -- deve falhar com mensagem clara
-- ============================================================================
