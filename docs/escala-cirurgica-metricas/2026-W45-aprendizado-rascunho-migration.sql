-- =====================================================================================
-- RASCUNHO — NÃO APLICAR. Não está em supabase/migrations/ de propósito.
-- O que gravar para o aprendizado da escalação melhorar sozinho (relatório
-- 2026-W45-aprendizado-relacoes.md, seção 5). Antes de virar migration: migration-validator,
-- ensaio com rollback, aplicar fora de turno, e linha em docs/lgpd-retencao.md.
-- Princípios herdados de 20260925220000: nada disto vai para escala_cirurgica_evento (o relatório
-- de adesão conta todo evento de lá como ação); leitura só admin; sem iniciais nem idade de paciente;
-- nenhuma escrita pode bloquear a publicação (exception → warning).
-- =====================================================================================

-- 1. RETRATO DA CONFERÊNCIA — o que a conferência já calcula e hoje descarta.
--    Um registro por publicação de turno: grade esperada pela numérica, férias, pós-plantão,
--    divergências aceitas e decisões. Entra como tipo novo da captura que já existe.
alter table public.escala_cirurgica_captura drop constraint if exists escala_cirurgica_captura_tipo_check;
alter table public.escala_cirurgica_captura add constraint escala_cirurgica_captura_tipo_check
  check (tipo in ('estimativa', 'estimativa_total', 'alocacao', 'realocacao', 'ordem', 'conferencia'));
-- detalhe da linha 'conferencia' (gravada pela rpc_publicar_escala_turno a partir de um p_conferencia jsonb):
--   { "esperado": [{numero, uid}], "ferias": [uid], "posPlantao": {hro: uid, unimed: uid},
--     "ausentes": [uid], "divergencias": {faltam: [...], sobram: [...], foraDeOrdem: [...]},
--     "fonte": "tela" | "skill", "numericaEdicao": "2026-08" }
--   ⚠️ "ausentes" guarda só QUEM, nunca o motivo (licença é dado de saúde).

-- 2. DICIONÁRIO DE CIRURGIÕES — mesma mecânica do escala_anestesista_alias.
create table if not exists public.escala_cirurgiao (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,                 -- nome canônico, como o grupo fala
  especialidade text,                        -- opcional, preenchida na revisão
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  criado_por  text not null
);
create table if not exists public.escala_cirurgiao_alias (
  hospital     text not null check (hospital in ('unimed', 'hro', 'materno')),
  apelido      text not null,                -- grafia do mapa, normalizada (maiúsculas, sem acento, sem DR/DRA)
  cirurgiao_id uuid not null references public.escala_cirurgiao(id) on delete cascade,
  criado_em    timestamptz not null default now(),
  criado_por   text not null,
  primary key (hospital, apelido)
);
-- RLS: select para quem opera a escala (can_write_escala_cirurgica); insert/update para quem publica
-- (can_publicar_escala_cirurgica); delete só admin. Carga inicial: os 191 grupos que cobrem 80% dos casos,
-- revisados pelo dono (65 grupos são ambíguos — primeiro nome com dois donos — e não entram sem resposta).
-- Cirurgião é profissional identificado, não titular de dado sensível: base legal = legítimo interesse.

-- 3. SUGESTÃO × O QUE O CONFERENTE MUDOU × POR QUÊ — o dado de treino que não existe hoje.
create table if not exists public.escala_cirurgica_sugestao (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  hospital      text not null,
  turno         text not null check (turno in ('matutino', 'vespertino')),
  modelo_versao text not null,               -- muda a cada ajuste de regra/peso: separa as edições no placar
  rodape        jsonb not null,              -- a ordem de saída recebida, como veio
  blocos        jsonb not null,              -- [{chave, sala, cirurgiaoId, cirurgias, fimPrevisto, sugeridoUid, segundoUid, motivo}]
  gerada_por    text not null,
  gerada_em     timestamptz not null default now()
);
create table if not exists public.escala_cirurgica_sugestao_ajuste (
  id           uuid primary key default gen_random_uuid(),
  sugestao_id  uuid not null references public.escala_cirurgica_sugestao(id) on delete cascade,
  bloco_chave  text not null,                -- sala + sequência no mapa
  sugerido_uid text,
  escolhido_uid text,
  aceito       boolean generated always as (sugerido_uid is not distinct from escolhido_uid) stored,
  -- um toque, lista fechada; 'outro' abre texto de até 120 caracteres (sem dado de paciente)
  motivo       text check (motivo in ('ordem', 'carga', 'cirurgiao_pede', 'nao_faz', 'combinado_entre_colegas',
                                      'residente', 'ja_estava_na_sala', 'outro')),
  motivo_texto text check (motivo_texto is null or char_length(motivo_texto) <= 120),
  por          text not null,
  em           timestamptz not null default now()
);
create index if not exists idx_esc_sugestao_data on public.escala_cirurgica_sugestao (data, hospital, turno);
create index if not exists idx_esc_sugestao_ajuste_sug on public.escala_cirurgica_sugestao_ajuste (sugestao_id);
-- RLS: enable + force; select só is_admin() (é dado de desempenho e de preferência de pessoa);
-- escrita só pela RPC da conferência (SECURITY DEFINER, por = firebase_uid(), nunca 'system').
-- O aceite silencioso também grava (aceito = true, motivo null): sem ele não se mede a taxa de aceitação.

