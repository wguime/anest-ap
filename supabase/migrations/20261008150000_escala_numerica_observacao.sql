-- ════════════════════════════════════════════════════════════════════════
-- 20261008150000_escala_numerica_observacao.sql
-- Observações da Escala Numérica — um recado livre embaixo de cada card.
--
-- Pedido do dono (08/10/2026): "acrescentar observações abaixo de cada escala dos
-- hospitais (UNIMED, HRO e MATERNO) e do consultório. Deixe um campo livre para
-- anotações". Escolhas dele no modelo `.tmp/obs-modelo/escala-numerica-observacoes.html`:
--   • POR TURNO — manhã e tarde têm anotações separadas, como as listas;
--   • escreve quem OPERA a escala cirúrgica (`can_write_escala_cirurgica()`); lê todo
--     usuário autenticado (a tela da numérica não é da equipe da escala só);
--   • a anotação sai na folha impressa, embaixo da coluna.
--
-- Uma linha por (data, turno, hospital). Apagar a anotação é gravar texto VAZIO — não
-- há DELETE: assim fica o rastro de quem apagou e quando, e a policy de DELETE não existe.
--
-- Audit: autor_id/autor_nome/atualizado_em são SERVER-SIDE (trigger com firebase_uid()),
-- como em `escala_plantao_p4_diario` — o cliente não escolhe quem escreveu.
-- LGPD: recado de trabalho. O campo avisa na tela que não é lugar de motivo de
-- afastamento nem de dado de paciente; o banco não tem como impedir texto livre.
-- Retenção de 90 DIAS pela data da escala (dono 08/10, depois da revisão LGPD): a purga
-- diária abaixo apaga a linha inteira — texto e autor.
--
-- Sem tempo real: a tela relê ao abrir, ao trocar a data e no botão de atualizar
-- (anotação de escala não é alarme; o sinal de broadcast fica para se o dono pedir).
--
-- Idempotente: IF NOT EXISTS / DROP ... IF EXISTS em tudo.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.escala_numerica_observacao (
  data          DATE NOT NULL,
  turno         TEXT NOT NULL CHECK (turno IN ('matutino', 'vespertino')),
  hospital      TEXT NOT NULL CHECK (hospital IN ('hro', 'unimed', 'materno', 'consultorio')),
  texto         TEXT NOT NULL DEFAULT '' CHECK (char_length(texto) <= 300),
  autor_id      TEXT,
  autor_nome    TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (data, turno, hospital)
);

COMMENT ON TABLE public.escala_numerica_observacao IS
  'Observação livre embaixo de cada card da Escala Numérica (HRO, Unimed, Materno, Consultório), por data e turno. Texto vazio = sem observação (apagar grava vazio). Pedido do dono 2026-10-08.';

-- Audit server-side: quem escreveu é sempre o usuário do JWT (regra audit-trail).
--   • nullif(...,''): firebase_uid() devolve '' sem JWT — vazio no campo de auditoria
--     viraria "escrito por ninguém" na tela.
--   • autor_nome vem SÓ do profiles, pelo MESMO uid, sem cair no valor do cliente: no
--     ramo DO UPDATE do upsert o nome do autor anterior ficaria ao lado do uid do novo, e
--     perfil sem nome gravaria o que o cliente mandou (o molde do P4 tem esse coalesce).
--     Sem perfil, o nome fica NULL e a tela mostra só a hora. SECURITY DEFINER existe por isto.
--   • btrim antes do CHECK (os CHECKs valem para a linha que sai do BEFORE trigger).
CREATE OR REPLACE FUNCTION public.fn_escala_numerica_observacao_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.turno := lower(btrim(NEW.turno));
  NEW.hospital := lower(btrim(NEW.hospital));
  NEW.texto := btrim(coalesce(NEW.texto, ''));
  NEW.autor_id := nullif(public.firebase_uid(), '');
  NEW.autor_nome := (select nullif(btrim(p.nome), '') from public.profiles p where p.id = NEW.autor_id);
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

