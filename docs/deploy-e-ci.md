# Deploy, CI e execução por Wave — texto integral

> Movido do CLAUDE.md em 2026-08-26 na otimização de contexto. O CLAUDE.md guarda a versão
> operacional condensada; aqui fica o registro completo, com os incidentes que originaram cada regra.

## Deploy para Produção
**Deploy AUTOMÁTICO na main desde 2026-08-06** (`ci.yml` job `deploy`): push na main → lint/build/test → publica o MESMO artefato testado no hosting. Motivo: correção ficava dias no git sem chegar ao hospital ("o bug corrigido voltou" = nunca tinha sido deployado — caso c2a11e2, 05→06/08). Secrets no GitHub: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ✅ (a anon key saiu do bundle PÚBLICO em `dist/assets/`, nunca do `.env.local`) · `FIREBASE_SERVICE_ACCOUNT_ANEST_AP` **só o dono cria** (chave-mestra gerada no Console → Contas de serviço). Sem ela o job falha no `action-hosting-deploy` e o deploy segue manual:
1. `npm run build` · 2. commit · 3. `git push origin main` · 4. `firebase deploy --only hosting:anest-ap`

NUNCA pular o `git push`. GitHub é fonte de verdade do histórico. **Gate de CI `regressao-escala`**: mudança em código da escala cirúrgica sem teste junto FALHA (o tema "isolar por turno" foi corrigido 3× em 2 dias e só a correção sem teste regrediu); dispensa explícita com `[sem-teste: motivo]` na mensagem do commit. O gate barra merge, não deploy. **Branch protection na main (08/08):** só esse check é obrigatório, force-push e deleção bloqueados, `enforce_admins: false` (o dono continua empurrando direto — o objetivo é impedir reescrita de histórico, não criar burocracia).

⚠️ **A suíte roda em `America/Sao_Paulo`** (`test.env.TZ` no `vite.config.js`), não no UTC do runner. Os testes da escala congelam um INSTANTE (`2026-07-28T10:00:00-03:00`), que em UTC vira 13h — turno vespertino — e as fixtures matutinas caíam: 28 testes vermelhos no CI e verdes no Mac, com o `Test` reprovado (e o deploy "skipped") em TODO commit de 05 a 08/08. Como toda regra de horário do app é escrita em BRT (turno, fase noturna 19h/23h, rollover 07h, crons 18h/20h30), fixar o fuso de produção é o que faz CI e máquina local verem o mesmo relógio. **Sintoma a reconhecer: "passa aqui, falha lá" em teste com data/hora = fuso, antes de qualquer outra hipótese.**

**Cada deploy renomeia os hashes e as 137 páginas são `React.lazy`** — cliente no bundle velho pede um chunk que não existe mais e recebe `index.html` (200, `text/html`), então a rota não renderiza. A recuperação em `errorReporting.js` é **one-shot por sessão** (chave `anest-chunk-reload-attempted`, nunca rearmada): o 1º erro do dia gasta o reload e os deploys seguintes ficam sem rede. Daí: **evitar deploy com turno em andamento** e, quando houver, avisar para fechar e reabrir o app. O `regex: "^/[^.]*$"` no `firebase.json` é o que impede o index velho de ficar 1h em cache — o casamento de header usa a URL REQUISITADA e acontece ANTES do rewrite, então `source: "/index.html"` NÃO alcança `/` nem `/escala-cirurgica` (incidente 29/07). Mudança só de header pode ir sozinha, sem rebuild: mesmo `dist` = mesmo `buildId` = ninguém recarregado.


## Padrões de execução por Wave (CRÍTICO para tarefas multi-step)
**Para wave/feature com 5+ tarefas:** seguir `@docs/wave-execution-playbook.md`. Consolida:
1. Workflow **Explore → Plan → Implement → Commit** (Anthropic best-practice)
2. Pre-flight obrigatório com 3 agentes paralelos (libs + map files + gaps arquiteturais)
3. Validar SQL com `migration-validator` agent ANTES de aplicar
4. Migration via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>` (NÃO `supabase db push` — CLI não instalado)
5. `AskUserQuestion` para decisões arquiteturais (não assumir)
6. `TaskCreate` granular + `TaskUpdate` em tempo real
7. Build verde a cada bloco lógico (checkpoint)
8. Commits granulares por bloco (deps / backend / UX / DS tokens)
9. Cloud Function deploy é tarefa DO USER (secrets via `firebase functions:secrets:set`)
10. Modal DS API: `title`/`description`/`footer` props (sem ModalHeader/Content/Footer)

