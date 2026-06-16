---
globs: ["CLAUDE.md", ".claude/skills/**", ".claude/agents/**", ".claude/commands/**", ".claude/rules/**", "docs/wave-execution-playbook.md"]
description: Otimização de prompts e solicitações — práticas oficiais Anthropic (Fable 5)
---

# Prompting — Práticas Oficiais Anthropic (Fable 5)

## Princípio: altitude certa
Instrução específica o bastante para guiar, flexível o bastante para o modelo aplicar julgamento.
Fable 5 segue instruções breves com fidelidade — 1 frase com o *porquê* supera 10 bullets de
MUST/NEVER, porque a razão cobre os edge cases que a regra rígida perde. Buscar sempre o menor
conjunto de tokens de alto sinal.

## Como formular solicitações (template)
> "Estou trabalhando em **[tarefa maior]** para **[quem]**. Precisa de **[o que o resultado
> habilita]**. Com isso em mente: **[pedido]**. Pronto quando: **[critério verificável]**."

O motivo conecta a tarefa ao contexto certo; sem ele o modelo infere a intenção sozinho.
Sempre incluir um check executável (teste, build, screenshot) — sem um check que o Claude possa
rodar, "parece pronto" é o único sinal disponível.

Exemplos ANEST:
- **Calculadora:** "Anestesistas usam no intra-op pelo celular; errar dose é risco ao paciente.
  Com isso em mente: crie a calculadora X. Pronto quando: Vitest passa com edge cases nos limites."
- **Migration:** "A tabela alimenta o painel LGPD que o DPO audita. Com isso em mente: crie a
  migration Y. Pronto quando: migration-validator aprova e RLS cobre os 4 verbos."
- **Run overnight:** "Vou dormir e ler o relatório de manhã; ninguém responde dúvidas. Com isso
  em mente: [mandato]. Pare quando: [critério explícito de parada]."

## Autoria de skills / agents / prompts novos
- **Description em 3ª pessoa com O QUE + QUANDO + triggers** — é o único sinal de seleção da
  skill; o modo de falha comum é under-trigger por description vaga.
- **Corpo conciso** — todo token carregado é custo recorrente de contexto; lógica complexa vai
  para `scripts/` invocados via bash, não inline no SKILL.md.
- **ALL-CAPS NEVER/ALWAYS sem o porquê é yellow flag oficial** — reescrever explicando a razão
  (ex.: em vez de "NUNCA usar elipses", dizer "o TTS não sabe pronunciar elipses, então evite-as").
- **Nunca instruir o modelo a "explicar/transcrever/mostrar seu raciocínio" no texto da resposta**
  — dispara refusal `reasoning_extraction` no Fable 5; visibilidade de raciocínio vem dos blocos
  `thinking` da API, não do output.
- **Não pedir "relate progresso a cada passo"** — usar os checkpoints já existentes (build verde
  por bloco, TaskUpdate em tempo real).
- Pausar/AskUserQuestion só para: ação destrutiva/irreversível, mudança real de escopo, ou input
  que só o usuário tem (referências corretas: skills `rotacao-residencia`, `sobreaviso`, `hospitais`).

## Prompts para subagentes e workflows
O subagente não vê a conversa — todo prompt de despacho leva os 4 elementos oficiais:
**objetivo** (com o porquê da tarefa), **formato de output**, **guidance de tools/fontes** e
**boundaries** (o que NÃO fazer). Sem eles: trabalho duplicado e gaps.
- Escala de spawning: 1 agente para fato simples, 2–4 para comparações, 10+ só para research
  complexa. Tarefas independentes → despacho paralelo no mesmo turno.
- Verificação por subagente de contexto limpo supera autocrítica do mesmo contexto.

## Runs longos/autônomos
Comportamento always-on (grounding de progresso) está no CLAUDE.md. Regra de autoria: todo
mandato overnight inclui critério de parada explícito + intervalo de auto-verificação
("verifique seu trabalho a cada [X] contra a especificação, com subagentes").

## Manutenção
Tratar esta rule e o CLAUDE.md como prompt: podar quando ignorado, testar se a mudança altera
comportamento de fato. CLAUDE.md inchado faz o Claude ignorar as instruções (alvo oficial: <200 linhas).

Revisão futura (anotado, não executar sem ordem do dono): `docs/wave-execution-playbook.md` e os
checklists de 26–50 itens em `.claude/agents/{security,lgpd}-reviewer.md` são candidatos a
re-avaliação — o guia Fable 5 diz que prompts de modelos anteriores podem ser prescritivos demais,
mas são artefatos de compliance médico (decisão separada).

## Fontes
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
- https://code.claude.com/docs/en/best-practices
- https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.anthropic.com/engineering/multi-agent-research-system