-- 4. RESTRIÇÕES CONFIRMADAS PELO DONO — as respostas às perguntas do relatório viram linhas aqui,
--    e não constantes no código: mudam com férias, credenciamento, gente nova.
create table if not exists public.escala_cirurgica_restricao (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                 -- anestesista
  alvo_tipo   text not null check (alvo_tipo in ('local', 'sala', 'especialidade', 'cirurgiao', 'pediatria')),
  alvo        text not null,
  regra       text not null check (regra in ('nunca', 'evitar', 'preferir')),
  origem      text not null check (origem in ('dono', 'aprendida')),
  vale_ate    date,
  criado_por  text not null,
  criado_em   timestamptz not null default now(),
  unique (user_id, alvo_tipo, alvo)
);
-- 'aprendida' nunca vale como 'nunca' sozinha: só o dono promove exclusão a regra dura.

-- 5. docs/lgpd-retencao.md — linhas a acrescentar (prazo é decisão do dono; proposta abaixo):
--   | Captura do aprendizado da escala (`escala_cirurgica_captura`, `escala_cirurgica_sugestao*`) | 24 meses após `data` |
--     Legítimo interesse (Art. 7, IX) — medir e melhorar a escalação | Exclusão física por função `_purge()` no pg_cron,
--     semanal. Sem iniciais nem idade; identifica anestesista e cirurgião (profissionais), não paciente |
--   | Log de eventos da escala (`escala_cirurgica_evento`) | idem — pendência aberta desde 25/09 |

