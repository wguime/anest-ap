-- ==========================================================================
-- 20260622120000_unimed_tuss_codigos.sql
-- Codificação Anestésica — catálogo de referência TUSS Unimed (read-only)
--
-- Objetivo:
--   Tabela de lookup dos ~5.4k códigos TUSS das listas referenciais Unimed
--   (HM v.2025.05 + SADT v.2026.02), usada pela calculadora de guia / assistente
--   de codificação anestésica para classificar qualquer código colado:
--     - tem indicador anestésico → anestesia paga embutida (mostra valor)
--     - porte anestésico 0 / sem indicador / SADT diagnóstico → recomenda código 31602
--
--   Catálogo imutável de referência (revisado ~2×/ano por reseed). Sem changelog/audit:
--   não há mutação por usuário, só leitura.
--
-- RLS (padrão catálogo aberto, igual rop_questions 20260609120000):
--   - SELECT: todo authenticated
--   - INSERT/UPDATE/DELETE: só public.is_admin()  (seed roda via Management API/superuser)
--
-- Valores na tabela Intercâmbio Nacional (UTM R$ 1,17). A tabela local Unimed Chapecó
-- (UTM R$ 1,73, com subsídio) é derivada em runtime (valor × 1,73/1,17), não armazenada.
--
-- Seed: scripts/extract-tuss-from-xlsx.mjs → scripts/seed-unimed-tuss.mjs --apply
-- ==========================================================================

create extension if not exists pgcrypto;

create table if not exists public.unimed_tuss_codigos (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  descricao             text,
  lista                 text not null check (lista in ('HM', 'SADT')),
  cobertura             text not null default 'coberto'
                          check (cobertura in ('coberto', 'sem_cobertura')),
  indicador_anestesico  text,
  valor_anestesista     numeric,
  valor_cirurgiao       numeric,
  porte_cirurgico       text,
  porte_anestesico      int,
  numero_auxiliares     int,
  classificacao         text,
  documentacao          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.unimed_tuss_codigos is
  'Catálogo read-only dos códigos TUSS das listas referenciais Unimed (HM+SADT). Valores na tabela Intercâmbio Nacional (UTM 1,17). Seed via scripts/seed-unimed-tuss.mjs.';
comment on column public.unimed_tuss_codigos.indicador_anestesico is
  'Letra A-Z do indicador anestésico; null = anestesia não paga embutida neste código.';
comment on column public.unimed_tuss_codigos.porte_anestesico is
  '0-8 (AN0-AN8); 0 = anestesia local presumida (não paga anestesista).';

create index if not exists idx_unimed_tuss_lista on public.unimed_tuss_codigos (lista);

-- RLS -----------------------------------------------------------------------
alter table public.unimed_tuss_codigos enable row level security;

drop policy if exists unimed_tuss_select       on public.unimed_tuss_codigos;
drop policy if exists unimed_tuss_admin_write   on public.unimed_tuss_codigos;

create policy unimed_tuss_select
  on public.unimed_tuss_codigos for select to authenticated using (true);

create policy unimed_tuss_admin_write
  on public.unimed_tuss_codigos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
