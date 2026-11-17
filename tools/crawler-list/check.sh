#!/usr/bin/env bash
# Asks a real nginx, with this checkout's nginx.conf, who it takes for a robot: every line of agents.tsv
# must come out as its first column says. Needs Docker. From Git Bash, anywhere:
#   tools/crawler-list/check.sh
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
out=$(MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(dir "$here/../../nginx.conf"):/etc/nginx/conf.d/default.conf:ro" \
  -v "$(dir "$here/agents.tsv"):/agents.tsv:ro" \
  -v "$(dir "$here/who.sh"):/who.sh:ro" nginx:alpine-slim sh /who.sh)
echo "$out" | grep -v '^checked' || true
if echo "$out" | grep -q WRONG; then echo "crawler list: FAILED"; exit 1; fi
if ! echo "$out" | grep -q '^checked'; then echo "crawler list: the check did not run"; exit 2; fi
echo "crawler list: $(echo "$out" | grep '^checked') user agents, all as agents.tsv says"
