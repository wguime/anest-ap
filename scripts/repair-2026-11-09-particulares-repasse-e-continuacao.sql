-- Reparo das cobranças de particular (dono 09/11/2026) — dado antigo que a migration
-- 20261109234000_cirurgia_particular_acompanha_repasse.sql não regrava (ela vale dali em diante).
--
-- ENSAIO: este arquivo, COMO ESTÁ, roda tudo e termina em ROLLBACK — nada é gravado. O resultado
-- é a tabela de antes/depois (parte A agregada por anestesista de → para; parte B por contagem;
-- nenhum nome de paciente). Para ver a tabela, rodar pelo `query`:
--   node scripts/deploy-sp21-mgmt-api.mjs query "$(grep -v '^--' scripts/repair-2026-11-09-particulares-repasse-e-continuacao.sql)"
-- Conferido o ensaio, trocar a ÚLTIMA linha (`rollback;`) por `commit;` e rodar de novo, igual.
-- A mesma tabela volta e vale como conferência: as três linhas "depois" têm de dar o esperado
-- (0 · 0 · e as continuações preenchidas que ficaram para conferir à mão).
--
-- ORDEM: só DEPOIS da migration 20261109234000 (o script aborta sem ela). Sem a migration o cron
-- das 20:30 reabriria as cobranças de continuação canceladas aqui (ele trata "cancelada" como
-- "sem lançamento ativo" durante 7 dias), e novos repasses voltariam a divergir.
--
-- PARTE A — "Corrigir todas para quem fez": cobrança AINDA NÃO PREENCHIDA (mesmo critério da
--   migration: sem CPF, R$ 0, pendente sem data, sem observação, não cancelada) cujo anestesista
--   não é o do caso → passa para o anestesista ATUAL do caso. Dupla "A + B" recebe os dois nomes
--   como estão no caso, sem login (regra nova). NÃO toca: cobrança preenchida, caso sem
--   anestesista ("?"), linha de continuação, nem as 10 em que o login é o mesmo e só a GRAFIA do
--   nome no cadastro mudou (ex.: nome completo → nome curto) — isso não é repasse.
--   Medido em produção em 09/11/2026 ~23h20: 183 (182 com outro login + 1 que virou dupla),
--   cirurgias de 22/07 a 09/11. Trava: 173 a 188. A folga existe porque o número se mexe sozinho
--   entre a medição e a aplicação: CAI quando alguém preenche uma guia (ela sai do critério) e
--   SOBE com repasse de caso até 09/11 feito antes de a migration entrar. Fora da faixa, aborta.
--   Só entram cirurgias até 09/11/2026 (o que foi medido).
--
-- PARTE B — "Cancelar as duplicadas": cobrança ativa pendurada numa linha de CONTINUAÇÃO (abertas
--   pelo cron, que não ignorava continuação) quando existe cobrança ativa do caso de origem — o
--   par do módulo: mesmo dia, mesmo hospital, mesmo cirurgião e mesmas iniciais, em linha que não
--   é continuação. Cancelamento igual ao da tela (cancelada_em/por/por_nome + motivo; nunca
--   DELETE). Continuação com cobrança PREENCHIDA não é cancelada: fica listada para conferir à mão.
--   Medido: 12 (02/10 a 03/11), as 12 com par, nenhuma preenchida, nenhum par preenchido.
--   Trava: canceladas + preenchidas-listadas = 12, exato (uma sem par muda a conta e aborta).
--
-- Autoria: o dono (uid dos outros repairs), nome lido do cadastro na hora — nunca um autor genérico.
-- Rodar duas vezes: a 2ª aborta ("fora da faixa"), sem gravar nada.
--
-- DE → PARA POR LINHA (revisão LGPD 10/11): antes de alterar, na MESMA transação, cada cobrança
-- tocada ganha uma linha em public.cirurgias_particulares_reparo_2026_11_09 — id da cobrança,
-- parte (A corrigida / B cancelada), anestesista (nome e login) antes e depois, os campos de
-- cancelamento e de "última edição" antes, quem rodou e quando. NENHUM dado de paciente. É o
-- que permite dizer qual cobrança era de quem e DESFAZER (SQL comentado no fim do arquivo): a
-- captura da escala só existe desde 25/09 e updated_by/updated_at não guardam o valor anterior.
-- Tabela com RLS ligada e SEM policy + revoke de public/anon/authenticated: pelo app ninguém
-- lê; só quem acessa o banco como dono. No ensaio (rollback) a tabela não fica.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

