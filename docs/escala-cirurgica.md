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
- **CasoCard em zonas fixas (2026-07-16):** hora/paciente/idade+badges → procedimento →
  cirurgião em destaque → rodapé tempo+convênio; truncamentos com `title`.
- **Cor por convênio (2026-07-16):** `familiaConvenio`/`corConvenio` em `utils.js` normalizam
  SUS/UNIMED*/BRF/FAS/SC/PARTICULAR/INTERCAMBIO* ("Unimed Intercâmbio" cai em intercambio) →
  tokens `category-*` (fundo do card pertence ao STATUS; convênio identifica pela **borda
  esquerda** `border-l-4` + badge `-bg`/`-fg` no rodapé e no sheet). Mapa: unimed=teal,
  sus=blue, particular=purple, brf=orange, fas=indigo, sc=cyan, intercambio=pink,
  outro=neutro. Classes 100% estáticas (Tailwind JIT purga string dinâmica).
- ~~**Troca de sala entre anestesistas**~~ — **REMOVIDA DO APP em 2026-07-29** (ver Fase 2.4).
  Existiu como `trocas_cirurgicas` + RPC `aplicar_troca_cirurgica` + `TrocaSalaSheet`/
  `TrocaPendenteCard`. O fluxo propor→aceitar foi aposentado em 23/07, a substituição de
  posição entrou em 27/07 e o conjunto todo saiu em 29/07. `validarConflito` sobreviveu em
  utils (utilitário puro de sobreposição de horário). A tabela segue no banco, sem uso.
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
- **Status da cirurgia em DOIS EIXOS (2026-07-21):** PRINCIPAL `status_cirurgia`
  (exclusivo, pinta o card): agendada (neutro) → **Iniciada VERDE** → **Terminada AZUL**
  (info) — cores decididas em 20/07. EXTRA `status_extra` (badge que CONVIVE com
  agendada/iniciada; toggle; terminada limpa e bloqueia — CHECK de invariante no banco):
  **Atrasada** (warning) · **Suspensa** (destructive; conta como concluída p/ cronômetro e
  "sala encerrou") · **Passa para tarde** (category-orange; badge na linha da Liberações,
  matching por normNome — linha renovada não herda). Migrations: `20260720100000` (whitelist
  6 valores — o CHECK inline da 20260701200000 bloquearia em silêncio, pego pelo validator)
  → `20260721100000` (campo `status_extra` + data migration + RPC com branch/toggle FOR
  UPDATE + trigger de eventos nos 2 eixos; evento com status_de=status_para = toggle de
  extra, mudança em detalhe.extra_de/para). ⚠️ `statusExtra` no CAMEL_TO_SNAKE do service.
  Sheet 3×2 (extras desabilitados quando terminada); Button sem variant azul/laranja →
  className com tokens `bg-info`/`bg-category-orange`. Quando o ÚLTIMO caso
  da sala termina, o plantonista (1º do rodapé) é notificado. Republicar a escala zera statuses
  (delete+insert do rpc_salvar — aceito).
- **Adicionar caso (F1.5):** `AddCasoSheet` (urgência/encaixe/fora do mapa) → `addCaso` INSERT;
  integra como os demais (board re-agrupa, liberação re-deriva). Paciente vira INICIAIS no blur
  (CHECK LGPD do banco rejeita nome completo).
- **Log de eventos invisível (2026-07-18, Fase 0 da previsão de tempos):** tabela insert-only
  `escala_cirurgica_evento` + 2 triggers SECURITY DEFINER (migration `20260718100000`, validada
  pelo migration-validator e aplicada): transições de `status_cirurgia` (com cirurgião/
  procedimento/convênio denormalizados — sobrevive à republicação delete+insert) e marcações
  de liberação (com snapshot da `ordem_liberacao` no detalhe). Sem NENHUM dado de paciente.
  Exceção nos triggers nunca bloqueia a operação clínica (warning + segue). Base futura:
  previsão de duração por (cirurgião×procedimento), turnover por sala e sugestão de alocação
  de anestesistas respeitando a ordem de liberação (ver docs/escala-cirurgica-evolucao-tecnica.md).
