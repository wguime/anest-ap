-- Migration 024: Add 'desastres' to documentos categoria CHECK constraint
-- This allows documents to be categorized under "Gerenciamento de Desastres"

ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_categoria_check;

ALTER TABLE documentos ADD CONSTRAINT documentos_categoria_check
  CHECK (categoria IN (
    'etica', 'comites', 'auditorias', 'relatorios',
    'biblioteca', 'financeiro', 'medicamentos', 'infeccoes', 'desastres'
  ));
