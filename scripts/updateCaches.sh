#!/usr/bin/env bash
# Updates ALL static caches for one network in the right order:
#   events (deposits/withdrawals) -> encrypted notes -> merkle trees -> zip -> governance.
# The individual yarn commands below still work on their own for manual use
# (see TORNADO_README.md), this script just chains them.
#
# Usage: ./scripts/updateCaches.sh [netId]   (default netId: 1 / Ethereum mainnet)
set -u

NET_ID="${1:-1}"
FAILED=0

run_step() {
  echo "==> $* ($(date -u '+%Y-%m-%d %H:%M:%S') UTC)"
  if ! "$@"; then
    echo "!! step failed: $*"
    FAILED=1
  fi
}

echo "Updating caches for netId ${NET_ID}"

run_step yarn update:events "$NET_ID"
run_step yarn update:encrypted "$NET_ID"

# merkle trees are only maintained for Ethereum mainnet
if [ "$NET_ID" = "1" ]; then
  run_step yarn update:tree "$NET_ID"
fi

run_step yarn update:zip
run_step yarn update:governance-cache "$NET_ID"

if [ "$FAILED" -ne 0 ]; then
  echo "Cache update finished WITH ERRORS (netId ${NET_ID})"
else
  echo "Cache update finished OK (netId ${NET_ID})"
fi

exit "$FAILED"
