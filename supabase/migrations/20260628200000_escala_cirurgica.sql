-- ════════════════════════════════════════════════════════════════════════
-- 20260628200000_escala_cirurgica.sql
-- Módulo: Escala Cirúrgica Diária + Painel de Liberação (Fase 1 / MVP)
--
-- Modela a escala do dia por hospital (Unimed/HRO/Materno) como
--   escala_cirurgica (cabeçalho, 1 por data×hospital)
--   escala_cirurgica_caso (1 por cirurgia/linha da imagem)
-- Vocabulário inspirado em FHIR (Schedule→Slot/Appointment) em tabelas simples.
--
-- RLS (modelo do módulo cateter, 20260627200000):
--   • leitura: qualquer usuário autenticado (todos veem o board do dia)
--   • escrita: anestesiologista/medico-residente OU admin (equipe de escalas)
--
-- LGPD: paciente só por iniciais (paciente_iniciais); nenhum nome completo.
-- Realtime: ambas as tabelas no publication (board ao vivo).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Helper: quem pode ESCREVER escala (equipe de escalas = clínicos) ───────
-- Mesmo padrão SECURITY DEFINER de can_write_cateter().
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
      and lower(coalesce(p.role, '')) in ('anestesiologista', 'medico-residente', 'secretaria')
  ) or public.is_admin();
$$;

revoke execute on function public.can_write_escala_cirurgica() from public, anon;
grant execute on function public.can_write_escala_cirurgica() to authenticated, service_role;

comment on function public.can_write_escala_cirurgica() is
  'true se o usuário corrente pode importar/editar/confeccionar a escala cirúrgica (anestesiologista/medico-residente/secretaria OU admin). A secretária confecciona a escala (atribui anestesistas do roster). Leitura restrita aos mesmos papéis.';

-- Helper: quem GERENCIA o dicionário de apelidos (qualquer linha). Mais estreito que
-- can_write: só coordenador (secretária) + admin — o anestesista só edita o PRÓPRIO alias
-- (self-claim), via predicado user_id = firebase_uid() na policy. Evita hijack de apelido.
create or replace function public.can_manage_alias_escala()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and lower(coalesce(p.role, '')) = 'secretaria'
  ) or public.is_admin();
$$;

revoke execute on function public.can_manage_alias_escala() from public, anon;
grant execute on function public.can_manage_alias_escala() to authenticated, service_role;

-- ── Tabela: escala_cirurgica (cabeçalho) ───────────────────────────────────
create table if not exists public.escala_cirurgica (
  id                 uuid primary key default gen_random_uuid(),
  data               date not null,
  hospital           text not null check (hospital in ('unimed', 'hro', 'materno')),
  status             text not null default 'rascunho' check (status in ('rascunho', 'publicada')),
  ordem_liberacao    jsonb not null default '[]'::jsonb,   -- nomes do rodapé, na ordem; editável
  liberacoes         jsonb not null default '{}'::jsonb,   -- { "<anestesista>": { liberadoEm, por } }
  linha_overrides    jsonb not null default '{}'::jsonb,   -- override do plantonista por anestesista: { "<chave>": { local?, cirurgioes?, por, em } }
  vinculos           jsonb not null default '{}'::jsonb,   -- { "<NOME_NORMALIZADO>": "<user_uid>" } p/ notificações
  source_image_path  text,
  published_at       timestamptz,
  published_by       text,
  published_by_name  text,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (data, hospital)
);

comment on table public.escala_cirurgica is
  'Escala cirúrgica do dia por hospital. ordem_liberacao = rodapé (ordem de liberação); liberacoes = marcações do plantonista. Paciente nunca aqui (só nos casos, por iniciais).';

