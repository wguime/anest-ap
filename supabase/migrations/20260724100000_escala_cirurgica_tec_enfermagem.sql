-- ════════════════════════════════════════════════════════════════════════
-- 20260724100000_escala_cirurgica_tec_enfermagem.sql
-- Escala Cirúrgica COLABORATIVA — inclui técnico de enfermagem (decisão do dono
-- 2026-07-24). A equipe do centro cirúrgico opera a escala junta.
--
-- can_write_escala_cirurgica() gateia leitura E escrita das tabelas do módulo
-- (escala_cirurgica, _caso, _evento, _alias, trocas_cirurgicas) e os RPCs de
-- status. Adiciona 'tec-enfermagem' ao conjunto — residentes (medico-residente)
-- e secretária já estavam. Nada mais muda: mesmas policies, mesmo SECURITY DEFINER.
--
-- Idempotente: create or replace + grants repetíveis.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create or replace function public.can_write_escala_cirurgica()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and lower(coalesce(p.role, '')) in ('anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria')
  ) or public.is_admin();
$$;

revoke execute on function public.can_write_escala_cirurgica() from public, anon;
grant execute on function public.can_write_escala_cirurgica() to authenticated, service_role;

comment on function public.can_write_escala_cirurgica() is
  'true se o usuário corrente pode ver/editar a escala cirúrgica (equipe do centro cirúrgico: anestesiologista/medico-residente/tec-enfermagem/secretaria OU admin). Escala colaborativa (decisão do dono 2026-07-24). Leitura e escrita usam este mesmo predicado.';

COMMIT;