-- o de → para por linha (auditoria e desfazer) — sem dado de paciente
create table if not exists public.cirurgias_particulares_reparo_2026_11_09 (
  id bigint generated always as identity primary key,
  cobranca_id uuid not null,
  parte text not null check (parte in ('A', 'B')),   -- A = anestesista corrigido · B = duplicada cancelada
  anestesista_nome_antes text,
  anestesista_user_id_antes text,
  anestesista_nome_depois text,
  anestesista_user_id_depois text,
  cancelada_em_antes timestamptz,
  cancelada_por_antes text,
  cancelada_por_nome_antes text,
  motivo_cancelamento_antes text,
  updated_by_antes text,
  updated_by_name_antes text,
  updated_at_antes timestamptz,
  rodado_por text not null,
  rodado_por_nome text not null,
  rodado_em timestamptz not null default now(),
  unique (cobranca_id, parte)
);
comment on table public.cirurgias_particulares_reparo_2026_11_09 is
  'De→para por cobrança do reparo scripts/repair-2026-11-09-particulares-repasse-e-continuacao.sql (auditoria e desfazer). Sem dado de paciente. RLS sem policy: leitura só pelo dono do banco.';
alter table public.cirurgias_particulares_reparo_2026_11_09 enable row level security;
alter table public.cirurgias_particulares_reparo_2026_11_09 force row level security;
revoke all on table public.cirurgias_particulares_reparo_2026_11_09 from public;
revoke all on table public.cirurgias_particulares_reparo_2026_11_09 from anon, authenticated;

-- o "antes", para a tabela do fim
create temp table _reparo_antes on commit drop as
  select cp.id, cp.anestesista_nome, cp.anestesista_user_id
    from public.cirurgias_particulares cp
   where cp.cancelada_em is null;

do $$
declare
  v_dono constant text := 'pPdKZ75E9zNdPnLz50qisPiHfJw1';
  v_dono_nome text;
  v_ate constant date := date '2026-11-09';
  v_esperado_a constant int := 183;
  v_folga_menos constant int := 10;
  v_folga_mais constant int := 5;
  v_esperado_b constant int := 12;
  v_motivo constant text := 'Duplicada: continuação da mesma cirurgia — a cobrança é a do caso de origem (reparo 09/11/2026)';
  n int;
  v_listadas int;
