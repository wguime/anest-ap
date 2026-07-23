# Cirurgias Particulares — cobrança de honorários

> Card na aba **Menu** → módulo CRUD Supabase + relatório por período (tela + PDF).
> Em produção desde 2026-07-22. Decisões do dono: grupo todo vê tudo; nome
> completo do paciente; valor + status de pagamento; relatório tela + PDF.

## O que faz
Anestesiologistas do grupo registram cirurgias particulares (fora de convênio)
para controlar a cobrança dos honorários e conferir/auditar pagamentos por
período: paciente (nome completo), cirurgião, anestesista, data, procedimento,
local, **valor (R$)** e **status de pagamento** (pendente/pago/glosado, com
`data_pagamento` auto ao marcar pago). Lançamento errado nunca é apagado —
**soft-cancel** (`cancelada_em/por/motivo`), sem policy DELETE.

## Arquitetura
| Camada | Arquivo |
|---|---|
| Migration | `supabase/migrations/20260722100000_cirurgias_particulares.sql` (aplicada 2026-07-22) |
| Service | `src/services/supabaseCirurgiasParticularesService.js` (CAMEL_TO_SNAKE completo; `toLocalISODate` p/ DATE) |
| Context | `src/contexts/CirurgiasParticularesContext.jsx` (useReducer + realtime + `requireUserId`; provider ON-DEMAND nos 2 cases do App.jsx — dados financeiros não carregam p/ quem não usa) |
| Lib pura | `src/lib/cirurgiasParticulares.js` + testes `src/__tests__/lib/cirurgiasParticulares.test.js` (21) |
| Páginas | `src/pages/cirurgias-particulares/` — listagem (= relatório em tela) + form criar/editar |
| PDF | `src/services/pdf/templates/cirurgiasParticularesReportTemplate.js` (registry `cirurgiasParticularesReport`) |
| Card/nav | `MenuPage` (`canAccessCard('cirurgias_particulares')`) · `NAV_STRUCTURE.menu.cards` · `PAGE_TO_CARD` (2 páginas → mesmo card) |

**RLS**: `can_write_cirurgias_particulares()` = role `anestesiologista`/`secretaria` OU admin —
mesmo predicado p/ SELECT/INSERT/UPDATE (grupo todo vê tudo). Residente fora
(não fatura particular; incluir depois = 1 linha no helper). `FORCE ROW LEVEL
SECURITY` + `REVOKE DELETE` (defesa em profundidade). Realtime na publication.

## Integração com a Escala Cirúrgica — AUTO-IMPORT (sem botão)
Pedido do dono 2026-07-22: publicar a escala importa os particulares SOZINHO.

- **Trigger no banco** `fn_sync_cirurgia_particular` (migration
  `20260722200000`, aplicada): AFTER INSERT/UPDATE em `escala_cirurgica_caso`.
  **REGRA DO DONO (2026-07-22, definitiva):** só importa se (1) convênio
  PURAMENTE particular E (2) paciente IDENTIFICADO na linha. Convênio
  COMPOSTO ("PART/SC" — sem como definir qual paciente é particular) e
  linhas de LOTE sem paciente ("04 FACECTOMIA (04 PCTES)") NUNCA geram
  lançamento (migration `20260722600000`: regex `^PART(ICULAR)?[^A-Z]*$` +
  guard de iniciais no trigger; rascunho pristine do lote PART/SC foi
  auto-cancelado). Caso PARTICULAR (`fn_convenio_particular` ≡ `familiaConvenio` — desde a
  migration `20260722500000` reconhece **PART como palavra**: 'Part',
  'PART/SC', 'Part.'; a escala do HRO abrevia — bug real 22/07: 4 casos sem
  lançamento até o fix trigger+re-backfill; regex espelhada em 4 LUGARES:
  SQL, familiaConvenio, edge parse-escala e excelEscala — mudar um = mudar os 4)
  de escala **publicada** vira rascunho automático em `cirurgias_particulares`
  (paciente = iniciais ou `?`, valor = 0, `created_by_name` = quem publicou ou
  "Importação automática"). Cobre: publicar, republicar, **adicionar caso**,
  **des-suspender** e convênio editado p/ particular. NUNCA bloqueia a operação
  clínica (exception → WARNING, padrão escala_cirurgica_evento). ⚠️ Se um dia
  existir "publicar" que só flipa o status do header SEM reinserir casos, o
  trigger não dispara (vive na tabela de casos).
