-- ============================================================================
-- Papel `func-hro` — a conta "HRO" opera a escala igual à conta "Unimed"
-- ============================================================================
-- Decisão do dono 2026-09-09: "crie um usuário HRO, Usuário: HRO, Senha: [a
-- combinada] (exatamente igual ao acesso para funcionárias da Unimed)".
--
-- "Exatamente igual" é literal: mesmo conjunto de poderes da conta `func-unimed`
-- criada em 08/09 — OPERA o dia inteiro (status, urgência, acrescentar caso,
-- liberar, ajuda, observação) e NÃO PUBLICA. Por isso esta migration mexe em
-- exatamente duas coisas:
--
--   profiles_role_check            → passa a aceitar 'func-hro'
--   can_write_escala_cirurgica()   → ganha 'func-hro'
--
-- E deliberadamente NÃO mexe em `can_publicar_escala_cirurgica()`: publicar
-- continua sendo da equipe. `pode_publicar_escala_turno()` também fica como
-- está — a exceção estreita dela (linha VAZIA do dia, para o `garantirEscala()`
-- da tela) já é escrita em cima de `can_write_escala_cirurgica()`, então a conta
-- HRO herda essa exceção pelo mesmo caminho da conta Unimed, sem cláusula nova.
--
-- Papel separado, e não a conta HRO reusando 'func-unimed', porque o rótulo do
-- cargo é o que a tela mostra: o dono pediu "apenas Unimed (quando o login for
-- realizado pela Unimed) e HRO (quando o login for realizado pelo HRO)".
--
-- Idempotente: roda duas vezes sem efeito colateral.

-- ── 1. profiles.role aceita o papel novo ────────────────────────────────────
-- ⚠️ A lista é REESCRITA inteira (o CHECK não é aditivo): manter os 8 papéis de
-- 20260908190000 e acrescentar o nono. Perder um aqui trava o login de um cargo.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array[
    'anestesiologista','medico-residente','enfermeiro','tec-enfermagem',
    'farmaceutico','colaborador','secretaria','func-unimed','func-hro'
  ]));

-- ── 2. OPERAR a escala (gate de leitura + escrita do dia) ───────────────────
create or replace function public.can_write_escala_cirurgica()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and lower(coalesce(p.role, '')) in (
        'anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria',
        -- contas compartilhadas do centro cirúrgico: operam o dia; publicar é
        -- outro gate (2026-09-08 Unimed, 2026-09-09 HRO)
        'func-unimed', 'func-hro'
      )
  ) or public.is_admin();
$function$;

comment on function public.can_write_escala_cirurgica() is
  'OPERAR a escala cirúrgica (ler + escrever o dia): equipe do centro cirúrgico + contas de hospital (func-unimed, func-hro) + admin. Para PUBLICAR, ver can_publicar_escala_cirurgica().';
