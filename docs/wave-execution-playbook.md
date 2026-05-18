# Wave Execution Playbook — ANEST

> Consolidação das lições aprendidas (Waves 1.1 → 1.5) + práticas oficiais Anthropic Claude Code.
> Aplicar para qualquer wave/feature com 5+ tarefas. Atualizar este doc quando descobrir novo padrão.

## TL;DR — 10 regras de ouro

1. **Explore → Plan → Implement → Commit** (workflow Anthropic, 4 fases).
2. **Pre-flight obrigatório** com 3 agentes paralelos (libs, map files, gaps).
3. **`migration-validator` agent** antes de aplicar SQL.
4. **`AskUserQuestion`** para decisões arquiteturais — não assumir.
5. **`TaskCreate` no início**, **`TaskUpdate` em tempo real**.
6. **`npm run dev` cedo** (não só `build`) — esbuild ≠ rollup.
7. **Build verde a cada bloco lógico** (checkpoint).
8. **Commits granulares** por bloco (deps / backend / UX / DS tokens).
9. **Cloud Function deploy = tarefa do user** (secrets nunca em chat).
10. **`migrate via deploy-sp21-mgmt-api.mjs`** — Supabase CLI não está instalado.

---

## Workflow Anthropic: Explore → Plan → Implement → Commit

### Fase 1 — Explore (plan mode opcional)
- Ler `docs/planejamento-melhorias-2026-05-16.md` (seção da wave)
- Ler memórias relevantes em `~/.claude/projects/-Users-guilherme-Documents-IA-ANEST-V2/memory/`
- Não escrever código nesta fase
- Despachar 3 agentes paralelos (próxima seção)

### Fase 2 — Plan
- Resumo do que vai mudar (arquivos novos, refatorações, schemas)
- `AskUserQuestion` para decisões arquiteturais não cobertas pelo plano
- `TaskCreate` granular (1 task por entrega lógica)
- Estimar onde libs novas serão necessárias e validar critérios

### Fase 3 — Implement
- Pegar tasks em ordem, marcar `in_progress` antes de começar
- Build verde a cada bloco
- Commits granulares
- Não fazer refactor oportunista (regra `feedback_scope_discipline`)

### Fase 4 — Commit / PR
- PR draft inicial com test plan detalhado
- Despachar agentes de revisão (`security-reviewer`, `lgpd-reviewer`, `qmentum-auditor` conforme escopo)
- Validar com user
- Marcar PR como ready
- Mergear via `gh pr merge --rebase --delete-branch`
- Deploy (se aplicável)

---

## Pre-flight obrigatório — 3 agentes paralelos

Disparar **antes** de qualquer implementação:

### Agente A — Validação de libs novas
```
general-purpose: re-validar libs novas com critérios duros:
  - Stars ≥1k OU npm weekly ≥100k
  - Last commit ≤6 meses (hoje = <data>)
  - License MIT/Apache/BSD/ISC
  - React 19 peer dep VERIFICADO (se aplicável)
  - Bundle gzip ≤50KB (se maior, marcar lazy)
  - ≥1 caso real positivo em fórum últimos 12 meses
```
Saída: tabela markdown lib | versão | stars | last commit | license | React 19 | bundle | verdict.

### Agente B — Mapeamento de arquivos atuais
```
Explore: localizar arquivos que vou TOCAR ou referenciar.
Para cada: ✅ existe path:linhas, ❌ NÃO existe path proposto, ⚠️ existe mas variante.
Listar diretórios-alvo na íntegra com LOC.
```

### Agente C — Gaps arquiteturais
```
general-purpose: validar se o plano da wave é compatível com a stack atual.
Por task que assume backend X, confirmar realidade do projeto.
Exemplo Wave 1.5: plano assumia Supabase, educação vive em Firestore →
4 tasks precisaram redesenhar stack.
```

**Quando os 3 voltam:** consolidar em resumo executivo, `AskUserQuestion` para decisões grandes, prosseguir.

---

## Agentes de revisão (despachar antes de mergear PR)

| Agente | Quando usar | Output |
|---|---|---|
| `migration-validator` | Toda migration SQL nova | Issues encontradas + comandos pré-apply |
| `security-reviewer` | RLS Supabase + Firestore rules + auth flow | Findings com confidence |
| `lgpd-reviewer` | Feature toca dado pessoal/saúde, ranking, opt-in | Checklist LGPD com gaps |
| `qmentum-auditor` | Feature de compliance (ROPs, auditoria, documentos) | Impact em score Qmentum |
| `calc-validator` | Calculadora clínica (matemática) | Fórmulas + edge cases |
| `test-writer` | Áreas sem cobertura testada | Vitest stubs no padrão 38 existentes |

---

## Decisões arquiteturais — quando usar `AskUserQuestion`

**Sempre** para:
- Escolha de stack (Supabase vs Firestore vs client-only)
- Lib bloqueada por critério (substituir vs aceitar risco vs construir)
- Mudança de schema com migração de dados existentes
- Trade-offs de UX (1 chip vs múltiplos, modal vs página)
- Compliance LGPD/Qmentum (opt-in vs forçado, retenção)

**Formato recomendado:**
```
[1] Opção recomendada — descrição + trade-offs
[2] Alternativa — quando preferir
[3] Não fazer — explicar custo
```

**Memória relevante:** `feedback_scope_discipline` — se gap arquitetural for grande, PARAR e reportar.

---

## TaskCreate / TaskUpdate — disciplina

### Quando criar
- Wave com 5+ entregas distintas → criar todas no início
- Task descoberta durante implementação → criar imediatamente, não no final

