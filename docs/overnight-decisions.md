# Overnight — Decisões Autônomas (2026-05-28 → 29)

Sessão autônoma de conclusão do Design System. Sem humano disponível — defaults
conservadores alinhados às DNA Rules, tudo registrado aqui.

## Convenções desta sessão
- **Sem `firebase deploy`** (tarefa do usuário). Só `npm run build` + `git push`.
- **Sem `AskUserQuestion`** — default conservador + registro aqui.
- Build verde + commit + push por bloco lógico.
- Validação visual só em rotas públicas (sem credenciais); telas autenticadas → lista para revisão humana.

## Decisões

### D1 — Fase 3.6: executar migração de formatters (102 arquivos)
**Contexto:** o plano marcou a migração como "DEFERIDA (payoff invisível)". O prompt overnight (§4)
ordena explicitamente executá-la como primeiro bloco.
**Decisão:** executar via Workflow `pipeline(refatorar → verificar adversarial)`, exigindo verify
byte-idêntico por substituição. Import canônico `@/utils/formatters`.
**Mapeamento:** `{day,month:'long',year}`→`'long'`; `{day,month:'short',year}`→`'medium'`;
`{day,month:'short'}`→`'dayMonth'`; sem-opts `toLocaleDateString('pt-BR')`→`formatDate(x)`;
`toLocaleString('pt-BR')` numérico→`formatNumber`; `{maximumFractionDigits:N}`→repassar como options;
moeda→`formatCurrency`; hora→`formatTime`/`'time'`; data+hora→`formatDateTime`.
**Pular + registrar:** options raras sem preset equivalente; receptores que não são data/número.

**Resultado:** 94 arquivos migrados. O Workflow teve falha sistêmica de tooling (71/102 agentes
"completed without calling StructuredOutput" — provável degradação após ~2h/5.4M tokens), mas os
agentes ainda editaram os arquivos. Como o estágio de verify adversarial foi pulado para esses 71,
**verifiquei manualmente** todo o bloco em vez de confiar no resumo do Workflow:
- `npm run build` verde (zero erro de import/sintaxe nos 94).
- `npm run test:run`: **zero novas falhas** vs baseline clean-HEAD (as 132 falhas do suite são
  pré-existentes — serviços/IndexedDB/async-flaky, arquivos não tocados; confirmado via `git stash`).
- Auditoria do diff: mapeamentos de preset byte-idênticos (casos não-triviais conferidos um a um:
  `dayMonth`, `long`, `medium`, `weekday`+`.replace()`, opts custom com hora, `" às "` preservado,
  preset `datetime`).
- Imports resolvem via aliases limpos (`fmtDate`, `formatDateBR`, `formatDateIntl`, etc.) para evitar
  colisão com funções locais homônimas; lint sem `no-unused-vars` de formatters.
- 15 chamadas `toLocale*('pt-BR')` remanescentes são skips legítimos (weekday-combinado;
  `Date.toLocaleString` com segundos).

### D2 — Workflow `agent({schema})` não confiável em lote grande/longo
**Contexto:** 71 de 102 agentes terminaram sem chamar StructuredOutput após ~2h de execução.
**Decisão:** nos próximos blocos, **evitar `schema` em pipelines grandes**; preferir lotes menores
(≤30 itens) por Workflow ou edição direta inline quando o bloco é pequeno. Sempre tratar a árvore de
trabalho (não o resumo do Workflow) como fonte de verdade e validar com build + test + diff audit.
