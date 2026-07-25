-- ════════════════════════════════════════════════════════════════════════
-- 20260724200000_escala_plantao_p4_diario.sql
-- Fase noturna das Liberações — onde o P4 (CORINGA) está escalado hoje.
--
-- Contexto (decisão do dono 2026-07-24): das 19h às 22h a aba Liberações mostra
-- os plantonistas noturnos como cards. P1 é do HRO, P2/P3 da Unimed — fixos. O
-- P4 é coringa: SEM marcação aparece nos TRÊS hospitais; marcado, aparece só no
-- hospital marcado e some dos outros. A marcação é do DIA e COMPARTILHADA por
-- todo o grupo (realtime), por isso vive no banco e não em localStorage.
--
-- Uma linha por DATA (PK): o P4 é um só no dia inteiro. Trocar de hospital é um
-- UPDATE da mesma linha — sem histórico paralelo que possa divergir.
--
-- ⚠️ NÃO confundir com o rodapé/ordem_liberacao da escala: nada aqui reescreve a
-- escala (reescrever o rodapé automaticamente foi a corrupção de 2026-07-22).
-- Esta tabela é 100% independente e só alimenta a exibição da fase noturna.
--
-- Audit: marcado_por/marcado_em são SERVER-SIDE (trigger com firebase_uid()) —
-- o cliente não escolhe quem marcou.
-- LGPD: zero dado de paciente; só nome de hospital + uid de quem marcou.
--
-- Idempotente: IF NOT EXISTS / DROP ... IF EXISTS em tudo.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.escala_plantao_p4_diario (
  data       DATE PRIMARY KEY,
  hospital   TEXT NOT NULL CHECK (hospital IN ('unimed', 'hro', 'materno')),
  marcado_por TEXT,
  marcado_por_nome TEXT,
  marcado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.escala_plantao_p4_diario IS
  'Hospital onde o plantonista noturno P4 (coringa) está escalado em cada data. Sem linha = P4 aparece nos 3 hospitais na fase noturna das Liberações. Decisão do dono 2026-07-24.';

-- Audit server-side: quem marcou é sempre o usuário do JWT, nunca o que o
-- cliente mandar (regra audit-trail: changedBy é o user REAL).
--   • nullif(...,''): firebase_uid() devolve '' (não NULL) sem JWT — string vazia
--     no campo de auditoria vira "marcado por ninguém" na UI.
--   • marcado_por_nome vem do profiles pelo MESMO uid: no ramo DO UPDATE do
--     upsert o cliente pode omitir o nome e o do marcador ANTERIOR ficaria ao
--     lado do uid do novo (par divergente). SECURITY DEFINER existe por isto.
--   • hospital normalizado: 'Unimed'/' hro' estouraria o CHECK em vez de gravar.
CREATE OR REPLACE FUNCTION public.fn_escala_p4_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.hospital := lower(btrim(NEW.hospital));
  NEW.marcado_por := nullif(public.firebase_uid(), '');
  NEW.marcado_por_nome := coalesce(
    (select p.nome from public.profiles p where p.id = public.firebase_uid()),
    NEW.marcado_por_nome
  );
  NEW.marcado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_escala_p4_audit ON public.escala_plantao_p4_diario;
CREATE TRIGGER tr_escala_p4_audit
  BEFORE INSERT OR UPDATE ON public.escala_plantao_p4_diario
  FOR EACH ROW EXECUTE FUNCTION public.fn_escala_p4_audit();

-- ── RLS ────────────────────────────────────────────────────────────────
-- Mesmo predicado da escala cirúrgica: quem vê/edita a escala vê/edita a
-- marcação do P4 (equipe do centro cirúrgico). FORCE = vale até p/ o owner.
ALTER TABLE public.escala_plantao_p4_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_plantao_p4_diario FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_p4_select" ON public.escala_plantao_p4_diario;
CREATE POLICY "escala_p4_select" ON public.escala_plantao_p4_diario
  FOR SELECT TO authenticated
  USING ((select public.can_write_escala_cirurgica()));

DROP POLICY IF EXISTS "escala_p4_insert" ON public.escala_plantao_p4_diario;
CREATE POLICY "escala_p4_insert" ON public.escala_plantao_p4_diario
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_escala_cirurgica()));

DROP POLICY IF EXISTS "escala_p4_update" ON public.escala_plantao_p4_diario;
CREATE POLICY "escala_p4_update" ON public.escala_plantao_p4_diario
  FOR UPDATE TO authenticated
  USING ((select public.can_write_escala_cirurgica()))
  WITH CHECK ((select public.can_write_escala_cirurgica()));

-- DELETE é o ÚNICO caminho de "desmarcar": hospital é NOT NULL com CHECK fechado,
-- não existe estado neutro DENTRO da linha — apagar a linha do dia devolve o P4
-- aos três hospitais. A UI de hoje não expõe esse botão (decisão do dono 24/07:
-- o sheet só oferece os 3 hospitais); a policy fica pronta para quando expuser.
DROP POLICY IF EXISTS "escala_p4_delete" ON public.escala_plantao_p4_diario;
CREATE POLICY "escala_p4_delete" ON public.escala_plantao_p4_diario
  FOR DELETE TO authenticated
  USING ((select public.can_write_escala_cirurgica()));

COMMIT;

-- ── Realtime (marcação compartilhada ao vivo) — fora da transação, idempotente ──
-- Sem isto a subscription silencia e cada usuário veria uma marcação diferente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'escala_plantao_p4_diario'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_plantao_p4_diario;
  END IF;
END $$;

-- ROLLBACK (manual, nesta ordem) — migration puramente aditiva, não altera
-- nenhum objeto pré-existente da escala cirúrgica:
--   DROP TABLE IF EXISTS public.escala_plantao_p4_diario;  -- sai da publication junto
--   DROP FUNCTION IF EXISTS public.fn_escala_p4_audit();
