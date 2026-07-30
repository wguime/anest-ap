-- ════════════════════════════════════════════════════════════════════════════
-- 20260730150000_daniela_cargo_anestesiologista.sql
-- Correção de CADASTRO (dono 2026-07-30): "Daniela não é mais residente e sim
-- anestesiologista, corrija para o futuro".
--
-- O cargo estava desatualizado e isso a tirou do seletor de responsável da escala
-- (filtro por cargo, decisão do dono 29/07). Os dados confirmam a correção sem
-- ambiguidade — no momento desta migration:
--     casos como ANESTESISTA .... 25
--     casos como RESIDENTE ......  0
--     apelidos no dicionário ....  2
--
-- Vai como migration em vez de UPDATE solto porque `profiles` NÃO tem trigger de
-- auditoria (só normalização de nome e updated_at), e a regra do projeto é que
-- toda mutation sensível registre QUEM mudou — nunca 'admin'/'system'. O app faz
-- isso em supabaseUsersService.updateUser, que exige `currentUserId` e grava
-- `role_change` em permission_audit_log. Aqui a linha de auditoria é escrita à
-- mão com o uid REAL do dono, que foi quem ordenou a mudança.
--
-- Idempotente: reaplicar não duplica auditoria nem sobrescreve um cargo que
-- alguém tenha ajustado depois pela tela.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_alvo   text := 'Dcbb3U7D1cWIeRrIEQNTMySDcDp2';   -- DANIELA KLEIN REIS
  v_dono   text := 'pPdKZ75E9zNdPnLz50qisPiHfJw1';   -- GUILHERME MELO (wguime@yahoo.com.br), admin
  v_antigo text;
BEGIN
  SELECT role INTO v_antigo FROM public.profiles WHERE id = v_alvo;

  IF v_antigo IS NULL THEN
    RAISE NOTICE 'perfil % não encontrado — nada a fazer', v_alvo;
    RETURN;
  END IF;

  IF v_antigo = 'anestesiologista' THEN
    RAISE NOTICE 'cargo já é anestesiologista — nada a fazer';
    RETURN;
  END IF;

  UPDATE public.profiles
     SET role = 'anestesiologista',
         updated_at = now()
   WHERE id = v_alvo;

  -- mesmo formato que supabaseUsersService.logPermissionChange grava
  INSERT INTO public.permission_audit_log (target_user_id, changed_by, action, old_value, new_value)
  VALUES (
    v_alvo,
    v_dono,
    'role_change',
    jsonb_build_object('role', v_antigo),
    jsonb_build_object('role', 'anestesiologista')
  );

  RAISE NOTICE 'cargo de % : % -> anestesiologista (auditado como %)', v_alvo, v_antigo, v_dono;
END $$;
