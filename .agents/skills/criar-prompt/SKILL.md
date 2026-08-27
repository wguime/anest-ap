---
name: criar-prompt
description: Gera um prompt pronto no padrão oficial Anthropic/Fable 5 a partir de uma descrição curta do usuário. Usar quando o usuário pedir "crie um prompt para X", "monte o prompt de Y", "preciso de um prompt para a função/tarefa Z" — para tarefa nova, mandato overnight, subagente ou skill.
allowed-tools: Read, Grep, Glob
---

# Criar Prompt — ANEST

Transforma um pedido curto ("crie um prompt para refatorar a busca global") num prompt completo
seguindo `.Codex/rules/prompting.md`. O usuário não precisa lembrar do template — esta skill
preenche os elementos por ele, inferindo do conhecimento do projeto o que ele não disse.

## Fluxo

1. **Identificar o tipo** pelo pedido (não perguntar se for óbvio):
   - **Tarefa** — prompt que o usuário cola numa sessão nova do Codex
   - **Overnight** — mandato autônomo de madrugada
   - **Subagente** — prompt para Agent/Workflow dispatch
   - **Skill/agent** — frontmatter + corpo de um SKILL.md ou agent novo

2. **Inferir os elementos do template antes de perguntar.** O contexto vive no repo: módulo
   afetado (AGENTS.md/mapa de módulos), quem usa (anestesistas, admin, DPO), comando de
   verificação (Vitest, build, playwright, migration-validator). Usar AskUserQuestion só para o
   que não dá para inferir — tipicamente 1 pergunta no máximo (ex.: escopo ambíguo entre dois módulos).

3. **Montar o prompt** com a estrutura do tipo:

   **Tarefa / Overnight:**
   > Estou trabalhando em [tarefa maior] para [quem]. Precisa de [o que o resultado habilita].
   > Com isso em mente: [pedido específico].
   > Pronto quando: [critério verificável + comando de check].
   - Overnight acrescenta: critério de parada explícito, intervalo de auto-verificação
     ("verifique a cada N tarefas contra a especificação, com subagentes"), grounding
     ("audite cada claim de progresso contra um tool result; teste falhou = reportar com output"),
     e o que NÃO fazer (boundaries — ex.: sem features novas, sem deploy).

   **Subagente** — os 4 elementos oficiais, nesta ordem:
   objetivo (com o porquê — o subagente não vê a conversa), formato de output esperado,
   guidance de tools/fontes, boundaries (o que não fazer / onde parar).

   **Skill/agent:** description em 3ª pessoa com O QUE + QUANDO + triggers; corpo conciso
   explicando o porquê das regras (não MUST/NEVER seco); lógica complexa → `scripts/`.

4. **Auto-checagem antes de entregar** (a razão de cada item está na rule `prompting`):
   - Tem motivo, não só pedido? Tem critério de pronto executável?
   - Nada de "explique/mostre seu raciocínio" (refusal `reasoning_extraction` no Fable 5)
   - Instrução curta com porquê no lugar de checklist enumerado
   - Pausas previstas só para destrutivo / escopo / input que só o usuário tem

5. **Entregar o prompt em um único bloco de código** pronto para copiar, seguido de 1-2 linhas
   dizendo o que foi inferido (para o usuário corrigir se a inferência errou).

## Exemplo

Pedido: *"crie um prompt para corrigir o bug do tagsService.createTag"*

```
Estou corrigindo um bug do módulo de tags (achado da madrugada tech-debt, RELATORIO-MADRUGADA.md)
do ANEST, app de gestão de qualidade usado por anestesistas. O fix destrava a criação de tags
na gestão documental. Com isso em mente: corrija o bug em src/services/tagsService.js
(createTag), cobrindo o caso que falha hoje com um teste de regressão.
Pronto quando: npm run test:run passa incluindo o teste novo, e npm run build sem erro.
Não refatore além do fix.
```
