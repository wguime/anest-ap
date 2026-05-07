# Plano de Revisão Completa — ANEST v3.70.0

**Criado:** 2026-04-29
**Motivação:** Revisão geral do app + queixa de usuários sobre dificuldade em adicionar/gerir documentos.

## Contexto

- Vite + React 19, Firebase Auth + Supabase RLS, dados de saúde (LGPD + Qmentum)
- Já existe `src/AUDIT_REPORT_GESTAO_DOCUMENTAL.md` (fev/2026) que remediou 10 gaps técnicos — queixa atual provavelmente é UX/fluxo, não conformidade
- Branch: `main`, working tree limpo no início

## As 7 Fases

| # | Fase | Ferramenta | Output | Custo |
|---|------|-----------|--------|-------|
| 1 | Preparação | git status, npm run build | Branch limpa, build ok | Grátis |
| 2 | /ultrareview | Cloud multi-agente (usuário dispara) | Relatório bugs/segurança/arch | 1 run grátis |
| 3 | Segurança LGPD | /security-review + análise | RLS, JWT, anonimização, secrets | Grátis |
| 4 | UX Gestão Documental 🔥 | Análise manual focada | Lista priorizada de fricções | Grátis |
| 5 | Saúde do código | /project-health-auditor:analyze | Refactors prioritários | Grátis |
| 6 | Qmentum | Análise manual | Status dos 5 gaps críticos | Grátis |
| 7 | Consolidação | Síntese | Backlog P0→P3 com PRs sugeridos | Grátis |

## Fase 4 — Pontos de investigação (queixa de usuários)

1. **NewDocumentModal** — campos obrigatórios excessivos? validação confusa? mensagens de erro claras?
2. **Upload (uploadDocumentFile)** — tipos aceitos, paths por categoria, feedback de progresso, tratamento de erro de rede
3. **Workflow rascunho → pendente → ativo** — usuário leigo entende? labels claras? quem aprova?
4. **GestaoDocumentalPage** — descoberta de ações (botão "novo doc" visível?), filtros úteis, busca funcional
5. **DocumentoDetalhePage** — edição inline vs modal, versionamento intuitivo
6. **Mobile** — modais fullscreen funcionam? touch targets 44px? scroll de form longo?
7. **Acessibilidade** — labels, focus trap, screen reader

## Ordem de execução

```
Fase 1 (preparação)
  ↓
Fase 2 (usuário dispara /ultrareview — em paralelo com 3-6)
  ↓
Fase 3 + 4 + 5 + 6 (eu executo em paralelo)
  ↓
Fase 7 (síntese final)
```

## Pendências do usuário

- Disparar `/ultrareview` (somente usuário pode — é faturado)
- Detalhar a queixa específica dos usuários sobre gestão documental (não apareceu na conversa). Sintomas possíveis: modal travando, upload falhando, campos confusos, não acham botão, erro de permissão. Saber o sintoma específico encurta Fase 4 em ~80%.

## Output final esperado

`RELATORIO_REVISAO_2026-04-29.md` com:
- Resumo executivo (3-5 bullets)
- Achados por fase (P0/P1/P2/P3)
- Backlog priorizado pronto para virar PRs
- Roadmap sugerido de execução
