-- ============================================================================
-- Wave 1 — Sincronizar pesos QMENTUM SQL ↔ JS (W1-3)
-- ----------------------------------------------------------------------------
-- Problema (auditoria 2026-05-04, Agente 1 + Agente 7):
-- O RPC rpc_compliance_score_qmentum hardcodeia pesos diferentes dos do
-- frontend (QMENTUM_CATEGORIES em src/types/documents.js):
--
--   Categoria      |  SQL  |  JS  |  Divergência
--   ---------------|-------|------|--------------
--   etica          |  1.2  |  1.2 |  OK
--   comites        |  1.0  |  1.0 |  OK
--   auditorias     |  1.5  |  1.5 |  OK
--   biblioteca     |  1.0  |  0.8 |  ⚠ DIVERGE
--   relatorios     |  0.8  |  1.0 |  ⚠ DIVERGE
--   financeiro     |  0.8  |  1.1 |  ⚠ DIVERGE
--   medicamentos   |  1.0  |  1.0 |  fallback else
--   infeccoes      |  1.0  |  1.0 |  fallback else
--   desastres      |  1.0  |  1.0 |  fallback else
--
-- Score reportado pelo SQL difere do JS para qualquer organização real.
--
-- Correção:
--   1. Criar tabela `qmentum_category_weights` como única fonte de verdade
--      com seed dos pesos canônicos (alinhados com src/types/documents.js,
--      que é a UX visível ao usuário).
--   2. Reescrever rpc_compliance_score_qmentum para ler da tabela.
--   3. Frontend pode opcionalmente ler em runtime para garantir consistência;
--      por ora mantém valores hardcoded em src/types/documents.js que são
--      idênticos.
-- ============================================================================

begin;

-- 1. Tabela de pesos
create table if not exists public.qmentum_category_weights (
  categoria   text primary key,
  weight      numeric(3,1) not null check (weight > 0 and weight <= 5),
  rop_area    text not null,
  descricao   text,
  updated_at  timestamptz not null default now()
);

comment on table public.qmentum_category_weights is
  'Pesos QMENTUM por categoria de documento. SSOT compartilhado com
   src/types/documents.js (frontend). Mudanças aqui exigem sincronização
   manual no código JS até que a Wave 2 implemente leitura runtime.';

-- 2. Seed canônico (idêntico a QMENTUM_CATEGORIES no frontend)
insert into public.qmentum_category_weights
  (categoria, weight, rop_area, descricao)
values
  ('etica',        1.2, 'Ética e Bioética',         'Comitê de ética + bioética'),
  ('comites',      1.0, 'Governança',               'Comitês internos'),
  ('auditorias',   1.5, 'Avaliação de Qualidade',   'Auditorias de qualidade'),
  ('relatorios',   1.0, 'Indicadores',              'Relatórios de gestão e indicadores'),
  ('biblioteca',   0.8, 'Padronização',             'Biblioteca técnica e protocolos'),
  ('financeiro',   1.1, 'Gestão Financeira',        'Relatórios e controles financeiros'),
  ('medicamentos', 1.0, 'Gestão de Medicamentos',   'Reconciliação, controle, dispensação'),
  ('infeccoes',    1.0, 'Prevenção de Infecções',   'Controle de infecções e cirurgia segura'),
  ('desastres',    1.0, 'Gestão de Desastres',      'Plano de contingência e desastres')
on conflict (categoria) do update
  set weight     = excluded.weight,
      rop_area   = excluded.rop_area,
      descricao  = excluded.descricao,
      updated_at = now();

-- 3. Trigger para auto-atualizar updated_at em mudanças futuras
create or replace function public.qmentum_weights_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_qmentum_weights_updated_at on public.qmentum_category_weights;
create trigger tr_qmentum_weights_updated_at
  before update on public.qmentum_category_weights
  for each row execute function public.qmentum_weights_updated_at();

-- 4. RLS — leitura para todos autenticados, escrita só admin
alter table public.qmentum_category_weights enable row level security;

drop policy if exists "qmentum_weights_select" on public.qmentum_category_weights;
create policy "qmentum_weights_select" on public.qmentum_category_weights
  for select to authenticated using (true);

drop policy if exists "qmentum_weights_admin_write" on public.qmentum_category_weights;
create policy "qmentum_weights_admin_write" on public.qmentum_category_weights
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Reescrever RPC para usar a tabela como fonte de pesos
create or replace function rpc_compliance_score_qmentum()
returns json as $$
  select json_build_object(
    'score', coalesce(round(
      sum(cat_score * coalesce(w.weight, 1.0))
      / nullif(sum(coalesce(w.weight, 1.0)), 0)
    ), null),
    'categories', coalesce(json_agg(json_build_object(
      'categoria', sub.categoria,
      'score',     cat_score,
      'weight',    coalesce(w.weight, 1.0),
      'rop_area',  coalesce(w.rop_area, ''),
      'total',     total,
      'ativos',    ativos,
      'vencidos',  overdue,
      'pendentes', pending
    )), '[]'::json)
  )
  from (
    select categoria,
      count(*)::int as total,
      count(*) filter (where status = 'ativo')::int as ativos,
      count(*) filter (where status = 'ativo' and proxima_revisao < now())::int as overdue,
      count(*) filter (where status = 'pendente')::int as pending,
      case
        when count(*) = 0 then null
        else greatest(0, least(100,
          100 - (count(*) filter (where status = 'ativo' and proxima_revisao < now()) * 10)
              - (count(*) filter (where status = 'pendente') * 5)
        ))
      end as cat_score
    from documentos
    where deleted_at is null  -- Wave 0: ignorar soft-deleted
    group by categoria
  ) sub
  left join public.qmentum_category_weights w on w.categoria = sub.categoria;
$$ language sql stable security definer;

comment on function rpc_compliance_score_qmentum() is
  'Score QMENTUM ponderado lendo pesos de qmentum_category_weights.
   Wave 1: filtra deleted_at IS NULL e usa null para categorias vazias
   (alinhado com computeQmentumScore JS).';

commit;

-- ============================================================================
-- VALIDAÇÃO
-- ============================================================================
-- 1. Pesos atuais:
--    SELECT * FROM qmentum_category_weights ORDER BY categoria;
-- 2. Score:
--    SELECT rpc_compliance_score_qmentum();
-- 3. Comparar com JS (deve bater para mesma entrada):
--    Frontend: useComplianceMetrics.qmentumScore
-- ============================================================================
