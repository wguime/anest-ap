-- ============================================================================
-- Escala Cirúrgica — CAPTURA para o aprendizado (dono 25/09/2026, itens 1 e 2)
-- ============================================================================
-- A revisão de 25/09 (docs/escala-cirurgica-metricas/2026-W39-aprendizado.md) mostrou
-- que a sugestão de alocação não é viável porque o app DESCARTA os dados de que ela
-- precisaria:
--   1. HISTÓRICO DAS ESTIMATIVAS — `termino_previsto` (término de cada cirurgia) não
--      tem histórico e é zerado ao marcar "terminada"; o tempo total da pessoa
--      (`linha_overrides[turno:chave].termino`) é sobrescrito sem registro. Erram 18,6
--      min na mediana — o melhor sinal de tempo que existe.
--   2. A ESCALA COMO FOI PUBLICADA — quem foi para cada sala (a republicação apagava os
--      casos até 23/09), cada troca de anestesista no caso (217 casos mudaram sem log)
--      e a ordem de liberação publicada por turno (sobrescrita a cada republicação).
-- (O item 3 — hora real de início/fim — foi recusado pelo dono: o horário é o do toque.)
--
-- TABELA PRÓPRIA, e não `escala_cirurgica_evento`, de propósito: o relatório de adesão
-- (`escala_adesao_relatorio`/`escala_adesao_gravar_dia`) conta como "ação" TODO evento
-- daquela tabela com autor — as ~90 alocações de cada publicação iriam para a conta de
-- quem publicou. Aqui nada muda para a adesão, e nenhuma função existente é alterada.
-- A análise junta as duas tabelas (caso_id, data, hospital).
--
-- Escrita EXCLUSIVA por triggers SECURITY DEFINER (dono `postgres`, BYPASSRLS); o registro
-- NUNCA bloqueia a operação clínica: todo o corpo está no `exception` (inclusive a leitura
-- do JWT, que fica fora do DECLARE) e `lock_timeout` curto nas funções transforma espera
-- de lock na tabela de captura em erro capturado. LGPD: nem `paciente_iniciais` nem
-- `idade` entram. O GUC `anest.publicacao` (ligado pela rpc_publicar_escala_turno) marca
-- o que a PUBLICAÇÃO gravou (`detalhe.publicacao = true`).
--
-- LEITURA SÓ PARA ADMIN: a tabela permite medir quanto cada anestesista erra a
-- estimativa (dado de desempenho de pessoa) e nenhuma tela lê daqui — a análise roda
-- pela Management API. Minimização (LGPD art. 6º, III).
--
-- Validada pelo migration-validator em 25/09 (aprovada com ajustes, todos aplicados aqui).
-- Aplicar FORA de turno: o `lock table` segura gravações na escala até o commit (<1 s);
-- a ordem dos locks é a mesma da rpc_publicar_escala_turno (cabeçalho, depois casos).
--
-- Rollback em dois níveis:
--   1. parar a captura, preservando o que já foi gravado:
--      drop trigger if exists tr_escala_caso_captura_insert on public.escala_cirurgica_caso;
--      drop trigger if exists tr_escala_caso_captura_update on public.escala_cirurgica_caso;
--      drop trigger if exists tr_escala_captura_linha on public.escala_cirurgica;
--   2. só depois de exportar os dados:
--      drop function if exists public.captura_escala_caso_insert();
--      drop function if exists public.captura_escala_caso_update();
--      drop function if exists public.captura_escala_linha();
--      drop table if exists public.escala_cirurgica_captura;
--
-- Idempotente.
-- ============================================================================

begin;
set local lock_timeout = '3s';
lock table public.escala_cirurgica, public.escala_cirurgica_caso in share row exclusive mode;

