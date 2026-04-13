-- Migration 029: Adicionar campo residente ao cateter peridural
-- e campos anestesista/residente nas evoluções PO

-- Coluna residente na tabela principal (quem inseriu como residente, apenas HRO)
ALTER TABLE cateteres_peridural ADD COLUMN residente TEXT;

-- Colunas anestesista/residente na tabela de followup (evolução PO)
ALTER TABLE cateteres_peridural_followup ADD COLUMN anestesista_nome TEXT;
ALTER TABLE cateteres_peridural_followup ADD COLUMN residente_nome TEXT;
