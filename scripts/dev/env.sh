#!/usr/bin/env bash

DEV_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${DEV_SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=versions.sh
source "${DEV_SCRIPT_DIR}/versions.sh"

TOOLS_DIR="${PROJECT_ROOT}/.tools"

export PATH="${TOOLS_DIR}/bin:${PATH}"
export GOROOT="${TOOLS_DIR}/go/${GO_VERSION}"
export GOPATH="${TOOLS_DIR}/go-path"
export GOMODCACHE="${TOOLS_DIR}/cache/go-mod"
export GOCACHE="${TOOLS_DIR}/cache/go-build"
export GOTOOLCHAIN="local"
export HUGO_CACHEDIR="${TOOLS_DIR}/cache/hugo"
export npm_config_cache="${TOOLS_DIR}/cache/npm"

unset DEV_SCRIPT_DIR
