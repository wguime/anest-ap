# Prompt — Bloco 2: Unificação da Taxonomia de Documentos (ANEST)

> Cole este prompt inteiro numa **nova aba do Claude Code** dentro do projeto ANEST.
> Ele já traz os achados verificados de uma auditoria multi-agente anterior (com `arquivo:linha`),
> então **não re-audite do zero** — valide pontualmente e parta para o desenho/implementação.

---

## Papel e objetivo

Você é responsável por reestruturar o **módulo de Documentos** do app ANEST (React 19 + Vite + Tailwind + Supabase) para que **Centro de Gestão** e **Biblioteca de Documentos** usem a **MESMA taxonomia primária de 11 categorias** e que o ciclo de vida do documento (aprovação → revisão → auditoria, arquivar-nunca-deletar) esteja completo e alcançável pela UI.

**Use um Workflow com múltiplos agentes** para otimizar. Siga o **caminho B**: primeiro MAPEIE a estrutura e PRODUZA um desenho exato (antes/depois) → **apresente ao usuário e aguarde aprovação** (`ExitPlanMode`/`AskUserQuestion`) → só então implemente, com checkpoints de build entre blocos.

Leia primeiro o `CLAUDE.md` e as regras em `.claude/rules/*` (design-tokens, responsividade, supabase-firebase, audit-trail, padroes-codigo). Siga `docs/wave-execution-playbook.md`.

---

## Decisões JÁ TOMADAS pelo usuário (não re-perguntar)

1. **Taxonomia:** o Centro de Gestão deve navegar pelas **MESMAS 11 categorias** da Biblioteca (Seção `00 Modelos … 10 Obsoletos` → Subseção/tipo). As 9 categorias "Qmentum" (`etica/comites/auditorias/relatorios/biblioteca/financeiro/medicamentos/infeccoes/desastres`) deixam de ser o eixo de navegação e viram **metadado secundário** (campo `categoria`, opcional).
2. **Ciclo de Revisão:** **por status** — adicionar UI "Enviar para revisão" (`ativo → revisao_pendente → pendente → ativo`). Ativar o status órfão `REVISAO_PENDENTE`.
3. **Delete:** **remover do app** — "nunca deletar, só arquivar". Reescrever os fluxos que chamam `deleteDocument` (soft-delete que esconde) para **arquivar** (vai p/ `10 Obsoletos`, continua visível). Hard delete já é bloqueado por trigger no banco.
4. **Auditoria:** o histórico (`documento_changelog`) **já foi limpo** (clean slate). Toda mutation deve continuar gerando changelog com `changedBy` real.

**Estado atual dos dados:** todos os documentos foram **zerados (clean slate)** — o usuário vai recadastrar manualmente pela UI. Portanto o foco é o **fluxo correto**, não migração de dados.

---

## Modelo de dados (o ponto-chave da confusão)

Cada linha em `documentos` tem TRÊS campos de taxonomia que coexistem:

| Campo no schema | No formulário "Novo Documento" | Vocabulário | Onde é usado hoje |
|---|---|---|---|
| `subcategoria` | **"Seção"** (obrigatório) | as **11**: `modelos, governanca, institucional, assistencial, gestao_pessoas, residencia, financeiro, qualidade, tecnologia_mat, relatorios_gerais, obsoletos` (`SUBCATEGORIA_CONFIG`, `src/types/documents.js:466-478`) | **eixo da Biblioteca** |
| `tipo` | **"Subseção"** (obrigatório) | depende da seção (`CATEGORY_SUBSECTIONS`), ex. "Modelo de Política" | sub-accordions da Biblioteca |
| `categoria` | **"Classificação"** (opcional, default `'biblioteca'`) | as **9 Qmentum** (`DOCUMENT_CATEGORIES`, `src/types/documents.js:7-17`) | **eixo do Centro** |

> O objetivo do usuário ("inserir numa das 11: 00 Modelos … 10 Obsoletos") mapeia para **`subcategoria`** — que **já é obrigatória** no cadastro. O que falta é o **Centro navegar por esse eixo** (hoje navega por `categoria`/9).

---

## Achados verificados (auditoria adversarial anterior — confirme por amostragem, não refaça inteiro)

