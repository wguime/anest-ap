-- ============================================================================
-- profiles.conta_duplicada_de — 2ª conta da MESMA pessoa
--
-- Pedido do dono 2026-07-29: "há dois guilhermes (Guilherme Melo e Guilherme
-- Souza Melo)... quero apenas um nome completo por anestesista". As duas contas
-- continuam ATIVAS (decisão de 27/07 — ele usa as duas para entrar); o que muda
-- é que a secundária sai das listas de escolha de anestesista da escala.
--
-- Não é `active = false`: desativar tiraria o acesso da conta. Aqui o perfil
-- segue íntegro (role, permissões, login) e só deixa de ser uma OPÇÃO na escala.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + constraints condicionais + UPDATE
-- guardado por `conta_duplicada_de IS NULL`.
-- ============================================================================

-- profiles é lida em TODO login: não deixar um ACCESS EXCLUSIVE enfileirar atrás
-- de uma query longa.
SET lock_timeout = '3s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS conta_duplicada_de TEXT;

COMMENT ON COLUMN public.profiles.conta_duplicada_de IS
  'Preenchido = este perfil é uma SEGUNDA conta da mesma pessoa e aponta o perfil principal. A conta segue ativa para login; some das listas de escolha de anestesista (useRosterAnestesistas) e os vínculos antigos resolvem para o principal.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_conta_duplicada_nao_self'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_conta_duplicada_nao_self
      CHECK (conta_duplicada_de IS NULL OR conta_duplicada_de <> id);
  END IF;

  -- FK self-referente: `rpc_create_profile` (025) DELETA o perfil quando o mesmo
  -- e-mail reaparece com outro uid — sem a FK, a secundária ficaria apontando p/
  -- um fantasma e sumiria das listas para sempre, sem sinal nenhum.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_conta_duplicada_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_conta_duplicada_fk
      FOREIGN KEY (conta_duplicada_de) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── O par do dono ───────────────────────────────────────────────────────────
-- Principal: GUILHERME MELO (wguime@yahoo.com.br) — é o uid que o dicionário de
-- apelidos, as escalas e as liberações já usam.
-- Secundária: GUILHERME SOUZA MELO (anestesista.guilherme@gmail.com) — hoje sem
-- nenhum caso e sem nenhum apelido apontando para ela.
-- Chaveado por E-MAIL (UNIQUE em 018_profiles) e não por uid: uid do Firebase
-- pode ser recriado, e aí o UPDATE afetaria 0 linhas reportando sucesso.
DO $$
DECLARE v_n int;
BEGIN
  UPDATE public.profiles s
     SET conta_duplicada_de = p.id
    FROM public.profiles p
   WHERE p.email = 'wguime@yahoo.com.br'
     AND s.email = 'anestesista.guilherme@gmail.com'
     AND s.conta_duplicada_de IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE WARNING 'conta_duplicada_de: nenhuma linha marcada (já marcada ou e-mails ausentes) — conferir manualmente';
  END IF;
END $$;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_conta_duplicada_nao_self;
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_conta_duplicada_fk;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS conta_duplicada_de;
-- (a conta duplicada volta a aparecer nas listas — degradação cosmética)
