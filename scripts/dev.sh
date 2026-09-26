#!/usr/bin/env zsh
set -euo pipefail

task_node_dir="/Users/oguzhanyildirtan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
task_tools_dir="/Users/oguzhanyildirtan/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"

if ! command -v node >/dev/null 2>&1; then
  export PATH="${task_node_dir}:${task_tools_dir}:${PATH}"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  print -u2 "Node.js 20+ ve pnpm kurulumu bulunamadı."
  exit 1
fi

exec pnpm dev
