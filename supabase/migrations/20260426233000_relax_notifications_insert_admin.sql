-- ============================================================================
-- Relax notifications INSERT policy — admin bypass explícito
--
-- Contexto: a policy "Active authenticated users can create notifications"
-- (de 20260422203000) exige `EXISTS profiles WHERE id = firebase_uid() AND
-- active IS NOT FALSE`. Em testes diretos (SET LOCAL ROLE authenticated +
-- request.jwt.claims com sub do admin) ela passa. Mas o frontend gera 42501
-- em loop nos reminder hooks (1.709 cateter notifs no DB, 0 cateter-reminder_*).
--
-- Esta migration consolida as duas policies INSERT existentes em UMA com
-- 3 caminhos de aceitação (OR). Estritamente mais permissiva que a atual
-- (não quebra nenhum call site que já funcione hoje) e adiciona admin
-- como caminho explícito robusto, mesmo quando firebase_uid() falhar:
--
--   1. is_admin()  → admin_users.firebase_uid = current → SECURITY DEFINER,
--      bypassa RLS internamente.
--   2. Profile ativo do caller → mantém comportamento atual para fluxos
--      como trocas, novo incidente, denúncia, comunicado.
--   3. Service role (Edge Functions, cron, scripts) sempre bypass.
--
-- Net effect: tudo que passa hoje continua passando, e admins ganham
-- caminho garantido para reminder hooks (cateter 24h/48h/72h/96h).
-- ============================================================================

DROP POLICY IF EXISTS "Active authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users and admins can create notifications" ON public.notifications;

CREATE POLICY "Users and admins can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    -- 1. Admin: caminho explícito + SECURITY DEFINER
    public.is_admin()
    OR
    -- 2. Usuário ativo (mantém comportamento das policies anteriores)
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.firebase_uid()
        AND p.active IS NOT FALSE
    )
    OR
    -- 3. Service role (Edge Functions, cron) — fallback explícito
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );
