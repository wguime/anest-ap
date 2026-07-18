-- ============================================================================
-- Escala Cirúrgica — log de EVENTOS insert-only (Fase 0 da previsão de tempos)
--
-- Propósito: capturar a verdade temporal que hoje se perde — status_atualizado_em
-- é sobrescrito a cada transição e a republicação da escala faz delete+insert dos
-- casos. Este log é DENORMALIZADO (copia os campos no momento do evento) e nada
-- o apaga: sobrevive à republicação e alimenta, no futuro:
--   1. previsão de duração por (cirurgião × procedimento) e de turnover por sala;
--   2. sugestão de alocação de anestesistas respeitando a ordem de liberação
--      (eventos 'liberacao' guardam a ordem vigente no detalhe).
--
-- LGPD: NÃO copia paciente_iniciais/idade — estatística de tempo não precisa de
-- nenhum dado do paciente.
--
-- Invisível para a UI: alimentado por triggers; nenhuma mudança de front.
-- ============================================================================

create table if not exists public.escala_cirurgica_evento (
  id                  uuid primary key default gen_random_uuid(),
  tipo                text not null check (tipo in ('status', 'liberacao')),
  -- referência fraca de propósito (sem FK): o caso pode ser apagado na republicação
  caso_id             uuid,
  escala_id           uuid,
  data                date not null,
  hospital            text not null,
  sala                text,
  cirurgiao           text,
  procedimento        text,
  convenio            text,
  tipo_caso           text,
  hora                text,
  tempo_estimado      text,
  anestesista         text,
  anestesista_user_id text,
  status_de           text,
  status_para         text,
  detalhe             jsonb not null default '{}'::jsonb,
  por                 text,
  em                  timestamptz not null default now()
);

comment on table public.escala_cirurgica_evento is
  'Log insert-only de eventos da escala cirúrgica (transições de status e marcações de liberação). Denormalizado: sobrevive à republicação (delete+insert dos casos). Base futura da previsão de duração/turnover e da sugestão de alocação. Escrita EXCLUSIVA via triggers.';

create index if not exists idx_esc_evento_data      on public.escala_cirurgica_evento (data);
create index if not exists idx_esc_evento_caso      on public.escala_cirurgica_evento (caso_id);
create index if not exists idx_esc_evento_cirurgiao on public.escala_cirurgica_evento (cirurgiao) where tipo = 'status';

-- ── RLS: leitura p/ o mesmo público do módulo; escrita SÓ pelos triggers ─────
alter table public.escala_cirurgica_evento enable row level security;
alter table public.escala_cirurgica_evento force row level security;

drop policy if exists "escala_evento_select" on public.escala_cirurgica_evento;
create policy "escala_evento_select" on public.escala_cirurgica_evento
  for select to authenticated using ((select public.can_write_escala_cirurgica()));

-- INSERT/UPDATE/DELETE: sem policy DE PROPÓSITO — clientes não escrevem aqui.
-- Os triggers usam função SECURITY DEFINER (owner) e passam por cima da RLS.
-- (Registrado para não parecer esquecimento — lição Erlei/authorized_emails.)
-- Defesa em profundidade: nem uma policy permissiva futura abre escrita por engano.
revoke insert, update, delete on public.escala_cirurgica_evento from anon, authenticated;

-- ── Trigger 1: transição de status do caso (Iniciada/Terminada/volta) ────────
create or replace function public.log_escala_caso_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_data date;
  v_hospital text;
begin
  select e.data, e.hospital into v_data, v_hospital
    from public.escala_cirurgica e where e.id = new.escala_id;
  if v_data is null then
    return new; -- escala já removida (cascade em andamento): nada a logar
  end if;

  insert into public.escala_cirurgica_evento (
    tipo, caso_id, escala_id, data, hospital, sala, cirurgiao, procedimento,
    convenio, tipo_caso, hora, tempo_estimado, anestesista, anestesista_user_id,
    status_de, status_para, por
  ) values (
    'status', new.id, new.escala_id, v_data, v_hospital, new.sala, new.cirurgiao,
    new.procedimento, new.convenio, new.tipo, new.hora, new.tempo_estimado,
    new.anestesista, new.anestesista_user_id,
    coalesce(old.status_cirurgia, 'agendada'), coalesce(new.status_cirurgia, 'agendada'),
    -- ator: JWT primeiro (não-forjável); coluna só como fallback (cron/service_role)
    coalesce(nullif(public.firebase_uid(), ''), nullif(new.status_atualizado_por, ''))
  );
  return new;
exception when others then
  -- log estatístico NUNCA bloqueia a operação clínica: perde o evento, avisa e segue
  raise warning 'log_escala_caso_status falhou: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists tr_escala_caso_evento_status on public.escala_cirurgica_caso;
create trigger tr_escala_caso_evento_status
  after update of status_cirurgia on public.escala_cirurgica_caso
  for each row
  when (old.status_cirurgia is distinct from new.status_cirurgia)
  execute function public.log_escala_caso_status();

-- ── Trigger 2: marcação/desfazer de liberação (cruza com a aba Liberações) ───
-- Guarda a ORDEM DE LIBERAÇÃO vigente no detalhe: é o dado que ensina, no
-- futuro, a sugerir posições de anestesistas respeitando a ordem do rodapé.
create or replace function public.log_escala_liberacao()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  k text;
  v_old jsonb := coalesce(old.liberacoes, '{}'::jsonb);
  v_new jsonb := coalesce(new.liberacoes, '{}'::jsonb);
begin
  -- dado corrompido (não-objeto) não pode travar a linha nem o trigger
  if jsonb_typeof(v_old) <> 'object' or jsonb_typeof(v_new) <> 'object' then
    return new;
  end if;

  -- marcadas (chave nova ou liberadoEm alterado)
  for k in select jsonb_object_keys(v_new) loop
    if (v_old -> k) is distinct from (v_new -> k) then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'liberacao', new.id, new.data, new.hospital, k, 'liberado',
        jsonb_build_object('ordem', coalesce(new.ordem_liberacao, '[]'::jsonb), 'em', v_new -> k -> 'liberadoEm'),
        -- ator: JWT primeiro (não-forjável); jsonb como fallback
        coalesce(nullif(public.firebase_uid(), ''), nullif(v_new -> k ->> 'por', ''))
      );
    end if;
  end loop;
  -- desfeitas (chave sumiu)
  for k in select jsonb_object_keys(v_old) loop
    if not (v_new ? k) then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'liberacao', new.id, new.data, new.hospital, k, 'desfeito',
        jsonb_build_object('ordem', coalesce(new.ordem_liberacao, '[]'::jsonb)),
        nullif(public.firebase_uid(), '')
      );
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'log_escala_liberacao falhou: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists tr_escala_evento_liberacao on public.escala_cirurgica;
create trigger tr_escala_evento_liberacao
  after update on public.escala_cirurgica
  for each row
  when (old.liberacoes is distinct from new.liberacoes)
  execute function public.log_escala_liberacao();
