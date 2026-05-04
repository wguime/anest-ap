---
description: Deploy guardrail — roda build, mostra status git, pede confirmação antes do firebase deploy
allowed-tools: Bash, Read
argument-hint: "[--dry-run]"
---

# /safe-deploy

Versão guardrail do deploy do ANEST. Executa a sequência obrigatória do CLAUDE.md, mas **pausa antes do `firebase deploy`** para confirmação humana.

## Sequência

1. **Verificar branch atual**
   - `git rev-parse --abbrev-ref HEAD` — deve ser `main`
   - Se não for main, ABORTAR e informar usuário

2. **Verificar estado do working tree**
   - `git status --short` — listar arquivos não commitados
   - Mostrar contagem ao usuário

3. **Build de produção**
   - `npm run build`
   - Se falhar: ABORTAR. Mostrar erro de build.

4. **Lint check**
   - `npm run lint`
   - Se houver erros: avisar mas não abortar (o usuário decide)

5. **Mostrar resumo**
   ```
   Branch: main
   Files modified: N
   Build: ✓
   Lint: ✓ ou ⚠️ X warnings
   
   Próximas ações:
   - git add -A && git commit -m "deploy: <descrição>"
   - git push origin main
   - firebase deploy --only hosting:anest-ap
   ```

6. **Aguardar confirmação do usuário** antes de executar 6.1, 6.2, 6.3.
   Se `--dry-run` foi passado em `$ARGUMENTS`, NÃO executar 6 — apenas mostrar resumo.

7. **Executar deploy completo após OK**
   1. `git add -A`
   2. Pedir descrição do deploy ao usuário
   3. `git commit -m "deploy: <descrição>"`
   4. `git push origin main`
   5. `firebase deploy --only hosting:anest-ap`
   6. Confirmar URL pública e versão deployada

## Argumentos

`$ARGUMENTS` pode conter:
- `--dry-run` — só mostra resumo, não executa o deploy

## Bloqueios automáticos
O hook `firebase deploy` em `.claude/settings.json` já alerta se HEAD diverge de origin/main. Esta command reforça com pause humano.
