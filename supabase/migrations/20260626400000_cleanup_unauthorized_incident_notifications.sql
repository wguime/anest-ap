-- Cleanup: Remove notificações de incidentes/denúncias enviadas a coordenadores
-- que NÃO são admins (fix retroativo da Wave 0.3)
BEGIN;

DELETE FROM public.notifications
WHERE category = 'incidente'
  AND related_entity_type IN ('denuncia', 'incidente')
  AND recipient_id IN (
    SELECT p.id
    FROM profiles p
    WHERE COALESCE(p.is_admin, false) = false
      AND (
        COALESCE(p.is_coordenador, false) = true
        OR LOWER(p.role) = 'coordenador'
      )
  )
  AND related_entity_type = 'denuncia';

COMMIT;