### Estrutura atual do Centro
- `src/pages/management/documents/DocumentsLayout.jsx:15-79` — `DOC_CATEGORIES` = as **9 Qmentum**, com **cores hex hardcoded** (viola regra design-tokens). Há um seletor `_handleCategoryChange` (linha ~358) **não usado** e `DOC_CATEGORIES` **não é renderizado como pills** no JSX — a categoria ativa vem de fora.
- `src/pages/management/documents/DocumentsLayout.jsx:85-142` — `SUB_TABS_CONFIG` por categoria (Documentos/Categorias/Arquivados/Stats; Auditorias tem Revisões/Relatórios). `:148-152` — `CROSS_TABS` (Aprovações/Revisões/Auditoria).
- `src/pages/management/CentroGestaoPage.jsx:417` — `activeDocCategory` default `'etica'`. `:1296-1308` — `sectionComponents` mapeia as 9 categoria→Section (EticaSection, ComitesSection, …). `:1318-1319` — `SectionComponent = sectionComponents[activeDocCategory]`, `docsForCategory = documentsByCategory[activeDocCategory]`. `:1311-1315` — `crossTabComponents` (ApprovalQueue/ReviewCalendar/AuditTrailPage).
- `src/pages/management/documents/sectionConfig.js:24-171` — `SECTION_CONFIG` com 9 entradas (label/ícone/cores por categoria Qmentum).
- **Investigar:** o que são exatamente `EticaSection`/`ComitesSection`/… (provável: wrappers finos de `DocumentSection` com `categoryId` fixo) e **como `activeDocCategory` é trocado** (hub/cards/quick-switch no `ManagementLayout`?). Isso define o tamanho do refactor.

### Biblioteca (referência de como navegar por 11)
- `src/pages/BibliotecaPage.jsx:31-39` — `CATEGORIA_CONFIG` derivado de `SUBCATEGORIA_CONFIG` (11) + catch-all `outros` (`99 Outros`). `:201-207` — `Object.values(documents).flat()` (achata todas as categorias). `:284` — agrupa por `doc.subcategoria`. `SubsectionsView` `:605-701` — sub-accordions por `doc.tipo`. `:213-216/276` — `obsoletos` lê só arquivados.

### Fonte/integração (JÁ OK — não quebrar)
- Ambas as telas leem do **mesmo** `DocumentsContext` (Biblioteca via `useDocumentsContext()`; Centro via `useDocuments()` que é wrapper — `src/hooks/useDocuments.js:13,17`). `fetchAllDocuments` (`src/services/supabaseDocumentService.js:237-296`) agrupa por **categoria** (9 baldes) e filtra `.is('deleted_at', null)`. Realtime via `createReliableSubscription` (`DocumentsContext.jsx`) com tratamento de INSERT/UPDATE/DELETE, soft-delete e **mudança de categoria** (helper `findDocCategory`, já corrigido).
- ⚠️ Consequência do refactor: se o Centro passar a agrupar por `subcategoria`, decidir se o **agrupamento do contexto** continua por `categoria` (e o Centro achata+reagrupa como a Biblioteca) **ou** se cria um seletor de eixo. **Recomendado:** manter o contexto como está (chave por `categoria`) e o Centro fazer `Object.values(documents).flat()` + reagrupar por `subcategoria`, igual à Biblioteca — minimiza risco e reusa código.

### Workflows (aprovação/revisão/auditoria)
- **Aprovação:** a fila `ApprovalQueue` funciona (aprovar/rejeitar via `changeStatus`, bloqueio de auto-aprovação). **MAS** rascunho não tem UI para ir a `pendente` (só o checkbox na criação). `submitForApproval` existe (`src/hooks/useDocumentActions.js:271`) mas é **dead code** (sem consumidor). → **adicionar ação "Enviar para aprovação"** (status `rascunho`) no menu do card/detalhe.
- **Revisão:** `REVISAO_PENDENTE` (`'revisao_pendente'`) tem label/cor/transições (`src/types/documents.js:55,97,99`) e consumidores de leitura (`DocumentSection.jsx`, `FilterBar.jsx`), mas **nenhum produtor**. "Marcar como revisado" = `addVersion` (não muda status) (`src/pages/management/documents/ReviewCalendar.jsx:320-329`). → **adicionar "Enviar para revisão"** (`ativo→revisao_pendente` via `changeStatus`) + retorno `revisao_pendente→pendente`.
- **Auditoria:** toda mutation loga em `documento_changelog` via `rpc_log_document_action`; `AuditTrailViewer` lê dela. Aprovação aparece como "Status alterado" (não "Aprovado/Rejeitado") — opcional emitir action `approved`/`rejected` em `changeStatus` (`supabaseDocumentService.js:641`).
- `rejeitado→rascunho` (revisar/reenviar) existe em `VALID_TRANSITIONS` mas sem UI — adicionar ação opcional.

### Delete → arquivar (consumidores reais — NÃO quebrar)
- `deleteDocument` faz **soft-delete que esconde** (`src/services/supabaseDocumentService.js:778`; contexto `src/contexts/DocumentsContext.jsx:465,730,744`).
- Consumidores que chamam o **service direto** (precisam virar arquivar): `src/hooks/useRelatoriosDocumentos.js:197`, `src/hooks/useEticaDocumentos.js:143`, e `src/pages/etica/ParecerUtiPage.jsx` (via `useEticaDocumentos`). Há também `src/hooks/useDocumentActions.js:111,326`.
- **Plano:** trocar cada chamada de delete por **`archiveDocument`** (com `archiveSubsection` obrigatório → `subcategoria='obsoletos'`); remover `deleteDocument` do `value` do contexto e do `useDocumentActions`. Manter `restoreFromTrash` no service (sem UI) só por segurança. **Não** mexer no trigger `prevent_doc_hard_delete`.
- `ArchiveDocumentModal` **já força** `archiveSubsection` (`src/pages/DocumentoDetalhePage/modals/ArchiveDocumentModal.jsx:19-23`).