begin
  select nullif(btrim(p.nome), '') into v_dono_nome from public.profiles p where p.id = v_dono;
  if v_dono_nome is null then
    raise exception 'reparo: perfil do dono não encontrado — não assino sem autor real';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tr_caso_cobranca_acompanha_repasse' and not tgisinternal)
     or not (select prosrc like '%NOT coalesce(c.is_continuacao, false)%' from pg_proc
              where oid = 'public.fn_verificar_cirurgias_particulares(text, boolean)'::regprocedure) then
    raise exception 'reparo: aplicar antes a migration 20261109234000 (senão o cron reabre o que for cancelado)';
  end if;

  ------------------------------------------------------------------
  -- PARTE A — rascunho com anestesista diferente do caso → quem fez
  ------------------------------------------------------------------
  with alvo as (
    select cp.id,
           cp.anestesista_nome as de_nome, cp.anestesista_user_id as de_login,
           cp.updated_by as de_upd_by, cp.updated_by_name as de_upd_nome, cp.updated_at as de_upd_em,
           case when btrim(coalesce(c.anestesista, '')) ~ '\+' then btrim(c.anestesista)
                else coalesce(nullif(btrim(coalesce(p.nome, '')), ''),
                              case when btrim(coalesce(c.anestesista, '')) ~ '[[:alpha:]]' then btrim(c.anestesista) end)
           end as para_nome,
           case when btrim(coalesce(c.anestesista, '')) ~ '\+' then null
                else nullif(btrim(coalesce(c.anestesista_user_id, '')), '')
           end as para_login
      from public.cirurgias_particulares cp
      join public.escala_cirurgica_caso c on c.id = cp.escala_caso_id
      left join public.profiles p on p.id = c.anestesista_user_id
     where cp.cancelada_em is null
       -- AINDA NÃO PREENCHIDA (critério da migration)
       and cp.paciente_cpf is null
       and cp.valor = 0
       and cp.status_pagamento = 'pendente'
       and cp.data_pagamento is null
       and nullif(btrim(coalesce(cp.observacoes, '')), '') is null
       and not coalesce(c.is_continuacao, false)
       and cp.data_cirurgia <= v_ate
  ), corrigidas as (
  update public.cirurgias_particulares cp
     set anestesista_nome = a.para_nome,
         anestesista_user_id = a.para_login,
         updated_at = now(),
         updated_by = v_dono,
         updated_by_name = v_dono_nome
    from alvo a
   where cp.id = a.id
     and a.para_nome is not null            -- caso sem anestesista ("?"): não toca
     and (cp.anestesista_user_id is distinct from a.para_login                       -- outra pessoa
          or (a.para_login is null and cp.anestesista_nome is distinct from a.para_nome))  -- dupla / sem login
  returning cp.id, a.de_nome, a.de_login, a.para_nome, a.para_login, a.de_upd_by, a.de_upd_nome, a.de_upd_em
  )
  -- uma linha de de → para por cobrança corrigida (mesmo comando: ou grava as duas coisas, ou nenhuma)
  insert into public.cirurgias_particulares_reparo_2026_11_09 (
    cobranca_id, parte, anestesista_nome_antes, anestesista_user_id_antes,
    anestesista_nome_depois, anestesista_user_id_depois,
    updated_by_antes, updated_by_name_antes, updated_at_antes, rodado_por, rodado_por_nome)
  select k.id, 'A', k.de_nome, k.de_login, k.para_nome, k.para_login,
         k.de_upd_by, k.de_upd_nome, k.de_upd_em, v_dono, v_dono_nome
    from corrigidas k;
  get diagnostics n = row_count;
  if n < v_esperado_a - v_folga_menos or n > v_esperado_a + v_folga_mais then
    raise exception 'reparo A: esperava % (faixa % a %), corrigiria % — fora da faixa (estado mudou ou já aplicado), revisar',
      v_esperado_a, v_esperado_a - v_folga_menos, v_esperado_a + v_folga_mais, n;
  end if;

  ------------------------------------------------------------------
  -- PARTE B — cobrança em linha de continuação com par no caso de origem
  ------------------------------------------------------------------
  create temp table _reparo_b on commit drop as
    select cp.id,
           not (cp.paciente_cpf is null and cp.valor = 0 and cp.status_pagamento = 'pendente'
                and cp.data_pagamento is null
                and nullif(btrim(coalesce(cp.observacoes, '')), '') is null) as preenchida
      from public.cirurgias_particulares cp
      join public.escala_cirurgica_caso c on c.id = cp.escala_caso_id
      join public.escala_cirurgica e on e.id = c.escala_id
     where cp.cancelada_em is null
       and coalesce(c.is_continuacao, false)
       and exists (
         select 1
           from public.escala_cirurgica_caso m
           join public.escala_cirurgica em on em.id = m.escala_id
           join public.cirurgias_particulares cm on cm.escala_caso_id = m.id and cm.cancelada_em is null
          where em.data = e.data and em.hospital = e.hospital and em.status = 'publicada'
            and m.id <> c.id
            and not coalesce(m.is_continuacao, false)
            and upper(btrim(coalesce(m.cirurgiao, ''))) = upper(btrim(coalesce(c.cirurgiao, '')))
            and upper(btrim(coalesce(m.paciente_iniciais, ''))) = upper(btrim(coalesce(c.paciente_iniciais, '')))
            and nullif(btrim(coalesce(c.paciente_iniciais, '')), '') is not null
       );
  select count(*) into v_listadas from _reparo_b where preenchida;

  -- de → para por linha, ANTES de cancelar (o anestesista não muda na parte B)
  insert into public.cirurgias_particulares_reparo_2026_11_09 (
    cobranca_id, parte, anestesista_nome_antes, anestesista_user_id_antes,
    anestesista_nome_depois, anestesista_user_id_depois,
    cancelada_em_antes, cancelada_por_antes, cancelada_por_nome_antes, motivo_cancelamento_antes,
    updated_by_antes, updated_by_name_antes, updated_at_antes, rodado_por, rodado_por_nome)
  select cp.id, 'B', cp.anestesista_nome, cp.anestesista_user_id, cp.anestesista_nome, cp.anestesista_user_id,
         cp.cancelada_em, cp.cancelada_por, cp.cancelada_por_nome, cp.motivo_cancelamento,
         cp.updated_by, cp.updated_by_name, cp.updated_at, v_dono, v_dono_nome
    from public.cirurgias_particulares cp
    join _reparo_b b on b.id = cp.id
   where not b.preenchida and cp.cancelada_em is null;

  update public.cirurgias_particulares cp
     set cancelada_em = now(),
         cancelada_por = v_dono,
         cancelada_por_nome = v_dono_nome,
         motivo_cancelamento = v_motivo,
         updated_at = now(),
         updated_by = v_dono,
         updated_by_name = v_dono_nome
    from _reparo_b b
   where cp.id = b.id and not b.preenchida and cp.cancelada_em is null;
  get diagnostics n = row_count;
  if n + v_listadas <> v_esperado_b then
    raise exception 'reparo B: esperava % duplicadas com par (cancelaria % + % preenchidas só listadas) — estado mudou ou já aplicado, revisar',
      v_esperado_b, n, v_listadas;
  end if;
