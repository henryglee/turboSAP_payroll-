#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME=${QDRANT_CONTAINER_NAME:-qdrant-db}
QDRANT_IMAGE=${QDRANT_IMAGE:-docker.io/qdrant/qdrant}
QDRANT_TAG=${QDRANT_TAG:-latest}
DATA_DIR=${QDRANT_DATA_DIR:-"$PWD/.qdrant_data"}
HTTP_PORT=${QDRANT_HTTP_PORT:-6333}
GRPC_PORT=${QDRANT_GRPC_PORT:-6334}
PODMAN_BIN=${PODMAN_BIN:-podman}

log() {
  echo "[qdrant-setup] $*"
}

require_podman() {
  if ! command -v "$PODMAN_BIN" >/dev/null 2>&1; then
    log "Podman is required but not installed or not in PATH."
    exit 1
  fi
}

ensure_podman_connection() {
  if ! "$PODMAN_BIN" info >/dev/null 2>&1; then
    log "Unable to communicate with the Podman service."
    log "If you're on macOS/Windows, ensure the Podman machine VM is running via 'podman machine start'."
    log "You can inspect configured connections with 'podman system connection list'."
    exit 1
  fi
}

ensure_data_dir() {
  if [ ! -d "$DATA_DIR" ]; then
    mkdir -p "$DATA_DIR"
    log "Created data directory at $DATA_DIR"
  fi
}

container_exists() {
  "$PODMAN_BIN" container exists "$CONTAINER_NAME"
}

container_status() {
  "$PODMAN_BIN" inspect -f '{{.State.Status}}' "$CONTAINER_NAME"
}

start_existing_container() {
  local status
  status=$(container_status)
  if [ "$status" = "running" ]; then
    log "Container '$CONTAINER_NAME' is already running."
    return
  fi
  if [ "$status" = "paused" ]; then
    log "Container '$CONTAINER_NAME' is paused; unpausing."
    "$PODMAN_BIN" unpause "$CONTAINER_NAME"
    return
  fi
  log "Starting existing container '$CONTAINER_NAME'."
  "$PODMAN_BIN" start "$CONTAINER_NAME"
}

create_container() {
  log "Creating and starting new Qdrant container '$CONTAINER_NAME'."
  "$PODMAN_BIN" run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "$HTTP_PORT:6333" \
    -p "$GRPC_PORT:6334" \
    -v "$DATA_DIR:/qdrant/storage:Z" \
    "$QDRANT_IMAGE:$QDRANT_TAG"
}

main() {
  require_podman
  ensure_podman_connection
  ensure_data_dir

  if container_exists; then
    start_existing_container
  else
    create_container
  fi

  log "Qdrant is available at http://localhost:$HTTP_PORT"
}

main "$@"
