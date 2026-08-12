KIT_ROOT := $(shell pwd)
TOOL_DIR := $(KIT_ROOT)/Tools/HudLint
HUDLINT  := $(TOOL_DIR)/.build/release/hudlint

IOS_DEMO_DIR := $(KIT_ROOT)/Demo/HudsonKitDemo-iOS

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "HudsonKit make targets:"
	@echo "  build         - swift build (lint runs first)"
	@echo "  build-full    - swift build with HUDSONKIT_WITH_TERMINAL=1"
	@echo "  build-voice   - compatibility alias for the default voice-enabled build"
	@echo "  build-terminal - swift build with HUDSONKIT_WITH_TERMINAL=1"
	@echo "  run           - swift run HudsonKitDemo (lint runs first)"
	@echo "  test          - swift test"
	@echo "  lint          - run HudLint on kit Sources + macOS demo"
	@echo "  lint-all      - also include iOS demo Sources"
	@echo "  hudlint       - build the HudLint binary"
	@echo "  ios-project   - regenerate iOS demo .xcodeproj"
	@echo "  clean         - clean build artifacts"
	@echo ""
	@echo "Optional features (set env vars before swift build / xcodebuild):"
	@echo "  HUDSONKIT_WITH_TERMINAL=1   pulls in HudsonTerminal + Termini"
	@echo "HudsonVoice is always included; its model download policy is runtime-only."

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
	@swift build

.PHONY: build-terminal
build-terminal: lint
	@HUDSONKIT_WITH_TERMINAL=1 swift build

.PHONY: build-full
build-full: lint
	@HUDSONKIT_WITH_TERMINAL=1 swift build

.PHONY: run
run: lint
	@swift run HudsonKitDemo

.PHONY: ios-project
ios-project:
	@cd $(IOS_DEMO_DIR) && xcodegen
	@echo "iOS demo project regenerated. Open HudsonKitDemoIOS.xcodeproj to build it."

.PHONY: test
test:
	@swift test

.PHONY: clean
clean:
	@swift package clean
	@rm -rf $(TOOL_DIR)/.build
