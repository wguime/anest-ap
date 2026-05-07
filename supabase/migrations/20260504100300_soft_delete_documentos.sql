-- ============================================================================
-- Wave 0a — Sprint 0 — Soft delete em documentos
-- ----------------------------------------------------------------------------
-- Problema (auditoria 2026-05-04, Agente 8 — CRÍTICO):
-- `deleteDocument` em supabaseDocumentService.js:618-632 executa um DELETE
-- físico em `documentos`. A FK `documento_changelog.documento_id ... ON
-- DELETE CASCADE` apaga ATOMICAMENTE no banco todas as entradas de audit
-- trail antes que o `logAction('deleted', ...)` seja chamado pelo serviço.
-- Resultado: quem deletou, quando, e por quê fica permanentemente perdido.
--
-- Correção:
--   1. Adicionar colunas `deleted_at` e `deleted_by` em `documentos`.
--   2. Trocar FK do changelog para `ON DELETE SET NULL` (preserva orfãos).
--   3. Trigger que rejeita DELETE físico (força soft delete via UPDATE).
--   4. View `documentos_ativos` para queries que ignoram excluídos.
--   5. Atualizar policies SELECT para esconder soft-deleted de não-admins.
-- ============================================================================

-- 1. Colunas de soft delete
alter table public.documentos
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists idx_doc_active
  on public.documentos(updated_at desc)
  where deleted_at is null;

-- 2. Mudar FK do changelog para SET NULL (preserva audit trail orfão)
alter table public.documento_changelog
  drop constraint if exists documento_changelog_documento_id_fkey;

alter table public.documento_changelog
  alter column documento_id drop not null;

alter table public.documento_changelog
  add constraint documento_changelog_documento_id_fkey
  foreign key (documento_id)
  references public.documentos(id)
  on delete set null;

-- 3. Trigger: força soft delete (rejeita DELETE físico fora de cleanup)
create or replace function public.prevent_doc_hard_delete()
returns trigger as $$
begin
  if old.deleted_at is null then
    raise exception 'Hard delete bloqueado. Use UPDATE para soft delete (set deleted_at + deleted_by).'
      using errcode = 'P0001';
  end if;
  -- Se chegou aqui, deleted_at != NULL → permite (cleanup forense pós-retenção)
  return old;
end;
$$ language plpgsql;

drop trigger if exists tr_prevent_doc_hard_delete on public.documentos;
create trigger tr_prevent_doc_hard_delete
  before delete on public.documentos
  for each row
  execute function public.prevent_doc_hard_delete();

-- 4. View para listagens (esconde soft-deleted)
create or replace view public.documentos_ativos as
select * from public.documentos
where deleted_at is null;

comment on view public.documentos_ativos is
  'Documentos não excluídos (deleted_at IS NULL). Use para listagens públicas.';

-- 5. RLS — esconde soft-deleted para não-admins
drop policy if exists "doc_select" on public.documentos;
create policy "doc_select" on public.documentos
  for select to authenticated
  using (
    deleted_at is null
    or public.is_admin()
  );

-- 6. Permitir UPDATE soft-delete pelo próprio criador (admin já cobre via doc_update)
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
