#!/usr/bin/env sh
set -eu

. docs/deployment/container-example/env.sh

DEFAULT_GATEWAY_API_KEYS_EXAMPLE="./docs/deployment/container-example/secrets/gateway-api-keys.example"
DEFAULT_OPENAI_API_KEY_EXAMPLE="./docs/deployment/container-example/secrets/openai-api-key.example"

failed=0

mark_failed() {
  failed=1
}

print_ok() {
  printf "ok: %s\n" "$1"
}

print_missing() {
  printf "missing: %s\n" "$1" >&2
  mark_failed
}

print_command_order() {
  printf "\npreferred manual command order\n"
  printf "1. make deployment-bootstrap-secrets\n"
  printf "2. make deployment-checklist\n"
  printf "3. make deployment-preflight\n"
  printf "4. make deployment-config\n"
  printf "5. make deployment-up\n"
  printf "6. make deployment-ready\n"
  printf "7. make deployment-request\n"
  printf "8. make deployment-diagnose\n"
  printf "9. make deployment-down\n"
}

check_env_file() {
  if [ -f "$DEPLOYMENT_EXAMPLE_ENV_FILE" ]; then
    print_ok "deployment env file exists: $DEPLOYMENT_EXAMPLE_ENV_FILE"
    return 0
  fi

  print_missing "deployment env file: $DEPLOYMENT_EXAMPLE_ENV_FILE"
  printf "Run 'make deployment-bootstrap-secrets' to create the ignored local env file and secret files.\n" >&2
}

check_local_secret_file() {
  label="$1"
  secret_file="$2"
  example_file="$3"

  if [ "$secret_file" = "$example_file" ]; then
    printf "%s still points at the checked-in example secret file: %s\n" "$label" "$secret_file" >&2
    printf "Run 'make deployment-bootstrap-secrets' or point %s at an ignored local secret file.\n" "$label" >&2
    mark_failed
    return 1
  fi

  if [ ! -r "$secret_file" ]; then
    print_missing "$label is not readable: $secret_file"
    return 1
  fi

  if [ ! -s "$secret_file" ]; then
    printf "%s is empty: %s\n" "$label" "$secret_file" >&2
    mark_failed
    return 1
  fi

  print_ok "$label is local, readable, and non-empty: $secret_file"
}

check_command() {
  command_name="$1"
  install_hint="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    print_ok "$command_name is available"
    return 0
  fi

  print_missing "required command: $command_name"
  printf "%s\n" "$install_hint" >&2
  return 1
}

printf "deployment first-run checklist\n"

check_env_file || true
check_local_secret_file "gateway API keys file" "$DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE" "$DEFAULT_GATEWAY_API_KEYS_EXAMPLE" || true
check_local_secret_file "OpenAI-compatible API key file" "$DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE" "$DEFAULT_OPENAI_API_KEY_EXAMPLE" || true

if check_command "docker" "Install Docker Desktop or Docker Engine before starting the deployment example."; then
  if docker info >/dev/null 2>&1; then
    print_ok "Docker daemon is reachable"
  else
    printf "Docker is installed but the daemon is not reachable\n" >&2
    printf "Start Docker before running make deployment-preflight or make deployment-up.\n" >&2
    mark_failed
  fi

  if docker compose version >/dev/null 2>&1; then
    print_ok "Docker Compose plugin is available"
  else
    printf "Docker Compose is not available through 'docker compose'\n" >&2
    printf "Install the Docker Compose plugin before running make deployment-preflight or make deployment-up.\n" >&2
    mark_failed
  fi
fi

check_command "node" "Install Node.js 22 or newer so deployment-preflight can verify local ports and secret file contents." || true

print_command_order

if [ "$failed" -ne 0 ]; then
  printf "\ndeployment first-run checklist failed; fix the missing setup above before starting the deployment stack.\n" >&2
  exit 1
fi

printf "\ndeployment first-run checklist passed\n"
