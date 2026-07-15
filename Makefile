.PHONY: build fmt fmt-check lint test validate

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
