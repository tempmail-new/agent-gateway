#!/usr/bin/env sh
set -eu

. docs/deployment/container-example/env.sh

file_status() {
  file_path="$1"

  if [ ! -e "$file_path" ]; then
    printf "missing"
    return 0
  fi

  if [ ! -r "$file_path" ]; then
    printf "not-readable"
    return 0
  fi

  if [ ! -s "$file_path" ]; then
    printf "empty"
    return 0
  fi

  printf "readable-non-empty"
}

print_value() {
  printf "%s=%s\n" "$1" "$2"
}

print_secret_file() {
  label="$1"
  file_path="$2"

  printf "%s=%s (%s)\n" "$label" "$file_path" "$(file_status "$file_path")"
}

printf "deployment example resolved configuration\n"
print_value "env_file" "$DEPLOYMENT_EXAMPLE_ENV_FILE"
print_value "compose_file" "$DEPLOYMENT_EXAMPLE_COMPOSE_FILE"
print_value "compose_project" "$DEPLOYMENT_EXAMPLE_COMPOSE_PROJECT"
print_value "gateway_port" "$DEPLOYMENT_EXAMPLE_GATEWAY_PORT"
print_value "gateway_url" "$DEPLOYMENT_EXAMPLE_GATEWAY_URL"
print_value "ports_checked_by_preflight" "$DEPLOYMENT_EXAMPLE_PORTS"
print_secret_file "gateway_api_keys_file" "$DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE"
print_secret_file "openai_api_key_file" "$DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE"
