#!/usr/bin/env sh
set -eu

ENV_EXAMPLE="docs/deployment/container-example/.env.local.example"
DEFAULT_ENV_FILE="docs/deployment/container-example/.env.local"
GATEWAY_API_KEYS_EXAMPLE="docs/deployment/container-example/secrets/gateway-api-keys.example"
OPENAI_API_KEY_EXAMPLE="docs/deployment/container-example/secrets/openai-api-key.example"
DEFAULT_GATEWAY_API_KEYS_LOCAL="docs/deployment/container-example/secrets/gateway-api-keys.local"
DEFAULT_OPENAI_API_KEY_LOCAL="docs/deployment/container-example/secrets/openai-api-key.local"

DEPLOYMENT_EXAMPLE_ENV_FILE="${DEPLOYMENT_EXAMPLE_ENV_FILE:-$DEFAULT_ENV_FILE}"

create_file_from_example() {
  source_file="$1"
  target_file="$2"
  label="$3"

  if [ -e "$target_file" ]; then
    printf "skip: %s already exists: %s\n" "$label" "$target_file"
    return 0
  fi

  mkdir -p "$(dirname "$target_file")"
  cp "$source_file" "$target_file"
  printf "created: %s from %s: %s\n" "$label" "$source_file" "$target_file"
}

create_secret_from_example() {
  source_file="$1"
  target_file="$2"
  label="$3"

  if [ -e "$target_file" ]; then
    printf "skip: %s already exists: %s\n" "$label" "$target_file"
    return 0
  fi

  mkdir -p "$(dirname "$target_file")"
  cp "$source_file" "$target_file"
  chmod 600 "$target_file"
  printf "created: %s from %s: %s\n" "$label" "$source_file" "$target_file"
}

create_file_from_example "$ENV_EXAMPLE" "$DEPLOYMENT_EXAMPLE_ENV_FILE" "deployment env file"

set -a
# shellcheck disable=SC1090
. "$DEPLOYMENT_EXAMPLE_ENV_FILE"
set +a

DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE="${DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE:-$DEFAULT_GATEWAY_API_KEYS_LOCAL}"
DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE="${DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE:-$DEFAULT_OPENAI_API_KEY_LOCAL}"

create_secret_from_example "$GATEWAY_API_KEYS_EXAMPLE" "$DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE" "gateway API keys file"
create_secret_from_example "$OPENAI_API_KEY_EXAMPLE" "$DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE" "OpenAI-compatible API key file"

printf "\ndeployment local secret bootstrap complete\n"
printf "review %s and replace example secret values before using this outside local smoke checks.\n" "$DEPLOYMENT_EXAMPLE_ENV_FILE"
