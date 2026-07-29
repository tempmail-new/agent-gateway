OBSERVABILITY_COMPOSE_PROJECT ?= agent-gateway-observability-demo
OBSERVABILITY_COMPOSE := COMPOSE_PROJECT_NAME=$(OBSERVABILITY_COMPOSE_PROJECT) docker compose -f compose.observability.yaml

.PHONY: benchmark-text-image build deployment-bootstrap-secrets deployment-checklist deployment-config deployment-diagnose deployment-down deployment-help deployment-logs deployment-preflight deployment-ready deployment-request deployment-reset deployment-smoke deployment-status deployment-up fmt fmt-check lint observability-down observability-inspect observability-logs observability-preflight observability-ready observability-smoke observability-traffic observability-up test validate

build:
	npm run build

benchmark-text-image:
	npm run benchmark:text-image

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

lint:
	npm run lint

test:
	npm test

validate: fmt-check lint test build

deployment-smoke:
	docs/deployment/container-example/smoke.sh

deployment-bootstrap-secrets:
	docs/deployment/container-example/bootstrap-secrets.sh

deployment-checklist:
	docs/deployment/container-example/checklist.sh

deployment-config:
	docs/deployment/container-example/config.sh

deployment-diagnose:
	docs/deployment/container-example/diagnose.sh

deployment-help:
	docs/deployment/container-example/help.sh

deployment-status:
	docs/deployment/container-example/status.sh

deployment-preflight:
	docs/deployment/container-example/preflight.sh

deployment-up:
	docs/deployment/container-example/lifecycle.sh up

deployment-ready:
	docs/deployment/container-example/lifecycle.sh ready

deployment-request:
	docs/deployment/container-example/lifecycle.sh request

deployment-reset:
	docs/deployment/container-example/reset.sh

deployment-logs:
	docs/deployment/container-example/lifecycle.sh logs

deployment-down:
	docs/deployment/container-example/lifecycle.sh down

observability-preflight:
	docs/observability/local-demo/preflight.sh

observability-up:
	$(OBSERVABILITY_COMPOSE) up --build -d

observability-ready:
	@docs/observability/local-demo/ready.sh

observability-traffic:
	docs/observability/local-demo/generate-traffic.sh

observability-inspect:
	docs/observability/local-demo/inspect.sh

observability-logs:
	@docs/observability/local-demo/logs.sh

observability-down:
	$(OBSERVABILITY_COMPOSE) down

observability-smoke:
	docs/observability/local-demo/smoke.sh
