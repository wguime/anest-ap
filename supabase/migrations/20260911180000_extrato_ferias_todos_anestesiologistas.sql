-- ============================================================================
-- Extrato de Férias — a LEITURA abre a todo anestesiologista
-- ============================================================================
-- Decisão do dono 2026-09-11: "libere a funcionalidade de conferência de
-- extrato de férias para todos os anestesistas (NÃO é para liberar para
-- funcionários, enfermeiros, farmacêuticos, residentes...)".
--
-- Até aqui `can_access_extrato_ferias()` era uma allowlist de 5 e-mails
-- (20260803233000 → 20260804160000). Passa a ser o CARGO: profiles.role =
-- 'anestesiologista', ativo. Os 5 e-mails da lista antiga têm esse cargo em
-- produção (conferido antes desta migration), então ninguém perde acesso.
-- Sem `is_admin()`: administrador de outro cargo fica de fora, como pedido.
--
-- Esta função é a policy de SELECT (e o `WITH CHECK` de INSERT, junto com o
-- uid) de ferias_violacoes_vistas, ferias_marcacoes_vistas e
-- ferias_movimentacoes. Ela abre a LEITURA; o que cada anestesiologista pode
-- ESCREVER não muda:
--   - ferias_movimentacoes exige `nome = ferias_nome_socio()`, que continua
--     mapeando só os 5 e-mails — quem não está lá vê o extrato, não marca;
--   - ferias_violacoes_vistas / ferias_marcacoes_vistas são append-only e
--     amarradas ao uid de quem registra (first-seen de alerta/marcação); o
--     primeiro anestesiologista a abrir a página registra, como já acontecia
--     com a lista antiga.
--
-- Espelho do front: `podeVerExtratoFerias` em src/pages/ferias/gate.js
-- (normalizeRole(user.role) === 'anestesiologista'). Mudar um = mudar o outro.
--
-- Idempotente: create or replace.
-- ============================================================================

BEGIN;

create or replace function public.can_access_extrato_ferias()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and p.active is not false
      and lower(trim(coalesce(p.role, ''))) = 'anestesiologista'
  );
$$;

comment on function public.can_access_extrato_ferias() is
  'true se o usuário corrente pode ver o Extrato de Férias — todo anestesiologista ativo (profiles.role), dono 2026-09-11. Sem is_admin. Espelha podeVerExtratoFerias em src/pages/ferias/gate.js; mudar um = mudar o outro. Quem pode MARCAR continua em ferias_nome_socio().';

COMMIT;