- **Rascunho na listagem**: badge sólido âmbar **"Completar dados"**
  (`precisaCompletar` = `pareceIniciais(paciente) || valor <= 0`); quick action
  "marcar pago" fica oculta até completar; form bloqueia save enquanto o nome
  for iniciais. Toast na publicação: "N casos particulares → cobrança".
- **Adicionar caso particular** (AddCasoSheet da escala): após salvar, dialog
  "Preencher cobrança agora?" → navega p/ o form com `params.escalaCasoId`
  (o form resolve o rascunho pelo vínculo quando o context carrega; se o
  trigger falhou, nasce em branco já vinculado — o índice único evita dupla).
- **Vínculo fraco**: `escala_caso_id UUID` SEM FK (republicação da escala faz
  DELETE+reinsert dos casos — ids instáveis). Na republicação o trigger
  **re-vincula** o lançamento órfão equivalente (mesma data+local+cirurgião+
  procedimento) em vez de duplicar; se o lançamento foi editado além disso,
  pode nascer rascunho duplicado — visível (R$ 0, badge) e cancelável. Índice
  único parcial impede 2 lançamentos ATIVOS do mesmo caso (cancelado libera).
- **Suspensa (2 momentos)**: caso suspenso não importa (trigger pula; reverter
  o toggle importa na hora). DEPOIS do lançamento, a listagem faz batch-check
  (`fetchCasosStatus(ids)` no service da escala) e mostra alerta âmbar
  "Suspensa na escala — conferir" com ação de cancelar o lançamento. Caso não
  encontrado (escala republicada) = sem alerta. Suspenso marcado terminada
  (RPC limpa o extra) → importa — terminada = aconteceu = faturável.
- ⚠️ **Seeds do piloto**: escala seed publicada com caso particular gera
  rascunho de teste — a limpeza da liberação ao grupo deve incluir
  `cirurgias_particulares` (junto do apagar seeds).
- **Backfill** (`20260722300000`, aplicada): casos particulares de escalas
  publicadas ANTES do trigger viram rascunho retroativamente (idempotente;
  marcador `created_by_name='Backfill auto-import'`). Em 2026-07-22 inseriu 0
  linhas — as escalas 20–22/07 tinham sido removidas do banco entre o dry-run
  (1 candidata) e o apply; só restou 16/07, sem convênio Particular.

## Nome COMPLETO do paciente no rascunho (2026-07-22, 2ª rodada)
A escala só guarda INICIAIS (CHECK no banco) — mas a IMAGEM/Excel que a
secretária importa TEM o nome completo. Pipeline:
1. **Edge `parse-escala-cirurgica`**: Vision devolve `pacienteNome` (nome
   completo) **APENAS p/ casos com convênio PARTICULAR** (prompt + defesa em
   profundidade no `sanitizeCasos` — não-particular sempre `''`). Nunca entra
   na escala (`CASO_FIELDS` filtra + CHECK rejeita). Redeployada com
   `verify_jwt=false` preservado.
2. **Excel** (`src/lib/excelEscala.js`): mesma regra — `pacienteNome` só se o
   convênio da linha começa com PARTICULAR.
3. **Publicação** (`ImportarEscalaPage`): após `salvarEscala`, casa payload ↔
   casos salvos por `sala|ordem` (RPC devolve ordenado; ordem efetiva replica
   `{ ordem: i, ...c }` do service) e chama
   `cirurgiasSvc.completarPacienteDoCaso(casoId, nome)` — atualiza o rascunho
   **só se o paciente atual ainda parecer iniciais** (não sobrescreve correção
   manual). Fire-and-forget: falha deixa iniciais + badge.
4. **AddCasoSheet**: guarda o último nome de verdade digitado (antes do blur
   converter p/ iniciais) e completa o rascunho após adicionar caso particular.
Resultado: rascunho nasce com nome completo quando a fonte tinha o nome; falta
só o valor (badge "Completar dados" cobre o resto).

