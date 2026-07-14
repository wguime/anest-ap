# Escala Cirúrgica Diária + Painel de Liberação

Board do dia por hospital (Unimed / HRO / Materno) com os casos cirúrgicos por sala,
"onde estou escalado" e o painel de liberação ordenado, em tempo real. Substitui o
gerenciamento via WhatsApp do turno (publicação ~12h, trocas/atrasos até ~13h).

> **Fase 1 (MVP).** Próximas fases (roteiro no plano): trocas in-app, acompanhamento
> colaborativo anônimo do andamento das cirurgias, urgência/emergência com contador de salas.

## Arquitetura

| Camada | Arquivo |
|---|---|
| Migration (2 tabelas + RLS + realtime) | `supabase/migrations/20260628200000_escala_cirurgica.sql` |
| Lib pura das 18 regras de liberação | `src/lib/colunaLiberacao.js` (+ testes `src/__tests__/lib/colunaLiberacao.test.js`) |
| Service Supabase | `src/services/supabaseEscalaCirurgicaService.js` |
| Context (split State/Actions + realtime) | `src/contexts/EscalaCirurgicaContext.jsx` |
| Página + 3 abas | `src/pages/escala-cirurgica/EscalaCirurgicaPage.jsx` |
| Views | `MinhasEscalasView` · `BoardView` · `LiberacoesView` · `ImportarEscalaPage` |
| Helpers de apresentação | `src/pages/escala-cirurgica/utils.js` |
| Edge Function (Claude Vision) | `supabase/functions/parse-escala-cirurgica/index.ts` |

## Modelo de dados

- **`escala_cirurgica`** (1 por `data`×`hospital`): `status` (rascunho/publicada), `ordem_liberacao`
  (jsonb — rodapé na ordem, editável), `liberacoes` (jsonb — marcações do plantonista), audit
  (`published_by`, `created_by`).
- **`escala_cirurgica_caso`** (1 por cirurgia): `sala`, `ordem`, `hora`, `paciente_iniciais`,
  `procedimento`, `cirurgiao`, `anestesista` (pode ser `//`), `bloco`, `is_continuacao`,
  `sem_anestesista`, `tipo` (eletiva/urgencia/emergencia).

## RLS / LGPD

- **Leitura e escrita** gatadas por `can_write_escala_cirurgica()` = papel clínico
  (`anestesiologista`/`medico-residente`) **OU** `is_admin()`. Papéis não-clínicos não acessam
  (mesmo fechamento do módulo cateter — `paciente_iniciais`+`procedimento`+`cirurgiao` podem
  reidentificar em hospital pequeno).
- **Paciente apenas por iniciais** em toda a cadeia (banco, Vision, UI). O prompt da Edge Function
  instrui a extrair só iniciais — nome completo de paciente não sai da imagem.
- **Base legal LGPD:** tratamento de dado de saúde para execução do contrato assistencial /
  legítimo interesse na coordenação do plantão; minimização por iniciais; acesso restrito a
  clínicos. A imagem é enviada ao provedor de visão (Anthropic) apenas para extração — confirmar
  postura de no-training do provedor e registrar no inventário de operações de tratamento.

## Importação (Claude Vision + conferência)

1. Upload do print → `FileUpload` → base64.
2. Edge Function `parse-escala-cirurgica` chama Claude Vision (prompt por formato de hospital) e
   devolve `{ casos, ordemLiberacao }` (paciente só iniciais).
3. Tela de conferência editável (corrigir sala/hora/cirurgião/anestesista/bloco) → **Publicar**.
4. Falha na extração → preenchimento manual (fallback).

Secret: `ANTHROPIC_API_KEY` (tarefa do dono — `firebase functions:secrets:set` ou Supabase secrets).
Deploy da edge: `bash scripts/deploy-edge-with-pat.sh parse-escala-cirurgica` (`--no-verify-jwt`
apenas se o app enviar JWT custom).

## Painel de liberação (18 regras)

`gerarColunaLiberacao(casos, ordemRodape, { hospital })` aplica as 18 regras da skill como
transformação determinística: propagação `//` por sala, nome curto do cirurgião (1º nome + inicial),
blocos especiais entre parênteses, SRPA/Continuação/Imagem, blocos inferiores invertidos, casos `?`
ao final, dedup, ordem do rodapé. Saída pronta para o plantonista marcar liberado e reordenar.

## Fase 1.5 — Ferramenta da secretária + identidade robusta

**Por que:** o export do hospital **não traz o anestesista** — a secretária o insere ao confeccionar
a escala. Casar por primeiro nome (anti-padrão; QGenda usa "External Call System ID", record-linkage
recomenda id estável + dicionário de apelidos) quebra com apelidos (`GARIM`, `STAUB`, `PED EDUARDO`).

**Fontes por hospital (a base vem SEM anestesista):**
- **Unimed** → upload de **Excel** (`src/lib/excelEscala.js`, SheetJS; detecta cabeçalho + casa colunas;
  paciente já vira iniciais). Ajustar `HEADER_ALIASES` ao export real da Unimed quando chegar.
