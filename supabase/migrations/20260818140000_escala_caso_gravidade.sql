-- Gravidade da urgência no caso da escala cirúrgica.
--
-- PORQUÊ (dono 2026-08-18): o contrato do HRO paga 2 anestesistas para urgência
-- por turno (plantonista + sobreaviso). Quando as duas salas estão ocupadas, a
-- próxima urgência entra numa FILA — e a ordem dessa fila é clínica, não de
-- chegada. Os três níveis são a adaptação da NCEPOD Classification of
-- Intervention (padrão internacional, atribuída por quem vai operar, no momento
-- da decisão de operar): Immediate → 'imediata', Urgent → 'urgente',
-- Expedited → 'aguarda'. Elective já é `tipo = 'eletiva'` e fica de fora.
--
-- NULL = NÃO CLASSIFICADO, e é de propósito. `tipo` pôde nascer com default
-- 'eletiva' porque eletiva é o zero-informação verdadeiro; gravidade não tem
-- valor neutro — qualquer default escreveria uma afirmação clínica que ninguém
-- fez, em milhares de linhas do histórico, e sujaria o relatório que vai ao
-- hospital. A fila trata o NULL como "Classificar", no fim, com chamada de ação.
--
-- CHECK cruzado (gravidade só em urgência/emergência) foi CONSIDERADO e
-- REJEITADO: quem marcasse a gravidade e depois corrigisse o tipo para eletiva
-- tomaria um 23514 no meio do plantão. A UI só oferece o campo em
-- urgência/emergência e o relatório filtra por `tipo` de qualquer forma.
--
-- ⚠️ Republicar um turno faz DELETE+insert dos casos daquele turno, então a
-- gravidade de um caso republicado se perde junto com o id — igual a todos os
-- outros campos de encaixe. Comportamento que já existe; registrado aqui para
-- não virar bug-fantasma.

begin;

-- `escala_cirurgica_caso` é escrita DURANTE o turno. O ALTER pega ACCESS
-- EXCLUSIVE e o segura até o commit: se uma transação longa estiver com ACCESS
-- SHARE na tabela, toda leitura/escrita da escala enfileira atrás dele e a tela
-- congela para quem está operando. Falhar rápido é melhor — basta reaplicar.
-- Mesmo cuidado de 20260729100000_profiles_conta_duplicada.sql.
set local lock_timeout = '3s';

-- ── 1) A coluna ──────────────────────────────────────────────────────────────
alter table public.escala_cirurgica_caso
  add column if not exists gravidade text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.escala_cirurgica_caso'::regclass
       and conname = 'escala_cirurgica_caso_gravidade_check'
  ) then
    alter table public.escala_cirurgica_caso
      add constraint escala_cirurgica_caso_gravidade_check
      check (gravidade is null or gravidade in ('imediata', 'urgente', 'aguarda'));
  end if;
end
$$;

comment on column public.escala_cirurgica_caso.gravidade is
  'Gravidade da urgência (adaptação NCEPOD): imediata|urgente|aguarda. NULL = não classificada — ordena por último na fila do HRO, com chamada de ação. Sem default de propósito: não existe gravidade neutra.';

-- ── 2) O log de eventos precisa carregar a gravidade ─────────────────────────
-- Coluna de verdade, como `tipo_caso`, e não `detalhe jsonb`: é por ela que o
-- relatório contratual quebra a espera da fila por gravidade, e o evento é o
-- único registro que sobrevive à republicação do turno.
alter table public.escala_cirurgica_evento
  add column if not exists gravidade_caso text;

comment on column public.escala_cirurgica_evento.gravidade_caso is
  'Gravidade do caso no instante do evento (denormalizada, como tipo_caso). NULL = não classificada ou evento anterior a 2026-08-18.';

-- ⚠️ LACUNA CONHECIDA E ACEITA (18/08): o trigger é `after update of
-- status_cirurgia, status_extra`, então `gravidade_caso` só é gravado quando há
-- transição de status. Um caso classificado como 'imediata' que NUNCA muda de
-- status e depois é republicado perde a classificação sem deixar evento. Logar a
-- classificação como evento próprio exigiria relaxar
-- `escala_cirurgica_evento_tipo_check` (hoje status|liberacao|troca|publicacao) —
-- e NÃO basta acrescentar `gravidade` ao `of` do trigger, porque isso geraria
-- eventos tipo='status' com status_de = status_para, que a semântica de
-- 20260718100000 reserva para toggle de extra. Decisão: aceitar por ora; o
-- relatório contratual declara a cobertura em vez de fingir que é completa.

-- Trigger reproduzido por inteiro a partir de 20260721100000 (versão vigente),
-- com gravidade_caso acrescentada. Continua NUNCA bloqueando a operação
-- clínica: qualquer falha vira warning.
--
-- Guard no mesmo espírito do das RPCs: se a definição viva não for a que
-- esperamos (hotfix aplicado direto em prod, fora de migration), abortar em vez
-- de reverter em silêncio.
do $$
declare v text;
begin
  select pg_get_functiondef(p.oid) into v
    from pg_proc p
   where p.proname = 'log_escala_caso_status' and p.pronamespace = 'public'::regnamespace;
  if v is null then
    raise exception 'gravidade: log_escala_caso_status nao existe — migration fora de ordem';
  end if;
  if position('extra_para' in v) = 0 then
    raise exception 'gravidade: log_escala_caso_status vivo nao e a versao de 20260721100000 — revisar antes de sobrescrever';
  end if;
