#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_logged() {
  local name="$1"
  shift

  local safe_name="${name//[^a-zA-Z0-9_-]/-}"
  local log_file="${TMPDIR:-/tmp}/moonbash-${safe_name}.log"

  echo "[vercel-build] Running ${name}: $*"
  if "$@" >"${log_file}" 2>&1; then
    local warning_count
    warning_count="$(grep -c '^Warning:' "${log_file}" || true)"
    echo "[vercel-build] ${name} succeeded (${warning_count} warnings captured in ${log_file})"
  else
    local status=$?
    echo "[vercel-build] ${name} failed with exit code ${status}; full log follows:"
    cat "${log_file}"
    return "${status}"
  fi
}

if ! command -v moon >/dev/null 2>&1; then
  echo "[vercel-build] MoonBit toolchain not found, installing..."
  curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash
  export PATH="$HOME/.moon/bin:$PATH"
else
  echo "[vercel-build] Using existing MoonBit toolchain: $(command -v moon)"
fi

echo "[vercel-build] Moon version:"
moon version
echo "[vercel-build] Node version: $(node --version)"
echo "[vercel-build] pnpm version: $(pnpm --version)"
echo "[vercel-build] vp path: $(command -v vp)"

cd "${ROOT_DIR}"
echo "[vercel-build] Updating MoonBit registry index..."
moon -C src update

run_logged "MoonBit build" moon -C src build --target js --release

echo "[vercel-build] Building website bundle..."
vp build -c vite.website.config.ts