-- ── Guarda: o plpgsql não valida colunas na criação — sem uma delas, TODA captura
-- falharia em silêncio (só um WARNING, que a Management API não mostra). ────────────
do $$
declare v_faltam text;
begin
  select string_agg(t || '.' || c, ', ') into v_faltam
    from (values
      ('escala_cirurgica_caso', 'termino_previsto'), ('escala_cirurgica_caso', 'termino_previsto_por'),
      ('escala_cirurgica_caso', 'anestesista'), ('escala_cirurgica_caso', 'anestesista_user_id'),
      ('escala_cirurgica_caso', 'sem_anestesista'), ('escala_cirurgica_caso', 'turno'),
      ('escala_cirurgica_caso', 'ordem'), ('escala_cirurgica_caso', 'bloco'),
      ('escala_cirurgica_caso', 'origem'), ('escala_cirurgica_caso', 'is_continuacao'),
      ('escala_cirurgica_caso', 'residente_user_id'), ('escala_cirurgica_caso', 'status_cirurgia'),
      ('escala_cirurgica_caso', 'status_extra'), ('escala_cirurgica_caso', 'gravidade'),
      ('escala_cirurgica_caso', 'tipo'), ('escala_cirurgica_caso', 'hora'),
      ('escala_cirurgica_caso', 'tempo_estimado'), ('escala_cirurgica_caso', 'sala'),
      ('escala_cirurgica_caso', 'cirurgiao'), ('escala_cirurgica_caso', 'procedimento'),
      ('escala_cirurgica_caso', 'convenio'), ('escala_cirurgica', 'linha_overrides'),
      ('escala_cirurgica', 'ordem_liberacao'), ('escala_cirurgica', 'data'),
      ('escala_cirurgica', 'hospital')
    ) as req(t, c)
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = req.t and column_name = req.c);
  if v_faltam is not null then
    raise exception 'captura do aprendizado: faltam as colunas % — a captura falharia em silêncio', v_faltam;
  end if;
end $$;

create table if not exists public.escala_cirurgica_captura (
  id                  uuid primary key default gen_random_uuid(),
  -- ordem de gravação: capturas da MESMA transação empatam em `em` (now() é o início
  -- da transação) e o id é aleatório — sem isto não se reconstrói a sequência
  seq                 bigint generated always as identity,
  tipo                text not null check (tipo in ('estimativa', 'estimativa_total', 'alocacao', 'realocacao', 'ordem')),
  -- referência fraca de propósito (sem FK): o caso pode ser apagado na republicação
  caso_id             uuid,
  escala_id           uuid,
  data                date not null,
  hospital            text not null,
  turno               text,
  sala                text,
  cirurgiao           text,
  procedimento        text,
  convenio            text,
  tipo_caso           text,
  gravidade_caso      text,
  hora                text,
  tempo_estimado      text,
  -- no caso: o apelido do anestesista; nas capturas da LINHA (estimativa_total), a
  -- chave "<turno>:<uid ou nome>" — a mesma convenção dos eventos de liberação/troca
  anestesista         text,
  anestesista_user_id text,
  valor_de            text,
  valor_para          text,
  detalhe             jsonb not null default '{}'::jsonb,
  por                 text,
  em                  timestamptz not null default now()
);

comment on table public.escala_cirurgica_captura is
  'Captura insert-only para o aprendizado da escala (dono 25/09/2026): estimativa (termino_previsto de cada cirurgia), estimativa_total (tempo total da pessoa na linha), alocacao (caso como foi gravado — publicação ou manual), realocacao (troca de anestesista no caso) e ordem (ordem de liberação do turno). Separada de escala_cirurgica_evento para não inflar o relatório de adesão. Escrita EXCLUSIVA via triggers; leitura só admin.';

create index if not exists idx_esc_captura_data on public.escala_cirurgica_captura (data);
create index if not exists idx_esc_captura_caso on public.escala_cirurgica_captura (caso_id);
create index if not exists idx_esc_captura_tipo_data on public.escala_cirurgica_captura (tipo, data);

-- ── RLS: leitura só admin; escrita SÓ pelos triggers ─────────────────────────
alter table public.escala_cirurgica_captura enable row level security;
alter table public.escala_cirurgica_captura force row level security;

drop policy if exists "escala_captura_select" on public.escala_cirurgica_captura;
create policy "escala_captura_select" on public.escala_cirurgica_captura
  for select to authenticated using ((select public.is_admin()));

-- INSERT/UPDATE/DELETE: sem policy DE PROPÓSITO — clientes não escrevem aqui (os
-- triggers são SECURITY DEFINER). `revoke all` também tira TRUNCATE (que ignora RLS),
-- REFERENCES e TRIGGER que os privilégios padrão do Supabase dariam.
revoke all on public.escala_cirurgica_captura from anon, authenticated;
grant select on public.escala_cirurgica_captura to authenticated;

-- ── 1+2. Caso INSERIDO: a alocação como foi gravada ──────────────────────────
-- Publicação (INSERT da rpc_publicar_escala_turno, com o andamento preservado já no
-- INSERT — `valor_para` traz o término preservado) e caso adicionado à mão (origem
-- 'manual'). É o retrato "quem foi escalado para cada sala" que o aprendizado precisa
-- para separar o planejado do acontecido.
create or replace function public.captura_escala_caso_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set lock_timeout = '200ms'
as $$
declare
  v_data date;
  v_hospital text;
  v_publicando boolean;
