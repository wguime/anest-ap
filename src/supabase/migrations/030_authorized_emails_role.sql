-- Migration 030: Add role column to authorized_emails
-- Permite que admin pre-selecione o cargo ao autorizar um email.
-- O role e aplicado automaticamente quando o usuario cria a conta via rpc_create_profile.

-- ──────────────────────────────────────────────
-- 1. Add role column (nullable; NULL = usa default no signup)
-- ──────────────────────────────────────────────

ALTER TABLE public.authorized_emails
  ADD COLUMN IF NOT EXISTS role TEXT;

-- ──────────────────────────────────────────────
-- 2. Update rpc_create_profile to prefer authorized_emails.role
--    quando houver, senao cai no p_role passado (fallback 'colaborador')
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_create_profile(
  p_id text,
  p_nome text,
  p_email text,
  p_role text DEFAULT 'colaborador'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_existing_id text;
  v_email_role text;
  v_final_role text;
BEGIN
  -- Validate email is authorized (tambem coleta o role associado)
  SELECT role INTO v_email_role
  FROM public.authorized_emails
  WHERE email = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email not authorized: %', p_email;
  END IF;

  -- Role final: authorized_emails.role > p_role > 'colaborador'
  v_final_role := COALESCE(NULLIF(v_email_role, ''), NULLIF(p_role, ''), 'colaborador');

  -- If profile with this exact id already exists, return it (idempotent)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_id) THEN
    SELECT to_jsonb(p.*) INTO v_result FROM public.profiles p WHERE p.id = p_id;
    RETURN v_result;
  END IF;

  -- If email exists with a different id (admin pre-created placeholder),
  -- replace it with the real Firebase UID
  SELECT id INTO v_existing_id FROM public.profiles WHERE email = lower(p_email) AND id != p_id;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_existing_id;
  END IF;

  -- Insert profile com role vindo de authorized_emails (se houver)
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (p_id, p_nome, lower(p_email), v_final_role)
  ON CONFLICT (id) DO NOTHING;

  -- Return the profile
  SELECT to_jsonb(p.*) INTO v_result FROM public.profiles p WHERE p.id = p_id;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_profile(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_profile(text, text, text, text) TO authenticated;
