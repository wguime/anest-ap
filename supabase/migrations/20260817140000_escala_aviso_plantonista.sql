-- ════════════════════════════════════════════════════════════════════════
-- 20260817140000_escala_aviso_plantonista.sql
-- Recado do PLANTONISTA para a equipe, na aba Liberações (dono 2026-08-17).
--
-- Contexto: "um campo para mensagem enviada exclusivamente pelo plantonista, em
-- destaque acima dos procedimentos sem anestesista; os envolvidos confirmam e a
-- mensagem some (inclusive o plantonista)". Exemplo dele: "Guilherme libera
-- Alexandre S." — coisas que hoje se resolvem no grito ou no WhatsApp e não
-- deixam rastro na escala.
--
-- Regras escolhidas pelo dono (17/08):
--   • ENVIA: só quem é o plantonista daquele hospital/turno (1º do rodapé);
--   • SOME: cada pessoa confirma e o aviso sai da tela DELA — quem não confirmou
--     continua vendo. O autor confirma o próprio recado para tirá-lo da dele.
--
-- ⚠️ NÃO é notificação. A escala não manda mensagem nenhuma desde 30/07 (as 6
-- fontes foram removidas; a inbox tinha 99 não lidas em 23 pessoas). Isto vive
-- na TELA, em realtime, e morre na confirmação — nada é enviado a ninguém.
--
-- ⚠️ NÃO reescreve o rodapé nem `ordem_liberacao`: é tabela independente, como a
-- do P4 coringa. Reescrever o rodapé automaticamente foi a corrupção de 22/07.
--
-- Audit: autor e confirmante são SERVER-SIDE (firebase_uid() no trigger) — o
-- cliente não escolhe quem falou nem quem confirmou.
-- LGPD: texto livre que o grupo TODO enxerga; a UI avisa que paciente só entra
-- por iniciais, mesma regra da Observação da linha. Limite de 160 caracteres.
--
-- Idempotente: IF NOT EXISTS / DROP ... IF EXISTS em tudo.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.escala_cirurgica_aviso (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id    UUID NOT NULL REFERENCES public.escala_cirurgica(id) ON DELETE CASCADE,
  -- 'noturno' entra porque o FDS tem esse turno na tela, ainda que os casos
  -- dele venham do vespertino (o CHECK de escala_cirurgica_caso não o aceita).
  turno        TEXT NOT NULL CHECK (turno IN ('matutino', 'vespertino', 'noturno')),
  texto        TEXT NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 160),
  autor_user_id TEXT,
  autor_nome   TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.escala_cirurgica_aviso IS
  'Recado do plantonista para a equipe na aba Liberações (dono 2026-08-17). Vive na tela em realtime e some para cada pessoa que confirma. NÃO gera notificação — a escala não manda mensagem desde 30/07.';

CREATE INDEX IF NOT EXISTS idx_escala_aviso_escala_turno
  ON public.escala_cirurgica_aviso (escala_id, turno, criado_em DESC);

-- Uma linha por pessoa que confirmou. PK composta = confirmar duas vezes é
-- no-op, e duas pessoas confirmando ao mesmo tempo não se sobrescrevem (era o
-- motivo de não guardar as confirmações num jsonb no próprio aviso).
CREATE TABLE IF NOT EXISTS public.escala_cirurgica_aviso_confirmacao (
  aviso_id      UUID NOT NULL REFERENCES public.escala_cirurgica_aviso(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  user_nome     TEXT,
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, user_id)
);

COMMENT ON TABLE public.escala_cirurgica_aviso_confirmacao IS
  'Quem já confirmou cada recado do plantonista. O aviso some da tela de quem confirmou; os demais continuam vendo.';

-- ── Audit SERVER-SIDE ──────────────────────────────────────────────────
-- Quem falou e quem confirmou saem do JWT, nunca do que o cliente mandar
-- (regra audit-trail: changedBy é o user REAL). nullif(...,'') porque
-- firebase_uid() devolve string vazia sem JWT, e '' num campo de autoria vira
-- "dito por ninguém" na tela.
CREATE OR REPLACE FUNCTION public.fn_escala_aviso_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.autor_user_id := nullif(public.firebase_uid(), '');
  NEW.autor_nome := coalesce(
    (SELECT p.nome FROM public.profiles p WHERE p.id = public.firebase_uid()),
    NEW.autor_nome
  );
  NEW.criado_em := now();
  NEW.texto := btrim(NEW.texto);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_escala_aviso_audit ON public.escala_cirurgica_aviso;
CREATE TRIGGER tr_escala_aviso_audit
  BEFORE INSERT ON public.escala_cirurgica_aviso
  FOR EACH ROW EXECUTE FUNCTION public.fn_escala_aviso_audit();