## CPF + valor opcional + exportações (2026-07-22, 3ª rodada)
- **CPF do paciente**: coluna `paciente_cpf` (migration `20260722400000`, aplicada;
  só dígitos, CHECK 11; nullable — rascunhos do auto-import nascem sem CPF).
  **Obrigatório no form** com validação de dígito verificador (`validarCPF` na
  lib + máscara `formatarCPF`); `precisaCompletar` = nome em iniciais OU sem
  CPF (valor saiu do critério). CPF aparece no card, no PDF (coluna própria)
  e no Excel. LGPD: identificação do pagador p/ cobrança/recibo (art. 7º V/VI).
- **Valor é OPCIONAL** (decisão do dono): vazio entra como R$ 0 — a guia pode
  ser precificada depois; texto inválido continua bloqueando.
- **CTA fora do header**: botão full-width "Nova cirurgia particular" no topo
  do corpo; header fica só com a lupa.
- **Exportações**: botão ÚNICO "Exportar" (DropdownMenu: PDF / Excel / PDF+Excel) —
  **Excel** (`import('xlsx')` dinâmico → abas "Cirurgias" c/ CPF/valores
  numéricos + linha TOTAL e "Resumo" por status/anestesista; nome do arquivo
  carrega o período; aviso CONFIDENCIAL na 1ª linha). Período = filtros De/Até
  (a lista é reativa).
- **Primeiro uso real em prod (2026-07-22 ~15h)**: dono publicou a escala
  Unimed com 2 particulares → auto-import criou os 2 lançamentos com NOME
  COMPLETO via Vision (pipeline pacienteNome validado em produção).

## Local (select do form)
`LOCAIS_BASE` (Unimed, HRO, Materno-infantil, Hospital de Olhos, IOSC, Centro
de Coluna, Accurata, Digimax, Umanitá, Consultório) ∪ locais já usados em
lançamentos (digitados via "Outro...") ∪ valor atual do registro — Select
`searchable`. A lista cresce com o uso; sem consulta extra ao banco.

## LGPD
Nome do paciente + procedimento = **dado de saúde sensível (art. 5º II)**.
Base legal primária: **art. 11, II, "d"** (exercício regular de direitos em
contrato — conferir cobrança contra guia/recibo exige o nome); suporte art. 7º
V/VI. Documentada no header da migration. Nunca logar dados do paciente em
console/notificação (só `error.message`). PDF leva tarja "CONFIDENCIAL — USO
INTERNO" + "Gerado por {nome} em {data/hora}" (accountability — o arquivo sai
do perímetro RLS ao ser compartilhado).

### Pendências registradas na revisão LGPD (2026-07-22, não-bloqueantes)
1. **Retenção (F2)**: prazo não definido — registro financeiro pede guarda
   ~5 anos (prescrição de cobrança, CC art. 206 §5º I). Follow-up: seed em
   `retention_policies` + `retention_until` + job que anonimiza só `paciente`
   após o prazo (padrão dos incidentes, art. 16 I).
2. **RIPD (F4)**: adicionar o módulo ao registro de operações (precedente
   `docs/lgpd-ripd-incidentes.md`), cobrindo: base legal, retenção pendente,
   fluxo manual de direitos do paciente terceiro (eliminação = anonimização
   pós-prazo) e a decisão consciente do dono de que **o grupo todo (incl.
   secretaria) vê o faturamento individual por colega** (F7).
3. Helpers `can_write_*` (cateter/escala/este) não exigem `p.active = true` —
   se endurecer, endurecer os três juntos (hardening separado).

## Verificado em 2026-07-22
- 24/24 testes da lib (45 c/ drift de navegação); lint 0 erros; build + dev OK.
- migration-validator aprovou as DUAS migrations (tabela + trigger).
- Smoke Playwright mobile 375px (user e2e anestesiologista, prod DB): card no
  Menu → listagem → form → criar (INSERT via RLS) → totais → marcar pago →
  cancelar lançamento (some da lista). Zero erros de console.
- PDF real gerado pelo botão: tarja, stat boxes, tabela paginável com linha
  TOTAL, resumo por anestesista, somas conferidas. Registros de teste apagados.
- Trigger auto-import validado com escala sintética (2020-01-01/materno) em
  prod: particular → rascunho ✓; suspensa não importa ✓; des-suspender importa
  na hora ✓; Unimed ignorado ✓; republicação re-vincula sem duplicar ✓.
  Dados sintéticos 100% removidos.
