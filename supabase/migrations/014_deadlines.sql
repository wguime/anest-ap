-- 014_deadlines.sql
-- Adiciona campo prazo (deadline) para auditorias interativas e autoavaliacao

ALTER TABLE auditoria_execucoes ADD COLUMN prazo DATE;
ALTER TABLE autoavaliacao_rop ADD COLUMN prazo DATE;

CREATE INDEX idx_aud_exec_prazo ON auditoria_execucoes(prazo);
CREATE INDEX idx_auto_rop_prazo ON autoavaliacao_rop(prazo);