CREATE OR REPLACE FUNCTION public.fn_escala_aviso_confirmacao_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.user_id := coalesce(nullif(public.firebase_uid(), ''), NEW.user_id);
  NEW.user_nome := coalesce(
    (SELECT p.nome FROM public.profiles p WHERE p.id = NEW.user_id),
    NEW.user_nome
  );
  NEW.confirmado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_escala_aviso_confirmacao_audit ON public.escala_cirurgica_aviso_confirmacao;
CREATE TRIGGER tr_escala_aviso_confirmacao_audit
  BEFORE INSERT ON public.escala_cirurgica_aviso_confirmacao
  FOR EACH ROW EXECUTE FUNCTION public.fn_escala_aviso_confirmacao_audit();

-- ── RLS ────────────────────────────────────────────────────────────────
-- Mesmo predicado do resto do módulo: quem vê/edita a escala vê o recado.
-- "Só o plantonista envia" é regra de PRODUTO, aplicada na tela (como todo o
-- resto do módulo, cuja RLS é por PAPEL e não por pessoa) — o que o banco
-- garante é que a autoria não pode ser forjada, pelo trigger acima.
ALTER TABLE public.escala_cirurgica_aviso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_cirurgica_aviso FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_aviso_select" ON public.escala_cirurgica_aviso;
CREATE POLICY "escala_aviso_select" ON public.escala_cirurgica_aviso
  FOR SELECT TO authenticated
  USING ((select public.can_write_escala_cirurgica()));

DROP POLICY IF EXISTS "escala_aviso_insert" ON public.escala_cirurgica_aviso;
CREATE POLICY "escala_aviso_insert" ON public.escala_cirurgica_aviso
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_escala_cirurgica()));

-- Sem UPDATE: recado não se edita — corrigir é mandar outro. Editar um texto que
-- metade da equipe já confirmou faria a confirmação valer para outra frase.
-- DELETE só do AUTOR, para quem errou a digitação retirar o próprio recado. A UI
-- de hoje não expõe o botão (o caminho normal de sumir é a confirmação); a
-- policy fica pronta, como se fez com o P4 coringa em 24/07.
DROP POLICY IF EXISTS "escala_aviso_delete_autor" ON public.escala_cirurgica_aviso;
CREATE POLICY "escala_aviso_delete_autor" ON public.escala_cirurgica_aviso
  FOR DELETE TO authenticated
  USING (autor_user_id = public.firebase_uid());

ALTER TABLE public.escala_cirurgica_aviso_confirmacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_cirurgica_aviso_confirmacao FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_aviso_conf_select" ON public.escala_cirurgica_aviso_confirmacao;
CREATE POLICY "escala_aviso_conf_select" ON public.escala_cirurgica_aviso_confirmacao
  FOR SELECT TO authenticated
  USING ((select public.can_write_escala_cirurgica()));

-- Confirmar é por SI: o WITH CHECK amarra a linha ao uid do JWT, então ninguém
-- confirma no lugar de outro (o placar "2 de 4" seria mentira).
DROP POLICY IF EXISTS "escala_aviso_conf_insert" ON public.escala_cirurgica_aviso_confirmacao;
CREATE POLICY "escala_aviso_conf_insert" ON public.escala_cirurgica_aviso_confirmacao
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_escala_cirurgica()) AND user_id = public.firebase_uid());

-- Desfazer a própria confirmação (o recado volta para a tela de quem se
-- arrependeu). Ninguém apaga a confirmação de outro.
DROP POLICY IF EXISTS "escala_aviso_conf_delete" ON public.escala_cirurgica_aviso_confirmacao;
CREATE POLICY "escala_aviso_conf_delete" ON public.escala_cirurgica_aviso_confirmacao
  FOR DELETE TO authenticated
  USING (user_id = public.firebase_uid());

COMMIT;

-- ── Realtime — fora da transação, idempotente ──────────────────────────
-- Sem isto o recado só apareceria ao recarregar, e o placar de confirmações
-- ficaria parado na tela de quem já estava com o app aberto.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'escala_cirurgica_aviso'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_cirurgica_aviso;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'escala_cirurgica_aviso_confirmacao'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_cirurgica_aviso_confirmacao;
  END IF;
END $$;

-- ROLLBACK (manual, nesta ordem) — migration puramente aditiva, não altera
-- nenhum objeto pré-existente da escala cirúrgica:
--   DROP TABLE IF EXISTS public.escala_cirurgica_aviso_confirmacao;
--   DROP TABLE IF EXISTS public.escala_cirurgica_aviso;   -- sai da publication junto
--   DROP FUNCTION IF EXISTS public.fn_escala_aviso_confirmacao_audit();
--   DROP FUNCTION IF EXISTS public.fn_escala_aviso_audit();
