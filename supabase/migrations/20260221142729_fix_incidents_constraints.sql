-- A1: Adicionar 'interno' ao CHECK constraint do source
ALTER TABLE incidentes DROP CONSTRAINT IF EXISTS incidentes_source_check;
ALTER TABLE incidentes ADD CONSTRAINT incidentes_source_check
  CHECK (source IN ('app','formulario_publico','externo','interno'));

-- A5: Habilitar real-time para tabela incidentes
ALTER PUBLICATION supabase_realtime ADD TABLE incidentes;
