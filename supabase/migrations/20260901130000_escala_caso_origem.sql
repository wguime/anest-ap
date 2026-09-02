-- ════════════════════════════════════════════════════════════════════════
-- 20260901130000_escala_caso_origem.sql
-- Escala Cirúrgica — de onde o caso veio, e rastro de quem o apagou.
--
-- Motivo (dono 2026-09-01): "quero poder editar o novo caso após publicado e ou
-- excluir se for necessário". O EXCLUIR foi decidido ESTREITO — alcança só o
-- caso ADICIONADO À MÃO (urgência, encaixe, cirurgia fora do mapa). O caso que
-- veio do mapa não ganha o botão: apagá-lo por engano custaria reimportar o dia,
-- e a republicação do turno já é o caminho de conserto dele.
--
-- BACKFILL do histórico por INFERÊNCIA MEDIDA, não por chute — DUAS condições,
-- porque uma só erra:
--
--   (a) nasceu DEPOIS do lote do seu (escala, turno). A publicação insere o
--       turno inteiro numa transação, e `now()` é o timestamp da transação:
--       o lote compartilha exatamente o mesmo created_at. Medido em 2026-09-01
--       sobre as 3.586 linhas, distância até o primeiro do grupo:
--           ≤5s: 3.313 · 5–60s: 2 · 1–10min: 5 · 10–60min: 29 · >1h: 237
--
--   (b) nasceu SOZINHA (`irmaos = 1`). `addCaso` insere UMA linha por chamada,
--       então adição à mão nunca tem irmão no mesmo microssegundo. Sem esta
--       segunda condição, 77 linhas de LOTE seriam marcadas 'manual' e
--       ganhariam o botão Excluir — exatamente o que a decisão do dono impede.
--       São três lotes de 2026-07-23 (32, 29 e 16 linhas) que escaparam do
--       `delete ... and turno=p_turno` da republicação por terem `turno NULL`
--       na época (a coluna nasce em 20260726100000) e só virarem 'matutino' no
--       forçamento de 20260804180000 — depois disso, dois lotes na mesma
--       partição. Contado em produção: 273 sem a guarda, 196 com ela.
--
-- ⚠️ Limite honesto: para o passado isto é inferência. Do app em diante a marca
-- é exata — `addCaso` grava 'manual' e as três rotas de publicação
-- (20260804180000, 20260815120000, 20260729210000) inserem com lista explícita
-- de colunas, sem citar `origem`, caindo no default 'importacao'.
-- ⚠️ Ordem de deploy: migration ANTES do app. Com o app velho no ar nada
-- quebra — o caso adicionado à mão nasceria 'importacao' e ficaria sem botão.
--
-- RLS: nenhuma policy nova. A coluna entra numa tabela já fechada por
-- `can_write_escala_cirurgica()` nos quatro verbos (20260628200000), e o DELETE
-- que ela passa a governar já era permitido — quem edita a escala pode apagar
-- caso. O estreitamento "só o adicionado à mão" é regra de UI, não de banco.
-- LGPD: `origem` é proveniência, sem dado de paciente; o evento de exclusão
-- segue a regra da tabela de eventos e NÃO copia paciente_iniciais/idade.
--
-- ROLLBACK (manual):
--   drop trigger if exists tr_escala_caso_evento_exclusao on public.escala_cirurgica_caso;
--   drop function if exists public.log_escala_caso_exclusao();
--   alter table public.escala_cirurgica_caso drop constraint if exists escala_caso_origem_check;
--   alter table public.escala_cirurgica_caso drop column if exists origem;
-- ⚠️ dropar a coluna descarta a classificação: o backfill é reproduzível, as
--    marcas 'manual' gravadas pelo app depois desta migration NÃO são.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. A coluna ────────────────────────────────────────────────────────────
-- NOT NULL DEFAULT com default constante não reescreve a tabela (attmissingval,
-- PG 11+): só um ACCESS EXCLUSIVE breve.
alter table public.escala_cirurgica_caso
  add column if not exists origem text not null default 'importacao';

-- CHECK guardado (o `add constraint` não aceita IF NOT EXISTS): reaplicar a
-- migration não pode falhar no meio e deixar o backfill por fazer.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.escala_cirurgica_caso'::regclass
       and conname = 'escala_caso_origem_check'
  ) then
    alter table public.escala_cirurgica_caso
      add constraint escala_caso_origem_check check (origem in ('importacao', 'manual'));
  end if;