- **HRO/Materno** → **imagem (Vision)** (`parse-escala-cirurgica`, agora com `sanitizeCasos` validando
  enums `bloco`/`tipo` p/ não violar o CHECK no insert).
- **Manual** → fallback universal.

**Identidade (resolve na atribuição):** a secretária **seleciona o anestesista de cada sala do roster
(login)** — não digita o apelido. Cada caso grava `anestesista_user_id` (login estável) + `anestesista`
(apelido, p/ exibição). Dicionário `escala_anestesista_alias` (apelido→login) **aprende uma vez**: ao
atribuir uma sala cujo apelido importado ainda não existe, o vínculo é salvo e reusado nas próximas
escalas. Hook `src/hooks/useRosterAnestesistas.js` (roster ativo + apelidos + resolver). Service
`src/services/supabaseEscalaAnestesistaService.js`.

**Consumo por uid:** `MinhasEscalasView`/`BoardView` casam por `anestesista_user_id === user.uid`
(cai p/ apelido só no demo/legado). Notificações (escalado/liberado) disparam por `uid` — fim do
falso-positivo/homônimo.

**RLS/papel:** `can_write_escala_cirurgica()` agora inclui `secretaria` (confecciona a escala). Tabela de
alias com RLS: coordenador/secretária/admin escrevem qualquer um; anestesista escreve o próprio (self-claim).

**Pendências da Fase 1.5:** self-claim do apelido no `ProfilePage` (adiado — o arquivo está em edição pelo
dono); calibrar `HEADER_ALIASES` com 1 Excel real da Unimed.

## Fase 2 — Troca de sala + hardenings + UX

- **Aba "Completa"** (ex-"Board"): cards com **idade + tempo cirúrgico** quando houver.
- **Troca de sala entre anestesistas:** tabela `trocas_cirurgicas` + RPC `aplicar_troca_cirurgica`
  (swap atômico dos casos das 2 salas). Fluxo propor→aceitar/recusar na aba Completa
  (`TrocaSalaSheet` + `TrocaPendenteCard`); coordenador (secretária/admin) aplica direto.
  Notifica os dois logins. As **liberações re-derivam sozinhas** (a coluna vem dos casos).
  Serviço `supabaseTrocasCirurgicasService.js`; validação `validarConflito` em utils.
- **Liberações:** anestesista sem cirurgião mostra **o local do bloco** (Consultório/SRPA/Exames/
  Hemodinâmica…) em vez de "…". O **plantonista ajusta a linha** de um anestesista (local e/ou
  cirurgião, sem troca de sala): override estruturado `{ local?, cirurgioes?, por, em }` em
  `linha_overrides` jsonb, gravado por chave via RPC `rpc_escala_patch_liberacao` (merge
  `jsonb_set` server-side — dois plantonistas simultâneos não se sobrescrevem; o mesmo vale
  para marcar liberado). Context: `setLinhaOverride`/`setLocalAnestesista`.
- **Save transacional:** `salvarEscala` usa o RPC `rpc_salvar_escala_cirurgica` (header+casos numa
  transação — sem escala vazia se o insert falhar, sem flash "Sem escala" no realtime).
- **Detecção de conflito:** `detectarConflitos(casos)` avisa (banner âmbar, não bloqueia) quando o
  mesmo login está em 2 salas com horário sobreposto (< 90 min).
- **Status da cirurgia (F1.5):** `status_cirurgia` por caso (agendada → **Iniciada** vermelho →
  **Terminada** verde) via RPC `rpc_escala_status_cirurgia` (audit `status_atualizado_por/em`
  carimbado server-side); controle no sheet de detalhe, badge+borda no card. Quando o ÚLTIMO caso
  da sala termina, o plantonista (1º do rodapé) é notificado. Republicar a escala zera statuses
  (delete+insert do rpc_salvar — aceito).
- **Adicionar caso (F1.5):** `AddCasoSheet` (urgência/encaixe/fora do mapa) → `addCaso` INSERT;
  integra como os demais (board re-agrupa, liberação re-deriva). Paciente vira INICIAIS no blur
  (CHECK LGPD do banco rejeita nome completo).
- **Troca sem uid pré-atribuído (F1.5):** escala publicada sem logins ainda permite troca — a
  `TrocaSalaSheet` resolve o uid pelo dicionário de apelidos e faz **backfill** nos casos antes
  de propor (a RPC casa por `anestesista_user_id`). Apelido não vinculado → erro orientando a
  atribuição no importador.
- **Vínculos nome↔usuário (F1.6):** `VinculosSheet` (ícone 🔗 no header) — cada anestesista
  reivindica os PRÓPRIOS nomes de escala (self-claim; RLS garante) e secretária/admin gerencia
  todos, com "Sugerir" (primeiro nome quando único no roster; ambíguos manuais). É o que habilita
  "Minhas escalas", trocas e notificações. Nomes em AZUL no rodapé Unimed = anestesista de outro
  hospital ajudando naquele dia (vincular normalmente).

## Deploy

1. Aplicar a migration: `node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/20260628200000_escala_cirurgica.sql`
2. Setar `ANTHROPIC_API_KEY` (dono) e fazer deploy da edge function.
3. `npm run build` + deploy hosting.
