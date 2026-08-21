-- ═══════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — `status_atualizado_em/por` passa a carimbar SÓ o eixo
-- principal (agendada/iniciada/terminada), nunca o toggle de aviso.
--
-- PORQUÊ (dono 2026-08-21, ao pedir que as informações da escala parem de ser
-- desencontradas): o par é o RELÓGIO DA OCUPAÇÃO — a faixa de urgências lê
-- `status_atualizado_em` para dizer "em sala há 40min" e para decidir se a
-- cirurgia virou a pergunta "iniciada há 6h, ainda em andamento?". Mas o ramo dos
-- extras o reescrevia também, então marcar "Atrasada" numa cirurgia que começou
-- às 10h ZERAVA o relógio e a tirava da pergunta.
--
-- Provado em produção no mesmo dia — cirurgia da Rose, Sala 8 do HRO:
--     14:33:40  agendada → iniciada
--     15:01:08  iniciada → iniciada   (detalhe: extra_para = suspensa)
--     15:42:25  iniciada → agendada   (detalhe: extra_de/para = suspensa)
--   `status_atualizado_em` ficou 15:42 — que não é quando a cirurgia começou nem
--   qualquer outra coisa útil.
--
-- E é pré-requisito de um pedido do dono: o detalhe passa a dizer "Iniciada às
-- 14:33 por Fulano". Com o carimbo dos extras junto, essa frase MENTIRIA — diria
-- o nome de quem só tocou num badge.
--
-- O histórico dos avisos não se perde: a trigger `log_escala_caso_status` já
-- grava cada toggle em `escala_cirurgica_evento` com `detalhe.extra_de/extra_para`.
--
-- `updated_at` CONTINUA sendo tocado nos dois ramos — é ele que alimenta o
-- realtime, e sem ele o toggle de aviso deixaria de chegar nas outras telas.
--
-- Sem backfill: o valor se corrige sozinho na próxima transição de cada caso, e
-- reconstruir o carimbo passado a partir do log seria reescrever registro clínico
-- para ganhar precisão em cirurgia que já acabou.
-- ═══════════════════════════════════════════════════════════════════════════

-- Guarda de versão: a função VIVA tem de ser a de 20260721100000. A versão mais
-- nova de uma RPC nem sempre está na migration de número mais alto que a cita
-- (lição de 20260818140000) — sobrescrever às cegas apagaria mudanças de terceiros.
do $$
declare
  v text;
begin
  select pg_get_functiondef(p.oid) into v
    from pg_proc p
   where p.proname = 'rpc_escala_status_cirurgia'
     and p.pronamespace = 'public'::regnamespace;
  if v is null then
    raise exception 'carimbo: rpc_escala_status_cirurgia nao existe — migration fora de ordem';
  end if;
  if position('extra_bloqueado_terminada' in v) = 0 then
    raise exception 'carimbo: a rpc viva nao e a versao de 20260721100000 — revisar antes de sobrescrever';
  end if;
end
$$;

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
    -- ⚠️ SEM `status_atualizado_por/em` (dono 21/08): o aviso é um toggle sobre a
    -- cirurgia, não uma transição dela. Carimbar aqui zerava o relógio da
    -- ocupação e trocava o autor do início pelo autor do badge.
    update public.escala_cirurgica_caso
       set status_extra = case when status_extra = p_status then null else p_status end,
           updated_at   = now()
     where id = p_caso_id;

  else
    raise exception 'status_invalido: %', p_status;
  end if;
end;
$$;

revoke execute on function public.rpc_escala_status_cirurgia(uuid, text) from public, anon;
grant execute on function public.rpc_escala_status_cirurgia(uuid, text) to authenticated, service_role;

comment on column public.escala_cirurgica_caso.status_atualizado_em is
  'Quando o EIXO PRINCIPAL (agendada/iniciada/terminada) mudou pela última vez. '
  'Toggle de aviso (atrasada/suspensa/passa_tarde) NÃO carimba desde 2026-08-21: '
  'é o relógio que a faixa de urgências usa para "em sala há X" e para a pergunta '
  'dos 240min. O histórico dos avisos está em escala_cirurgica_evento (detalhe.extra_*).';

comment on column public.escala_cirurgica_caso.status_atualizado_por is
  'Quem fez a última transição do EIXO PRINCIPAL — é o "por Fulano" do detalhe do '
  'caso. Toggle de aviso não altera (2026-08-21).';
