# Audit & Optimize — Prompt completo para revisar fluxo de execução

> Use este prompt em uma **nova sessão Claude Code** (`claude` em nova aba do terminal).
> Antes: `cd ~/Documents/IA/ANEST\ V2`
> Não use durante uma wave em andamento — abra sessão dedicada.

---

````
═══════════════════════════════════════════════════════════════
OBJETIVO desta sessão: auditar como o projeto ANEST configura Claude Code
e propor melhorias baseadas nas práticas oficiais Anthropic mais
recentes (2026). Não implementar nada sem aprovação por bloco do user.
═══════════════════════════════════════════════════════════════

Working dir: /Users/guilherme/Documents/IA/ANEST V2
Stack: React 19.2 + Vite 7 + Tailwind 3.4 + Firebase + Supabase (RLS JWT HS256)
Estado: pós Wave 1.5 em produção (commit ≥ 96dddd9)

PRINCÍPIO RAIZ (Anthropic best practices):
- "Context window é seu recurso fundamental. Performance degrada com bloat."
- "Would removing this cause Claude to make mistakes?" — se NÃO, cortar.
- "Verification criteria é a coisa de maior alavanca que você pode fornecer."
- "Explore → Plan → Implement → Commit" — 4 fases.

═══════════════════════════════════════════════════════════════
FASE 1 — PESQUISA ATUALIZADA (~10min, agentes paralelos)
═══════════════════════════════════════════════════════════════

Disparar EM PARALELO 4 agentes general-purpose para coletar práticas atuais.
Cada agente reporta em ≤400 palavras, em formato lista markdown.

Agente A — CLAUDE.md & Memory
  WebFetch:
   - https://code.claude.com/docs/en/best-practices  (seção CLAUDE.md)
   - https://code.claude.com/docs/en/memory
  Extrair: tamanho ideal, padrões de @import, quando usar CLAUDE.local.md,
  emphasizers (IMPORTANT / YOU MUST), o que NÃO incluir, como medir bloat.

Agente B — Subagents, Skills & Plugins
  WebFetch:
   - https://code.claude.com/docs/en/sub-agents
   - https://code.claude.com/docs/en/skills
   - https://code.claude.com/docs/en/plugins
   - https://www.anthropic.com/news/claude-code-plugins
  Extrair: quando escolher subagent vs skill vs plugin; frontmatter completo
  com exemplo; tools allowlist; model selection por papel; disable-model-invocation;
  plugins comunidade úteis pra stack React/Firebase/Supabase.

Agente C — Hooks, Permissions & Sandboxing
  WebFetch:
   - https://docs.anthropic.com/en/docs/claude-code/hooks-guide
   - https://code.claude.com/docs/en/hooks
   - https://code.claude.com/docs/en/permissions
   - https://code.claude.com/docs/en/permission-modes
   - https://code.claude.com/docs/en/sandboxing
  Extrair: eventos (PreToolUse, PostToolUse, SessionStart, CwdChanged, etc.),
  matchers, jq patterns, auto mode quando usar, allowlist patterns,
  sandbox quando faz sentido.

Agente D — Workflow patterns
  WebFetch:
   - https://code.claude.com/docs/en/common-workflows
   - https://code.claude.com/docs/en/worktrees
   - https://code.claude.com/docs/en/sessions
   - https://code.claude.com/docs/en/checkpointing
   - https://code.claude.com/docs/en/headless
  Extrair: explore→plan→implement→commit, plan mode hotkeys (Ctrl+G),
  /rewind vs /clear, worktrees vs agent teams, non-interactive (claude -p)
  pra CI/scripts, fan-out patterns.

Consolidar saídas em uma seção AUDIT_INPUTS no scratch.

═══════════════════════════════════════════════════════════════
FASE 2 — INVENTÁRIO DO ESTADO ATUAL (~5min, paralelos)
═══════════════════════════════════════════════════════════════

Disparar EM PARALELO 3 agentes Explore para mapear configuração do projeto:

Agente E — Config Claude
  Listar e resumir conteúdo de:
   - CLAUDE.md (LOC, principais seções, @imports usados)
   - .claude/settings.json (permissions allow/deny/ask + hooks ativos)
   - .claude/settings.local.json (se existir; gitignored)
   - .claude/skills/ (cada SKILL.md: name, description, allowed-tools)
   - .claude/rules/ (cada .md: tópico)
   - .claude/agents/ (cada .md: name, description, tools, model)
   - .mcp.json (MCPs configurados)

Agente F — Memórias do user
  Listar e resumir:
   - ~/.claude/projects/-Users-guilherme-Documents-IA-ANEST-V2/memory/MEMORY.md
     (todas as entradas, status: ativa/obsoleta)
   - Cada arquivo .md de memória: type, age, ainda relevante?
  Identificar redundâncias, memórias obsoletas, sem cross-link.

