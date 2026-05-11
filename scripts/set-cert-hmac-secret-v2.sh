#!/bin/bash
# Sprint 12 helper — gera fresh CERT_HMAC_SECRET_V2 e seta no Supabase.
#
# Por quê:
#   Sprint 11 moveu o secret antigo (CERT_HMAC_SECRET) pro Supabase mas o
#   valor é o mesmo que vazou em git history (commit b1bc502). A Sprint 12
#   adiciona uma versão V2 inédita, gerada agora, e introduz a edge
#   `sign-cert` que assina certs em V2. A edge `verify-cert-public` aceita
#   ambas as versões via campo `signatureVersion` no payload.
#
# Padrão de segurança (idem set-cert-hmac-secret.sh):
#   - Valor gerado FRESH via openssl rand -hex 32 (32 bytes hex = 256 bits)
#   - Escrito em arquivo temporário com perm 600
#   - Setado via `supabase secrets set --env-file` (NÃO via argv → não
#     vaza em `ps`, shell history, ou logs)
#   - Variável local sobrescrita após uso
#   - Trap garante remoção do arquivo no exit
#
# Uso:
#   SUPABASE_ACCESS_TOKEN=sbp_... bash scripts/set-cert-hmac-secret-v2.sh
#
# PAT: https://supabase.com/dashboard/account/tokens
#
# Após rodar este script:
#   npx supabase functions deploy verify-cert-public --no-verify-jwt --project-ref vjzrahruvjffyyqyhjny
#   npx supabase functions deploy sign-cert --project-ref vjzrahruvjffyyqyhjny

set -e

cd "$(dirname "$0")/.."

PROJECT_REF="vjzrahruvjffyyqyhjny"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "ERRO: export SUPABASE_ACCESS_TOKEN='sbp_...' antes de rodar."
  echo "PAT: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERRO: openssl não encontrado no PATH."
  exit 1
fi

# Gera valor fresh: 32 bytes = 64 chars hex.
SECRET=$(openssl rand -hex 32)

if [ -z "$SECRET" ] || [ "${#SECRET}" -ne 64 ]; then
  echo "ERRO: openssl falhou em gerar 64 chars hex."
  exit 1
fi

echo "✓ Secret V2 gerado (length=${#SECRET} chars, NÃO mostrado em stdout)"

# Escreve em arquivo temporário com permissões restritas, seta via
# --env-file (não trafega via argv → não vaza em ps), e remove no exit.
TMPENV=$(mktemp)
trap "rm -f '$TMPENV'" EXIT
chmod 600 "$TMPENV"
printf "CERT_HMAC_SECRET_V2=%s\n" "$SECRET" > "$TMPENV"

echo "Setando CERT_HMAC_SECRET_V2 no projeto ${PROJECT_REF}..."
npx --yes supabase secrets set --env-file "$TMPENV" --project-ref "$PROJECT_REF"

# Limpa variável local
SECRET=""
unset SECRET

echo ""
echo "✓ Concluído. Próximos passos (deploy das edge functions):"
echo ""
echo "  npx supabase functions deploy verify-cert-public --no-verify-jwt --project-ref ${PROJECT_REF}"
echo "  npx supabase functions deploy sign-cert --project-ref ${PROJECT_REF}"
echo ""
echo "Verificar que o secret foi setado (sem mostrar valor):"
echo "  npx supabase secrets list --project-ref ${PROJECT_REF}"
echo ""
echo "Rollback (se precisar):"
echo "  npx supabase secrets unset CERT_HMAC_SECRET_V2 --project-ref ${PROJECT_REF}"
echo "  npx supabase functions deploy verify-cert-public --no-verify-jwt --project-ref ${PROJECT_REF}"
echo "  (sign-cert continuará respondendo 500 secret_unavailable, e"
echo "   solicitarAssinaturaHMAC retorna null → emitirCertificado degrade"
echo "   gracefully: cert sem assinatura.)"
