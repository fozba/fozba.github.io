#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=versions.sh
source "${SCRIPT_DIR}/versions.sh"

TOOLS_DIR="${PROJECT_ROOT}/.tools"
BIN_DIR="${TOOLS_DIR}/bin"
DOWNLOAD_DIR="${TOOLS_DIR}/downloads"

die() {
  printf 'setup: %s\n' "$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || die "required system command not found: $1"
}

download() {
  local url="$1"
  local destination="$2"

  if [[ -s "${destination}" ]]; then
    return
  fi

  printf 'Downloading %s\n' "${url}"
  curl \
    --proto '=https' \
    --tlsv1.2 \
    --location \
    --fail \
    --show-error \
    --retry 3 \
    --retry-delay 2 \
    --output "${destination}.partial" \
    "${url}"
  mv -- "${destination}.partial" "${destination}"
}

verify_checksum() {
  local archive="$1"
  local expected="$2"
  printf '%s  %s\n' "${expected}" "${archive}" | sha256sum --check --status - || die "checksum failed for $(basename -- "${archive}")"
}

safe_replace_dir() {
  local destination="$1"
  local staged="$2"

  [[ "${destination}" == "${TOOLS_DIR}/"* ]] || die "refusing to replace a directory outside .tools"
  rm -rf -- "${destination}"
  mkdir -p -- "$(dirname -- "${destination}")"
  mv -- "${staged}" "${destination}"
}

need_command curl
need_command tar
need_command xz
need_command sha256sum
need_command awk

case "$(uname -s)" in
  Linux) platform="linux" ;;
  *) die "automatic setup currently supports Linux; install the pinned tools listed in scripts/dev/versions.sh manually on this platform" ;;
esac

case "$(uname -m)" in
  x86_64 | amd64)
    node_arch="x64"
    hugo_arch="amd64"
    go_arch="amd64"
    hugo_checksum="fa3ea49e0ca3dcc1f50b6976be0f96c15c17bc4a14278d605281d185f3022857"
    node_checksum="2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2"
    go_checksum="68097bd680839cbc9d464a0edce4f7c333975e27a90246890e9f1078c7e702ad"
    ;;
  aarch64 | arm64)
    node_arch="arm64"
    hugo_arch="arm64"
    go_arch="arm64"
    hugo_checksum="46e37c68e6c66416182b46f5624c73f99e71a0aaf04ca511be4b952055837021"
    node_checksum="5f4ddab610c1ab2016b3c227cebdbf6d9495161487e4739c7b90090595f465f7"
    go_checksum="756274ea4b68fa5535eb9fe2559889287d725a8da63c6aae4d5f23778c229f4b"
    ;;
  *) die "unsupported CPU architecture: $(uname -m)" ;;
esac

mkdir -p -- "${BIN_DIR}" "${DOWNLOAD_DIR}"

install_hugo() {
  local destination="${TOOLS_DIR}/hugo/${HUGO_VERSION}"
  local executable="${destination}/hugo"
  local archive_name="hugo_extended_${HUGO_VERSION}_${platform}-${hugo_arch}.tar.gz"
  local archive="${DOWNLOAD_DIR}/${archive_name}"
  local release_url="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}"
  local stage

  if [[ -x "${executable}" ]] && "${executable}" version | grep -q "hugo v${HUGO_VERSION}.*+extended"; then
    printf 'Hugo %s Extended is already installed.\n' "${HUGO_VERSION}"
    return
  fi

  download "${release_url}/${archive_name}" "${archive}"
  verify_checksum "${archive}" "${hugo_checksum}"

  stage="$(mktemp -d "${TOOLS_DIR}/.hugo-stage.XXXXXX")"
  tar -xzf "${archive}" -C "${stage}"
  [[ -x "${stage}/hugo" ]] || die "the Hugo archive did not contain an executable"
  safe_replace_dir "${destination}" "${stage}"
  "${executable}" version | grep -q "hugo v${HUGO_VERSION}.*+extended" || die "installed Hugo is not the expected Extended build"
  printf 'Installed Hugo %s Extended.\n' "${HUGO_VERSION}"
}