Agente G — Histórico recente de pain points
  Inspecionar últimos 30 commits + últimas 10 PRs:
   - git log --oneline -30 main
   - gh pr list --state all --limit 10
  Identificar: padrões recorrentes de erro/fix, retrabalho, decisões que
  poderiam ter sido capturadas como regra/skill/agent.

Consolidar saídas em uma seção CURRENT_STATE no scratch.

═══════════════════════════════════════════════════════════════
FASE 3 — GAP ANALYSIS (~10min, sequencial pra raciocinar)
═══════════════════════════════════════════════════════════════

Comparar AUDIT_INPUTS × CURRENT_STATE. Produzir tabela markdown com
formato exato abaixo, ordenada por ROI decrescente:

| ID | Área | Gap | Impacto | Esforço | ROI | Risco se aplicar |
|----|------|-----|---------|---------|-----|------------------|

Categorias a cobrir (não obrigatório encontrar gap em todas):
1. CLAUDE.md bloat ou faltas (versus prática "would removing cause mistakes?")
2. Skills mal-escopadas, frontmatter incompleto, redundantes com rules
3. Rules redundantes com CLAUDE.md
4. Agents faltando (calc-validator/lgpd-reviewer/migration-validator existem; faltam test-writer? a11y? perf?)
5. Agents com tools amplos demais (devia ser read-only)
6. Hooks faltando que seriam determinísticos (vs instrução advisory em CLAUDE.md)
7. Permissions com pattern muito amplo ou muito restrito
8. Memory bloat (entradas obsoletas, sem cross-link, MEMORY.md > 200 linhas)
9. MCPs ausentes para a stack (firebase, chrome-devtools mencionados em CLAUDE.md como "a instalar")
10. Plugins úteis não instalados
11. Workflow patterns não usados (worktrees em paralelo? non-interactive em CI?)
12. Verification criteria fracos em algum área (testes/screenshots/build)
13. Padrões de prompt user que poderiam virar slash command
14. CLAUDE.local.md ainda não existe (deveria pra overrides pessoais?)

Critérios de ROI:
- ALTO: bloqueia falha recorrente OU acelera ≥30min de toda sessão
- MÉDIO: melhora qualidade mas em <10% das sessões
- BAIXO: nice-to-have

Critérios de Risco:
- BAIXO: arquivo isolado, fácil reverter (git revert)
- MÉDIO: afeta toda sessão (CLAUDE.md, settings.json, memória)
- ALTO: muda comportamento de produção (hooks, permissions auto)

═══════════════════════════════════════════════════════════════
FASE 4 — APROVAÇÃO POR BLOCO via AskUserQuestion
═══════════════════════════════════════════════════════════════

Apresentar a tabela GAP ANALYSIS ao user.

Para cada gap de ROI ALTO + Risco BAIXO/MÉDIO: usar AskUserQuestion (uma vez,
agrupando até 4 itens por chamada) com opções:
  [Aplicar agora]  [Adiar / criar issue]  [Não fazer]

Para gaps de ROI MÉDIO: agrupar em UMA AskUserQuestion final com checklist
multiSelect.

Gaps de ROI BAIXO: não perguntar — listar como sugestões no relatório final.

REGRA: NÃO aplicar nada sem aprovação explícita. NUNCA aplicar gaps de
Risco ALTO sem mostrar diff e pedir confirmação adicional.

═══════════════════════════════════════════════════════════════
FASE 5 — IMPLEMENTAÇÃO POR BLOCO
═══════════════════════════════════════════════════════════════

Para cada gap aprovado:

1. TaskCreate ("Aplicar gap #N — descrição curta")
2. Em branch dedicada: `git checkout -b chore/anthropic-bp-audit-N` (primeiro
   gap criar branch; demais commits na mesma branch)
3. Implementar a mudança específica
4. Validação imediata:
   - Se editou CLAUDE.md: medir LOC antes/depois, conferir <200 linhas total
     com @imports expandidos. Se passar de 200, REVERTER e mover detalhe pra
     arquivo importado via @path.
   - Se editou settings.json hooks: testar com comando dummy local
     (não bloqueia o agente atual, mas valida sintaxe via `cat | jq .`).
   - Se criou skill/agent: testar invocação direta (/<name> ou Agent({type})).
   - Se editou memória: garantir cross-links [[name]] válidos.
   - Se mudou permissions: rodar 1 comando que era bloqueado pra confirmar
     comportamento.
5. Commit granular: `chore(claude): <gap específico>`
6. TaskUpdate completed
7. `npm run build` é OPCIONAL aqui (mudanças não tocam src/), mas rodar uma
   vez ao final pra checkpoint.

═══════════════════════════════════════════════════════════════
FASE 6 — DOCUMENTAÇÃO E PR
═══════════════════════════════════════════════════════════════

1. Atualizar docs/wave-execution-playbook.md com aprendizados novos (se houver)
2. Adicionar entrada de histórico ao final do playbook:
     ## Histórico de evolução
     - YYYY-MM-DD — audit Anthropic BP, N gaps aplicados, ver PR #X
