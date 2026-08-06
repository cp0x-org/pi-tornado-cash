#!/usr/bin/env bash
# Entry point for the cache-updater container (see docker-compose.yml).
# Runs a full cache update on start, then repeats every UPDATE_INTERVAL_SECONDS
# (default: 604800 = 7 days). Only Ethereum mainnet (netId 1) is active.
set -u

INTERVAL="${UPDATE_INTERVAL_SECONDS:-604800}"
NET_ID="${UPDATE_NET_ID:-1}"

echo "cache-updater started: netId=${NET_ID}, interval=${INTERVAL}s"

# bind-mount каталоги (./data/*) при первом запуске пустые — Docker не копирует
# в них содержимое образа. Засеваем их кешами из dist/ (создан на этапе сборки
# командой yarn generate и не перекрыт маунтами).
for dir in events trees governance-cache; do
  if [ -d "dist/$dir" ] && [ -z "$(ls -A "static/$dir" 2>/dev/null)" ]; then
    echo "seeding static/$dir from image copy"
    cp -a "dist/$dir/." "static/$dir/"
  fi
done

while true; do
  bash ./scripts/updateCaches.sh "$NET_ID" || echo "cache update failed, will retry next cycle"
  echo "next cache update at $(date -u -d "@$(($(date +%s) + INTERVAL))" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -r "$(($(date +%s) + INTERVAL))" '+%Y-%m-%d %H:%M:%S') UTC"
  sleep "$INTERVAL"
done