-- função de trigger não é RPC: ninguém a executa direto
REVOKE EXECUTE ON FUNCTION public.fn_escala_numerica_observacao_audit() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS tr_escala_numerica_observacao_audit ON public.escala_numerica_observacao;
CREATE TRIGGER tr_escala_numerica_observacao_audit
  BEFORE INSERT OR UPDATE ON public.escala_numerica_observacao
  FOR EACH ROW EXECUTE FUNCTION public.fn_escala_numerica_observacao_audit();

-- ── Privilégios: só o que a tela usa (ler e gravar por upsert). Sem DELETE/TRUNCATE. ──
REVOKE ALL ON public.escala_numerica_observacao FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.escala_numerica_observacao TO authenticated;

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.escala_numerica_observacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_numerica_observacao FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_numerica_obs_select" ON public.escala_numerica_observacao;
CREATE POLICY "escala_numerica_obs_select" ON public.escala_numerica_observacao
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escala_numerica_obs_insert" ON public.escala_numerica_observacao;
CREATE POLICY "escala_numerica_obs_insert" ON public.escala_numerica_observacao
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_escala_cirurgica()));

DROP POLICY IF EXISTS "escala_numerica_obs_update" ON public.escala_numerica_observacao;
CREATE POLICY "escala_numerica_obs_update" ON public.escala_numerica_observacao
  FOR UPDATE TO authenticated
  USING ((select public.can_write_escala_cirurgica()))
  WITH CHECK ((select public.can_write_escala_cirurgica()));

-- ── Retenção: 90 dias (dono 08/10) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.escala_numerica_observacao_purge()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.escala_numerica_observacao WHERE data < current_date - 90;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.escala_numerica_observacao_purge() IS
  'Retenção de 90 dias das observações da Escala Numérica (pela data da escala). Agendada em escala-numerica-observacao-purge (diária, 03:23 BRT). Dono 2026-10-08.';

REVOKE ALL ON FUNCTION public.escala_numerica_observacao_purge() FROM public, anon, authenticated;

-- Agenda só se o pg_cron existir (molde de 20260907120000_escala_leitura_log.sql): o
-- `from cron.job where` protege a 1ª aplicação, porque unschedule de nome inexistente levanta.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('escala-numerica-observacao-purge')
      FROM cron.job WHERE jobname = 'escala-numerica-observacao-purge';
    -- 06:23 UTC = 03:23 BRT, todo dia
    PERFORM cron.schedule(
      'escala-numerica-observacao-purge', '23 6 * * *',
      $cron$select public.escala_numerica_observacao_purge();$cron$
    );
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Conferência depois de aplicar (esperado: rls=true, policies=3, trig=1, auth_delete=false,
-- anon_select=false, job=1):
--   select (select relrowsecurity and relforcerowsecurity from pg_class
--             where oid = 'public.escala_numerica_observacao'::regclass) rls,
--          (select count(*) from pg_policies where tablename = 'escala_numerica_observacao') policies,
--          (select count(*) from pg_trigger where tgname = 'tr_escala_numerica_observacao_audit') trig,
--          has_table_privilege('authenticated', 'public.escala_numerica_observacao', 'delete') auth_delete,
--          has_table_privilege('anon', 'public.escala_numerica_observacao', 'select') anon_select,
--          (select count(*) from cron.job where jobname = 'escala-numerica-observacao-purge') job;

-- ROLLBACK (manual) — ⚠️ DESTRUTIVO depois que a tela estiver em uso: o DROP apaga as
-- observações gravadas. A migration não altera nenhum objeto que já existia:
--   DO $$ BEGIN PERFORM cron.unschedule('escala-numerica-observacao-purge')
--     FROM cron.job WHERE jobname = 'escala-numerica-observacao-purge'; END $$;
--   DROP FUNCTION IF EXISTS public.escala_numerica_observacao_purge();
--   DROP TABLE IF EXISTS public.escala_numerica_observacao;
--   DROP FUNCTION IF EXISTS public.fn_escala_numerica_observacao_audit();