- **Vínculos nome↔usuário (F1.6):** `VinculosSheet` (ícone 🔗 no header) — cada anestesista
  reivindica os PRÓPRIOS nomes de escala (self-claim; RLS garante) e secretária/admin gerencia
  todos, com "Sugerir" (primeiro nome quando único no roster; ambíguos manuais). É o que habilita
  "Minhas escalas" e as notificações. Nomes em AZUL no rodapé Unimed = anestesista de outro
  hospital ajudando naquele dia (vincular normalmente).

## Fase 2.1 — Identidade na coluna de liberação + hospital na importação (2026-07-21)

- **Bug real do piloto:** rodapé "GUILHERME DIDOMENICO" × caso "GUILHERME D." viravam 2
  linhas; a variante do caso caía na regra "fora do rodapé → fim da lista" (depois dos
  liberados) e roubava o badge "Próximo a ser liberado". **Fix:** `gerarColunaLiberacao`
  aceita `opts.resolverUid` (dicionário `escala_anestesista_alias`) e agrupa por
  `anestesista_user_id || resolverUid(nome) || norm(nome)`; rodapé com variantes
  duplicadas também colapsa. `LiberacoesView` passa o resolver de `useRosterAnestesistas`.
- **Dicionário populado (54 apelidos → 47 pessoas)** com as associações confirmadas pelo
  dono em 2026-07-21 (DIDO/GUILHERME D./GUILHERME DIDOMENICO → guilhermexavier.d@;
  MELO/GUILHERME MELO → wguime@ ⚠️ dono tem 2 contas; STAUB → guigostaub@; ALEXANDRE S. =
  Schmidt, ALEXANDRE D. = Danieli; COSTA = Marcos, GABRIEL = Gabriel Costa; GUSTAVO =
  Biesdorf, GARIM = Gustavo Garim; ROSE = Rosemary Cury, CURY = Marcos Cury).
  **Regra do dono:** primeiro nome sozinho com >1 candidato → SEMPRE perguntar, nunca
  auto-associar. Residentes não aparecem nas escalas.
- **Hospital na importação:** `ImportarEscalaPage` tem SegmentedSelector "Hospital desta
  escala" (publica no escolhido, não no da página). Edge devolve `hospitalDetectado`
  (assinaturas: HRO = planilha colorida c/ rodapé vermelho; Unimed = grade branca c/
  TEMPO/CONVÊNIO; Materno = G-HOSP "Mapa de cirurgias"); a UI SUGERE com banner "Usar X
  e reler" — nunca troca sozinha. Excel/CSV sugere Unimed (heurística local).
- **Nome com diferencial (pedido 2026-07-21):** nunca exibir só "Gustavo/Marcos/Guilherme" —
  quando o apelido é só o PRIMEIRO NOME do cadastro, a linha mostra `nomeCirurgiaoCurto`
  do perfil ("GUSTAVO" → "Gustavo Biesdorf"); apelidos já diferenciais (GARIM, MELO,
  CURY) ficam como estão. Política na view (`nomeExibicao`), passthrough puro na lib.
- **Badge Ajuda:** linha de ajuda externa (nome AZUL no rodapé) ganha badge **azul sólido
  "Ajuda"** ao lado do nome (mesmo destaque do Plantonista).
- **Limitação conhecida:** `liberacoes`/`linha_overrides` são chaveados pelo NOME exibido —
  vínculo novo que muda o display órfã a marcação do dia (aceito; candidato a chavear por
  uid na Fase 2).

## Fase 2.4 — Os 5 pedidos do dono de 2026-07-29 (tarde)

- **Residente é campo DO CASO, não da lista de anestesistas.** `useRosterAnestesistas`
  passou a devolver só `anestesiologista`; os residentes têm roster próprio
  (`useRosterResidentes`, sem dicionário de apelidos — a identidade vem sempre do uid do
  seletor). O caso ganhou `residente` + `residente_user_id` (migration `20260729200000`,
  aplicada): seletor no `CasoDetalheSheet` (que serve Completa, Minhas E o painel da linha)
  e no `AddCasoSheet`, nome no `CasoCard`, e a aba **Minhas** do residente passou a casar
  também por `residenteUserId`. Ele aparece no caso **sem virar responsável**: a coluna de
  liberação segue derivando só do anestesista. Residentes cadastrados só com o PRIMEIRO
  NOME — está correto assim (não há repetido entre eles); não completar os cadastros.
