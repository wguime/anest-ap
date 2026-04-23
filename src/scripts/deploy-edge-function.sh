#!/bin/bash
# Deploy da Edge Function schedule-shift-reminders.
#
# Uso:
#   SUPABASE_ACCESS_TOKEN=sbp_... bash src/scripts/deploy-edge-function.sh
#
# Ou edite a variável abaixo direto e rode:
#   bash src/scripts/deploy-edge-function.sh

set -e

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "ERRO: export SUPABASE_ACCESS_TOKEN='sbp_...' antes de rodar este script."
  echo "PAT gera-se em https://supabase.com/dashboard/account/tokens"
  exit 1
fi

PROJECT_REF="vjzrahruvjffyyqyhjny"
FUNCTION_NAME="schedule-shift-reminders"

echo "Fazendo deploy de '$FUNCTION_NAME' para projeto $PROJECT_REF..."
npx --yes supabase functions deploy "$FUNCTION_NAME" \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "✓ Deploy concluído."
echo ""
echo "Endpoint: https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME"