3. Criar PR:
     gh pr create --base main --head chore/anthropic-bp-audit-N --draft \
       --title "chore(claude): audit Anthropic best practices — N gaps aplicados"
4. Test plan no PR:
     - [ ] Próxima sessão neste projeto carrega CLAUDE.md em tempo razoável
       (avaliar via /context se houver redução vs antes)
     - [ ] Skills modificadas invocam corretamente (/<name>)
     - [ ] Agents modificados respeitam tool allowlists
     - [ ] Hooks novos disparam sem false positives
     - [ ] Memória ainda referenciada onde relevante
5. Relatório final ao user em ≤300 palavras:
     - Gaps aplicados (lista)
     - Gaps adiados (lista com motivo)
     - Gaps recusados (lista, breve justificativa)
     - Métricas: LOC CLAUDE.md antes/depois, número de skills/agents/hooks
     - Próximos passos sugeridos

═══════════════════════════════════════════════════════════════
RESTRIÇÕES E GUARD-RAILS
═══════════════════════════════════════════════════════════════

NÃO fazer:
- Não modificar src/ (esta sessão é meta — config de Claude, não código de produto)
- Não aplicar gaps sem aprovação do user
- Não criar agents com tools="*" (sempre allowlist específica)
- Não criar hooks PreToolUse que bloqueiem comandos comuns sem opt-out
- Não escrever secrets nos arquivos modificados (regra .claude/rules/secrets.md)
- Não remover memórias do user sem confirmação explícita (mesmo se obsoletas)
- Não mexer em settings.local.json (gitignored, pessoal do user)
- Não rodar firebase deploy / supabase push nesta sessão

SEMPRE:
- Preservar todas as decisões arquiteturais já consolidadas
  (memórias feedback_*, docs/wave-execution-playbook.md)
- Reverter o commit imediatamente se um agente subsequente reportar problema
- Pedir confirmação extra se um gap requerer remover regra existente

═══════════════════════════════════════════════════════════════
ENTREGÁVEIS ESPERADOS
═══════════════════════════════════════════════════════════════

1. PR draft com mudanças granulares por commit (1 commit = 1 gap)
2. Relatório resumido em ≤300 palavras na resposta final
3. docs/wave-execution-playbook.md com entrada de histórico
4. Lista de "próximos passos" priorizada para revisão futura

═══════════════════════════════════════════════════════════════
COMEÇAR POR
═══════════════════════════════════════════════════════════════

1. Confirmar com user que está em sessão dedicada (não no meio de wave de feature)
2. Disparar Fase 1 (4 agentes pesquisa paralelos) + Fase 2 (3 agentes inventário
   paralelos) — total 7 agentes em paralelo, em UM único bloco de tool calls
3. Aguardar todos retornarem; consolidar
4. Fase 3 Gap Analysis (sequencial; raciocínio)
5. Fase 4 Aprovação via AskUserQuestion
6. Fase 5 Implementação dos aprovados
7. Fase 6 PR + relatório

OBSERVAÇÃO de eficiência: as Fases 1+2 disparam 7 agentes em paralelo. Cada
agente roda em contexto isolado e retorna apenas o resumo. Isso é o padrão
Anthropic "subagents for parallelization and context management" — mantém
seu contexto principal limpo enquanto a pesquisa acontece em paralelo.
````

---

## Como usar este prompt

1. **Termine qualquer wave em andamento primeiro** (commit/PR pendente)
2. Abra nova aba: `Cmd + T`
3. `cd ~/Documents/IA/ANEST\ V2`
4. `claude`
5. Cole tudo entre as ` ``` ` acima
6. A sessão vai:
   - Disparar 7 agentes em paralelo (4 pesquisa Anthropic + 3 inventário projeto)
   - Apresentar tabela de gaps ordenada por ROI
   - Pedir aprovação por bloco via `AskUserQuestion`
   - Aplicar só o aprovado em commits granulares
   - Abrir PR draft + relatório

**Tempo estimado**: 30-45 minutos de relógio, sendo ~15 min só esperando os agentes paralelos retornarem da pesquisa.

**Frequência sugerida**: 1× a cada 2-3 sprints, ou quando você suspeitar que algo ficou desatualizado. Anthropic publica novidades em Claude Code mensalmente.

## Diferenças vs prompt da Wave 1.6

| Aspecto | Wave 1.6 prompt | Audit prompt (este) |
|---|---|---|
| Objetivo | Implementar feature do plano | Otimizar config Claude |
| Toca `src/` | Sim | **Não** (só `.claude/`, `docs/`, memória) |
| Decisões via AskUserQuestion | 2 arquiteturais | N gaps com 3 opções cada |
| Agentes paralelos | 3 (pre-flight) | 7 (4 pesquisa + 3 inventário) |
| Output | PR de feature | PR de config |
| Risco | Médio (afeta produto) | Baixo-médio (afeta config de sessões) |