### Quando atualizar
- `in_progress` ANTES de começar (não depois)
- `completed` IMEDIATAMENTE ao terminar (não em batch)
- `deferred` com `description` explicando POR QUE (escopo, complexidade, dependência)

### Antipatrões
- ❌ Criar todas como `completed` no final ("já fiz")
- ❌ Atualizar batch a cada 5 tasks
- ❌ `completed` sem ter build verde

---

## Migrations Supabase — fluxo correto

```bash
# 1. Criar arquivo em supabase/migrations/AAAAMMDDHHMMSS_nome.sql
# 2. Despachar migration-validator agent ANTES de aplicar
# 3. Aplicar correções sugeridas
# 4. Aplicar via Mgmt API (CLI supabase NÃO está instalado):
node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/AAAAMMDDHHMMSS_nome.sql
```

**Não usar** `supabase db push` — não funciona neste projeto (CLI ausente).
**O script** usa `SUPABASE_ACCESS_TOKEN` do `.env.local` via Management API.

---

## Cloud Functions — divisão de responsabilidades

| Quem | O quê |
|---|---|
| **Agente** | Escrever `functions/src/X.js` + adicionar export em `functions/index.js` + service helpers (`httpsCallable`) + UI |
| **User** | Configurar secrets (`firebase functions:secrets:set NAME` no terminal dele) + rodar `firebase deploy --only functions:X,Y` |

**Por quê separação:** secrets nunca em chat (regra `.claude/rules/secrets.md`). O agente NÃO lê `.env.local`. Os 2 valores principais (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) já estão em Secret Manager.

---

## Modal DS — API correta

```jsx
<Modal
  open={open}
  onClose={onClose}
  title="Título"
  description="Descrição opcional"
  size="lg"   // sm | md | lg | xl
  footer={<Button onClick={onClose}>Fechar</Button>}
>
  <div className="space-y-4">{/* corpo */}</div>
</Modal>
```

**Não existem** `ModalHeader`, `ModalTitle`, `ModalContent`, `ModalFooter` no DS. Erro frequente importado de templates antigos.

**Alert DS:** só exporta `Alert`. Não há `AlertDescription` — use `<div>` filho.

---

## Erros comuns + soluções (aprendi nas Waves 1.1–1.5)

### "No matching export `_foo`" em dev
Causa: hook antigo de auto-eslint renomeou imports não-usados para `_*`. Quebra ESM.
Fix: cleanup em batch — script node varre `src/**/*.{js,jsx}` removendo `_*` de blocos `import {}`.
Após Wave 1.5 esse hook foi removido — não deve mais acontecer.

### "Invalid secret key HTTPS://..."
Causa: user colou valor (URL) como **nome** do secret no `secrets:set`.
Fix: `firebase functions:secrets:set NOME_DO_SECRET` SEM nada depois. Aí cole o valor no prompt mascarado.

### Build verde, dev quebrado
Causa: esbuild (dev) é mais estrito que rollup (build) com ESM.
Fix: sempre rodar `npm run dev` cedo, não confiar só em `npm run build`.

### `_*` Finder duplicates
Causa: macOS Finder duplica arquivos via Cmd+D criando `X 2.ext`.
Fix: grep + delete; adicionar `* 2.*` ao `.gitignore` (já feito).

---

## Failure patterns Anthropic (a evitar)

1. **Kitchen sink session** — misturar várias tarefas no mesmo contexto. → `/clear` entre tarefas não relacionadas.
2. **Correcting over and over** — duas correções no mesmo issue = `/clear` e prompt melhor.
3. **Over-specified CLAUDE.md** — se Claude ignora regras, é porque tem muita coisa. Cortar.
4. **Trust-then-verify gap** — não verificar (build/test/screenshot). Sempre incluir critério de verificação.
5. **Infinite exploration** — pedir "investigue X" sem escopo. Usar subagentes ou escopar.

---

## Resume / Resume / Branch — sessões paralelas

- Para wave nova em outra aba: `claude` → cole o `docs/wave-N-prompt.md`
- Para retomar sessão atual: `claude --continue` ou `claude --resume`
- Renomear com `/rename` para tratar sessões como branches

---

## Checklist final antes de declarar wave pronta

- [ ] `npm run build` verde
- [ ] `npm run dev` sobe sem erro
- [ ] `npm run lint` sem NOVOS errors (24 pré-existentes em main, OK)
- [ ] Testes Vitest sem regressão (8 falhas pré-existentes em main, OK)
- [ ] Agentes de revisão despachados (security/lgpd/qmentum conforme escopo)
- [ ] Playwright resize 375x812 + 1280x800 sem layout break
- [ ] Touch targets ≥44px em CTAs
- [ ] Zero hex hardcoded (grep `#[0-9a-f]{3,6}` em arquivos modificados)
- [ ] `changedBy = currentUserId` real em mutations
- [ ] Migration aplicada via `deploy-sp21-mgmt-api.mjs`
- [ ] Cloud Function deploy instruções claras para user (se aplicável)
- [ ] PR draft com test plan completo
- [ ] CHANGELOG bump (no fim da sprint)
- [ ] Memória do user atualizada com aprendizados novos

---

## Referências externas

- [Anthropic Best Practices Claude Code](https://code.claude.com/docs/en/best-practices)
- [Subagents docs](https://code.claude.com/docs/en/sub-agents)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Skills](https://code.claude.com/docs/en/skills)
- [Memory / CLAUDE.md](https://code.claude.com/docs/en/memory)

---

## Histórico de evolução deste playbook

- **2026-05-18** — criado consolidando aprendizados Waves 1.1 → 1.5 + best practices Anthropic
