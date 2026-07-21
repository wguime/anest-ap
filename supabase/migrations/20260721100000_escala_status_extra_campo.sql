-- ============================================================================
-- Escala Cirúrgica — status em DOIS eixos (pedido do dono 2026-07-21)
--
-- Principal (exclusivo, pinta o card): agendada → iniciada → terminada.
-- Extra (badge que CONVIVE com agendada/iniciada; nunca com terminada):
--   atrasada | suspensa | passa_tarde — clicar de novo desmarca (toggle).
--
-- Migra os dados: casos com status antigo atrasada/suspensa/passa_tarde viram
-- agendada + extra correspondente. A RPC única continua aceitando os 6 valores
-- (o front não muda a assinatura): principais setam status_cirurgia (terminada
-- limpa o extra); extras alternam status_extra (bloqueado se terminada).
-- ============================================================================

begin;

alter table public.escala_cirurgica_caso add column if not exists status_extra text;

alter table public.escala_cirurgica_caso
  drop constraint if exists escala_cirurgica_caso_status_extra_check;
alter table public.escala_cirurgica_caso
  add constraint escala_cirurgica_caso_status_extra_check
  check (status_extra is null or status_extra in ('atrasada', 'suspensa', 'passa_tarde'));

-- Dados existentes: extra estava no campo principal. Trigger de log desabilitado
-- durante a realocação — não são transições reais, não devem virar dado de treino.
alter table public.escala_cirurgica_caso disable trigger tr_escala_caso_evento_status;
update public.escala_cirurgica_caso
   set status_extra = status_cirurgia, status_cirurgia = 'agendada'
 where status_cirurgia in ('atrasada', 'suspensa', 'passa_tarde');
alter table public.escala_cirurgica_caso enable trigger tr_escala_caso_evento_status;

-- Principal volta a ser só o ciclo de execução.
alter table public.escala_cirurgica_caso
  drop constraint if exists escala_cirurgica_caso_status_cirurgia_check;
alter table public.escala_cirurgica_caso
  add constraint escala_cirurgica_caso_status_cirurgia_check
  check (status_cirurgia in ('agendada', 'iniciada', 'terminada'));

-- Invariante no banco (defesa mesmo contra UPDATE direto): terminada nunca carrega extra.
alter table public.escala_cirurgica_caso
  drop constraint if exists escala_cirurgica_caso_terminada_sem_extra;
alter table public.escala_cirurgica_caso
  add constraint escala_cirurgica_caso_terminada_sem_extra
  check (not (status_cirurgia = 'terminada' and status_extra is not null));

comment on column public.escala_cirurgica_caso.status_cirurgia is
  'Ciclo de execução do caso (exclusivo): agendada → iniciada → terminada. Ocorrências (atrasada/suspensa/passa_tarde) vivem em status_extra.';
comment on column public.escala_cirurgica_caso.status_extra is
  'Ocorrência do caso (toggle): atrasada | suspensa | passa_tarde | null. Convive com agendada/iniciada; terminada limpa e bloqueia.';

-- ── RPC única p/ os dois eixos (mesma assinatura do front) ───────────────────
create or replace function public.rpc_escala_status_cirurgia(
  p_caso_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
  v_atual  text;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;

  if p_status in ('agendada', 'iniciada', 'terminada') then
    update public.escala_cirurgica_caso
       set status_cirurgia       = p_status,
           status_extra          = case when p_status = 'terminada' then null else status_extra end,
           status_atualizado_por = v_caller,
           status_atualizado_em  = now(),
           updated_at            = now()
     where id = p_caso_id;
    if not found then raise exception 'caso_nao_encontrado'; end if;

  elsif p_status in ('atrasada', 'suspensa', 'passa_tarde') then
    -- FOR UPDATE: sem race com um 'terminada' concorrente entre o SELECT e o UPDATE
    select status_cirurgia into v_atual
      from public.escala_cirurgica_caso where id = p_caso_id
      for update;
    if not found then raise exception 'caso_nao_encontrado'; end if;
    if v_atual = 'terminada' then
      raise exception 'extra_bloqueado_terminada';
    end if;
    update public.escala_cirurgica_caso
       set status_extra          = case when status_extra = p_status then null else p_status end,
           status_atualizado_por = v_caller,
           status_atualizado_em  = now(),
           updated_at            = now()
     where id = p_caso_id;

  else
    raise exception 'status_invalido: %', p_status;
  end if;
end;
$$;

revoke execute on function public.rpc_escala_status_cirurgia(uuid, text) from public, anon;
grant execute on function public.rpc_escala_status_cirurgia(uuid, text) to authenticated, service_role;

-- ── Log de eventos passa a cobrir os dois eixos ──────────────────────────────
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
    return new;
  end if;

  insert into public.escala_cirurgica_evento (
    tipo, caso_id, escala_id, data, hospital, sala, cirurgiao, procedimento,
    convenio, tipo_caso, hora, tempo_estimado, anestesista, anestesista_user_id,
    status_de, status_para, detalhe, por
  ) values (
    'status', new.id, new.escala_id, v_data, v_hospital, new.sala, new.cirurgiao,
    new.procedimento, new.convenio, new.tipo, new.hora, new.tempo_estimado,
    new.anestesista, new.anestesista_user_id,
    coalesce(old.status_cirurgia, 'agendada'), coalesce(new.status_cirurgia, 'agendada'),
    jsonb_strip_nulls(jsonb_build_object('extra_de', old.status_extra, 'extra_para', new.status_extra)),
    coalesce(nullif(public.firebase_uid(), ''), nullif(new.status_atualizado_por, ''))
  );
  return new;
exception when others then
  raise warning 'log_escala_caso_status falhou: %', sqlerrm;
  return new;
end;
$$;

comment on table public.escala_cirurgica_evento is
  'Log insert-only de eventos da escala cirúrgica. Eventos tipo=status com status_de = status_para são toggles do EXTRA (mudança só em detalhe.extra_de/extra_para). Escrita exclusiva via triggers.';

drop trigger if exists tr_escala_caso_evento_status on public.escala_cirurgica_caso;
create trigger tr_escala_caso_evento_status
  after update of status_cirurgia, status_extra on public.escala_cirurgica_caso
  for each row
  when (old.status_cirurgia is distinct from new.status_cirurgia
     or old.status_extra   is distinct from new.status_extra)
  execute function public.log_escala_caso_status();

commit;
