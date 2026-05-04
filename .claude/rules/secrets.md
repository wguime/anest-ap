---
globs: ["**"]
description: Higiene de secrets — agente nunca vê valores de credenciais. Lê só metadados, invoca CLIs autenticadas, redireciona geração/setup para o usuário via dashboard web.
---

# Secret Hygiene — ANEST

> Tudo que aparece em stdout de Bash, em retorno de Read, ou em tool result entra no contexto da API Anthropic e fica em transcripts. Um secret exposto em chat é equivalente a um secret commitado no GitHub: precisa rotacionar.

## Modelo mental

Secrets vivem **fora do contexto do agente**, em três camadas:

| Camada | Onde | Lido por |
|---|---|---|
| Dev local | `.env.local` (gitignored), `~/.supabase/`, `~/.config/gh/`, `~/.config/firebase/` | Vite, Node, CLIs autenticadas |
| CI / Actions | GitHub Secrets (dashboard) | runner do workflow |
| Produção | Supabase Edge Function Secrets, Firebase Functions config | a função/edge no servidor |

O agente **invoca consumidores** (scripts, CLIs, deploys); o consumidor lê o secret do lugar dele. O agente nunca segura o valor.

## Proibido

- **Ler arquivos de env/credenciais** com `Read`, `cat`, `head`, `tail`, `less`, `more`, `bat`, `grep`, `awk`, `sed`, `cut`. Aplica-se a: `.env`, `.env.local`, `.env.*.local`, `.env.production`, qualquer `*credentials*.json`, `*service-account*.json`, `*adminsdk*.json`, `~/.supabase/**`, `~/.config/gh/**`, `~/.config/firebase/**`, `~/.aws/**`, `~/.ssh/**`.
- `echo $VAR` / `printf "%s" "$VAR"` quando o nome de `VAR` contém `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `API_KEY`, `CREDENTIAL`, `JWT_SECRET`.
- `printenv` ou `env` sem filtro (lista TODAS as vars).
- `openssl rand`, `head /dev/urandom`, `pwgen`, `uuidgen` sem pipe direto pra um consumidor — se o valor vai virar secret, **delegue pro usuário gerar no terminal dele e setar via dashboard web**.
- Salvar secret em arquivo temporário e depois lê-lo com `cat` para passar adiante.

**Why:** `.env.example` é commitado e é a fonte da verdade dos *nomes*. Os *valores* nunca precisam estar no contexto do agente — só no consumidor.

## Permitido (presença sem valor)

```bash
[ -n "$VAR" ] && echo set || echo missing       # confirma var existe sem imprimir valor
grep -c '^NOME=' .env.local                      # retorna 0/1, nunca o valor
gh secret list                                    # lista nomes no GitHub
gh auth status                                    # confirma login
npx supabase secrets list --project-ref <REF>    # lista nomes no Supabase
firebase projects:list                            # confirma login Firebase
```

Para saber quais secrets o projeto consome, leia `.env.example` (commitado) e o YAML dos workflows (`.github/workflows/*.yml` referencia secrets por nome).

## Rotação / criação de secret novo

Quando um secret precisa ser criado ou rotacionado, o agente **não gera o valor**. Roteiro pro usuário:

1. **No terminal do usuário** (qualquer aba que NÃO esteja rodando Claude Code):
   ```bash
   openssl rand -hex 32
   ```
   O valor aparece. Usuário seleciona e copia.

2. **Setar via dashboard web** (não CLI, evita shell history e `ps`):
   - Supabase: `https://supabase.com/dashboard/project/<REF>/settings/functions` → Secrets → Add new secret → cola.
   - GitHub: `https://github.com/<OWNER>/<REPO>/settings/secrets/actions` → New repository secret → cola.
   - Firebase Functions config: `firebase functions:secrets:set NOME` (lê stdin sem ecoar).

3. **Limpar:** `pbcopy < /dev/null && clear` no terminal do usuário; fechar a aba pra eliminar scrollback.

4. **Agente confirma presença** (sem ver valor) com os comandos da seção "Permitido".

## Se um secret vazar (em chat ou em commit)

1. Pare imediatamente. Avise o usuário.
2. Não use o valor vazado em lugar nenhum.
3. Roteiro de rotação: gerar valor novo (passo acima), atualizar em todos os lugares que consomem (Supabase + GitHub + qualquer outro), invalidar o antigo onde aplicável.
4. Se vazou em commit, force-push **não** resolve (já está em forks/clones/cache do GitHub). Rotacione, sempre.

## Como aplicar

Antes de rodar qualquer comando que toque arquivo de env, var de ambiente, ou CLI autenticada, pergunte: **isso imprime o secret ou só consome?** Se imprime, recuse e proponha alternativa da seção "Permitido". Se só consome (`node script.mjs` que lê `process.env.X` internamente), prossiga normalmente — o agente não vê o valor.
