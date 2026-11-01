#!/usr/bin/env bash
# Thin wrapper around `docker compose` for this project's stack.
#
# Why it exists: macOS filesystems are case-insensitive, so a shell can end up in
# /volumes/projects/... instead of /Volumes/Projects/.... Compose resolves bind mounts
# from that spelling, and Docker Desktop's file-sharing allowlist IS case-sensitive,
# so the mount is rejected. `/bin/pwd -P` (getcwd) returns the on-disk spelling;
# bash's builtin `pwd -P` does not, it only resolves symlinks.
#
# Passing that path to `-f` is not enough: Compose (Go) takes the working directory
# from $PWD whenever it points at the same directory, keeping the shell's spelling.
# `cd` into the canonical path updates $PWD as well, so every path Compose derives
# is correct.
set -euo pipefail
DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd -P)"
cd "$DOCKER_DIR"
exec docker compose -f docker-compose.yml "$@"
