-- 026: Add metadata fields to documentos table
-- New columns for complete document management

-- 1. New metadata columns
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS data_publicacao timestamptz;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS data_versao timestamptz;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS classificacao_acesso text DEFAULT 'interno';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS local_armazenamento text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS responsavel_elaboracao text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS responsavel_aprovacao text;

-- 2. CHECK constraint for classificacao_acesso
ALTER TABLE documentos ADD CONSTRAINT chk_classificacao_acesso
  CHECK (classificacao_acesso IS NULL OR classificacao_acesso IN ('publico', 'interno', 'confidencial', 'restrito'));

-- 3. Relax codigo NOT NULL if it exists
DO $$
BEGIN
  ALTER TABLE documentos ALTER COLUMN codigo DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;
