-- Escala Cirúrgica — três consertos da auditoria de 09/11/2026 (NÃO APLICADA: aguarda o dono).
--
-- 1. GATE DE PUBLICAÇÃO. A migration 20260908190000 pôs `pode_publicar_escala_turno`
--    dentro de `rpc_publicar_escala_turno` (contas de hospital OPERAM, não PUBLICAM).
--    As recriações de 23/09 (20260923160000) e 02/10 (20261002190000) copiaram o corpo
--    de antes e devolveram `can_write_escala_cirurgica()`. Conferido em produção em
--    09/11 com pg_get_functiondef: a RPC só checa o gate de operar. A tela esconde o
--    botão, mas a chamada direta publica.
--    O conserto troca SÓ a linha do gate na definição que está no banco (em vez de
--    recriar 300 linhas à mão): nada mais do corpo muda, e a migration aborta se a
--    linha esperada não estiver lá exatamente uma vez. Idempotente.
--
-- 2. ANON SEM ACESSO ÀS TABELAS DA ESCALA. `anon` tinha SELECT/INSERT/UPDATE/DELETE
--    (grant padrão do Supabase); as policies são `to authenticated`, então a RLS
--    devolvia 200 com zero linhas e 204 sem gravar — foi o que escondeu as requisições
--    que saíram sem token em 09/11 (o cliente novo nunca manda a chave anon com
--    usuário logado — src/lib/fetchSupabaseAutenticado.js; isto é a segunda trava e
--    pode ser aplicada antes ou depois do deploy dele). Sem o grant a resposta
--    vira 401/42501, que o app trata como falha. Nenhuma página pública lê estas tabelas.
--
-- 3. ÍNDICE DO RELATÓRIO DE ADESÃO. `escala_adesao_relatorio` varria 90 dias de
--    `user_activity_log` pelo índice de data (33 mil buffers, 1,3 s) para achar ~65
--    usuários: mediana 2,4 s, máximo 10 s, 192 chamadas/dia a partir do card da Home.
--    Índice parcial com os MESMOS predicados da função.
--
-- Rollback: (1) trocar a linha de volta com o mesmo bloco, invertendo de/para;
-- (2) `grant select, insert, update, delete on <tabelas> to anon`; (3) `drop index`.

begin;

-- ── 1. gate de publicação ────────────────────────────────────────────────────
do $mig$
declare
  v_def text;
  v_de constant text := 'if not public.can_write_escala_cirurgica() then';
  v_para constant text := 'if not public.pode_publicar_escala_turno(p_data, p_hospital, p_casos) then';
  v_n int;
begin
  select pg_get_functiondef(p.oid) into strict v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'rpc_publicar_escala_turno';

  if position(v_para in v_def) > 0 then
    raise notice 'rpc_publicar_escala_turno já usa pode_publicar_escala_turno — nada a fazer';
    return;
  end if;

  v_n := (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de);
  if v_n <> 1 then
    raise exception 'gate esperado aparece % vez(es) em rpc_publicar_escala_turno — conferir a definição antes de aplicar', v_n;
  end if;

  execute replace(v_def, v_de, v_para);
end
$mig$;

-- ── 2. anon fora das tabelas da escala ───────────────────────────────────────
revoke all on table
  public.escala_cirurgica,
  public.escala_cirurgica_caso,
  public.escala_cirurgica_evento,
  public.escala_plantao_p4_diario,
  public.escala_cirurgica_aviso,
  public.escala_cirurgica_aviso_confirmacao,
  public.escala_cirurgica_aviso_tempo,
  public.escala_anestesista_alias
from anon;

-- ── 3. índice parcial do relatório de adesão ─────────────────────────────────
-- Sem CONCURRENTLY: roda dentro da transação abaixo. A tabela tem ~137 mil linhas e
-- ~1,3 mil inserts/dia; a criação segura escrita no log por uma fração de segundo —
-- por isso é o ÚLTIMO comando. `created_at` na frente: os três usos (pv e vistos do
-- relatório, pv do gravar_dia) filtram por faixa de data, nunca por usuário.
create index if not exists idx_activity_log_pv_escala
  on public.user_activity_log (created_at, user_id)
  where event_type = 'page_view' and (event_data->>'page') = 'escalaCirurgica';

commit;

-- Conferência (a Management API não devolve raise notice): os três têm de vir
-- gate_ok = true, anon_le = false, indice = true.
select
  position('pode_publicar_escala_turno(p_data, p_hospital, p_casos)' in
    pg_get_functiondef('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) > 0 as gate_ok,
  has_table_privilege('anon', 'public.escala_cirurgica', 'select') as anon_le,
  to_regclass('public.idx_activity_log_pv_escala') is not null as indice;