install_node() {
  local destination="${TOOLS_DIR}/node/${NODE_VERSION}"
  local executable="${destination}/bin/node"
  local archive_name="node-v${NODE_VERSION}-${platform}-${node_arch}.tar.xz"
  local archive="${DOWNLOAD_DIR}/${archive_name}"
  local release_url="https://nodejs.org/dist/v${NODE_VERSION}"
  local stage
  local unpacked

  if [[ -x "${executable}" ]] && [[ "$("${executable}" --version)" == "v${NODE_VERSION}" ]]; then
    printf 'Node %s is already installed.\n' "${NODE_VERSION}"
    return
  fi

  download "${release_url}/${archive_name}" "${archive}"
  verify_checksum "${archive}" "${node_checksum}"

  stage="$(mktemp -d "${TOOLS_DIR}/.node-stage.XXXXXX")"
  tar -xJf "${archive}" -C "${stage}"
  unpacked="${stage}/node-v${NODE_VERSION}-${platform}-${node_arch}"
  [[ -x "${unpacked}/bin/node" ]] || die "the Node archive did not contain an executable"
  safe_replace_dir "${destination}" "${unpacked}"
  rmdir -- "${stage}"
  [[ "$("${executable}" --version)" == "v${NODE_VERSION}" ]] || die "installed Node version did not match v${NODE_VERSION}"
  printf 'Installed Node %s.\n' "${NODE_VERSION}"
}

install_go() {
  local destination="${TOOLS_DIR}/go/${GO_VERSION}"
  local executable="${destination}/bin/go"
  local archive_name="go${GO_VERSION}.${platform}-${go_arch}.tar.gz"
  local archive="${DOWNLOAD_DIR}/${archive_name}"
  local stage

  if [[ -x "${executable}" ]] && "${executable}" version | grep -q "go${GO_VERSION} "; then
    printf 'Go %s is already installed.\n' "${GO_VERSION}"
    return
  fi

  download "https://go.dev/dl/${archive_name}" "${archive}"
  verify_checksum "${archive}" "${go_checksum}"

  stage="$(mktemp -d "${TOOLS_DIR}/.go-stage.XXXXXX")"
  tar -xzf "${archive}" -C "${stage}"
  [[ -x "${stage}/go/bin/go" ]] || die "the Go archive did not contain an executable"
  safe_replace_dir "${destination}" "${stage}/go"
  rmdir -- "${stage}"
  "${executable}" version | grep -q "go${GO_VERSION} " || die "installed Go version did not match ${GO_VERSION}"
  printf 'Installed Go %s.\n' "${GO_VERSION}"
}

install_hugo
install_node
install_go

ln -sfn -- "../hugo/${HUGO_VERSION}/hugo" "${BIN_DIR}/hugo"
ln -sfn -- "../node/${NODE_VERSION}/bin/node" "${BIN_DIR}/node"
ln -sfn -- "../node/${NODE_VERSION}/bin/npm" "${BIN_DIR}/npm"
ln -sfn -- "../node/${NODE_VERSION}/bin/npx" "${BIN_DIR}/npx"
ln -sfn -- "../go/${GO_VERSION}/bin/go" "${BIN_DIR}/go"
ln -sfn -- "../go/${GO_VERSION}/bin/gofmt" "${BIN_DIR}/gofmt"

# shellcheck source=env.sh
source "${SCRIPT_DIR}/env.sh"

if [[ "$(npm --version)" != "${NPM_VERSION}" ]]; then
  printf 'Installing npm %s into the project-local Node distribution.\n' "${NPM_VERSION}"
  npm install --global --prefix "${TOOLS_DIR}/node/${NODE_VERSION}" --no-audit --no-fund "npm@${NPM_VERSION}"
fi
[[ "$(npm --version)" == "${NPM_VERSION}" ]] || die "installed npm version did not match ${NPM_VERSION}"

lock_hash="$(sha256sum "${PROJECT_ROOT}/package-lock.json" | awk '{ print $1 }')"
dependency_stamp="node=${NODE_VERSION} npm=${NPM_VERSION} lock=${lock_hash}"
stamp_file="${TOOLS_DIR}/node-modules.stamp"

if [[ ! -d "${PROJECT_ROOT}/node_modules" ]] || [[ ! -f "${stamp_file}" ]] || [[ "$(<"${stamp_file}")" != "${dependency_stamp}" ]]; then
  printf 'Installing locked Node dependencies with npm ci.\n'
  (
    cd -- "${PROJECT_ROOT}"
    npm ci --no-audit --no-fund
  )
  printf '%s\n' "${dependency_stamp}" > "${stamp_file}"
else
  printf 'Node dependencies already match package-lock.json.\n'
fi

printf '\nLocal toolchain ready:\n'
printf '  %s\n' "$(hugo version)"
printf '  %s\n' "$(node --version)"
printf '  npm %s\n' "$(npm --version)"
printf '  %s\n' "$(go version)"