end $$;

-- ANTES/DEPOIS + CONFERÊNCIA (sem nome de paciente). No ensaio é o que seria gravado.
select parte, de, para, n from (
  select 1 as o, 'A · de → para' as parte, a.anestesista_nome as de, cp.anestesista_nome as para, count(*)::int as n
    from _reparo_antes a join public.cirurgias_particulares cp on cp.id = a.id
   where cp.cancelada_em is null
     and (cp.anestesista_nome is distinct from a.anestesista_nome
          or cp.anestesista_user_id is distinct from a.anestesista_user_id)
   group by a.anestesista_nome, cp.anestesista_nome
  union all
  select 2, 'A · total corrigido (esperado 183, faixa 173–188)', null, null, count(*)::int
    from _reparo_antes a join public.cirurgias_particulares cp on cp.id = a.id
   where cp.cancelada_em is null
     and (cp.anestesista_nome is distinct from a.anestesista_nome
          or cp.anestesista_user_id is distinct from a.anestesista_user_id)
  union all
  select 3, 'B · duplicadas de continuação canceladas (esperado 12)', null, null, count(*)::int
    from _reparo_antes a join public.cirurgias_particulares cp on cp.id = a.id
   where cp.cancelada_em is not null
  union all
  select 3, 'registro · linhas de de → para gravadas (esperado = A + B)', null, null, count(*)::int
    from public.cirurgias_particulares_reparo_2026_11_09
  union all
  select 4, 'depois · rascunho ainda com outro login que o do caso (esperado 0)', null, null, count(*)::int
    from public.cirurgias_particulares cp
    join public.escala_cirurgica_caso c on c.id = cp.escala_caso_id
   where cp.cancelada_em is null
     and cp.paciente_cpf is null and cp.valor = 0 and cp.status_pagamento = 'pendente'
     and cp.data_pagamento is null and nullif(btrim(coalesce(cp.observacoes, '')), '') is null
     and not coalesce(c.is_continuacao, false)
     and cp.data_cirurgia <= date '2026-11-09'
     and btrim(coalesce(c.anestesista, '')) !~ '\+'
     and nullif(btrim(coalesce(c.anestesista_user_id, '')), '') is not null
     and cp.anestesista_user_id is distinct from c.anestesista_user_id
  union all
  select 5, 'depois · cobrança ativa em linha de continuação NÃO preenchida (esperado 0)', null, null, count(*)::int
    from public.cirurgias_particulares cp
    join public.escala_cirurgica_caso c on c.id = cp.escala_caso_id
   where cp.cancelada_em is null and coalesce(c.is_continuacao, false)
     and cp.paciente_cpf is null and cp.valor = 0 and cp.status_pagamento = 'pendente'
     and cp.data_pagamento is null and nullif(btrim(coalesce(cp.observacoes, '')), '') is null
  union all
  select 6, 'depois · continuação com cobrança PREENCHIDA, não cancelada — conferir à mão (esperado 0)', null, null, count(*)::int
    from public.cirurgias_particulares cp
    join public.escala_cirurgica_caso c on c.id = cp.escala_caso_id
   where cp.cancelada_em is null and coalesce(c.is_continuacao, false)
     and not (cp.paciente_cpf is null and cp.valor = 0 and cp.status_pagamento = 'pendente'
              and cp.data_pagamento is null and nullif(btrim(coalesce(cp.observacoes, '')), '') is null)
) t
order by o, n desc, de, para;

