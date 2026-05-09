-- =============================================================================
-- Sprint 8 / Onda 2 / O2-7 — Tags hierárquicas (taxonomia)
-- -----------------------------------------------------------------------------
-- Backward-compatible: NÃO altera coluna `documentos.tags text[]` (já indexada
-- via GIN, integrada ao FTS weight C, e usada em filtros existentes).
--
-- A tabela `tags` define a TAXONOMIA (catálogo + hierarquia + metadados).
-- A coluna `documentos.tags` continua armazenando slugs (string[]) — agora
-- com lookup contra `tags.slug` para validação opcional e exibição de
-- label/parent.
--
-- Hierarquia via parent_slug (self-FK, nullable na raiz). Profundidade
-- arbitrária; ciclos prevenidos por trigger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tags (
  slug         text PRIMARY KEY
                 CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$'),
  label        text NOT NULL,
  parent_slug  text REFERENCES public.tags(slug) ON DELETE RESTRICT,
  descricao    text,
  color        text,                              -- hex opcional para UI
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_parent ON public.tags(parent_slug);

COMMENT ON TABLE public.tags IS
  'Taxonomia hierárquica de tags. documentos.tags (text[]) referencia slugs daqui.';
COMMENT ON COLUMN public.tags.slug IS
  'Identificador estável usado em documentos.tags. Lower-snake/kebab-case.';
COMMENT ON COLUMN public.tags.parent_slug IS
  'Tag pai na hierarquia (NULL = raiz). RESTRICT para evitar órfãos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: prevenir ciclos parent_slug (auto-referência ou loop transitivo)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tags_prevent_cycle() RETURNS trigger AS $$
DECLARE
  cur text;
  visited text[] := ARRAY[]::text[];
BEGIN
  IF NEW.parent_slug IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_slug = NEW.slug THEN
    RAISE EXCEPTION 'tag % não pode ser pai dela mesma', NEW.slug;
  END IF;
  cur := NEW.parent_slug;
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.slug THEN
      RAISE EXCEPTION 'ciclo detectado: % aparece em sua própria cadeia de ancestrais', NEW.slug;
    END IF;
    IF cur = ANY(visited) THEN
      RAISE EXCEPTION 'ciclo pré-existente em %', cur;
    END IF;
    visited := array_append(visited, cur);
    SELECT parent_slug INTO cur FROM public.tags WHERE slug = cur;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tags_prevent_cycle ON public.tags;
CREATE TRIGGER tr_tags_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_slug ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.tags_prevent_cycle();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tags_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tags_updated_at ON public.tags;
CREATE TRIGGER tr_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.tags_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: descendentes de uma tag (incluindo ela própria)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_tag_descendants(p_slug text)
RETURNS TABLE(slug text, label text, parent_slug text, depth int) AS $$
  WITH RECURSIVE tree AS (
    SELECT t.slug, t.label, t.parent_slug, 0 AS depth
    FROM public.tags t WHERE t.slug = p_slug
    UNION ALL
    SELECT t.slug, t.label, t.parent_slug, tr.depth + 1
    FROM public.tags t JOIN tree tr ON t.parent_slug = tr.slug
  )
  SELECT * FROM tree;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_tag_descendants(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: filtra documentos por tag + descendentes
-- (usado pelo filtro hierárquico em BibliotecaPage)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_documentos_by_tag_tree(p_slug text)
RETURNS SETOF text AS $$
  SELECT d.id
  FROM public.documentos d
  WHERE d.deleted_at IS NULL
    AND d.tags && (
      SELECT array_agg(slug) FROM public.rpc_tag_descendants(p_slug)
    );
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_documentos_by_tag_tree(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_read_authenticated ON public.tags;
CREATE POLICY tags_read_authenticated ON public.tags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tags_write_admin ON public.tags;
CREATE POLICY tags_write_admin ON public.tags
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed inicial — taxonomia mínima alinhada às categorias existentes
-- (admin pode adicionar mais via UI futura)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.tags (slug, label, parent_slug, descricao, created_by) VALUES
  ('clinico',           'Clínico',            NULL,         'Documentos clínicos em geral', 'system'),
  ('anestesia',         'Anestesia',          'clinico',    'Específico de anestesiologia', 'system'),
  ('anestesia-geral',   'Anestesia Geral',    'anestesia',  NULL, 'system'),
  ('anestesia-regional','Anestesia Regional', 'anestesia',  NULL, 'system'),
  ('anestesia-pediatrica','Anestesia Pediátrica','anestesia',NULL,'system'),
  ('seguranca',         'Segurança',          NULL,         'Protocolos e checklists de segurança', 'system'),
  ('checklist-cirurgico','Checklist Cirúrgico','seguranca', NULL, 'system'),
  ('higiene-maos',      'Higiene de Mãos',    'seguranca',  NULL, 'system'),
  ('infeccoes',         'Infecções',          NULL,         'Prevenção e controle de infecções', 'system'),
  ('medicamentos',      'Medicamentos',       NULL,         'Protocolos farmacológicos', 'system'),
  ('emergencia',        'Emergência',         NULL,         'Protocolos de emergência', 'system'),
  ('qualidade',         'Qualidade',          NULL,         'Indicadores e auditorias', 'system'),
  ('lgpd',              'LGPD',               'qualidade',  NULL, 'system'),
  ('qmentum',           'Qmentum',            'qualidade',  NULL, 'system')
ON CONFLICT (slug) DO NOTHING;
