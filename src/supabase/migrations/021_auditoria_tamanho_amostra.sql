-- 021: Tamanho da amostra para auditorias interativas
ALTER TABLE auditoria_execucoes ADD COLUMN IF NOT EXISTS tamanho_amostra INTEGER DEFAULT NULL;