rollback;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- DESFAZER O REPARO (só se o dono pedir) — a partir de cirurgias_particulares_reparo_2026_11_09.
-- Tirar o "-- " do começo das linhas entre as duas marcas e rodar. Devolve o anestesista (parte A)
-- e reabre a cobrança (parte B) SÓ onde a linha ainda está como o reparo deixou: cobrança que
-- alguém editou ou preencheu depois não é tocada (aparece na contagem "ficaram como estão").
-- A tabela de registro NÃO é apagada. Assinado pelo dono, como o reparo.
-- >>> DESFAZER
-- begin;
-- set local lock_timeout = '3s';
-- select set_config('request.jwt.claims',
--   json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);
-- create temp table _desfeitas on commit drop as
--   with dono as (
--     select p.id, nullif(btrim(p.nome), '') as nome from public.profiles p
--      where p.id = 'pPdKZ75E9zNdPnLz50qisPiHfJw1' and nullif(btrim(p.nome), '') is not null
--   ), a as (
--     update public.cirurgias_particulares cp
--        set anestesista_nome = r.anestesista_nome_antes,
--            anestesista_user_id = r.anestesista_user_id_antes,
--            updated_at = now(), updated_by = d.id, updated_by_name = d.nome
--       from public.cirurgias_particulares_reparo_2026_11_09 r, dono d
--      where r.parte = 'A' and cp.id = r.cobranca_id
--        and cp.cancelada_em is null
--        and cp.anestesista_nome is not distinct from r.anestesista_nome_depois
--        and cp.anestesista_user_id is not distinct from r.anestesista_user_id_depois
--        and cp.updated_by is not distinct from r.rodado_por
--     returning cp.id
--   ), b as (
--     update public.cirurgias_particulares cp
--        set cancelada_em = r.cancelada_em_antes,
--            cancelada_por = r.cancelada_por_antes,
--            cancelada_por_nome = r.cancelada_por_nome_antes,
--            motivo_cancelamento = r.motivo_cancelamento_antes,
--            updated_at = now(), updated_by = d.id, updated_by_name = d.nome
--       from public.cirurgias_particulares_reparo_2026_11_09 r, dono d
--      where r.parte = 'B' and cp.id = r.cobranca_id
--        and cp.cancelada_em is not null
--        and cp.cancelada_por is not distinct from r.rodado_por
--        and cp.motivo_cancelamento like 'Duplicada: continuação da mesma cirurgia%'
--        and not exists (select 1 from public.cirurgias_particulares o
--                         where o.escala_caso_id = cp.escala_caso_id and o.cancelada_em is null)
--     returning cp.id
--   )
--   select 'A' as parte, id from a union all select 'B', id from b;
-- select r.parte,
--        count(*)::int as registradas,
--        count(d.id)::int as desfeitas,
--        (count(*) - count(d.id))::int as ficaram_como_estao
--   from public.cirurgias_particulares_reparo_2026_11_09 r
--   left join _desfeitas d on d.id = r.cobranca_id and d.parte = r.parte
--  group by r.parte order by r.parte;
-- commit;
-- <<< DESFAZER
