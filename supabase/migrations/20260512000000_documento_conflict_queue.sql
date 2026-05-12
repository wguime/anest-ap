-- =============================================================================
-- Sprint 14b — F6.3 (Conflict Queue para offline ops)
-- -----------------------------------------------------------------------------
-- Fila de conflitos para operações offline que retornaram 409 (conflito de
-- versão / state mismatch) ao tentar dar replay. O entry é persistido aqui
-- para que um admin (ou o próprio dono da op) possa inspecionar e resolver
-- manualmente, ao invés de descartar silenciosamente.
--
-- Origem do entry: cliente IndexedDB (offline queue) → ao sincronizar, se o
-- servidor responder 409, o cliente envia a entry para esta tabela.
--
-- `op_id`     — id local da entry IndexedDB (correlação cliente-servidor)
-- `op_string` — identificador da operação (ex.: 'documento.recordAcknowledgement')
-- `payload`   — corpo original que o cliente tentou enviar
-- `server_state` — estado do servidor no momento do conflito (snapshot p/ debug)
-- `status`    — pending | resolved_last_write_wins | resolved_manual | dismissed
--
-- RLS:
--   - SELECT: dono da op OU admin
--   - INSERT: dono da op (firebase_uid() = user_id)
--   - UPDATE/DELETE: admin (somente admin resolve/descarta)
--
-- Audit trail: trigger logando mudanças de status em
-- `documento_conflict_queue_audit` (companion table) — não usa
-- `permission_audit_log` (CHECK constraint incompatível) nem
-- `documento_changelog` (FK obrigatório para documentos.id).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela principal: documento_conflict_queue
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documento_conflict_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id            text NOT NULL,
  op_string        text NOT NULL,
  user_id          text NOT NULL,
  user_name        text NOT NULL,
  payload          jsonb NOT NULL,
  server_state     jsonb,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending',
                       'resolved_last_write_wins',
                       'resolved_manual',
                       'dismissed'
                     )),
  resolved_by      text,
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documento_conflict_queue IS
  'Fila de conflitos offline (409) que precisam resolução manual.
   Entry origina-se de IndexedDB do cliente quando replay de op offline
   detecta state mismatch no servidor.';
COMMENT ON COLUMN public.documento_conflict_queue.op_id IS
  'ID da entry IndexedDB local (correlação cliente-servidor, NÃO FK).';
COMMENT ON COLUMN public.documento_conflict_queue.op_string IS
  'Identificador da operação, ex.: documento.recordAcknowledgement.';
COMMENT ON COLUMN public.documento_conflict_queue.payload IS
  'Payload original que o cliente tentou aplicar (read-only após insert).';
COMMENT ON COLUMN public.documento_conflict_queue.server_state IS
  'Snapshot do estado do servidor no momento do conflito (debug).';
COMMENT ON COLUMN public.documento_conflict_queue.status IS
  'pending | resolved_last_write_wins | resolved_manual | dismissed';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index: queries de admin filtram por status + ordenam por created_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_doc_conflict_queue_status_created
  ON public.documento_conflict_queue (status, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Companion audit table: histórico de mudanças de status
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documento_conflict_queue_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id     uuid NOT NULL REFERENCES public.documento_conflict_queue(id) ON DELETE CASCADE,
  old_status      text,
  new_status      text NOT NULL,
  changed_by      text NOT NULL,
  resolution_notes text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_conflict_audit_conflict_id
  ON public.documento_conflict_queue_audit (conflict_id, created_at DESC);

COMMENT ON TABLE public.documento_conflict_queue_audit IS
  'Audit trail (append-only) de mudanças de status em documento_conflict_queue.
   Populado por trigger AFTER UPDATE.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: loga UPDATE de status em audit companion
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.documento_conflict_queue_audit_trg()
RETURNS trigger AS $$
BEGIN
  -- Só registra se status mudou
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.documento_conflict_queue_audit (
      conflict_id,
      old_status,
      new_status,
      changed_by,
      resolution_notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.resolved_by, public.firebase_uid(), 'unknown'),
      NEW.resolution_notes
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_doc_conflict_queue_audit ON public.documento_conflict_queue;
CREATE TRIGGER tr_doc_conflict_queue_audit
  AFTER UPDATE ON public.documento_conflict_queue
  FOR EACH ROW EXECUTE FUNCTION public.documento_conflict_queue_audit_trg();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — documento_conflict_queue
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documento_conflict_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_conflict_queue_select ON public.documento_conflict_queue;
CREATE POLICY doc_conflict_queue_select ON public.documento_conflict_queue
  FOR SELECT TO authenticated
  USING (
    public.firebase_uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS doc_conflict_queue_insert ON public.documento_conflict_queue;
CREATE POLICY doc_conflict_queue_insert ON public.documento_conflict_queue
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = user_id);

DROP POLICY IF EXISTS doc_conflict_queue_update ON public.documento_conflict_queue;
CREATE POLICY doc_conflict_queue_update ON public.documento_conflict_queue
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS doc_conflict_queue_delete ON public.documento_conflict_queue;
CREATE POLICY doc_conflict_queue_delete ON public.documento_conflict_queue
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — documento_conflict_queue_audit (append-only, admin-read)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documento_conflict_queue_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_conflict_audit_select ON public.documento_conflict_queue_audit;
CREATE POLICY doc_conflict_audit_select ON public.documento_conflict_queue_audit
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- INSERT/UPDATE/DELETE: nenhuma policy → bloqueado para `authenticated`.
-- Trigger roda como SECURITY DEFINER e bypassa RLS no INSERT do audit.
