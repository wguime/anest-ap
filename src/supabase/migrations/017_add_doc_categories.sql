-- Migration 017: Expand documentos.categoria CHECK constraint
-- Add 'medicamentos' and 'infeccoes' categories to align with 6 Qmentum ROP areas

-- Drop existing constraint
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_categoria_check;

-- Recreate with all 8 categories
ALTER TABLE documentos ADD CONSTRAINT documentos_categoria_check
  CHECK (categoria IN (
    'etica',
    'comites',
    'auditorias',
    'relatorios',
    'biblioteca',
    'financeiro',
    'medicamentos',
    'infeccoes'
  ));
