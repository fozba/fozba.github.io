#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=env.sh
source "${SCRIPT_DIR}/env.sh"

if [[ ! -x "${TOOLS_DIR}/bin/hugo" ]]; then
  printf 'Local Hugo is missing. Run `make setup` first.\n' >&2
  exit 1
fi

cd -- "${PROJECT_ROOT}"
exec "${TOOLS_DIR}/bin/hugo" "$@"