-- ── Tabela: escala_cirurgica_caso (1 por cirurgia) ─────────────────────────
create table if not exists public.escala_cirurgica_caso (
  id                uuid primary key default gen_random_uuid(),
  escala_id         uuid not null references public.escala_cirurgica(id) on delete cascade,
  sala              text not null default '',
  ordem             integer not null default 0,            -- ordem dentro da sala (sequência da imagem)
  hora              text,
  tempo_estimado    text,
  -- LGPD: só iniciais — o CHECK bloqueia qualquer sequência de 3+ letras (nomes),
  -- aceitando "C.S.G.", "C S G", "MC" etc. Falha alto no publish é preferível a persistir nome.
  paciente_iniciais text check (
    paciente_iniciais is null
    or (char_length(paciente_iniciais) <= 12 and paciente_iniciais !~ '[[:alpha:]]{3,}')
  ),
  idade             text,                                  -- idade do paciente quando houver (ex.: "37a")
  procedimento      text,
  convenio          text,
  cirurgiao         text,
  cirurgiao_display text,                                  -- "Primeiro N" pré-computado
  anestesista       text,                                  -- apelido de escala p/ exibição (pode ser '//')
  anestesista_user_id text,                                -- login (profiles.id) resolvido na atribuição — identidade robusta
  bloco             text not null default 'normal',
  is_continuacao    boolean not null default false,
  sem_anestesista   boolean not null default false,        -- caso "?"
  tipo              text not null default 'eletiva' check (tipo in ('eletiva', 'urgencia', 'emergencia')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.escala_cirurgica_caso is
  'Casos cirúrgicos da escala. anestesista "//" herda da linha acima na mesma sala (regra 2 da coluna de liberação). LGPD: paciente_iniciais apenas.';

create index if not exists idx_escala_caso_escala on public.escala_cirurgica_caso (escala_id);
create index if not exists idx_escala_caso_ordem  on public.escala_cirurgica_caso (escala_id, sala, ordem);
create index if not exists idx_escala_caso_anest_uid on public.escala_cirurgica_caso (anestesista_user_id);
-- (data, hospital) já é indexado pelo UNIQUE da tabela — sem índice extra.

-- ── Tabela: escala_anestesista_alias (dicionário apelido↔login) ─────────────
-- Resolve a identidade do anestesista de forma estável: cada login pode ter N
-- apelidos de escala (EDUARDO, PED EDUARDO). A secretária/coordenador mantém o
-- dicionário (aprende 1x) e o anestesista pode reivindicar o próprio (self-claim).
create table if not exists public.escala_anestesista_alias (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,                 -- profiles.id (login)
  apelido    text not null
    -- normalização UPPER deixa de ser só convenção: 'Garim' e 'GARIM' não coexistem
    check (apelido <> '' and apelido = upper(btrim(apelido))),
  created_by text,
  created_at timestamptz not null default now(),
  unique (apelido)
);
comment on table public.escala_anestesista_alias is
  'Dicionário apelido (de escala) → login. Resolve identidade do anestesista de forma estável (fim do match por nome). apelido UNIQUE: um apelido aponta para um único login.';
create index if not exists idx_escala_alias_user on public.escala_anestesista_alias (user_id);

-- ── updated_at automático (função global update_updated_at de 001_schema) ───
drop trigger if exists tr_escala_cirurgica_updated_at on public.escala_cirurgica;
create trigger tr_escala_cirurgica_updated_at before update on public.escala_cirurgica
  for each row execute function update_updated_at();

drop trigger if exists tr_escala_caso_updated_at on public.escala_cirurgica_caso;
create trigger tr_escala_caso_updated_at before update on public.escala_cirurgica_caso
  for each row execute function update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.escala_cirurgica enable row level security;
alter table public.escala_cirurgica_caso enable row level security;

-- escala_cirurgica: leitura para clínicos + admin (LGPD: paciente_iniciais+procedimento+
-- cirurgião podem reidentificar em hospital pequeno; mesmo fechamento do módulo cateter,
-- 20260627200000). Cobre todos os anestesistas/plantonista; papéis não-clínicos não leem.
drop policy if exists "escala_cirurgica_select" on public.escala_cirurgica;
create policy "escala_cirurgica_select" on public.escala_cirurgica
  for select to authenticated using ((select public.can_write_escala_cirurgica()));

drop policy if exists "escala_cirurgica_insert" on public.escala_cirurgica;
create policy "escala_cirurgica_insert" on public.escala_cirurgica
  for insert to authenticated with check ((select public.can_write_escala_cirurgica()));

drop policy if exists "escala_cirurgica_update" on public.escala_cirurgica;
create policy "escala_cirurgica_update" on public.escala_cirurgica
  for update to authenticated
  using ((select public.can_write_escala_cirurgica()))
  with check ((select public.can_write_escala_cirurgica()));

drop policy if exists "escala_cirurgica_delete" on public.escala_cirurgica;
create policy "escala_cirurgica_delete" on public.escala_cirurgica
  for delete to authenticated using ((select public.can_write_escala_cirurgica()));

-- escala_cirurgica_caso: leitura para clínicos + admin (mesma justificativa LGPD acima)
drop policy if exists "escala_caso_select" on public.escala_cirurgica_caso;
create policy "escala_caso_select" on public.escala_cirurgica_caso
  for select to authenticated using ((select public.can_write_escala_cirurgica()));

drop policy if exists "escala_caso_insert" on public.escala_cirurgica_caso;
create policy "escala_caso_insert" on public.escala_cirurgica_caso
  for insert to authenticated with check ((select public.can_write_escala_cirurgica()));

drop policy if exists "escala_caso_update" on public.escala_cirurgica_caso;
create policy "escala_caso_update" on public.escala_cirurgica_caso
  for update to authenticated
  using ((select public.can_write_escala_cirurgica()))
  with check ((select public.can_write_escala_cirurgica()));

drop policy if exists "escala_caso_delete" on public.escala_cirurgica_caso;
create policy "escala_caso_delete" on public.escala_cirurgica_caso
  for delete to authenticated using ((select public.can_write_escala_cirurgica()));

-- escala_anestesista_alias: leitura p/ clínicos/secretária/admin (resolução + atribuição).
-- Escrita: coordenador/secretária/admin (qualquer alias) OU o próprio anestesista (self-claim).
alter table public.escala_anestesista_alias enable row level security;

drop policy if exists "escala_alias_select" on public.escala_anestesista_alias;
create policy "escala_alias_select" on public.escala_anestesista_alias
  for select to authenticated using ((select public.can_write_escala_cirurgica()));

-- Escrita: coordenador (secretária)/admin gerenciam QUALQUER alias; anestesista só o PRÓPRIO
-- (self-claim). Como can_manage NÃO inclui anestesiologista, ele cai no ramo user_id=firebase_uid()
-- — um upsert sobre apelido de outro login falha no USING (linha existente tem user_id≠eu).
-- RISCO CONHECIDO (aceito no MVP): apelido AINDA NÃO registrado pode ser reivindicado por
-- qualquer clínico (squatting); a secretária/admin corrige reapontando via can_manage.
drop policy if exists "escala_alias_insert" on public.escala_anestesista_alias;
create policy "escala_alias_insert" on public.escala_anestesista_alias
  for insert to authenticated
  with check ((select public.can_manage_alias_escala()) or user_id = public.firebase_uid());

drop policy if exists "escala_alias_update" on public.escala_anestesista_alias;
create policy "escala_alias_update" on public.escala_anestesista_alias
  for update to authenticated
  using ((select public.can_manage_alias_escala()) or user_id = public.firebase_uid())
  with check ((select public.can_manage_alias_escala()) or user_id = public.firebase_uid());

drop policy if exists "escala_alias_delete" on public.escala_anestesista_alias;
create policy "escala_alias_delete" on public.escala_anestesista_alias
  for delete to authenticated
  using ((select public.can_manage_alias_escala()) or user_id = public.firebase_uid());

-- ── RPC: salvar escala em transação única ─────────────────────────────────
-- Substitui a sequência client-side upsert→DELETE→INSERT por uma operação atômica.
-- Elimina: (a) escala com 0 casos se o INSERT falhar; (b) flash realtime no DELETE
-- (o repl. stream entrega header+casos num batch pós-COMMIT).
create or replace function public.rpc_salvar_escala_cirurgica(
  p_header jsonb,
  p_casos  jsonb     -- array JSON de casos em snake_case; campo escala_id ignorado
)
returns jsonb        -- { header: escala_cirurgica, casos: escala_cirurgica_caso[] }
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id     uuid;
  v_status text := coalesce(nullif(p_header->>'status', ''), 'rascunho');
  v_caller text := public.firebase_uid();
  v_result jsonb;
begin
  -- SECURITY DEFINER bypassa RLS → verificar o gate explicitamente antes de qualquer DML.
  -- firebase_uid() devolve '' (não NULL) sem JWT — barrar antes do gate.
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;

  -- Audit 100% server-side: created_by/published_by = firebase_uid(); o nome vem de
  -- profiles (fallback: display enviado pelo cliente). Cliente não escolhe o autor.
  insert into public.escala_cirurgica (
    data, hospital, status, ordem_liberacao, vinculos, source_image_path,
    created_by, published_at, published_by, published_by_name, created_at, updated_at
  ) values (
    (p_header->>'data')::date,
    p_header->>'hospital',
    v_status,
    coalesce(p_header->'ordem_liberacao', '[]'::jsonb),
    coalesce(p_header->'vinculos',        '{}'::jsonb),
    nullif(p_header->>'source_image_path', ''),
    v_caller,
    case when v_status = 'publicada' then now() end,
    case when v_status = 'publicada' then v_caller end,
    case when v_status = 'publicada' then coalesce(
      (select p.nome from public.profiles p where p.id = v_caller),
      nullif(p_header->>'published_by_name', '')
    ) end,
    now(), now()
  )
  on conflict (data, hospital) do update set
    -- publicada nunca rebaixa para rascunho por re-importação
    status            = case when escala_cirurgica.status = 'publicada' then 'publicada' else excluded.status end,
    ordem_liberacao   = excluded.ordem_liberacao,
    vinculos          = excluded.vinculos,
    source_image_path = coalesce(excluded.source_image_path, escala_cirurgica.source_image_path),
    updated_at        = now(),
    published_at      = coalesce(excluded.published_at,      escala_cirurgica.published_at),
    published_by      = coalesce(excluded.published_by,      escala_cirurgica.published_by),
    published_by_name = coalesce(excluded.published_by_name, escala_cirurgica.published_by_name)
    -- created_by, created_at, liberacoes, linha_overrides: ausentes de propósito → preservados
  returning id into v_id;

  delete from public.escala_cirurgica_caso where escala_id = v_id;

  if p_casos is not null and jsonb_typeof(p_casos) = 'array' and jsonb_array_length(p_casos) > 0 then
    insert into public.escala_cirurgica_caso (
      escala_id, sala, ordem, hora, tempo_estimado, paciente_iniciais, idade,
      procedimento, convenio, cirurgiao, cirurgiao_display,
      anestesista, anestesista_user_id, bloco, is_continuacao, sem_anestesista, tipo
    )
    select
      v_id,
      coalesce(c->>'sala', ''),
      coalesce((nullif(c->>'ordem', ''))::int, 0),
      nullif(c->>'hora', ''),
      nullif(c->>'tempo_estimado', ''),
      nullif(c->>'paciente_iniciais', ''),
      nullif(c->>'idade', ''),
      nullif(c->>'procedimento', ''),
      nullif(c->>'convenio', ''),
      nullif(c->>'cirurgiao', ''),
      nullif(c->>'cirurgiao_display', ''),
      nullif(c->>'anestesista', ''),
      nullif(c->>'anestesista_user_id', ''),
      coalesce(nullif(c->>'bloco', ''), 'normal'),
      coalesce((nullif(c->>'is_continuacao', ''))::boolean,  false),
      coalesce((nullif(c->>'sem_anestesista', ''))::boolean, false),
      coalesce(nullif(c->>'tipo', ''), 'eletiva')
    from jsonb_array_elements(p_casos) as c;
  end if;

  select jsonb_build_object(
    'header', (select to_jsonb(e.*) from public.escala_cirurgica e where e.id = v_id),
    'casos', coalesce(
      (select jsonb_agg(c.* order by c.sala, c.ordem) from public.escala_cirurgica_caso c where c.escala_id = v_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.rpc_salvar_escala_cirurgica(jsonb, jsonb) from public, anon;
grant execute on function public.rpc_salvar_escala_cirurgica(jsonb, jsonb) to authenticated, service_role;

-- ── RPC: patch por chave em liberacoes/linha_overrides ─────────────────────
-- Dois plantonistas mexendo ao mesmo tempo não podem se sobrescrever: o merge é
-- server-side por chave (jsonb_set), nunca o objeto inteiro vindo do cliente.
-- p_valor NULL (ou jsonb 'null') remove a chave.
create or replace function public.rpc_escala_patch_liberacao(
  p_escala_id uuid,
  p_campo     text,   -- 'liberacoes' | 'linha_overrides'
  p_chave     text,   -- chave do anestesista na coluna
  p_valor     jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
  v_remove boolean := (p_valor is null or jsonb_typeof(p_valor) = 'null');
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  if p_campo not in ('liberacoes', 'linha_overrides') then
    raise exception 'campo_invalido: %', p_campo;
  end if;
  if p_chave is null or btrim(p_chave) = '' then
    raise exception 'chave_invalida';
  end if;

  -- Audit server-side também dentro do valor: 'por'/'em' são carimbados aqui,
  -- nunca aceitos do cliente (mesma regra do created_by/published_by).
  if not v_remove and jsonb_typeof(p_valor) = 'object' then
    p_valor := jsonb_set(jsonb_set(p_valor, '{por}', to_jsonb(v_caller)), '{em}', to_jsonb(now()));
  end if;

  if p_campo = 'liberacoes' then
    update public.escala_cirurgica set
      liberacoes = case when v_remove then liberacoes - p_chave
                        else jsonb_set(liberacoes, array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  else
    update public.escala_cirurgica set
      linha_overrides = case when v_remove then linha_overrides - p_chave
                             else jsonb_set(linha_overrides, array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  end if;

  if not found then
    raise exception 'escala_nao_encontrada';
  end if;
end;
$$;

revoke execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) from public, anon;
grant execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) to authenticated, service_role;

-- ── Tabela: trocas_cirurgicas (troca de sala entre anestesistas) ────────────
-- Ciclo propor→aceitar/recusar/cancelar. O apply é ATÔMICO via RPC (swap dos casos).
create table if not exists public.trocas_cirurgicas (
  id             uuid primary key default gen_random_uuid(),
  escala_id      uuid not null references public.escala_cirurgica(id) on delete cascade,
  sala_a         text not null,          -- sala do solicitante
  sala_b         text not null,          -- sala do alvo
  uid_a          text not null,          -- anestesista_user_id da sala_a (solicitante)
  uid_b          text not null,          -- anestesista_user_id da sala_b (alvo)
  alias_a        text not null,          -- apelido de exibição gravado na proposta
  alias_b        text not null,
  -- 'expirada' reservado para o auto-expiry via pg_cron (Fase 2)
  status         text not null default 'pendente' check (status in ('pendente','aceita','recusada','cancelada','expirada')),
  motivo         text,
  solicitado_por text not null,          -- firebase_uid de quem propôs
  respondido_por text,
  respondido_em  timestamptz,
  aplicada_em    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint chk_troca_salas_distintas check (sala_a <> sala_b),
  constraint chk_troca_uids_distintos  check (uid_a <> uid_b),
  -- firebase_uid() devolve '' sem JWT — uid vazio aqui abriria o gate da RPC p/ anônimo
  constraint chk_troca_uids_nao_vazios check (uid_a <> '' and uid_b <> '')
);
comment on table public.trocas_cirurgicas is
  'Trocas de sala entre anestesistas. Apply atômico via aplicar_troca_cirurgica(). Liberado é por-pessoa, não por sala — não é limpo na troca.';
create index if not exists idx_troca_escala on public.trocas_cirurgicas (escala_id);
create index if not exists idx_troca_pendente on public.trocas_cirurgicas (escala_id) where status = 'pendente';

drop trigger if exists tr_troca_cirurgica_updated_at on public.trocas_cirurgicas;
create trigger tr_troca_cirurgica_updated_at before update on public.trocas_cirurgicas
  for each row execute function update_updated_at();

alter table public.trocas_cirurgicas enable row level security;

drop policy if exists "trocas_cirurgicas_select" on public.trocas_cirurgicas;
create policy "trocas_cirurgicas_select" on public.trocas_cirurgicas
  for select to authenticated using ((select public.can_write_escala_cirurgica()));

-- Propor: uid_a = eu (ou coordenador/admin propõe em nome de qualquer sala)
drop policy if exists "trocas_cirurgicas_insert" on public.trocas_cirurgicas;
create policy "trocas_cirurgicas_insert" on public.trocas_cirurgicas
  for insert to authenticated
  with check (uid_a = public.firebase_uid() or (select public.can_manage_alias_escala()));

-- Update DIRETO só p/ pendente→recusada|cancelada. Selar 'aceita' é EXCLUSIVO da RPC
-- (SECURITY DEFINER bypassa esta policy) — impede troca "aceita" sem o swap dos casos.
-- 'pendente' fora do WITH CHECK: sem no-op pendente→pendente por update direto.
drop policy if exists "trocas_cirurgicas_update" on public.trocas_cirurgicas;
create policy "trocas_cirurgicas_update" on public.trocas_cirurgicas
  for update to authenticated
  using (status = 'pendente' and (uid_a = public.firebase_uid() or uid_b = public.firebase_uid() or (select public.can_manage_alias_escala())))
  with check (status in ('recusada','cancelada') and (uid_a = public.firebase_uid() or uid_b = public.firebase_uid() or (select public.can_manage_alias_escala())));

-- DELETE: sem policy de propósito — o ciclo é por status e o cascade da FK (delete da
-- escala) não passa por RLS. Registrado para não parecer esquecimento (lição Erlei/authorized_emails).

-- Colunas estruturais da proposta são IMUTÁVEIS pós-insert (anti-retarget): o WITH CHECK
-- não compara OLD×NEW, então o guard vai num trigger. A RPC de aceite só toca
-- status/respondido_*/aplicada_em — passa.
create or replace function public.trocas_cirurgicas_guard_imutaveis()
returns trigger
language plpgsql
as $$
begin
  if new.escala_id      is distinct from old.escala_id
     or new.sala_a      is distinct from old.sala_a
     or new.sala_b      is distinct from old.sala_b
     or new.uid_a       is distinct from old.uid_a
     or new.uid_b       is distinct from old.uid_b
     or new.alias_a     is distinct from old.alias_a
     or new.alias_b     is distinct from old.alias_b
     or new.solicitado_por is distinct from old.solicitado_por then
    raise exception 'troca_imutavel: só status/motivo/respondido_*/aplicada_em podem mudar' using errcode = '42501';
  end if;
  -- respondido_por não é forjável: quando muda, tem que ser o próprio ator
  -- (vale p/ update direto e p/ a RPC, que já usa firebase_uid()).
  if new.respondido_por is distinct from old.respondido_por
     and coalesce(new.respondido_por, '') <> public.firebase_uid() then
    raise exception 'respondido_por_invalido' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_trocas_guard_imutaveis on public.trocas_cirurgicas;
create trigger tr_trocas_guard_imutaveis before update on public.trocas_cirurgicas
  for each row execute function public.trocas_cirurgicas_guard_imutaveis();

-- ── RPC: aplicar_troca_cirurgica (SECURITY DEFINER, atômica) ────────────────
-- Aceite = swap dos casos das duas salas + sela a troca. O ator é SEMPRE o
-- public.firebase_uid() (nunca um parâmetro do cliente — evita bypass/spoof de
-- auditoria). Só o alvo (uid_b) ou coordenador/admin pode aceitar.
create or replace function public.aplicar_troca_cirurgica(p_troca_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v public.trocas_cirurgicas;
  v_caller text := public.firebase_uid();
  n_a int;
  n_b int;
begin
  -- firebase_uid() devolve '' sem JWT — barrar antes de qualquer comparação com uid_b
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select * into v from public.trocas_cirurgicas where id = p_troca_id for update;
  if not found then raise exception 'troca_nao_encontrada'; end if;
  if v.status <> 'pendente' then raise exception 'troca_nao_pendente'; end if;
  if v.uid_b <> v_caller and not public.can_manage_alias_escala() then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;

  update public.escala_cirurgica_caso
     set anestesista = v.alias_b, anestesista_user_id = v.uid_b, updated_at = now()
   where escala_id = v.escala_id and sala = v.sala_a and anestesista_user_id = v.uid_a;
  get diagnostics n_a = row_count;

  update public.escala_cirurgica_caso
     set anestesista = v.alias_a, anestesista_user_id = v.uid_a, updated_at = now()
   where escala_id = v.escala_id and sala = v.sala_b and anestesista_user_id = v.uid_b;
  get diagnostics n_b = row_count;

  -- Proposta obsoleta (escala mudou entre propor e aceitar) → aborta, sem swap parcial.
  if n_a = 0 or n_b = 0 then
    raise exception 'troca_obsoleta' using errcode = 'P0001';
  end if;

  update public.trocas_cirurgicas
     set status = 'aceita', respondido_por = v_caller,
         respondido_em = now(), aplicada_em = now(), updated_at = now()
   where id = p_troca_id;
end;
$$;
revoke execute on function public.aplicar_troca_cirurgica(uuid) from public, anon;
grant execute on function public.aplicar_troca_cirurgica(uuid) to authenticated, service_role;

COMMIT;

-- ── Realtime (board ao vivo) — fora da transação, idempotente ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'escala_cirurgica'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_cirurgica;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'escala_cirurgica_caso'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_cirurgica_caso;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'trocas_cirurgicas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trocas_cirurgicas;
  END IF;
END $$;
