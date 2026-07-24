OBSERVABILITY_COMPOSE_PROJECT ?= agent-gateway-observability-demo
OBSERVABILITY_COMPOSE := COMPOSE_PROJECT_NAME=$(OBSERVABILITY_COMPOSE_PROJECT) docker compose -f compose.observability.yaml

.PHONY: benchmark-text-image build deployment-bootstrap-secrets deployment-diagnose deployment-down deployment-logs deployment-preflight deployment-ready deployment-request deployment-smoke deployment-up fmt fmt-check lint observability-down observability-inspect observability-logs observability-preflight observability-ready observability-smoke observability-traffic observability-up test validate

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

deployment-diagnose:
	docs/deployment/container-example/diagnose.sh

deployment-preflight:
	docs/deployment/container-example/preflight.sh

deployment-up:
	docs/deployment/container-example/lifecycle.sh up

deployment-ready:
	docs/deployment/container-example/lifecycle.sh ready

deployment-request:
	docs/deployment/container-example/lifecycle.sh request

deployment-logs:
	docs/deployment/container-example/lifecycle.sh logs

deployment-down:
	docs/deployment/container-example/lifecycle.sh down

observability-preflight:
	docs/observability/local-demo/preflight.sh

observability-up:
	$(OBSERVABILITY_COMPOSE) up --build -d

observability-ready:
	@i=1; while [ "$$i" -le 30 ]; do \
		if curl -fsS http://localhost:8080/readyz >/dev/null && curl -fsS http://localhost:9090/-/ready >/dev/null; then \
			echo "observability demo is ready"; \
			exit 0; \
		fi; \
		sleep 2; \
		i=$$((i + 1)); \
	done; \
	echo "observability demo did not become ready" >&2; \
	$(OBSERVABILITY_COMPOSE) ps; \
	exit 1

observability-traffic:
	docs/observability/local-demo/generate-traffic.sh

observability-inspect:
	docs/observability/local-demo/inspect.sh

observability-logs:
	$(OBSERVABILITY_COMPOSE) logs -f --tail=100

observability-down:
	$(OBSERVABILITY_COMPOSE) down

observability-smoke:
	docs/observability/local-demo/smoke.sh
