#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-compose.observability.yaml}"
COMPOSE_PROJECT_NAME="${OBSERVABILITY_COMPOSE_PROJECT:-agent-gateway-observability-demo}"
DEMO_PORTS="${OBSERVABILITY_DEMO_PORTS:-3000 8080 9090 9464}"
failed=0

export COMPOSE_PROJECT_NAME

mark_failed() {
  failed=1
}

require_command() {
  command_name="$1"
  install_hint="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    printf "ok: %s is available\n" "$command_name"
    return 0
  fi

  printf "missing required command: %s\n" "$command_name" >&2
  printf "%s\n" "$install_hint" >&2
  mark_failed
  return 1
}

check_port() {
  port="$1"

  if node - "$port" <<'NODE'
const net = require("node:net");

const port = Number(process.argv[process.argv.length - 1]);
const server = net.createServer();
const timeout = setTimeout(() => process.exit(1), 1000);

server.once("error", () => {
  clearTimeout(timeout);
  process.exit(1);
});

server.once("listening", () => {
  server.close(() => {
    clearTimeout(timeout);
    process.exit(0);
  });
});

server.listen({ host: "0.0.0.0", port, exclusive: true });
NODE
  then
    printf "ok: port %s is available\n" "$port"
    return 0
  fi

  printf "port %s is already in use\n" "$port" >&2
  printf "Stop the process using port %s, or change OBSERVABILITY_DEMO_PORTS if you intentionally remapped the demo.\n" "$port" >&2
  mark_failed
  return 1
}

if require_command "docker" "Install Docker Desktop or Docker Engine, then retry make observability-smoke."; then
  if docker info >/dev/null 2>&1; then
    printf "ok: Docker daemon is reachable\n"
  else
    printf "Docker is installed but the daemon is not reachable\n" >&2
    printf "Start Docker, then retry make observability-smoke.\n" >&2
    mark_failed
  fi

  if docker compose version >/dev/null 2>&1; then
    printf "ok: Docker Compose plugin is available\n"
  else
    printf "Docker Compose is not available through 'docker compose'\n" >&2
    printf "Install the Docker Compose plugin, then retry make observability-smoke.\n" >&2
    mark_failed
  fi
fi

if require_command "node" "Install Node.js 22 or newer so the preflight can verify local port availability."; then
  for port in $DEMO_PORTS; do
    check_port "$port" || true
  done
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose -f "$COMPOSE_FILE" config >/dev/null 2>&1; then
    printf "ok: %s is a valid compose file\n" "$COMPOSE_FILE"
  else
    printf "failed to validate compose file: %s\n" "$COMPOSE_FILE" >&2
    mark_failed
  fi

  existing_containers="$(docker compose -f "$COMPOSE_FILE" ps --all --quiet 2>/dev/null || true)"
  if [ -n "$existing_containers" ]; then
    printf "observability demo containers already exist for compose project '%s'\n" "$COMPOSE_PROJECT_NAME" >&2
    printf "Run 'make observability-down' to remove stale demo containers before starting a fresh smoke run.\n" >&2
    docker compose -f "$COMPOSE_FILE" ps --all >&2 || true
    mark_failed
  else
    printf "ok: no stale observability demo containers found\n"
  fi
fi

if [ "$failed" -ne 0 ]; then
  printf "\nlocal observability preflight failed; fix the issues above before starting the demo stack.\n" >&2
  exit 1
fi

printf "\nlocal observability preflight passed\n"
