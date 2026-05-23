-- Migration: normalizar profiles.nome (UPPER + trim) e exigir nome+sobrenome no INSERT
-- Pedido user 2026-05-23: gravar nomes sempre em maiúsculas + obrigar nome+sobrenome em novos cadastros.
--
-- Decisões:
--   1. Trigger BEFORE INSERT OR UPDATE faz UPPER + trim + collapse espaços. Idempotente,
--      aplicável a todos os paths (RPC, service.updateUser, dashboard, scripts).
--   2. Trigger BEFORE INSERT (não UPDATE) exige nome+sobrenome (≥2 palavras). UPDATE
--      preserva flexibilidade pra admin editar profile existente sem quebrar.
--   3. Bypass para postgres/service_role (matching pattern de profiles_require_authorized_email):
--      scripts ad-hoc e migrations não disparam validação. rpc_create_profile é
--      SECURITY DEFINER (owner=postgres) → cai no bypass.
--   4. Aceita placeholder 'Sem nome' (legado) e nomes preenchidos pelo Firebase displayName
--      no primeiro login — validação só rejeita se nome for preenchido mas single-word.
--   5. Bulk UPDATE dos perfis existentes na mesma migration (idempotente). O trigger
--      UPPER vai rodar mas já será no-op porque o UPDATE explicita UPPER no SET.

-- 1. Função normalizadora (UPPER + trim + collapse de espaços)
CREATE OR REPLACE FUNCTION public.profiles_normalize_nome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.nome IS NOT NULL AND TRIM(NEW.nome) <> '' THEN
    NEW.nome := UPPER(TRIM(REGEXP_REPLACE(NEW.nome, '\s+', ' ', 'g')));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_normalize_nome ON public.profiles;
CREATE TRIGGER tr_profiles_normalize_nome
  BEFORE INSERT OR UPDATE OF nome ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_normalize_nome();

-- 2. Função de validação nome+sobrenome (só em INSERT)
CREATE OR REPLACE FUNCTION public.profiles_require_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_normalized text;
  v_word_count int;
BEGIN
  -- Bypass roles privilegiados (postgres = superuser/SECURITY DEFINER owner,
  -- service_role = migration scripts/admin tools). O alvo é o role 'authenticated'
  -- (signup direto, dashboard supabase via authenticated).
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- NULL/vazio: permite (campo nome é opcional na criação inicial; outras camadas
  -- garantem displayName via Firebase). Validação só bloqueia se preencheu mas mal.
  IF NEW.nome IS NULL OR TRIM(NEW.nome) = '' THEN
    RETURN NEW;
  END IF;

  -- Placeholder histórico 'Sem nome' (criado por trigger antigo de pre-fill) — permite
  IF UPPER(TRIM(NEW.nome)) = 'SEM NOME' THEN
    RETURN NEW;
  END IF;

  -- Conta palavras após normalização
  v_normalized := TRIM(REGEXP_REPLACE(NEW.nome, '\s+', ' ', 'g'));
  v_word_count := array_length(string_to_array(v_normalized, ' '), 1);

  IF v_word_count < 2 THEN
    RAISE EXCEPTION
      'profiles.nome deve conter nome e sobrenome (mínimo 2 palavras separadas por espaço). Recebido: %',
      NEW.nome
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_require_full_name ON public.profiles;
CREATE TRIGGER tr_profiles_require_full_name
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_require_full_name();

-- 3. Bulk: UPPER em todos os perfis existentes (idempotente)
UPDATE public.profiles
SET nome = UPPER(TRIM(REGEXP_REPLACE(nome, '\s+', ' ', 'g')))
WHERE nome IS NOT NULL
  AND nome <> UPPER(TRIM(REGEXP_REPLACE(nome, '\s+', ' ', 'g')));

-- Smoke tests (rodar manualmente após apply):
--   -- (a) UPPER funciona em UPDATE:
--   --   UPDATE profiles SET nome = 'joão silva' WHERE id = '<uid>';
--   --   SELECT nome FROM profiles WHERE id = '<uid>';  -- 'JOÃO SILVA'
--   --
--   -- (b) INSERT exige nome+sobrenome (role authenticated):
--   --   SET ROLE authenticated;
--   --   INSERT INTO profiles (id, nome, email, role)
--   --     VALUES ('test', 'Maria', 'maria@aut.com', 'colaborador');
--   --   -- ERROR: nome deve conter nome e sobrenome
--   --
--   -- (c) INSERT 'Sem nome' funciona (legado):
--   --   INSERT INTO profiles (id, nome, email, role)
--   --     VALUES ('test2', 'Sem nome', 'x@aut.com', 'colaborador');
--   --   -- OK
