#!/usr/bin/env sh
set -eu

. docs/deployment/container-example/env.sh

COMPOSE_PROJECT_NAME="$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT"
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
  printf "Stop the process using port %s, or change DEPLOYMENT_EXAMPLE_GATEWAY_PORT in %s if you intentionally remapped the deployment example.\n" "$port" "$DEPLOYMENT_EXAMPLE_ENV_FILE" >&2
  mark_failed
  return 1
}

check_secret_file() {
  secret_file="$1"

  if [ ! -r "$secret_file" ]; then
    printf "secret file is not readable: %s\n" "$secret_file" >&2
    mark_failed
    return 1
  fi

  if [ ! -s "$secret_file" ]; then
    printf "secret file is empty: %s\n" "$secret_file" >&2
    mark_failed
    return 1
  fi

  if node - "$secret_file" <<'NODE'
const fs = require("node:fs");

const file = process.argv[process.argv.length - 1];
const value = fs.readFileSync(file, "utf8").trim();

process.exit(value.length > 0 ? 0 : 1);
NODE
  then
    printf "ok: secret file is readable and non-empty: %s\n" "$secret_file"
    return 0
  fi

  printf "secret file is blank after trimming whitespace: %s\n" "$secret_file" >&2
  mark_failed
  return 1
}

check_gateway_request_token() {
  if node - "$DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE" "$AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN" <<'NODE'
const fs = require("node:fs");

const file = process.argv[process.argv.length - 2];
const requestToken = process.argv[process.argv.length - 1];
let value;

try {
  value = fs.readFileSync(file, "utf8");
} catch {
  process.exit(1);
}

const tokens = value
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);

process.exit(tokens.includes(requestToken) ? 0 : 1);
NODE
  then
    printf "ok: deployment request token is present in gateway API keys file\n"
    return 0
  fi

  printf "gateway API keys file does not include the deployment request token\n" >&2
  printf "Add the token to %s, or set AGENT_GATEWAY_DEPLOYMENT_EXAMPLE_TOKEN to one of the configured gateway API keys.\n" "$DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE" >&2
  mark_failed
  return 1
}

if require_command "docker" "Install Docker Desktop or Docker Engine, then retry make deployment-smoke."; then
  if docker info >/dev/null 2>&1; then
    printf "ok: Docker daemon is reachable\n"
  else
    printf "Docker is installed but the daemon is not reachable\n" >&2
    printf "Start Docker, then retry make deployment-smoke.\n" >&2
    mark_failed
  fi

  if docker compose version >/dev/null 2>&1; then
    printf "ok: Docker Compose plugin is available\n"
  else
    printf "Docker Compose is not available through 'docker compose'\n" >&2
    printf "Install the Docker Compose plugin, then retry make deployment-smoke.\n" >&2
    mark_failed
  fi
fi

if require_command "node" "Install Node.js 22 or newer so the preflight can verify local port availability and secret file contents."; then
  for port in $DEPLOYMENT_EXAMPLE_PORTS; do
    check_port "$port" || true
  done

  for secret_file in $DEPLOYMENT_EXAMPLE_SECRET_FILES; do
    check_secret_file "$secret_file" || true
  done

  check_gateway_request_token || true
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" config >/dev/null 2>&1; then
    printf "ok: %s is a valid compose file\n" "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE"
  else
    printf "failed to validate compose file: %s\n" "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" >&2
    mark_failed
  fi

  existing_containers="$(docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" ps --all --quiet 2>/dev/null || true)"
  if [ -n "$existing_containers" ]; then
    printf "deployment example containers already exist for compose project '%s'\n" "$COMPOSE_PROJECT_NAME" >&2
    printf "Run 'make deployment-down' to remove stale deployment containers before starting a fresh smoke run.\n" >&2
    docker compose -f "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE" ps --all >&2 || true
    mark_failed
  else
    printf "ok: no stale deployment example containers found\n"
  fi
fi

if [ "$failed" -ne 0 ]; then
  printf "\ndeployment example preflight failed; fix the issues above before starting the deployment stack.\n" >&2
  exit 1
fi

printf "\ndeployment example preflight passed\n"
