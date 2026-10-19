#!/usr/bin/env bash
set -euo pipefail
output=$(bash scripts/backfill-local.sh --help)
[[ "$output" == *"Usage: scripts/backfill-local.sh"* ]]
