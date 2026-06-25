# ==============================================================================
# {{PROJECT}}-web - Makefile
# ==============================================================================

# --- Variables ----------------------------------------------------------------

APP_NAME        := {{PROJECT}}-web

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

# ==============================================================================
# HOUSEKEEPING
# ==============================================================================

.PHONY: clean
clean: ## Remove build artifacts and generated files
	@echo "TODO: define clean command"
