-- Wave 1.9 T1.9.6: Audit trail server-side de download de certificados
-- LGPD Art. 18 (portabilidade): rastreável quem baixou qual cert, quando, de onde.
-- Server-side via Edge get-cert-download-url com service_role insert (não-bypassable).
-- Retenção: 5 anos (padrão audit logs ANEST conforme docs/lgpd-retencao.md).

create table if not exists public.educacao_downloads_audit (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null check (action = 'cert_download_signed'),
  target_type text not null check (target_type = 'educacao_certificado'),
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_educ_dl_audit_user on public.educacao_downloads_audit(user_id);
create index if not exists idx_educ_dl_audit_target on public.educacao_downloads_audit(target_id);
create index if not exists idx_educ_dl_audit_created on public.educacao_downloads_audit(created_at desc);

alter table public.educacao_downloads_audit enable row level security;

-- SELECT: owner OR admin
drop policy if exists educ_dl_audit_select_owner on public.educacao_downloads_audit;
create policy educ_dl_audit_select_owner
  on public.educacao_downloads_audit for select to authenticated
  using (user_id = public.firebase_uid() or public.is_admin());

-- INSERT: service_role only
drop policy if exists educ_dl_audit_insert_service on public.educacao_downloads_audit;
create policy educ_dl_audit_insert_service
  on public.educacao_downloads_audit for insert to service_role
  with check (true);

-- WORM: nenhuma policy UPDATE/DELETE (deny by default)

-- WORM trigger (espelhar 20260508000000_audit_v3_72_fixes.sql padrão)
create or replace function public.prevent_educ_dl_audit_modification()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') and current_setting('role', true) <> 'service_role' then
    raise exception 'educacao_downloads_audit é WORM (append-only). Apenas service_role pode modificar.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_educ_dl_audit_worm on public.educacao_downloads_audit;
create trigger trg_educ_dl_audit_worm
  before update or delete on public.educacao_downloads_audit
  for each row execute function public.prevent_educ_dl_audit_modification();
