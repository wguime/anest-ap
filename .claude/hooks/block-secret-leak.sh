#!/bin/bash
# Bloqueia comandos Bash que imprimiriam valores de secret no contexto do agente.
# Tripwire para acidentes — não é fortaleza contra intenção. Documenta o "por que" via permissionDecisionReason.
# Spec: .claude/rules/secrets.md

set -u

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

deny() {
  jq -nc --arg msg "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $msg
    }
  }'
  exit 0
}

# Comandos que imprimem conteúdo de arquivo
LEAK_TOOLS='cat|head|tail|less|more|bat|view|grep|egrep|fgrep|awk|sed|cut|nl|od|xxd|strings|hexdump'

# 1) Leitura de arquivos .env (exceto .env.example, que é commitado e tem só nomes)
if printf '%s' "$cmd" | grep -qE "(\b|^)($LEAK_TOOLS)[[:space:]]+[^|]*\.env(\.local|\.production|\.[a-z]+\.local|\$|[[:space:]])" \
   && ! printf '%s' "$cmd" | grep -qE '\.env\.example'; then
  deny "BLOQUEADO: leitura de .env imprime valor de secret no contexto. Para os NOMES dos secrets que o projeto consome, leia .env.example (commitado). Para confirmar que uma var está setada, carregue em subshell e teste presença: (set -a; . .env.local; set +a; [ -n \"\$NOME\" ] && echo set || echo missing)"
fi

# 2) Leitura de arquivos de credencial conhecidos
if printf '%s' "$cmd" | grep -qiE "(\b|^)($LEAK_TOOLS)[[:space:]]+[^|]*(credentials|service[-_]account|access[-_]token|adminsdk|firebase[-_]private|\\.npmrc|\\.pgpass|id_rsa|id_ed25519)"; then
  deny "BLOQUEADO: leitura de arquivo de credencial. Use 'gh auth status', 'supabase projects list', 'firebase projects:list' para confirmar autenticação sem ler o token."
fi

# 3) Leitura de diretórios de auth de CLIs
if printf '%s' "$cmd" | grep -qE "($LEAK_TOOLS)[[:space:]]+[^|]*(\\\$HOME|~|/Users/[^/[:space:]]+)/(\.supabase|\.config/gh|\.config/firebase|\.aws|\.ssh)/"; then
  deny "BLOQUEADO: leitura de diretório de credenciais de CLI. As CLIs leem isso sozinhas — agente não precisa."
fi

# 4) echo/printf de variável com nome sugestivo de secret
if printf '%s' "$cmd" | grep -qE "(\b|^)(echo|printf)[[:space:]]+[^|]*\\\$\{?[A-Za-z_]*([Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Pp][Rr][Ii][Vv][Aa][Tt][Ee][_-]?[Kk][Ee][Yy]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]|[Cc][Rr][Ee][Dd][Ee][Nn][Tt][Ii][Aa][Ll]|JWT_SECRET|ACCESS_KEY|REFRESH_TOKEN)[A-Za-z_]*\}?"; then
  deny "BLOQUEADO: 'echo \$VAR' com nome de secret imprime valor no contexto. Para confirmar presença: [ -n \"\$VAR\" ] && echo set || echo missing"
fi

# 5) printenv / env nu (sem var específica nem filtro)
if printf '%s' "$cmd" | grep -qE "(^|;|&&|\|\|)[[:space:]]*(printenv|env)[[:space:]]*($|;|&&|\|\|)"; then
  deny "BLOQUEADO: 'printenv' / 'env' sem filtro lista TODAS as variáveis, incluindo secrets. Use 'env | grep -c ^NOME=' (retorna contagem, não valor)."
fi

# 6) Geração de valor aleatório (potencial secret) sem pipe
if printf '%s' "$cmd" | grep -qE "\bopenssl[[:space:]]+rand[[:space:]]+(-hex|-base64)[[:space:]]+[0-9]+([[:space:]]*\$|[[:space:]]*;|[[:space:]]*&&|[[:space:]]*\|\|)"; then
  deny "BLOQUEADO: 'openssl rand' sem pipe imprime o valor gerado. Se for pra virar secret, peça ao usuário gerar no terminal dele e setar via dashboard web (Supabase / GitHub / Firebase). Para outros usos, pipe pra consumidor (| ..., > /tmp/...)."
fi

# 7) head /dev/urandom — mesma classe
if printf '%s' "$cmd" | grep -qE "head[[:space:]]+[^|]*/dev/(urandom|random)([[:space:]]*\$|[[:space:]]*;|[[:space:]]*&&|[[:space:]]*\|\|)"; then
  deny "BLOQUEADO: leitura de /dev/urandom sem pipe imprime entropia bruta. Se for pra gerar secret, delegue ao usuário."
fi

# Default: permite
exit 0
