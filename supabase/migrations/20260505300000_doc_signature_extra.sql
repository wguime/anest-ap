-- ============================================================================
-- Migration: doc_signature_extra (Onda 1-1)
-- Date: 2026-05-05
-- Roadmap: ANEST V2 — Onda 1, agente Onda1-1 (SHA-256 + signed PDF)
--
-- Adiciona, em `documento_aprovacoes`, as colunas necessárias para
-- materializar a assinatura criptográfica de um PDF aprovado:
--
--   * signed_pdf_url           — URL pública/signed do PDF assinado
--   * signed_pdf_storage_path  — path imutável no bucket `documentos-assinados`
--   * signature_algo           — algoritmo do hash (default 'SHA-256')
--
-- A coluna `signature_hash` (64-char hex SHA-256) já existe desde
-- `001_schema.sql:163-181`. A coluna `decided_at` (existente) cobre o
-- carimbo temporal da assinatura — não criamos `signed_at` redundante.
--
-- Imutabilidade (audit trail): os valores escritos aqui NÃO devem ser
-- atualizados após o primeiro insert. Bloqueio via WORM/triggers fica
-- a cargo do agente Onda1-4 (changelog imutável). Esta migration é
-- apenas a infraestrutura de schema.
--
-- Algoritmo: SHA-256 (NIST FIPS 180-4). Saída 64 chars hex lowercase.
--
-- BUCKET de storage: `documentos-assinados` deve existir. Crie-o via
-- dashboard do Supabase OU via migration separada (insert em
-- storage.buckets) caso ainda não exista. Esta migration NÃO cria o
-- bucket, apenas as colunas que referenciam o path dentro dele.
-- ============================================================================

ALTER TABLE documento_aprovacoes
  ADD COLUMN IF NOT EXISTS signed_pdf_url text;

ALTER TABLE documento_aprovacoes
  ADD COLUMN IF NOT EXISTS signed_pdf_storage_path text;

ALTER TABLE documento_aprovacoes
  ADD COLUMN IF NOT EXISTS signature_algo text DEFAULT 'SHA-256';

COMMENT ON COLUMN documento_aprovacoes.signed_pdf_url IS
  'URL (signed ou pública) do PDF copiado para `documentos-assinados/` no momento da aprovação. Imutável após escrita — fonte de verdade da versão assinada.';

COMMENT ON COLUMN documento_aprovacoes.signed_pdf_storage_path IS
  'Path dentro do bucket `documentos-assinados` (formato: `<docId>/<aprovacaoId>.pdf`). Imutável. Usado para audit/recovery.';

COMMENT ON COLUMN documento_aprovacoes.signature_algo IS
  'Algoritmo do `signature_hash`. Default SHA-256 (NIST FIPS 180-4, 64 chars hex). Coluna existe para futura migração se SHA-3/SHA-512 forem adotados.';
