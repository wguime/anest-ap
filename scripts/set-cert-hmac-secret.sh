#!/bin/bash
# Sprint 11 helper — seta CERT_HMAC_SECRET no Supabase com o valor
# que vivia em educacaoService.js antes do refactor (commit b1bc502).
#
# Por quê: pós-refactor o segredo deixa de viver no bundle JS, mas para
# preservar a validade dos certificados já emitidos, o segredo no Supabase
# precisa ser o MESMO valor antigo. Este script extrai o valor de git
# history e seta via `supabase secrets set --env-file` (lê de arquivo,
# não argv → não vaza em `ps` ou shell history).
#
# Uso:
#   SUPABASE_ACCESS_TOKEN=sbp_... bash scripts/set-cert-hmac-secret.sh
#
# PAT: https://supabase.com/dashboard/account/tokens

set -e

cd "$(dirname "$0")/.."

PROJECT_REF="vjzrahruvjffyyqyhjny"
PRE_REFACTOR_SHA="b1bc502"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "ERRO: export SUPABASE_ACCESS_TOKEN='sbp_...' antes de rodar."
  echo "PAT: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERRO: python3 não encontrado no PATH."
  exit 1
fi

# Extrai o valor do segredo do commit pre-refactor. Captura o argumento de
# encoder.encode('...') na função verificarAssinatura. Imprime APENAS o
# valor (sem newline) — é capturado em variável e nunca aparece em stdout.
SECRET=$(git show "${PRE_REFACTOR_SHA}:src/services/educacaoService.js" 2>/dev/null \
  | python3 -c "
import sys, re
src = sys.stdin.read()
# Acha o bloco da função verificarAssinatura e o encoder.encode('...') dentro dele
m = re.search(r\"verificarAssinatura.*?encoder\.encode\('([^']+)'\).*?\{ name: 'HMAC'\", src, re.DOTALL)
if not m:
    sys.exit(1)
sys.stdout.write(m.group(1))
")

if [ -z "$SECRET" ]; then
  echo "ERRO: secret não encontrado no commit ${PRE_REFACTOR_SHA}."
  echo "Verifique se a branch local tem esse commit (git log b1bc502)."
  exit 1
fi

echo "✓ Secret extraído de ${PRE_REFACTOR_SHA} (length=${#SECRET} chars)"

# Escreve em arquivo temporário com permissões restritas, seta via
# --env-file (não traf­ega via argv → não vaza em ps), e remove no exit.
TMPENV=$(mktemp)
trap "rm -f '$TMPENV'" EXIT
chmod 600 "$TMPENV"
printf "CERT_HMAC_SECRET=%s\n" "$SECRET" > "$TMPENV"

echo "Setando CERT_HMAC_SECRET no projeto ${PROJECT_REF}..."
npx --yes supabase secrets set --env-file "$TMPENV" --project-ref "$PROJECT_REF"

# Limpa variável local
SECRET=""
unset SECRET

echo ""
echo "✓ Concluído. Próximos passos:"
echo "  npx supabase db push --linked --include-all"
echo "  npx supabase functions deploy verify-cert-public --no-verify-jwt --project-ref ${PROJECT_REF}"
