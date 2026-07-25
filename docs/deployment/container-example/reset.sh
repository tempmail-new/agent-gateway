#!/usr/bin/env sh
set -eu

DEFAULT_ENV_FILE="docs/deployment/container-example/.env.local"
SECRETS_DIR="docs/deployment/container-example/secrets"
DEFAULT_GATEWAY_API_KEYS_LOCAL="$SECRETS_DIR/gateway-api-keys.local"
DEFAULT_OPENAI_API_KEY_LOCAL="$SECRETS_DIR/openai-api-key.local"

DEPLOYMENT_EXAMPLE_ENV_FILE="${DEPLOYMENT_EXAMPLE_ENV_FILE:-$DEFAULT_ENV_FILE}"

if [ -f "$DEPLOYMENT_EXAMPLE_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$DEPLOYMENT_EXAMPLE_ENV_FILE"
  set +a
fi

DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE="${DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE:-$DEFAULT_GATEWAY_API_KEYS_LOCAL}"
DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE="${DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE:-$DEFAULT_OPENAI_API_KEY_LOCAL}"

seen_targets="
"

already_seen() {
  target_file="$1"

  case "$seen_targets" in
    *"
$target_file
"*) return 0 ;;
  esac

  seen_targets="${seen_targets}${target_file}
"
  return 1
}

remove_target() {
  target_file="$1"
  label="$2"

  if already_seen "$target_file"; then
    return 0
  fi

  if [ ! -e "$target_file" ]; then
    printf "skip: %s not present: %s\n" "$label" "$target_file"
    return 0
  fi

  if [ -d "$target_file" ]; then
    printf "refuse: %s is a directory: %s\n" "$label" "$target_file" >&2
    return 1
  fi

  rm -f "$target_file"
  printf "removed: %s: %s\n" "$label" "$target_file"
}

remove_env_file() {
  target_file="$1"

  case "$target_file" in
    .env.local | */.env.local)
      remove_target "$target_file" "deployment env file"
      ;;
    *)
      printf "preserve: deployment env file is not named .env.local: %s\n" "$target_file"
      ;;
  esac
}

remove_local_secret_file() {
  target_file="$1"
  label="$2"

  case "$target_file" in
    *.local)
      remove_target "$target_file" "$label"
      ;;
    *)
      printf "preserve: %s is not a .local file: %s\n" "$label" "$target_file"
      ;;
  esac
}

printf "deployment local reset\n"

remove_local_secret_file "$DEPLOYMENT_EXAMPLE_GATEWAY_API_KEYS_FILE" "gateway API keys file"
remove_local_secret_file "$DEPLOYMENT_EXAMPLE_OPENAI_API_KEY_FILE" "OpenAI-compatible API key file"

for local_secret_file in "$SECRETS_DIR"/*.local; do
  if [ -e "$local_secret_file" ]; then
    remove_local_secret_file "$local_secret_file" "deployment local secret file"
  fi
done

remove_env_file "$DEPLOYMENT_EXAMPLE_ENV_FILE"

printf "\ndeployment local reset complete\n"