end
$$;

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
    convenio, tipo_caso, gravidade_caso, hora, tempo_estimado, anestesista, anestesista_user_id,
    status_de, status_para, detalhe, por
  ) values (
    'status', new.id, new.escala_id, v_data, v_hospital, new.sala, new.cirurgiao,
    new.procedimento, new.convenio, new.tipo, new.gravidade, new.hora, new.tempo_estimado,
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

-- ── 3) As DUAS RPCs que inserem caso enumeram colunas ────────────────────────
-- Sem a coluna aqui, publicar apaga a classificação EM SILÊNCIO — a mesma classe
-- de bug já documentada em supabaseEscalaCirurgicaService.js:79-81.
--
-- Em vez de recopiar ~110 linhas de corpo (foi assim que 20260726110000 nasceu
-- sem residente/residente_user_id/termino_previsto), o patch é aplicado sobre a
-- definição VIVA no banco, com assert de âncora única. Não há como regredir
-- outra coluna: o que não é a âncora não é tocado. Idempotente — pula se a
-- função já cita `gravidade`.
do $patch$
declare
  v_def text;
  v_novo text;
  v_alvos text[][] := array[
    -- função,                      âncora,                                                     substituição
    array['rpc_publicar_escala_turno',
          'sem_anestesista,tipo,turno)',
          'sem_anestesista,tipo,gravidade,turno)'],
    array['rpc_publicar_escala_turno',
          'coalesce(nullif(c->>''tipo'',''''),''eletiva''), p_turno',
          'coalesce(nullif(c->>''tipo'',''''),''eletiva''), nullif(c->>''gravidade'',''''), p_turno'],
    array['rpc_salvar_escala_cirurgica',
          'sem_anestesista, tipo, turno',
          'sem_anestesista, tipo, gravidade, turno'],
    array['rpc_salvar_escala_cirurgica',
          'coalesce(nullif(c->>''tipo'', ''''), ''eletiva''),',
          'coalesce(nullif(c->>''tipo'', ''''), ''eletiva''),' || chr(10) || '      nullif(c->>''gravidade'', ''''),']
  ];
  v_fn text;
  v_assinatura text;
  v_oid regprocedure;
  i int;
  v_ancora text;
  v_troca text;
  v_ocorrencias int;
begin
  -- Resolvido por ASSINATURA (to_regprocedure), não por nome + limit 1: se um dia
  -- houver overload, o `limit 1` escolheria arbitrariamente qual patchear.
  foreach v_assinatura in array array[
    'public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb)',
    'public.rpc_salvar_escala_cirurgica(jsonb,jsonb)'
  ]
  loop
    v_fn := split_part(split_part(v_assinatura, '(', 1), '.', 2);
    v_oid := to_regprocedure(v_assinatura);
    if v_oid is null then
      raise exception 'gravidade: funcao % nao existe — migration fora de ordem', v_assinatura;
    end if;
    v_def := pg_get_functiondef(v_oid);

    if position('gravidade' in v_def) > 0 then
      raise notice 'gravidade: % ja patcheada, pulando', v_fn;
      continue;
    end if;

    -- Guard herdado de 20260729210000: se a definicao viva nao for a mais nova,
    -- falhar ALTO agora, e não com 42703 na primeira publicação do expediente.
    if position('residente_user_id' in v_def) = 0 or position('termino_previsto' in v_def) = 0 then
      raise exception 'gravidade: definicao viva de % nao tem residente_user_id/termino_previsto — versao inesperada, abortando', v_fn;
    end if;

    v_novo := v_def;
    for i in 1 .. array_length(v_alvos, 1) loop
      if v_alvos[i][1] = v_fn then
        v_ancora := v_alvos[i][2];
        v_troca  := v_alvos[i][3];
        v_ocorrencias := (length(v_novo) - length(replace(v_novo, v_ancora, ''))) / length(v_ancora);
        if v_ocorrencias <> 1 then
          raise exception 'gravidade: ancora % ocorre % vez(es) em % (esperado 1)', v_ancora, v_ocorrencias, v_fn;
        end if;
        v_novo := replace(v_novo, v_ancora, v_troca);
      end if;
    end loop;

    execute v_novo;
    raise notice 'gravidade: % patcheada', v_fn;
  end loop;
end
$patch$;

-- ── 4) Verificação final: as duas RPCs têm de citar gravidade ────────────────
do $$
declare
  v_faltando text;
begin
  select string_agg(p.proname, ', ') into v_faltando
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('rpc_publicar_escala_turno', 'rpc_salvar_escala_cirurgica')
     and position('gravidade' in pg_get_functiondef(p.oid)) = 0;
  if v_faltando is not null then
    raise exception 'gravidade: RPC(s) sem a coluna apos o patch: %', v_faltando;
  end if;
end
$$;

commit;

-- Conferência VISÍVEL para quem aplica: os `raise notice` do patch não voltam
-- pela Management API, então o resultado sai como linhas aqui.
select p.proname,
       position('gravidade' in pg_get_functiondef(p.oid)) > 0 as tem_gravidade
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('rpc_publicar_escala_turno', 'rpc_salvar_escala_cirurgica')
 order by p.proname;

-- Rollback manual (não automatizado — coluna com dado clínico não se dropa sozinha):
--   alter table public.escala_cirurgica_caso drop constraint escala_cirurgica_caso_gravidade_check;
--   alter table public.escala_cirurgica_caso drop column gravidade;
--   alter table public.escala_cirurgica_evento drop column gravidade_caso;
--   (e reaplicar 20260815120000 + 20260729210000 + 20260721100000 para as funções)
