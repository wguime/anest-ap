-- Migration 032: Enforce lowercase emails in authorized_emails and profiles
-- Resolve mismatch entre INSERTs sem normalizacao e buscas com lower(email).
-- Bug: usuarios autorizados nao conseguiam se cadastrar quando admin digitava email com case misto
-- (ex: 'User@Empresa.COM') — RPC rpc_create_profile faz WHERE email = lower(p_email) e nao encontrava.
--
-- Diagnostico em producao (2026-05-05): 0 emails com case misto, 0 duplicatas case-insensitive.
-- Logo, esta migration nao precisa de UPDATE nem DELETE — apenas adiciona CHECK constraint
-- para impedir reintroducao de case misto via codigo cliente legado.

-- ──────────────────────────────────────────────
-- Defensive UPDATE — no-op em prod hoje, salvaguarda se rodar em ambiente desincronizado
-- ──────────────────────────────────────────────

UPDATE public.authorized_emails
SET email = lower(email)
WHERE email <> lower(email);

UPDATE public.profiles
SET email = lower(email)
WHERE email <> lower(email);

-- ──────────────────────────────────────────────
-- CHECK constraint para impedir reintroducao de case misto
-- ──────────────────────────────────────────────

ALTER TABLE public.authorized_emails
  DROP CONSTRAINT IF EXISTS authorized_emails_lowercase_check;
ALTER TABLE public.authorized_emails
  ADD CONSTRAINT authorized_emails_lowercase_check
  CHECK (email = lower(email));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_lowercase_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_lowercase_check
  CHECK (email = lower(email));
