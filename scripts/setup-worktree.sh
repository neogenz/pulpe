#!/bin/bash
# setup-worktree.sh
# Claude Code SessionStart hook. Bootstraps a linked worktree the first time a
# session opens in it: install dependencies, then sync skills. Mirrors the
# [setup] script of .codex/environments/environment.toml.
#
# .env files are not handled here: .worktreeinclude covers worktrees Claude Code
# creates, pulpe-sync-env-on-worktree-start.sh covers the others.

set -u

input="$(/bin/cat)"

jq_bin=/opt/homebrew/bin/jq
[[ -x "$jq_bin" ]] || jq_bin=/usr/local/bin/jq
[[ -x "$jq_bin" ]] || exit 0

cwd="$("$jq_bin" -er '.cwd | select(type == "string" and length > 0)' <<<"$input" 2>/dev/null)" || exit 0
root="$(/usr/bin/git -C "$cwd" rev-parse --path-format=absolute --show-toplevel 2>/dev/null)" || exit 0

# Linked worktrees only. The main checkout has a .git directory, not a .git file.
[[ -f "$root/.git" && ! -L "$root/.git" ]] || exit 0
[[ -f "$root/pnpm-workspace.yaml" && -x "$root/scripts/install-skills.sh" ]] || exit 0

marker="$(/usr/bin/git -C "$root" rev-parse --path-format=absolute --git-path pulpe-worktree-setup 2>/dev/null)" || exit 0
[[ ! -e "$marker" ]] || exit 0

command -v pnpm >/dev/null 2>&1 || {
  printf 'Worktree setup skipped: pnpm is not on PATH.\n' >&2
  exit 0
}

cd "$root" || exit 0

if ! pnpm install --frozen-lockfile >&2; then
  printf "Worktree setup failed. Run 'pnpm install --frozen-lockfile' in %s.\\n" "$root" >&2
  exit 0
fi

# The marker is only written once both steps land, so a skills source that was
# briefly unreachable retries next session. A satisfied install costs ~2s.
if ./scripts/install-skills.sh >&2; then
  /usr/bin/touch "$marker"
  printf 'Worktree ready: dependencies installed and skills synced.\n'
else
  printf 'Worktree ready: dependencies installed. Skills sync failed, it retries next session.\n'
fi