begin
  v_publicando := coalesce(current_setting('anest.publicacao', true), '') = '1';
  select e.data, e.hospital into v_data, v_hospital
    from public.escala_cirurgica e where e.id = new.escala_id;
  if v_data is null then
    return new;
  end if;

  insert into public.escala_cirurgica_captura (
    tipo, caso_id, escala_id, data, hospital, turno, sala, cirurgiao, procedimento,
    convenio, tipo_caso, gravidade_caso, hora, tempo_estimado, anestesista,
    anestesista_user_id, valor_para, detalhe, por
  ) values (
    'alocacao', new.id, new.escala_id, v_data, v_hospital, new.turno, new.sala,
    new.cirurgiao, new.procedimento, new.convenio, new.tipo, new.gravidade, new.hora,
    new.tempo_estimado, new.anestesista, new.anestesista_user_id, new.termino_previsto,
    jsonb_strip_nulls(jsonb_build_object(
      'ordem', new.ordem, 'bloco', new.bloco, 'origem', new.origem,
      'continuacao', new.is_continuacao, 'semAnestesista', new.sem_anestesista,
      'residenteUid', nullif(new.residente_user_id, ''),
      'status', new.status_cirurgia, 'extra', new.status_extra,
      'publicacao', v_publicando)),
    nullif(public.firebase_uid(), '')
  );
  return new;
exception when others then
  raise warning 'captura_escala_caso_insert falhou: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger tr_escala_caso_captura_insert
  after insert on public.escala_cirurgica_caso
  for each row execute function public.captura_escala_caso_insert();

