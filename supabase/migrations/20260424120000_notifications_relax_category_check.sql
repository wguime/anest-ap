-- ============================================================================
-- Relaxa CHECK constraint de notifications.category.
--
-- Problema: uma CHECK constraint aplicada manualmente no Dashboard
-- rejeita valores como 'cateter', causando falha silenciosa em TODO
-- INSERT de notificação de cateter (NovoCateterPage, CateterDetalhePage,
-- useCateterReminders). O cliente só loga o erro no console e segue com
-- o otimista local, que é perdido no próximo refetch — daí o relato de
-- "notificação some após leitura".
--
-- Fix: remove a constraint. A validação de categoria é feita no app via
-- NOTIFICATION_CATEGORIES (src/contexts/MessagesContext.jsx) — fonte
-- única de verdade. Forçar uma lista em DB duplica a responsabilidade e
-- gera falhas silenciosas quando uma nova categoria é adicionada.
-- ============================================================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
