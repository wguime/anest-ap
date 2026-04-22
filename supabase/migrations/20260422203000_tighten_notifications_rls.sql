-- ============================================================================
-- Tighten notifications RLS
--
-- Problema: policy anterior "System can create notifications" usava
--   WITH CHECK (true), permitindo qualquer sessão (inclusive anon key)
--   inserir notificações para qualquer recipient_id — risco de spoofing.
--
-- Fix: exigir que quem faz INSERT esteja autenticado com um perfil ativo.
--   Service role (Edge Functions, scripts administrativos com JWT
--   service_role) bypassa RLS automaticamente e segue funcionando.
-- ============================================================================

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Active authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.firebase_uid()
        AND p.active IS NOT FALSE
    )
  );

-- Nota: para restringir ainda mais (ex.: apenas admins/coordenadores),
-- seria preciso migrar os call sites que criam notificações em lote
-- (trocas de plantão, novo incidente, cateter etc.) para Edge Functions
-- com JWT service_role, de modo que o usuário comum não precise mais
-- inserir diretamente na tabela. Isso fica como próximo passo.