end $$;

comment on column public.escala_cirurgica_caso.origem is
  'De onde o caso veio: ''importacao'' (lote da publicação/RPC — o default, e o que as RPCs produzem por não citarem a coluna) ou ''manual'' (INSERT avulso do "Adicionar caso"). Só o ''manual'' oferece Excluir na UI; o importado se conserta republicando o turno. Histórico anterior a 2026-09-01 foi inferido pelo created_at (ver cabeçalho da migration 20260901130000).';

-- ── 2. Backfill do histórico ───────────────────────────────────────────────
-- `tr_escala_caso_updated_at` é BEFORE UPDATE SEM lista de colunas: sem
-- desligá-lo, marcar 196 linhas carimbaria updated_at em todas e apagaria o
-- histórico real de quando cada caso mudou pela última vez. Mesmo padrão de
-- 20260721100000. ⚠️ isto NÃO silencia o realtime (os eventos vêm do WAL):
-- aplicar com nenhum turno em andamento, como manda a regra de deploy do módulo.
alter table public.escala_cirurgica_caso disable trigger tr_escala_caso_updated_at;

with lote as (
  select id,
         created_at,
         min(created_at) over (partition by escala_id, turno)             as primeiro,
         count(*)        over (partition by escala_id, turno, created_at) as irmaos
    from public.escala_cirurgica_caso
)
update public.escala_cirurgica_caso c
   set origem = 'manual'
  from lote
 where lote.id = c.id
   -- idempotente: o que já está marcado sai por aqui, e linha nova do app já
   -- nasce 'manual' sem depender desta conta.
   and c.origem = 'importacao'
   and lote.created_at > lote.primeiro + interval '30 seconds'
   and lote.irmaos = 1;

alter table public.escala_cirurgica_caso enable trigger tr_escala_caso_updated_at;

-- ── 3. Rastro da exclusão ──────────────────────────────────────────────────
-- Apagar caso é a primeira operação DESTRUTIVA de dado clínico que o app
-- oferece — sem registro, "quem apagou a cirurgia das 15:00?" não tem resposta.
-- O log reaproveita `escala_cirurgica_evento`, que já é insert-only,
-- denormalizado e sobrevive à republicação.
alter table public.escala_cirurgica_evento drop constraint if exists escala_cirurgica_evento_tipo_check;
alter table public.escala_cirurgica_evento add constraint escala_cirurgica_evento_tipo_check
  check (tipo in ('status', 'liberacao', 'troca', 'publicacao', 'exclusao'));

create or replace function public.log_escala_caso_exclusao()
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
    from public.escala_cirurgica e where e.id = old.escala_id;
  if v_data is null then
    return old; -- escala inteira sendo apagada (cascade): nada a logar
  end if;

  -- LGPD: mesma regra da tabela — nem paciente_iniciais nem idade entram.
  insert into public.escala_cirurgica_evento (
    tipo, caso_id, escala_id, data, hospital, sala, cirurgiao, procedimento,
    convenio, tipo_caso, hora, tempo_estimado, anestesista, anestesista_user_id,
    status_de, detalhe, por
  ) values (
    'exclusao', old.id, old.escala_id, v_data, v_hospital, old.sala, old.cirurgiao,
    old.procedimento, old.convenio, old.tipo, old.hora, old.tempo_estimado,
    old.anestesista, old.anestesista_user_id, old.status_cirurgia,
    jsonb_build_object('turno', old.turno, 'statusExtra', old.status_extra),
    public.firebase_uid()
  );
  return old;
exception when others then
  return old; -- registrar NUNCA pode impedir a exclusão no meio do plantão
end $$;

comment on function public.log_escala_caso_exclusao() is
  'Registra em escala_cirurgica_evento (tipo=exclusao) o caso ADICIONADO À MÃO que foi apagado, com o autor por firebase_uid(). Só origem=manual: a republicação de um turno apaga o lote inteiro e logar tudo encheria a tabela de ruído — e caso do mapa não tem botão de excluir no app. Um manual apagado pela republicação também aparece aqui, e isso é de propósito: é perda silenciosa que hoje ninguém vê.';

drop trigger if exists tr_escala_caso_evento_exclusao on public.escala_cirurgica_caso;
create trigger tr_escala_caso_evento_exclusao
  after delete on public.escala_cirurgica_caso
  for each row
  when (old.origem = 'manual')
  execute function public.log_escala_caso_exclusao();

COMMIT;
