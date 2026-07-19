OBSERVABILITY_COMPOSE := docker compose -f compose.observability.yaml

.PHONY: build fmt fmt-check lint observability-down observability-inspect observability-logs observability-ready observability-smoke observability-traffic observability-up test validate

build:
	npm run build

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

lint:
	npm run lint

test:
	npm test

validate: fmt-check lint test build

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
