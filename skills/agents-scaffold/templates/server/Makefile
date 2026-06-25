# ==============================================================================
# {{PROJECT}}-server - Makefile
# ==============================================================================

# --- Variables ----------------------------------------------------------------

APP_NAME        := {{PROJECT}}-server
BIN_DIR         := bin

VERSION         ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT          ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo none)
BUILD_TIME      := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

# Database
DATABASE_URL    ?= $(shell grep -E '^DATABASE_URL' .env 2>/dev/null | cut -d= -f2-)

# Docker / Fly.io
DOCKER_IMAGE    ?= $(APP_NAME)
DOCKER_TAGS     := -t $(DOCKER_IMAGE):$(VERSION) -t $(DOCKER_IMAGE):latest
DOCKER_BUILD_ARGS := \
	--build-arg VERSION="$(VERSION)" \
	--build-arg COMMIT="$(COMMIT)" \
	--build-arg BUILD_TIME="$(BUILD_TIME)"
FLY_APP         ?= $(APP_NAME)
FLY_CONFIG      ?= fly.toml

# Colors
CYAN  := \033[36m
RESET := \033[0m
BOLD  := \033[1m

.DEFAULT_GOAL := help

# ==============================================================================
# HELP
# ==============================================================================

.PHONY: help
help: ## Show this help
	@echo ""
	@echo "$(BOLD){{PROJECT}}-server$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ==============================================================================
# BUILD
# ==============================================================================

.PHONY: build
build: ## Build server binary
	@echo "TODO: define build command"

.PHONY: run
run: ## Run server (requires DATABASE_URL)
	@echo "TODO: define run command"

# ==============================================================================
# DEV
# ==============================================================================

.PHONY: dev
dev: ## Start dev server with hot reload
	@echo "TODO: define dev command"

# ==============================================================================
# DATABASE
# ==============================================================================

.PHONY: db-up
db-up: ## Start local database via docker compose
	docker compose up -d

.PHONY: db-down
db-down: ## Stop local database
	docker compose down

.PHONY: migrate-up
migrate-up: ## Run all pending migrations
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set. Check your .env file." && exit 1)
	@echo "TODO: define migrate-up command"

.PHONY: migrate-down
migrate-down: ## Roll back the last migration step
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set." && exit 1)
	@echo "TODO: define migrate-down command"

# ==============================================================================
# DEPENDENCY MANAGEMENT
# ==============================================================================

.PHONY: deps
deps: ## Install / download all dependencies
	@echo "TODO: define deps command"

# ==============================================================================
# TESTING
# ==============================================================================

.PHONY: test
test: ## Run tests
	@echo "TODO: define test command"

.PHONY: test-cover
test-cover: ## Generate coverage report
	@echo "TODO: define test-cover command"

# ==============================================================================
# CODE QUALITY
# ==============================================================================

.PHONY: lint
lint: ## Run linter
	@echo "TODO: define lint command"

.PHONY: fmt
fmt: ## Format code
	@echo "TODO: define fmt command"

.PHONY: govulncheck
govulncheck: ## Scan for known vulnerabilities in dependencies
	@echo "TODO: define govulncheck command"

.PHONY: check
check: fmt lint govulncheck test ## Run all quality checks (fmt + lint + govulncheck + test)

.PHONY: release-check
release-check: lint govulncheck test ## Pre-release checks (lint + govulncheck + test)

# ==============================================================================
# DOCKER
# ==============================================================================

.PHONY: docker
docker: release-check ## Build Docker image with version tags (runs release-check)
	docker build $(DOCKER_TAGS) $(DOCKER_BUILD_ARGS) .

.PHONY: docker-build
docker-build: ## Build Docker image without running checks
	docker build $(DOCKER_TAGS) $(DOCKER_BUILD_ARGS) .

# ==============================================================================
# DEPLOYMENT (Fly.io)
# ==============================================================================

.PHONY: deploy-preflight
deploy-preflight: ## Verify flyctl, config, and warn on dirty git tree
	@which flyctl > /dev/null 2>&1 || (echo "flyctl not found. Install: https://fly.io/docs/hands-on/install-flyctl/" && exit 1)
	@test -f $(FLY_CONFIG) || (echo "$(FLY_CONFIG) not found. Copy fly.toml.example → fly.toml or run: flyctl launch" && exit 1)
	@if echo "$(VERSION)" | grep -q dirty; then \
		echo "WARNING: deploying with uncommitted changes ($(VERSION))"; \
	fi

.PHONY: deploy
deploy: release-check deploy-preflight ## Run release checks then deploy to Fly.io
	flyctl deploy --app $(FLY_APP) --config $(FLY_CONFIG) $(DOCKER_BUILD_ARGS)

.PHONY: deploy-fast
deploy-fast: deploy-preflight ## Deploy to Fly.io without running checks
	flyctl deploy --app $(FLY_APP) --config $(FLY_CONFIG) $(DOCKER_BUILD_ARGS)

.PHONY: deploy-status
deploy-status: ## Show Fly.io app status
	flyctl status --app $(FLY_APP)

.PHONY: logs
logs: ## Stream live logs from Fly.io (Ctrl+C to stop)
	flyctl logs --app $(FLY_APP)

.PHONY: ssh
ssh: ## Open SSH console on Fly.io instance
	flyctl ssh console --app $(FLY_APP)

.PHONY: scale
scale: ## Show current VM scale info on Fly.io
	flyctl scale show --app $(FLY_APP)

.PHONY: secrets-list
secrets-list: ## List Fly.io secrets (names only)
	flyctl secrets list --app $(FLY_APP)

# ==============================================================================
# TOOLCHAIN
# ==============================================================================

.PHONY: tools
tools: ## Install / update all dev tools
	@echo "TODO: define tools install command"

.PHONY: tools-check
tools-check: ## Verify all required tools are installed
	@echo "Checking tools..."
	@which docker        > /dev/null 2>&1 && echo "  ✓ docker"        || echo "  ✗ docker        (https://docs.docker.com/get-docker/)"
	@which flyctl        > /dev/null 2>&1 && echo "  ✓ flyctl"        || echo "  ✗ flyctl        (brew install flyctl)"
	@which docker        > /dev/null 2>&1 && docker compose version > /dev/null 2>&1 && echo "  ✓ docker compose" || echo "  ✗ docker compose (included with Docker Desktop)"

# ==============================================================================
# HOUSEKEEPING
# ==============================================================================

.PHONY: clean
clean: ## Remove build artifacts and generated files
	rm -rf $(BIN_DIR)
	@echo "Cleaned."

.PHONY: env-check
env-check: ## Validate required environment variables are set
	@echo "Checking required env vars..."
	@test -n "$(DATABASE_URL)"   && echo "  ✓ DATABASE_URL"     || echo "  ✗ DATABASE_URL not set"
