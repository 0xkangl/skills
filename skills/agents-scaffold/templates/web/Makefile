# ==============================================================================
# {{PROJECT}}-web - Makefile
# ==============================================================================

# --- Variables ----------------------------------------------------------------

APP_NAME        := {{PROJECT}}-web

# Cloudflare (wrangler)
WRANGLER        ?= npx wrangler
WRANGLER_CONFIG ?= wrangler.jsonc
# 顶层配置即 production;发其它环境用 `make deploy CF_ENV=staging`
CF_ENV          ?=
CF_ENV_FLAG     := $(if $(CF_ENV),--env $(CF_ENV),)

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
	@echo "$(BOLD){{PROJECT}}-web$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ==============================================================================
# BUILD
# ==============================================================================

.PHONY: build
build: ## Build for production
	@echo "TODO: define build command"

# ==============================================================================
# DEV
# ==============================================================================

.PHONY: dev
dev: ## Start dev server
	@echo "TODO: define dev command"

# ==============================================================================
# DEPENDENCY MANAGEMENT
# ==============================================================================

.PHONY: install
install: ## Install dependencies
	@echo "TODO: define install command"

# ==============================================================================
# TESTING
# ==============================================================================

.PHONY: test
test: ## Run tests
	@echo "TODO: define test command"

# ==============================================================================
# CODE QUALITY
# ==============================================================================

.PHONY: lint
lint: ## Run linter
	@echo "TODO: define lint command"

.PHONY: fmt
fmt: ## Format code
	@echo "TODO: define fmt command"

.PHONY: check
check: fmt lint test ## Run all quality checks (fmt + lint + test)

.PHONY: release-check
release-check: lint test ## Pre-release checks (lint + test)

# ==============================================================================
# DEPLOYMENT (Cloudflare)
# ==============================================================================
# 只经 CLI 部署:本地与 CI 跑同一条命令,凭据是可撤销的最小权限 API token。
# 不接面板的 GitHub App / Git 集成 —— 那会把构建配置与触发条件放到仓库之外。

.PHONY: deploy-preflight
deploy-preflight: ## Verify wrangler, config, credentials, and warn on dirty git tree
	@$(WRANGLER) --version > /dev/null 2>&1 || (echo "wrangler not found. Install: npm i -D wrangler" && exit 1)
	@test -f $(WRANGLER_CONFIG) || (echo "$(WRANGLER_CONFIG) not found. Copy wrangler.jsonc.example -> wrangler.jsonc" && exit 1)
	@test -n "$(CLOUDFLARE_API_TOKEN)" || echo "NOTE: CLOUDFLARE_API_TOKEN not set, falling back to 'wrangler login' session (CI must set the token)"
	@test -z "$$(git status --porcelain 2>/dev/null)" || echo "WARNING: deploying with uncommitted changes"

.PHONY: deploy-dry-run
deploy-dry-run: ## Build and validate config without publishing
	$(WRANGLER) deploy --dry-run --outdir dist $(CF_ENV_FLAG)

.PHONY: deploy
deploy: release-check deploy-preflight ## Run release checks then deploy (CF_ENV=staging for staging)
	$(WRANGLER) deploy $(CF_ENV_FLAG)

.PHONY: deploy-fast
deploy-fast: deploy-preflight ## Deploy without running checks
	$(WRANGLER) deploy $(CF_ENV_FLAG)

.PHONY: deploy-status
deploy-status: ## List deployments (current active version first)
	$(WRANGLER) deployments list $(CF_ENV_FLAG)

.PHONY: rollback
rollback: ## Roll back to a previous version (VERSION_ID=<id> to pick one)
	$(WRANGLER) rollback $(VERSION_ID) $(CF_ENV_FLAG)

.PHONY: logs
logs: ## Stream live logs (Ctrl+C to stop)
	$(WRANGLER) tail $(CF_ENV_FLAG)

.PHONY: secrets-list
secrets-list: ## List secrets (names only)
	$(WRANGLER) secret list $(CF_ENV_FLAG)

# ==============================================================================
# TOOLCHAIN
# ==============================================================================

.PHONY: tools-check
tools-check: ## Verify all required tools are installed
	@echo "Checking tools..."
	@which node            > /dev/null 2>&1 && echo "  ✓ node"     || echo "  ✗ node     (https://nodejs.org/)"
	@$(WRANGLER) --version > /dev/null 2>&1 && echo "  ✓ wrangler" || echo "  ✗ wrangler (npm i -D wrangler)"

# ==============================================================================
# HOUSEKEEPING
# ==============================================================================

.PHONY: clean
clean: ## Remove build artifacts and generated files
	@echo "TODO: define clean command"
