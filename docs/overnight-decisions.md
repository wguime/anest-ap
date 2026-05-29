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

### D3 — Fase 3.4 PageSkeleton: workflow no-schema confiável
**Decisão:** rodei a adoção via Workflow **sem `schema`** (agentes retornam texto livre) — 14 agentes,
13 CHANGED + 1 SKIP correto, 60s, zero falha de tooling. Confirma D2: o problema era o StructuredOutput,
não o Workflow. Padrão canônico aplicado (`{header}` + wrapper preservados, `<PageSkeleton header={false}>`).
Removi 4 imports `Spinner` órfãos à mão. Build verde. Commit `d9c0595`.

### D4 — Inline styles (ComunicadosPage, EducacaoTab): premissa do plano invalidada
**Contexto:** plano (3.x) listava esses arquivos como tendo inline styles estáticos a tokenizar.
**Achado na inspeção:** TODOS os `style={{}}` são legitimamente data-driven — `width: ${pct}%`
(barras de progresso), `backgroundColor: item.cor` (cores dinâmicas vindas de dados, que DEVEM ficar
inline pela armadilha #1 de JIT-purge), `env(safe-area-inset-*)` e motion values (`x`, `opacity`).
**Decisão:** **nenhuma mudança** — mexer quebraria o comportamento. Único hex cru é o fallback `'#666'`
em EducacaoTab:450 (raramente atingido); troca por token arrisca contraste com `text-white` em um dos
temas, então mantido. Bloco encerrado como no-op consciente.

### D5 — Adoção Fase 4.2: BlurFade NÃO serve em grid de altura-igual; criada utility `ds-stagger-in`
**Contexto (validado ao vivo com o usuário em localhost):** envolver cada card num `<BlurFade>` (motion.div)
quebrou o layout do grid do `MenuPage` — o grid iguala altura via `align-items: stretch` + `min-h` no
**filho direto** (WidgetCard); o wrapper intermediário rompe isso e `h-full`/`auto-rows-fr` não atravessam
o motion.div de forma confiável.
**Decisão (melhor prática):** para entrada escalonada em **grids**, NÃO usar wrapper — animar os filhos
diretos via CSS. Criada utility **`ds-stagger-in`** em `anest-theme.css` (keyframe blur+fade + delay por
`nth-child`, dentro de `@media (prefers-reduced-motion: no-preference)`, `fill-mode: backwards` p/ não
deixar transform residual que sobreporia o `hover:-translate-y`). Aplicada no `MenuPage` (filhos seguem
sendo grid items → alturas iguais preservadas). ✅ validado pelo usuário ("funcionou perfeitamente").
**Regra geral:** `<BlurFade>`/`<AnimatedList>` (wrapper) só em **listas de fluxo vertical**; em **grids**
use `ds-stagger-in`. Reusável p/ outros grids (ex.: 73 calculadoras) quando desejado.
**Adoções validadas ao vivo (sessão 05-29 com user logado):** `ds-stagger-in` no MenuPage (`3c29389`),
no grid das 73 calcs gated por `!searchTerm` (`ccdf997`), e no feed de comunicados gated por `!searchQuery`
(`efbbf6a`). Todas "funcionou perfeitamente".

### D6 — Busca da ComunicadosPage movida p/ header (padrão de listagens) + déficit global do PageHeader
**Contexto:** input de busca sempre-visível ficava parcialmente sob o header fixo. Pedido do usuário:
virar ícone como na Home (padrão [[feedback_search_in_header]]).
**Feito:** `SearchToggleButton` nas `actions` do PageHeader + `Collapsible`+`SearchBar` full-width abaixo
(autoFocus; fecha→limpa query). Validado.
**Achado latente (NÃO corrigido globalmente):** o header fixo do `PageHeader` mede ~68px (`py-3` 24px +
botão Voltar `min-h-[44px]`) mas o spacer é `h-14` (56px) → ~12px de sobreposição em QUALQUER página cujo
1º conteúdo encoste no topo. Corrigido **localmente** na ComunicadosPage com `pt-3` no wrapper de conteúdo.
**Pendente (decisão humana):** corrigir na fonte — spacer do PageHeader p/ `h-[68px]`/`h-16` resolve em
todas as ~180 páginas, mas mexe no app inteiro → exige validação de algumas telas antes.
