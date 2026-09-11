# Plano concluído — revisão independente da Escala

Base: `12924e89`. Worktree: `anest-codex-escala`. Branch local: `codex/revisao-escala-2026-09-08`.

## Decisões e escopo

- Revisar → planejar → corrigir, em worktree isolado, sem push ou deploy.
- A migration do swap foi autorizada especificamente pelo dono para preparação e testes locais; não foi aplicada em produção.
- A autorização posterior para concluir resolveu a confirmação de escopo das duplicatas: prevalece preservar linhas para conferência humana, conforme a regra documentada.
- Não mudar prompt, modelo, schema de saída, layout, navegação ou regra clínica. Mudanças de transformação invalidam cache pela versão do contrato.
- Cada correção inclui regressão executada vermelha antes e lint, suíte integral e build aprovados antes do commit.

## Achados e execução

Evidência, impacto, diff aplicado, commit, comandos de reprodução e outputs: `RELATORIO.md`, seção 2.

| Gravidade | Achado concluído | Commit | Teste |
|---|---|---|---|
| P0 | Swap republicado transfere cada caso uma só vez | `e3944f17` | `escalaPublicacaoSwapSql` |
| P0 | Erro de consulta ou contagem desatualizada não autoriza republicar | `fdb9f52e` | `importarEscalaPublicacaoDecisoes importarEscalaFdsMapas` |
| P0 | Dupla lida não vira apenas a primeira pessoa | `2b5b1ea1` | `escalaRosterVocabulario` |
| P0 | Cor e repetição atravessam o sanitizador | `e3f78c75` | `escalaSanitizacaoPipeline` |
| P0 | Todas as linhas lidas seguem para conferência | `69b6a225` | `escalaNormalizacaoEdge` |
| P1 | Ajudas homônimas permanecem distintas | `914c88c5` | `escalaCorComoDado` |
| P1 | Renovação mantém o hospital de origem | `bafafd99` | `escalaOrigemRenovacao` |
| P1 | Recarga falha não apaga hospitais nem grava cache parcial | `ae2171a8` | `escalaRecargaFalha` |
| P0 | Desfazer por UID mantém o rastro salvo no apelido do turno | `aa6cf03a` | `escalaOrigemRenovacao` |

Os oito itens do plano recuperado foram concluídos; a revisão final acrescentou a variante do rastro por apelido/turno ao desfazer por UID, comprovada em teste e corrigida separadamente.

## Propostas sem implementação

P2: precisão do eval para homônimos/horas, leitura serial, retomada parcial FDS e atualização da matriz curta. Evidências, diffs propostos e limites estão no relatório. Integrações completas de RLS, concorrência e handler da edge ficam registradas na matriz de cobertura, sem alegar defeitos não reproduzidos.

## Critério de entrega

Relatório com as seis seções, regressões por commit, lint/suíte/build no último código, Deno, inicialização/imports Vite, artefatos versionados e `git status --short` vazio no worktree. Nenhuma alteração de aplicação no checkout principal; sem push, deploy, SQL de produção, leitura de credenciais ou chamada à Vision.