-- ── 1+2. Caso ALTERADO: término informado e troca de anestesista ─────────────
-- `estimativa`: cada valor de termino_previsto, inclusive o que "terminada" zera
-- (valor_de = a última estimativa antes do fim; `statusDe` distingue o "desfazer
-- terminada", que devolve o término). O INSERT com o andamento preservado na
-- republicação não passa por aqui — é cópia, não estimativa nova.
-- `realocacao`: quem saiu e quem entrou no caso (definir/trocar anestesista,
-- executar troca, re-apontar da publicação — este com detalhe.publicacao).
create or replace function public.captura_escala_caso_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set lock_timeout = '200ms'
as $$
declare
  v_data date;
  v_hospital text;
  v_publicando boolean;
  v_ator text;
begin
  v_publicando := coalesce(current_setting('anest.publicacao', true), '') = '1';
  v_ator := nullif(public.firebase_uid(), '');
  select e.data, e.hospital into v_data, v_hospital
    from public.escala_cirurgica e where e.id = new.escala_id;
  if v_data is null then
    return new;
  end if;

  if old.termino_previsto is distinct from new.termino_previsto then
    insert into public.escala_cirurgica_captura (
      tipo, caso_id, escala_id, data, hospital, turno, sala, cirurgiao, procedimento,
      convenio, tipo_caso, gravidade_caso, hora, tempo_estimado, anestesista,
      anestesista_user_id, valor_de, valor_para, detalhe, por
    ) values (
      'estimativa', new.id, new.escala_id, v_data, v_hospital, new.turno, new.sala,
      new.cirurgiao, new.procedimento, new.convenio, new.tipo, new.gravidade, new.hora,
      new.tempo_estimado, new.anestesista, new.anestesista_user_id,
      old.termino_previsto, new.termino_previsto,
      jsonb_strip_nulls(jsonb_build_object(
        'status', new.status_cirurgia, 'statusDe', old.status_cirurgia,
        'extra', new.status_extra, 'publicacao', v_publicando)),
      coalesce(v_ator, nullif(new.termino_previsto_por, ''))
    );
  end if;

  if old.anestesista is distinct from new.anestesista
     or old.anestesista_user_id is distinct from new.anestesista_user_id
     or old.sem_anestesista is distinct from new.sem_anestesista then
    insert into public.escala_cirurgica_captura (
      tipo, caso_id, escala_id, data, hospital, turno, sala, cirurgiao, procedimento,
      convenio, tipo_caso, gravidade_caso, hora, tempo_estimado, anestesista,
      anestesista_user_id, valor_de, valor_para, detalhe, por
    ) values (
      'realocacao', new.id, new.escala_id, v_data, v_hospital, new.turno, new.sala,
      new.cirurgiao, new.procedimento, new.convenio, new.tipo, new.gravidade, new.hora,
      new.tempo_estimado, new.anestesista, new.anestesista_user_id,
      old.anestesista, new.anestesista,
      jsonb_strip_nulls(jsonb_build_object(
        'deUid', old.anestesista_user_id, 'paraUid', new.anestesista_user_id,
        'semAnestesistaDe', old.sem_anestesista, 'semAnestesistaPara', new.sem_anestesista,
        'status', new.status_cirurgia, 'publicacao', v_publicando)),
      v_ator
    );
  end if;
  return new;
exception when others then
  raise warning 'captura_escala_caso_update falhou: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger tr_escala_caso_captura_update
  after update of termino_previsto, anestesista, anestesista_user_id, sem_anestesista
  on public.escala_cirurgica_caso
  for each row
  when (old.termino_previsto is distinct from new.termino_previsto
     or old.anestesista is distinct from new.anestesista
     or old.anestesista_user_id is distinct from new.anestesista_user_id
     or old.sem_anestesista is distinct from new.sem_anestesista)
  execute function public.captura_escala_caso_update();

-- ── 1+2. Linha da escala: tempo total da pessoa e ordem de liberação ─────────
-- `estimativa_total`: cada chave "<turno>:<chave>" de linha_overrides cujo `termino`
-- mudou (valor antigo → novo). `ordem`: cada turno cuja ordem de liberação mudou
-- (o array legado, sem turno, vale como matutino — mesma leitura do app).
create or replace function public.captura_escala_linha()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set lock_timeout = '200ms'
as $$
declare
  k text;
  v_old jsonb;
  v_new jsonb;
  o_old jsonb;
  o_new jsonb;
  t_old text;
  t_new text;
  v_publicando boolean;
  v_ator text;
begin
  v_old := coalesce(old.linha_overrides, '{}'::jsonb);
  v_new := coalesce(new.linha_overrides, '{}'::jsonb);
  o_old := coalesce(old.ordem_liberacao, '{}'::jsonb);
  o_new := coalesce(new.ordem_liberacao, '{}'::jsonb);
  v_publicando := coalesce(current_setting('anest.publicacao', true), '') = '1';
  v_ator := nullif(public.firebase_uid(), '');

  if jsonb_typeof(v_old) = 'object' and jsonb_typeof(v_new) = 'object'
     and v_old is distinct from v_new then
    for k in select jsonb_object_keys(v_old) union select jsonb_object_keys(v_new) loop
      t_old := case when jsonb_typeof(v_old -> k) = 'object' then nullif(v_old -> k ->> 'termino', '') end;
      t_new := case when jsonb_typeof(v_new -> k) = 'object' then nullif(v_new -> k ->> 'termino', '') end;
      if t_old is distinct from t_new then
        insert into public.escala_cirurgica_captura
          (tipo, escala_id, data, hospital, turno, anestesista, valor_de, valor_para, detalhe, por)
        values (
          'estimativa_total', new.id, new.data, new.hospital,
          case when position(':' in k) > 0 then split_part(k, ':', 1) end,
          k, t_old, t_new,
          jsonb_build_object('publicacao', v_publicando),
          coalesce(v_ator, nullif(v_new -> k ->> 'por', ''), nullif(v_old -> k ->> 'por', ''))
        );
      end if;
    end loop;
  end if;

  if o_old is distinct from o_new then
    -- array legado (sem turno) = matutino, como o app lê
    if jsonb_typeof(o_old) = 'array' then o_old := jsonb_build_object('matutino', o_old); end if;
    if jsonb_typeof(o_new) = 'array' then o_new := jsonb_build_object('matutino', o_new); end if;
    if jsonb_typeof(o_old) = 'object' and jsonb_typeof(o_new) = 'object' then
      for k in select jsonb_object_keys(o_old) union select jsonb_object_keys(o_new) loop
        if (o_old -> k) is distinct from (o_new -> k) then
          insert into public.escala_cirurgica_captura
            (tipo, escala_id, data, hospital, turno, detalhe, por)
          values (
            'ordem', new.id, new.data, new.hospital, k,
            jsonb_build_object('de', o_old -> k, 'para', o_new -> k, 'publicacao', v_publicando),
            v_ator
          );
        end if;
      end loop;
    end if;
  end if;
  return new;
exception when others then
  raise warning 'captura_escala_linha falhou: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger tr_escala_captura_linha
  after update on public.escala_cirurgica
  for each row
  when (old.linha_overrides is distinct from new.linha_overrides
     or old.ordem_liberacao is distinct from new.ordem_liberacao)
  execute function public.captura_escala_linha();

-- funções de trigger não são chamadas por cliente
revoke execute on function public.captura_escala_caso_insert() from public, anon, authenticated;
revoke execute on function public.captura_escala_caso_update() from public, anon, authenticated;
revoke execute on function public.captura_escala_linha() from public, anon, authenticated;

commit;

-- conferência: os três triggers ligados (a Management API devolve este SELECT)
select c.relname as tabela, t.tgname, t.tgenabled
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where t.tgname in ('tr_escala_caso_captura_insert', 'tr_escala_caso_captura_update', 'tr_escala_captura_linha')
 order by 1, 2;