-- =====================================================================================
-- 3ª RODADA (09/11) — RASCUNHO, NÃO APLICAR: onde as tabelas de TEMPO passam a morar quando a
-- sugestão for para dentro do app. Hoje elas são arquivos (.local/escala-aprendizado/saida/*.json),
-- regravados pelo ciclo-semanal.mjs; isso basta enquanto a sugestão roda pela skill.
-- Tabela simples, regravada pelo script (delete + insert numa transação); nada de view materializada
-- nem cálculo no banco: o plano é FREE/Nano e a conta roda melhor fora dele.
-- =====================================================================================
create table if not exists public.escala_tempo (
  tipo        text not null check (tipo in ('duracao', 'giro', 'atraso')),
  nivel       text not null,   -- duracao: cirurgiao_procedimento | procedimento_hospital | procedimento | cirurgiao | hospital
                               -- giro: hospital | hospital_mesmo_cirurgiao | sala | cirurgiao ; atraso: hospital_turno | cirurgiao
  chave       text not null,   -- ex.: 'COLECISTECTOMIA|hro|C101' (cirurgião = id do dicionário quando ele existir)
  n           integer not null,
  mediana     numeric not null,
  p25         numeric,
  p75         numeric,
  ate         date not null,   -- último dia de dado usado
  gerado_em   timestamptz not null default now(),
  primary key (tipo, nivel, chave)
);
-- RLS: select para quem publica a escala (can_publicar_escala_cirurgica) — é o que a conferência lê;
-- escrita só service role (o script). Sem dado de paciente. Tempo por cirurgião é dado de desempenho de
-- profissional: não vai para tela nenhuma além da sugestão, e entra na mesma linha de retenção da captura.

create table if not exists public.escala_aprendizado_placar (
  semana        text primary key,            -- '2026-W45'
  ate           date not null,
  regras_versao text not null,
  erro_duracao  numeric,                     -- min, pares limpos, fora da amostra
  cobertura_cirurgiao_procedimento numeric,
  inversoes_sugestao  numeric,               -- % de pares invertidos > 30 min
  inversoes_publicado numeric,
  sem_bloco_certo     numeric,
  violacoes_duras     integer,
  aceitacao           numeric,               -- % dos blocos sugeridos que o conferente manteve (quando existir)
  gerado_em     timestamptz not null default now()
);

-- =====================================================================================
-- REVISÃO DE 10/11/2026 — RASCUNHO, NÃO APLICAR. SUBSTITUI as seções 1, 3 e 4 acima.
-- Motivo: (a) a revisão de LGPD pediu purge na MESMA migration, RLS explícita para os 4 verbos,
-- restrição SEM motivo, lista ÚNICA de indisponíveis, id do dicionário no lugar do nome do
-- cirurgião e NENHUM texto livre; (b) a pesquisa 2026-W46 listou o que coletar.
-- O que o banco JÁ tem e não precisa de nada novo: tempo do mapa bruto (caso.tempo_estimado e
-- captura 'alocacao'), hora do mapa × início real do 1º caso, giro (fim → início seguinte),
-- "quanto falta" (caso.termino_previsto + captura 'estimativa'), encaixe (captura 'alocacao'
-- com origem manual), suspensão (evento de status), exclusão de caso (evento de exclusão),
-- repasse de/para/hora (captura 'realocacao').
-- =====================================================================================

-- A. Tipos novos na captura que já existe (uma tabela só; nada em escala_cirurgica_evento)
alter table public.escala_cirurgica_captura drop constraint if exists escala_cirurgica_captura_tipo_check;
alter table public.escala_cirurgica_captura add constraint escala_cirurgica_captura_tipo_check
  check (tipo in ('estimativa', 'estimativa_total', 'alocacao', 'realocacao', 'ordem',
                  'conferencia',   -- retrato da conferência, por publicação de turno
                  'saida',         -- hora real de saída informada na liberação — APROVADO pelo dono em 10/11/2026
                  'movimento',     -- caso que mudou de sala ou de hora depois da publicação
                  'tempo_bloco')); -- tempo estimado pelo conferente para um bloco (HRO não manda no mapa)
-- 'conferencia'.detalhe = { "esperado": [uid…], "indisponiveis": [uid…], "divergencias": {faltam, sobram, foraDeOrdem} }
--    LISTA ÚNICA de indisponíveis: quem a grade previa e não trabalha. SEM motivo (férias, licença e
--    pós-plantão não se distinguem aqui — licença é dado de saúde).
-- 'saida'.valor_para = "HH:MM" informado; detalhe = { "toque": "HH:MM", "corrigido": bool }.
-- 'movimento'.valor_de/valor_para = sala (ou hora) antes → depois; detalhe = { "campo": "sala" | "hora" }.
-- 'tempo_bloco'.valor_para = minutos (texto numérico); sala = sala do bloco; detalhe = { "cirurgias": n }.
-- (EM ABERTO, dono 10/11: o motivo do repasse sai do reexame do sistema de trocas — não implementar daqui)
-- 'realocacao' ganha detalhe.motivo, lista fechada, opcional:
--    'liberar_na_ordem' | 'sala_atrasou' | 'urgencia' | 'combinado' | 'correcao_de_registro'.
-- Captura de cirurgião: quando o dicionário existir, a captura grava cirurgiao_id e deixa `cirurgiao` nulo.
alter table public.escala_cirurgica_captura add column if not exists cirurgiao_id uuid;
alter table public.escala_cirurgica_captura add column if not exists procedimento_chave text; -- família normalizada (lib), não o texto do mapa

-- B. Marca de "hora digitada depois" no próprio caso: quando o horário real foi gravado
--    (hoje só se deduz comparando com o toque; a hora do registro se perde a cada edição).
alter table public.escala_cirurgica_caso add column if not exists inicio_real_em timestamptz;
alter table public.escala_cirurgica_caso add column if not exists termino_real_em timestamptz;
-- preenchidos pelo gatilho escala_caso_horario_real junto com *_real_por; "digitado depois" =
-- *_real_em mais de 10 min depois do horário informado. Sem coluna de texto.

-- C. Sugestão × escolha do conferente × motivo (SEM texto livre; SEM nome de cirurgião)
create table if not exists public.escala_cirurgica_sugestao (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  hospital      text not null check (hospital in ('unimed', 'hro', 'materno')),
  turno         text not null check (turno in ('matutino', 'vespertino')),
  modelo_versao text not null,
  regras_versao text not null,
  exibida       boolean not null default false,   -- false = modo sombra (calculada e gravada, não mostrada)
  blocos        jsonb not null,  -- [{chave, sala, cirurgiaoId, cirurgias, fimP50, fimP80, baixaConfianca, sugeridoUid, regra}]
  gerada_por    text not null,
  gerada_em     timestamptz not null default now()
);
create table if not exists public.escala_cirurgica_sugestao_ajuste (
  id            uuid primary key default gen_random_uuid(),
  sugestao_id   uuid not null references public.escala_cirurgica_sugestao(id) on delete cascade,
  data          date not null,                    -- repetida para o purge por data
  bloco_chave   text not null,
  sugerido_uid  text,
  escolhido_uid text,
  aceito        boolean generated always as (sugerido_uid is not distinct from escolhido_uid) stored,
  motivo        text check (motivo in ('ordem', 'carga', 'cirurgiao_pede', 'nao_faz', 'combinado_entre_colegas',
                                       'residente', 'ja_estava_na_sala', 'previsao_errada', 'outro')),
  por           text not null,
  em            timestamptz not null default now()
);
create index if not exists idx_esc_sugestao_data on public.escala_cirurgica_sugestao (data, hospital, turno);
create index if not exists idx_esc_sugestao_ajuste_data on public.escala_cirurgica_sugestao_ajuste (data);

-- D. Restrições confirmadas pelo dono — SEM motivo e sem origem "aprendida" (só o dono cria)
create table if not exists public.escala_cirurgica_restricao (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  alvo_tipo   text not null check (alvo_tipo in ('local', 'sala', 'especialidade', 'cirurgiao')),
  alvo        text not null,          -- para 'cirurgiao': o id do dicionário, nunca o nome
  regra       text not null check (regra in ('nunca', 'preferir')),
  vale_ate    date,
  criado_por  text not null,
  criado_em   timestamptz not null default now(),
  unique (user_id, alvo_tipo, alvo)
);

-- E. RLS — os 4 verbos, explícitos, nas três tabelas novas
alter table public.escala_cirurgica_sugestao enable row level security;        alter table public.escala_cirurgica_sugestao force row level security;
alter table public.escala_cirurgica_sugestao_ajuste enable row level security; alter table public.escala_cirurgica_sugestao_ajuste force row level security;
alter table public.escala_cirurgica_restricao enable row level security;       alter table public.escala_cirurgica_restricao force row level security;
-- sugestão e ajuste: quem publica a escala lê e grava; ninguém edita nem apaga pelo cliente (o purge é do servidor)
create policy esc_sugestao_select on public.escala_cirurgica_sugestao for select to authenticated using ((select public.can_publicar_escala_cirurgica()));
create policy esc_sugestao_insert on public.escala_cirurgica_sugestao for insert to authenticated with check ((select public.can_publicar_escala_cirurgica()) and gerada_por = (select public.firebase_uid()));
create policy esc_sugestao_update on public.escala_cirurgica_sugestao for update to authenticated using (false) with check (false);
create policy esc_sugestao_delete on public.escala_cirurgica_sugestao for delete to authenticated using (false);
create policy esc_ajuste_select on public.escala_cirurgica_sugestao_ajuste for select to authenticated using ((select public.is_admin()));
create policy esc_ajuste_insert on public.escala_cirurgica_sugestao_ajuste for insert to authenticated with check ((select public.can_publicar_escala_cirurgica()) and por = (select public.firebase_uid()));
create policy esc_ajuste_update on public.escala_cirurgica_sugestao_ajuste for update to authenticated using (false) with check (false);
create policy esc_ajuste_delete on public.escala_cirurgica_sugestao_ajuste for delete to authenticated using (false);
-- restrição: quem publica lê (a conferência valida contra ela); só admin cria, altera e apaga
create policy esc_restricao_select on public.escala_cirurgica_restricao for select to authenticated using ((select public.can_publicar_escala_cirurgica()));
create policy esc_restricao_insert on public.escala_cirurgica_restricao for insert to authenticated with check ((select public.is_admin()) and criado_por = (select public.firebase_uid()));
create policy esc_restricao_update on public.escala_cirurgica_restricao for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy esc_restricao_delete on public.escala_cirurgica_restricao for delete to authenticated using ((select public.is_admin()));
revoke all on public.escala_cirurgica_sugestao, public.escala_cirurgica_sugestao_ajuste, public.escala_cirurgica_restricao from anon;

-- F. PURGE na mesma migration — 24 meses pela data da escala (prazo a confirmar com o dono)
create or replace function public.escala_aprendizado_purge()
returns void language sql security definer set search_path = pg_catalog, public as $$
  delete from public.escala_cirurgica_sugestao_ajuste where data < (current_date - interval '24 months');
  delete from public.escala_cirurgica_sugestao        where data < (current_date - interval '24 months');
  delete from public.escala_cirurgica_captura         where data < (current_date - interval '24 months');
  delete from public.escala_cirurgica_restricao       where vale_ate is not null and vale_ate < current_date;
$$;
revoke execute on function public.escala_aprendizado_purge() from public, anon, authenticated;
-- select cron.schedule('escala-aprendizado-purge', '37 6 * * 0', $$select public.escala_aprendizado_purge()$$);
-- docs/lgpd-retencao.md ganha a linha na MESMA entrega (captura, sugestão, ajuste: 24 meses; base: legítimo interesse).
