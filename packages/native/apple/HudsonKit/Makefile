KIT_ROOT := $(shell pwd)
REPO_ROOT := $(shell git -C $(KIT_ROOT) rev-parse --show-toplevel)
HKIT := $(REPO_ROOT)/packages/tools/hkit/bin/hkit.mjs
TOOL_DIR := $(KIT_ROOT)/Tools/HudLint
HUDLINT  := $(TOOL_DIR)/.build/release/hudlint

IOS_DEMO_DIR := $(KIT_ROOT)/Demo/HudsonKitDemo-iOS

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "HudsonKit make targets:"
	@echo "  build         - swift build (lint runs first)"
	@echo "  build-full    - swift build with HUDSONKIT_WITH_TERMINAL=1 + HUDSONKIT_WITH_VOICE=1"
	@echo "  build-voice   - swift build with HUDSONKIT_WITH_VOICE=1"
	@echo "  build-terminal - swift build with HUDSONKIT_WITH_TERMINAL=1"
	@echo "  run           - build HudsonKit Lab .app and launch (real macOS app)"
	@echo "  run-cli       - swift run HudsonKitDemo (bare binary, generic Dock icon)"
	@echo "  run-vantage   - hkit dev macos (declarative features: terminal)"
	@echo "  test          - swift test"
	@echo "  lint          - run HudLint on kit Sources + macOS demo"
	@echo "  lint-all      - also include iOS demo Sources"
	@echo "  hudlint       - build the HudLint binary"
	@echo "  ios-project   - regenerate iOS demo .xcodeproj (sets HUDSONKIT_WITH_VOICE=1)"
	@echo "  install-hooks - point git core.hooksPath to .githooks"
	@echo "  clean         - clean build artifacts"
	@echo ""
	@echo "Optional features (set env vars before swift build / xcodebuild):"
	@echo "  HUDSONKIT_WITH_TERMINAL=1   pulls in HudsonTerminal + Termini"
	@echo "  HUDSONKIT_WITH_VOICE=1      pulls in HudsonVoice"

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

.PHONY: build-voice
build-voice: lint
	@HUDSONKIT_WITH_VOICE=1 swift build

.PHONY: build-terminal
build-terminal: lint
	@HUDSONKIT_WITH_TERMINAL=1 swift build

.PHONY: build-full
build-full: lint
	@HUDSONKIT_WITH_TERMINAL=1 HUDSONKIT_WITH_VOICE=1 swift build

.PHONY: run
run: lint
	@bash Demo/scripts/run-app.sh --restart

.PHONY: run-cli
run-cli: lint
	@HUDSONKIT_WITH_TERMINAL=1 swift run HudsonKitDemo

.PHONY: run-vantage
run-vantage: lint
	@cd $(KIT_ROOT) && node $(HKIT) dev macos --config Demo/hudsonkit-demo.package.json

.PHONY: ios-project
ios-project:
	@cd $(IOS_DEMO_DIR) && HUDSONKIT_WITH_VOICE=1 xcodegen
	@echo "iOS demo project regenerated. To build: open HudsonKitDemoIOS.xcodeproj from a shell where HUDSONKIT_WITH_VOICE=1 is exported."

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
