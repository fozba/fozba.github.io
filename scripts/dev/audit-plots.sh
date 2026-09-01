#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

for required_command in awk find grep gzip mktemp sort wc; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    printf 'audit-plots: required command not found: %s\n' "${required_command}" >&2
    exit 2
  fi
done

human_size() {
  awk -v bytes="$1" 'BEGIN {
    split("B KiB MiB GiB", units, " ");
    value = bytes;
    unit = 1;
    while (value >= 1024 && unit < 4) {
      value /= 1024;
      unit++;
    }
    if (unit == 1) printf "%d %s", value, units[unit];
    else printf "%.1f %s", value, units[unit];
  }'
}

declare -a scan_files=()
declare -a report_files=()

collect_files() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    scan_files+=("${target}")
    report_files+=("${target}")
  elif [[ -d "${target}" ]]; then
    while IFS= read -r -d '' file; do
      scan_files+=("${file}")
      report_files+=("${file}")
    done < <(find "${target}" -type f -print0)
  else
    printf 'audit-plots: path does not exist: %s\n' "${target}" >&2
    exit 2
  fi
}

if (( $# > 0 )); then
  for supplied_path in "$@"; do
    if [[ "${supplied_path}" = /* ]]; then
      collect_files "${supplied_path}"
    else
      collect_files "${PROJECT_ROOT}/${supplied_path}"
    fi
  done
else
  # Audit source files even when a build is present so an old public/ directory
  # cannot hide a newly embedded runtime.
  for source_path in static/portfolio layouts/portfolio content/portfolio; do
    [[ -d "${PROJECT_ROOT}/${source_path}" ]] || continue
    while IFS= read -r -d '' file; do
      scan_files+=("${file}")
    done < <(
      find "${PROJECT_ROOT}/${source_path}" -type f -print0
    )
  done

  if [[ -d "${PROJECT_ROOT}/public/portfolio" ]]; then
    while IFS= read -r -d '' file; do
      scan_files+=("${file}")
      report_files+=("${file}")
    done < <(find "${PROJECT_ROOT}/public/portfolio" -type f -print0)
  else
    # Before the first build, report source payloads instead.
    report_files=("${scan_files[@]}")
  fi
fi

if (( ${#scan_files[@]} == 0 )); then
  printf 'Plot payload audit failed: no portfolio files found.\n' >&2
  printf 'Expected the portfolio source directories, or pass paths explicitly.\n' >&2
  exit 2
fi

embedded=0
for file in "${scan_files[@]}"; do
  case "${file,,}" in
    *.html | *.htm)
      # Plotly-generated embedded bundles contain this version banner. The
      # factory marker catches minified bundles whose banner was stripped.
      if LC_ALL=C grep -aEq 'plotly\.js v[0-9]+|root\.moduleName[[:space:]]*=[[:space:]]*factory' "${file}"; then
        relative="${file#"${PROJECT_ROOT}/"}"
        printf 'ERROR: embedded Plotly runtime: %s\n' "${relative}" >&2
        embedded=1
      fi
      ;;
  esac
done

size_table="$(mktemp "${TMPDIR:-/tmp}/portfolio-size-audit.XXXXXX")"
trap 'rm -f -- "${size_table}"' EXIT

total_raw=0
total_gzip=0
for file in "${report_files[@]}"; do
  raw_bytes="$(wc -c < "${file}")"
  gzip_bytes="$(gzip -9 -n -c -- "${file}" | wc -c)"
  relative="${file#"${PROJECT_ROOT}/"}"
  printf '%s\t%s\t%s\n' "${raw_bytes}" "${gzip_bytes}" "${relative}" >> "${size_table}"
  total_raw=$((total_raw + raw_bytes))
  total_gzip=$((total_gzip + gzip_bytes))
done

printf '\nPortfolio payload sizes (largest first)\n'
printf '%-11s %-11s %s\n' 'RAW' 'GZIP' 'FILE'
while IFS=$'\t' read -r raw_bytes gzip_bytes relative; do
  printf '%-11s %-11s %s\n' "$(human_size "${raw_bytes}")" "$(human_size "${gzip_bytes}")" "${relative}"
done < <(sort -t $'\t' -k1,1nr "${size_table}")
printf '%-11s %-11s %s\n' "$(human_size "${total_raw}")" "$(human_size "${total_gzip}")" 'TOTAL'

if (( embedded != 0 )); then
  printf '\nPlot payload audit failed: embedded Plotly runtimes must be replaced by the shared runtime.\n' >&2
  exit 1
fi

printf '\nPlot payload audit passed: no embedded Plotly runtime detected.\n'
