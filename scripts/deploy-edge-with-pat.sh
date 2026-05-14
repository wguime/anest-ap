#!/usr/bin/env bash
# Deploy a Supabase edge function using SUPABASE_ACCESS_TOKEN from .env.local
# WITHOUT printing or echoing the token. Run as:
#   bash scripts/deploy-edge-with-pat.sh <function-name> [--no-verify-jwt]

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found" >&2
  exit 1
fi

# Source only the PAT; the file has many other vars but we only care about this.
# Using a subshell + export to avoid printing.
set -a
# shellcheck disable=SC1091
SUPABASE_ACCESS_TOKEN=$(awk -F= '/^SUPABASE_ACCESS_TOKEN=/{sub(/^SUPABASE_ACCESS_TOKEN=/,""); print; exit}' .env.local)
export SUPABASE_ACCESS_TOKEN
set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN not found in .env.local" >&2
  exit 1
fi

FN="${1:-}"
if [ -z "$FN" ]; then
  echo "Usage: $0 <function-name> [extra-flags...]" >&2
  exit 1
fi
shift

exec npx supabase functions deploy "$FN" --project-ref=vjzrahruvjffyyqyhjny "$@"
