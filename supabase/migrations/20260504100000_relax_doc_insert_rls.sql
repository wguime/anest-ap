-- ============================================================================
-- Wave 0a — Sprint 0 — Relax doc_insert RLS
-- ----------------------------------------------------------------------------
-- Problema (auditoria 2026-05-04, Agente 1):
-- A policy `doc_insert` em `documentos` exige `is_admin()`, bloqueando 100%
-- dos usuários autenticados não-admin. Mesmo problema em `storage.objects`
-- para o bucket `documentos`. Causa raiz #1 do bug "dificuldade em anexar
-- novos documentos".
--
-- Correção:
-- Permitir que qualquer usuário autenticado crie documentos quando
-- (a) o `created_by` for o próprio Firebase UID e
-- (b) o status inicial for `rascunho` ou `pendente`.
-- Admins continuam podendo criar com qualquer status via policy `doc_update`.
-- Mesma lógica para upload no Storage: usuário autenticado pode subir
-- arquivos no bucket `documentos`. Path-scoped RLS pode ser aplicada depois.
-- ============================================================================

-- ─── documentos ─────────────────────────────────────────────────────────────

drop policy if exists "doc_insert" on public.documentos;

create policy "doc_insert_authenticated" on public.documentos
  for insert to authenticated
  with check (
    created_by = public.firebase_uid()
    and status in ('rascunho', 'pendente')
  );

-- Admins continuam tendo poder total via doc_update (já existente).
-- Para admin criar documento direto com status='ativo', usamos uma policy
-- adicional dedicada que não requer constraint de status.
create policy "doc_insert_admin" on public.documentos
  for insert to authenticated
  with check (public.is_admin());

-- ─── storage.objects (bucket: documentos) ───────────────────────────────────

drop policy if exists "storage_doc_insert" on storage.objects;
drop policy if exists "Admins can upload documentos" on storage.objects;

create policy "storage_doc_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos');
