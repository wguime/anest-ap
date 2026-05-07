-- =============================================================================
-- 20260505500000_worm_changelog.sql — Onda1-4
-- WORM (Write Once Read Many) para documento_changelog.
-- Append-only: bloqueia UPDATE e DELETE (audit trail imutável).
--
-- service_role pode bypassar para fins de archive automatizado.
-- =============================================================================

-- Função guard: dispara erro em UPDATE/DELETE para roles não-service.
CREATE OR REPLACE FUNCTION public.prevent_changelog_modification()
RETURNS trigger AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  );

  IF (TG_OP = 'UPDATE') THEN
    IF jwt_role <> 'service_role' THEN
      RAISE EXCEPTION 'documento_changelog é WORM (append-only). UPDATE bloqueado.';
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    IF jwt_role <> 'service_role' THEN
      RAISE EXCEPTION 'documento_changelog é WORM (append-only). DELETE bloqueado.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_worm_changelog ON public.documento_changelog;
CREATE TRIGGER trg_worm_changelog
  BEFORE UPDATE OR DELETE ON public.documento_changelog
  FOR EACH ROW EXECUTE FUNCTION public.prevent_changelog_modification();

-- Tabela espelhada de arquivo (read-only futuro: registros >6 anos vão para cá).
CREATE TABLE IF NOT EXISTS public.documento_changelog_archive (
  LIKE public.documento_changelog INCLUDING ALL
);

-- Função de archive (>6 anos).
-- Roda via pg_cron com service_role implícito → bypassa o trigger acima.
CREATE OR REPLACE FUNCTION public.archive_old_changelog()
RETURNS integer AS $$
DECLARE
  moved_count int := 0;
BEGIN
  WITH moved AS (
    DELETE FROM public.documento_changelog
      WHERE created_at < (now() - interval '6 years')
      RETURNING *
  )
  INSERT INTO public.documento_changelog_archive
    SELECT * FROM moved;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.archive_old_changelog() IS
  'Move registros do documento_changelog com mais de 6 anos para documento_changelog_archive. SECURITY DEFINER para bypassar o trigger WORM.';

COMMENT ON TRIGGER trg_worm_changelog ON public.documento_changelog IS
  'WORM: bloqueia UPDATE/DELETE em documento_changelog (audit trail imutável). service_role bypass para archive.';