### Endurecimentos opcionais
- `NewDocumentModal` "Subseção"/`tipo` permite texto livre via `__custom__` — opcional validar contra allowlist por seção.
- `RelatorioDetalhePage.jsx:744-745` usa `createdBy: 'admin@anest.com.br'` hardcoded — viola regra audit-trail (usar user real).

---

## Escopo do Bloco 2 (entregáveis)

1. **SSOT de taxonomia + unificar Centro nas 11:** Centro passa a navegar por **Seção (11) → Subseção (tipo)**, igual à Biblioteca. Remover `DOC_CATEGORIES` hardcoded (e o hex) de `DocumentsLayout`; derivar tudo de `SUBCATEGORIA_CONFIG`/um SSOT único. Manter as sub-abas (Documentos/Categorias/Arquivados/Aprovações/Revisões/Auditoria/Stats) operando sobre o eixo das 11. Qmentum (`categoria`) continua gravado como metadado, mas sai da navegação.
2. **Delete → arquivar:** reescrever os 3 fluxos (etica/relatorios) para arquivar; remover `deleteDocument` da UI/contexto.
3. **Ciclo de aprovação/revisão completo:** ações "Enviar para aprovação" (rascunho→pendente) e "Enviar para revisão" (ativo→revisao_pendente→pendente) no card/detalhe; (opcional) "Revisar/Reenviar" (rejeitado→rascunho).
4. **Integração garantida:** as duas telas refletindo o mesmo dado e a mesma taxonomia, em realtime (não regredir o sync já corrigido).

---

## Como conduzir (workflow multi-agente + caminho B)

**Fase 1 — MAPEAR (Workflow, agentes em paralelo, read-only):**
- Agente A: estrutura dos `*Section` (EticaSection…) e como `activeDocCategory` é trocado (ManagementLayout/hub/quick-switch) — produzir o "antes" da navegação do Centro com `arquivo:linha`.
- Agente B: desenhar o "depois" — como o Centro renderiza navegação por 11 (reusando padrão da Biblioteca) mantendo as sub-abas e cross-tabs; impacto em `DocumentsLayout`, `sectionConfig`, `CentroGestaoPage`, `DocumentSection`.
- Agente C: mapear todos os call-sites de `deleteDocument` e desenhar a troca por arquivar sem quebrar etica/relatorios.
- Agente D: desenhar as ações de aprovação/revisão no `DocumentCard`/detalhe (props, handlers, transições válidas).
- Fase de verificação adversarial + síntese num **plano com antes/depois e lista de arquivos**.

**Fase 2 — APRESENTAR e APROVAR:** consolidar num desenho claro (diagrama de navegação antes/depois + lista de arquivos a editar + riscos) e chamar `ExitPlanMode`/`AskUserQuestion`. **Não editar antes do OK.**

**Fase 3 — IMPLEMENTAR:** em blocos lógicos com **build verde a cada bloco** (`npm run build` + `npm run dev`), commits granulares, validação em Playwright (mobile 375px + desktop, dual theme), e deploy só ao final (sequência do `CLAUDE.md`: build → commit → push → `firebase deploy --only hosting:anest-ap`). Testes (`npx vitest run src/pages/management/documents src/contexts`) verdes.

---

## Restrições (CLAUDE.md / regras)
- **Design tokens:** zero hex cru — usar tokens semânticos / `category-*` (a regra design-tokens). O `DOC_CATEGORIES` atual viola isso (cores hex).
- **Nunca hard delete** (trigger de compliance); changelog é **WORM**.
- **Audit trail:** `changedBy` sempre o user real (`requireUserId`), nunca `'admin'`/`'system'`.
- **Mobile-first**, touch ≥44px, dual theme.
- **Não** renderizar BottomNav próprio em página nova; Modal DS via props `title/description/footer`.
- Migration (se precisar) validar com `migration-validator` e aplicar via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>`.

## Critérios de verificação (antes de declarar pronto)
- [ ] `npm run build` e `npm run dev` sem erro; `vitest` de documentos/contexto verde; lint sem novos erros.
- [ ] Centro e Biblioteca mostram as MESMAS 11 categorias e os MESMOS documentos.
- [ ] Criar doc na Seção X / Subseção Y → aparece nas duas telas em X→Y, em realtime, sem reload.
- [ ] "Excluir" não existe; só "Arquivar" → vai para 10 Obsoletos e continua visível. Hard delete bloqueado.
- [ ] Rascunho → "Enviar para aprovação" → fila; aprovar/rejeitar funciona; "Enviar para revisão" → revisao_pendente.
- [ ] Cada ação registra no `documento_changelog` com user real.
- [ ] Playwright: mobile (375px) + desktop, light + dark.
