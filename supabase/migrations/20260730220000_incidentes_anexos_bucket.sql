-- ============================================================================
-- Anexos de denúncias/incidentes — bucket privado + RLS + anonimato
--
-- Contexto (bug 2026-07-30): o formulário de denúncia coletava só o NOME do
-- arquivo (f.name) e o INSERT de createDenuncia nem incluía a coluna
-- attachments — o anexo da DEN-20260727-8445 nunca saiu do browser.
-- Esta migration cria a infra de storage; o front passa a subir o arquivo
-- real e gravar metadados {name, path, size, type} no JSONB attachments.
--
-- LGPD (base art. 11 II "d" — canal de denúncias/incidentes, evidência):
-- - Bucket PRIVADO; leitura só admin (espelha inc_select_admin) ou dono do
--   upload identificado. Acompanhamento público (tracking) NÃO expõe anexos.
-- - Denúncia/incidente ANÔNIMO: upload vai para pasta *-anon/ e o trigger
--   abaixo anula owner/owner_id ANTES do insert — o Storage gravaria o UID
--   do uploader (auth.uid()), o que violaria "não vincular userId a relatos
--   anônimos" (NovaDenunciaPage). Identidade nunca chega a persistir.
-- - Sem policy de DELETE/UPDATE: evidência é imutável (remoção só via
--   service role, alinhado à retenção do módulo).
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('incidentes-anexos', 'incidentes-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Paths permitidos: denuncias/ denuncias-anon/ incidentes/ incidentes-anon/
-- (2º segmento = protocolo, 3º = uuid aleatório — sem dado pessoal no path)
DROP POLICY IF EXISTS "incidentes_anexos_insert" ON storage.objects;
CREATE POLICY "incidentes_anexos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incidentes-anexos'
    AND (storage.foldername(name))[1] IN
      ('denuncias', 'denuncias-anon', 'incidentes', 'incidentes-anon')
  );

-- Leitura: admin (responsáveis pelo canal) OU dono do upload identificado.
-- Uploads anônimos ficam sem owner (trigger abaixo) → só admin baixa.
DROP POLICY IF EXISTS "incidentes_anexos_select" ON storage.objects;
CREATE POLICY "incidentes_anexos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidentes-anexos'
    AND (public.is_admin() OR owner_id = (SELECT public.firebase_uid()))
  );

-- Anonimato: anula owner_id (o storage-api grava o sub do JWT nele; owner
-- uuid nunca é populado neste projeto — anulado junto por segurança) de
-- uploads nas pastas *-anon ANTES de persistir.
-- A pasta é decidida DENTRO da função: CREATE OR REPLACE fica sempre
-- disponível ao postgres, enquanto o WHEN do trigger é imutável p/ nós
-- após criado (DROP TRIGGER exige ownership de storage.objects, que a
-- Management API não tem — validação 2026-07-30). Kill switch: trocar o
-- corpo por RETURN NEW.
CREATE OR REPLACE FUNCTION public.fn_scrub_anexo_anonimo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF (storage.foldername(NEW.name))[1] IN ('denuncias-anon', 'incidentes-anon') THEN
    NEW.owner := NULL;
    NEW.owner_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Sem DROP TRIGGER (não re-executável como postgres): cria só se não existe.
-- INSERT OR UPDATE: upload resumable (TUS) e upsert fazem UPDATE e
-- re-populariam owner_id sem o OR UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND t.tgname = 'tr_incidentes_anexos_scrub_anon'
  ) THEN
    CREATE TRIGGER tr_incidentes_anexos_scrub_anon
      BEFORE INSERT OR UPDATE ON storage.objects
      FOR EACH ROW
      WHEN (NEW.bucket_id = 'incidentes-anexos')
      EXECUTE FUNCTION public.fn_scrub_anexo_anonimo();
  END IF;
END $$;

COMMIT;
