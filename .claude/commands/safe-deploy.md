---
description: Deploy guardrail — roda build, mostra status git, pede confirmação antes do commit e do push que publicam pelo CI
allowed-tools: Bash, Read
argument-hint: "[--dry-run]"
---

# /safe-deploy

Versão guardrail do deploy do ANEST. Executa a sequência do CLAUDE.md (o push na main publica pelo CI), mas **pausa antes do commit e do push** para confirmação humana.

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
   - git add <arquivos deste trabalho> && git commit -m "deploy: <descrição>"
   - git push origin main  (o job `deploy` do ci.yml publica)
   ```

6. **Aguardar confirmação do usuário** antes de executar o passo 7.
   Se `--dry-run` foi passado em `$ARGUMENTS`, NÃO executar o passo 7 — apenas mostrar resumo.

7. **Publicar após OK** — o push na main dispara o job `deploy` do `ci.yml`, que roda lint/build/test e publica o MESMO artefato testado
   1. Pedir descrição do deploy ao usuário
   2. `git add` só dos arquivos deste trabalho — o working tree é compartilhado entre sessões e `git add -A` levaria trabalho alheio para o commit
   3. `git commit -m "deploy: <descrição>"` e conferir `git log origin/main..HEAD` antes do push
   4. `git push origin main`
   5. Acompanhar o job `deploy` (`gh run watch`) e confirmar a URL pública
   6. `firebase deploy --only hosting:anest-ap` só como fallback, se o job `deploy` falhar

## Argumentos

`$ARGUMENTS` pode conter:
- `--dry-run` — só mostra resumo, não executa o deploy

## Bloqueios automáticos
O hook `firebase deploy` em `.claude/settings.json` já alerta se HEAD diverge de origin/main. Esta command reforça com pause humano.
