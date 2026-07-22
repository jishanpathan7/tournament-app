#!/usr/bin/env bash
#
# Run Alembic against the production database from your own terminal.
#
# Normally you should NOT need this — `preDeployCommand` in apps/api/railway.toml
# migrates on every deploy. This exists for the times you need to inspect or
# repair prod directly: checking what version it is on, or applying a migration
# without shipping a deploy.
#
# Credentials live in .env.prod at the repo root (gitignored). Create it once:
#
#     DIRECT_URL='postgresql+asyncpg://USER:PASS@db.<ref>.supabase.co:5432/postgres'
#
# Use Supabase's DIRECT connection (port 5432), never the pooler (6543) —
# Alembic holds a transaction across DDL, which the pooler will not do reliably.
#
# Usage:
#     scripts/migrate-prod.sh current      # what version is prod on?
#     scripts/migrate-prod.sh history      # what migrations exist?
#     scripts/migrate-prod.sh upgrade head # apply everything outstanding
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.prod"
API_DIR="$ROOT/apps/api"
ALEMBIC="$API_DIR/.venv/bin/alembic"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  echo "Create it with a single line:" >&2
  echo "  DIRECT_URL='postgresql+asyncpg://USER:PASS@db.<ref>.supabase.co:5432/postgres'" >&2
  exit 1
fi

if [[ ! -x "$ALEMBIC" ]]; then
  echo "No alembic at $ALEMBIC — activate/install the API venv first." >&2
  exit 1
fi

# `set -a` exports everything the file defines, so DIRECT_URL reaches alembic.
# Sourcing (rather than inlining on the command line) keeps the password out of
# your shell history and out of `ps` output.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "$ENV_FILE does not define DIRECT_URL" >&2
  exit 1
fi

# Show which database, never the password.
HOST="$(printf '%s' "$DIRECT_URL" | sed -E 's#.*@([^/?]+).*#\1#')"
echo "▶ target: $HOST"

ACTION=("${@:-current}")
[[ $# -eq 0 ]] && ACTION=(current)

# Anything that writes gets a confirmation. `current`/`history` are read-only.
case "${ACTION[0]}" in
  upgrade | downgrade | stamp | merge)
    echo "▶ about to run: alembic ${ACTION[*]}  against PRODUCTION"
    read -r -p "  type the host to confirm: " typed
    if [[ "$typed" != "$HOST" ]]; then
      echo "  mismatch — aborted." >&2
      exit 1
    fi
    ;;
esac

cd "$API_DIR"
exec "$ALEMBIC" "${ACTION[@]}"
