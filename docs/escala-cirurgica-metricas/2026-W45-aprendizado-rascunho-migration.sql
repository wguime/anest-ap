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
