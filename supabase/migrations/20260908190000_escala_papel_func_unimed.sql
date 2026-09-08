-- ============================================================================
-- Papel `func-unimed` — funcionárias da Unimed OPERAM a escala, mas não PUBLICAM
-- ============================================================================
-- Decisão do dono 2026-09-08: uma conta para as funcionárias da Unimed com
-- acesso só à Escala Cirúrgica. Elas fazem tudo que a equipe faz na tela do dia
-- (marcar iniciada/terminada, urgência, acrescentar procedimento, liberar,
-- ajuda externa) — "as mesmas funcionalidades que os usuários têm ao acessarem
-- as escalas. nao podem publicar escalas apenas."
--
-- Até aqui `can_write_escala_cirurgica()` respondia pelas DUAS coisas: operar o
-- dia e publicar a escala. Esta migration separa:
--
--   can_write_escala_cirurgica()     → OPERAR  (ganha 'func-unimed')
--   can_publicar_escala_cirurgica()  → PUBLICAR (o conjunto de antes, sem ela)
--
-- ⚠️ A ÚNICA publicação que `func-unimed` faz é a linha VAZIA do dia: a tela
-- chama `garantirEscala()` (EscalaCirurgicaPage) antes de "adicionar caso" num
-- hospital que ainda não tem escala — sem isso o Materno ficaria sem ação
-- nenhuma para elas. `pode_publicar_escala_turno()` autoriza esse caso estreito
-- (0 casos E nenhuma escala existente para data+hospital) e nada mais: publicar
-- por cima de escala existente, ou com casos, continua barrado.
--
-- Idempotente: roda duas vezes sem efeito colateral.

-- ── 1. profiles.role aceita o papel novo ────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array[
    'anestesiologista','medico-residente','enfermeiro','tec-enfermagem',
    'farmaceutico','colaborador','secretaria','func-unimed'
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
        -- 2026-09-08: funcionárias da Unimed operam o dia; publicar é outro gate
        'func-unimed'
      )
  ) or public.is_admin();
$function$;

comment on function public.can_write_escala_cirurgica() is
  'OPERAR a escala cirúrgica (ler + escrever o dia): equipe do centro cirúrgico + func-unimed + admin. Para PUBLICAR, ver can_publicar_escala_cirurgica().';

-- ── 3. PUBLICAR a escala (importação/substituição do turno) ─────────────────
create or replace function public.can_publicar_escala_cirurgica()
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
        'anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria'
      )
  ) or public.is_admin();
$function$;

comment on function public.can_publicar_escala_cirurgica() is
  'PUBLICAR/substituir escala cirúrgica (importação da foto, exclusão da escala). Conjunto de can_write_escala_cirurgica() MENOS func-unimed.';

revoke execute on function public.can_publicar_escala_cirurgica() from public, anon;
grant execute on function public.can_publicar_escala_cirurgica() to authenticated, service_role;

-- ── 4. A exceção estreita: criar a linha VAZIA do dia ───────────────────────
create or replace function public.pode_publicar_escala_turno(
  p_data date, p_hospital text, p_casos jsonb
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.can_publicar_escala_cirurgica()
     or (
       -- garantirEscala(): quem só opera pode criar a linha do dia quando ela
       -- não existe e vem SEM casos. Publicação de verdade nunca cai aqui.
       public.can_write_escala_cirurgica()
       and coalesce(jsonb_array_length(coalesce(p_casos, '[]'::jsonb)), 0) = 0
       and not exists (
         select 1 from public.escala_cirurgica e
         where e.data = p_data and e.hospital = p_hospital
       )
     );
$function$;

comment on function public.pode_publicar_escala_turno(date, text, jsonb) is
  'Gate de rpc_publicar_escala_turno: publica quem pode publicar; quem só opera cria apenas a linha vazia do dia (garantirEscala).';

revoke execute on function public.pode_publicar_escala_turno(date, text, jsonb) from public, anon;
grant execute on function public.pode_publicar_escala_turno(date, text, jsonb) to authenticated, service_role;

-- ── 5. Trocar o gate DENTRO das duas RPCs de publicação ─────────────────────
-- Reescrita cirúrgica sobre a definição VIVA (pg_get_functiondef): o corpo da
-- rpc_publicar_escala_turno tem ~16 KB e copiá-lo para cá convidaria drift.
-- Se a âncora não existir e o gate novo também não, aborta alto — nunca deixa a
-- função pela metade.
do $do$
declare
  v_def  text;
  v_ancora text := 'if not public.can_write_escala_cirurgica() then
    raise exception ''permission_denied: sem acesso à escala cirúrgica'' using errcode = ''42501'';
  end if;';
  v_novo text := 'if not public.pode_publicar_escala_turno(p_data, p_hospital, p_casos) then
    raise exception ''permission_denied: sem permissão para publicar escala'' using errcode = ''42501'';
  end if;';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'rpc_publicar_escala_turno';

  if v_def is null then
    raise exception 'rpc_publicar_escala_turno não existe';
  end if;

  if position(v_novo in v_def) > 0 then
    raise notice 'rpc_publicar_escala_turno já usa pode_publicar_escala_turno — nada a fazer';
  elsif position(v_ancora in v_def) = 0 then
    raise exception 'âncora do gate não encontrada em rpc_publicar_escala_turno — abortando';
  else
    execute replace(v_def, v_ancora, v_novo);
  end if;
end
$do$;

do $do$
declare
  v_def text;
  v_ancora text := 'if not public.can_write_escala_cirurgica() then';
  v_novo   text := 'if not public.can_publicar_escala_cirurgica() then';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'rpc_salvar_escala_cirurgica';

  if v_def is null then
    raise exception 'rpc_salvar_escala_cirurgica não existe';
  end if;

  if position(v_novo in v_def) > 0 then
    raise notice 'rpc_salvar_escala_cirurgica já usa can_publicar_escala_cirurgica — nada a fazer';
  elsif position(v_ancora in v_def) = 0 then
    raise exception 'âncora do gate não encontrada em rpc_salvar_escala_cirurgica — abortando';
  else
    execute replace(v_def, v_ancora, v_novo);
  end if;
end
$do$;

-- ── 6. Cabeçalho da escala: criar/apagar é privilégio de quem publica ───────
-- UPDATE continua no gate de operação (liberações, ordem do rodapé, ajuda
-- externa e urgências são o dia a dia). INSERT/DELETE diretos, não: a linha do
-- dia nasce pela RPC (que já sabe distinguir os dois casos) e apagar a escala
-- inteira é ato de quem publica.
drop policy if exists escala_cirurgica_insert on public.escala_cirurgica;
create policy escala_cirurgica_insert on public.escala_cirurgica
  for insert to authenticated
  with check ((select public.can_publicar_escala_cirurgica()));

drop policy if exists escala_cirurgica_delete on public.escala_cirurgica;
create policy escala_cirurgica_delete on public.escala_cirurgica
  for delete to authenticated
  using ((select public.can_publicar_escala_cirurgica()));
