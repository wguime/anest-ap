-- Migration 025: RPC to create profile during signup
-- Ensures new users get a Supabase profile when registering via Firebase Auth.
-- SECURITY DEFINER so anon/authenticated can insert into profiles.
-- Idempotent: returns existing profile if id matches.
-- Handles pre-created placeholders: if email exists with different id, replaces it.

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
BEGIN
  -- Validate email is authorized
  IF NOT EXISTS (
    SELECT 1 FROM public.authorized_emails WHERE email = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'Email not authorized: %', p_email;
  END IF;

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

  -- Insert profile
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (p_id, p_nome, lower(p_email), p_role)
  ON CONFLICT (id) DO NOTHING;

  -- Return the profile
  SELECT to_jsonb(p.*) INTO v_result FROM public.profiles p WHERE p.id = p_id;
  RETURN v_result;
END;
$$;

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.rpc_create_profile(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_profile(text, text, text, text) TO authenticated;
