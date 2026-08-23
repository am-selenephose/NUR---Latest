#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKERFILE="$ROOT/apps/api/Dockerfile"
PYPROJECT="$ROOT/apps/api/pyproject.toml"
LOCK="$ROOT/apps/api/requirements.lock"

grep -Fq '[build-system]' "$PYPROJECT"
grep -Fq '"setuptools==75.6.0"' "$PYPROJECT"
grep -Fq '"wheel==0.45.1"' "$PYPROJECT"
grep -Fxq 'setuptools==75.6.0' "$LOCK"
grep -Fxq 'wheel==0.45.1' "$LOCK"
grep -Fq 'RUN pip install --no-cache-dir --no-deps --no-build-isolation .' "$DOCKERFILE"

printf 'api container build contract passed.\n'