- **Troca REMOVIDA do app**, e no lugar um campo livre de **Observação** na linha
  (`linha_overrides[chave].observacao`, teto de `OBSERVACAO_MAX` = 120 caracteres). Saíram:
  o bloco "Quem está nesta posição", `substituirPosicao`/`localizarPosicao` da página, o
  badge "Troca", a nota `troca` do context, e o código morto (`TrocaSalaSheet`,
  `TrocaPendenteCard`, `supabaseTrocasCirurgicasService`, as 5 actions, o state
  `trocasPendentes`/`trocasAceitas` e o canal de realtime de `trocas_cirurgicas` — que
  custava 2 queries por carregamento para um estado que ninguém lia). **Nenhum caminho da
  aba Liberações escreve mais em `ordem_liberacao` nem troca o dono de um caso**
  (`liberacoesPainelLinha.test.jsx` trava isso). Nota `troca` de escala antiga é exibida
  como texto de observação — não some nem quebra o card. A tabela `trocas_cirurgicas` fica
  no banco (apagar dado é irreversível). Com a substituição saiu também a única leitura de
  "sou o plantonista?", então `meuUid`/`meuAlias`/`podeGerenciar` saíram das props da view.
  LGPD: é campo aberto que o grupo todo enxerga → o painel avisa que é recado operacional e
  que paciente só entra por iniciais.
- **Ajuda marcável à mão nas DUAS abas** (a escala nem sempre traz o nome em azul no
  rodapé): toggle no painel da linha (Liberações) e no detalhe do caso (Completa). Escolhido
  o detalhe do caso, e não o cabeçalho da sala, porque aquela linha de 44px a 375px já
  carrega sala + nome + ⚙ + chevron — um quarto controle trunca o nome. Fonte única:
  as duas escrevem em `ajudaExterna[turno]`, então uma reflete na outra na hora. Remover
  usa a entrada EXATA do array (casada pela chave resolvida, não pelo nome exibido), e
  adicionar entra no FIM — a ordem em que a fila libera as ajudas é a do array.
- **Tempo faltante POR CIRURGIA** (`termino_previsto` no caso, migration `20260729210000`),
  além do total da pessoa. Preenchível pelas duas abas (o `CasoDetalheSheet` é o mesmo).
  Na fila, os dois convivem com PESOS diferentes: chip cinza pequeno ao lado do cirurgião a
  que pertence (a lib devolve `linha.tokenTermino[token]`) × pílula verde sólida do total da
  pessoa, inalterada. ⚠️ **O total NUNCA é a soma dos casos**: estimativa de cirurgia que
  estoura não converge para zero (Dexter et al., *Anesth Analg*), somar as partes acumularia
  o erro justo quando a fila depende do número. `PainelTempo.jsx` virou a fonte única da UI
  de tempo (havia duas cópias divergentes). Cronômetro segue 100% manual — não reintroduzir
  estimativa automática.
- **Plantão do turno seguinte vale nos DOIS turnos.** `isProximoPlantao` deixou de exigir
  `turno === 'matutino'`; o rótulo vem da lib (`plantaoLabel`: matutino → "Plantão da
  tarde", vespertino → "Plantão da manhã"), nunca fixo na view. Sem turno informado
  (chamada legada) a regra não dispara. Não disputa com os P1–P4 da fase noturna: aqueles
  vêm do card Plantões e assumem o TOPO; o plantão do turno seguinte fica no fim da lista,
  abaixo até das ajudas.

## Deploy

1. Aplicar a migration: `node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/20260628200000_escala_cirurgica.sql`
2. Setar `ANTHROPIC_API_KEY` (dono) e fazer deploy da edge function.
3. `npm run build` + deploy hosting.
