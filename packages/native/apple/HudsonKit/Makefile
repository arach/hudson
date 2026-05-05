KIT_ROOT := $(shell pwd)
TOOL_DIR := $(KIT_ROOT)/Tools/HudLint
HUDLINT  := $(TOOL_DIR)/.build/release/hudlint

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "HudsonKit make targets:"
	@echo "  build         - swift build (lint runs first)"
	@echo "  run           - swift run HudsonKitDemo (lint runs first)"
	@echo "  test          - swift test"
	@echo "  lint          - run HudLint on kit Sources + macOS demo"
	@echo "  lint-all      - also include iOS demo Sources"
	@echo "  hudlint       - build the HudLint binary"
	@echo "  install-hooks - point git core.hooksPath to .githooks"
	@echo "  clean         - clean build artifacts"

$(HUDLINT):
	@cd $(TOOL_DIR) && swift build -c release --product hudlint

.PHONY: hudlint
hudlint: $(HUDLINT)

.PHONY: lint
lint: $(HUDLINT)
	@$(HUDLINT) \
		--root $(KIT_ROOT)/Sources \
		--root $(KIT_ROOT)/Demo/HudsonKitDemo \
		--format plain

.PHONY: lint-all
lint-all: $(HUDLINT)
	@$(HUDLINT) \
		--root $(KIT_ROOT)/Sources \
		--root $(KIT_ROOT)/Demo/HudsonKitDemo \
		--root $(KIT_ROOT)/Demo/HudsonKitDemo-iOS/Sources \
		--format plain

.PHONY: build
build: lint
	@swift build

.PHONY: run
run: lint
	@swift run HudsonKitDemo

.PHONY: test
test:
	@swift test

.PHONY: install-hooks
install-hooks:
	@REPO_ROOT=$$(git rev-parse --show-toplevel) && \
		cd "$$REPO_ROOT" && \
		git config core.hooksPath .githooks && \
		echo "git hooks now point to .githooks"

.PHONY: clean
clean:
	@swift package clean
	@rm -rf $(TOOL_DIR)/.build
