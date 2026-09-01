SHELL := /bin/bash

.DEFAULT_GOAL := help

DEV_HOST ?= 127.0.0.1
DEV_PORT ?= 1313
HUGO_ARGS ?=
PLOT_AUDIT_PATHS ?=

.PHONY: help setup dev build audit-plots test-sierra test

help:
	@echo "Local development commands:"
	@echo "  make setup        Install pinned tools and Node dependencies in .tools/"
	@echo "  make dev          Start the local Hugo server at http://$(DEV_HOST):$(DEV_PORT)/"
	@echo "  make build        Create a minified production build in public/"
	@echo "  make audit-plots  Check portfolio Plotly packaging and payload sizes"
	@echo "  make test-sierra  Verify the Sierra model against its source base case"
	@echo "  make test         Run the production build and portfolio verification suite"

setup:
	@./scripts/dev/setup.sh

dev: setup
	@./scripts/dev/run-hugo.sh server \
		--bind "$(DEV_HOST)" \
		--port "$(DEV_PORT)" \
		--buildDrafts \
		--buildFuture \
		--disableFastRender \
		$(HUGO_ARGS)

build: setup
	@./scripts/dev/run-hugo.sh \
		--gc \
		--cleanDestinationDir \
		--minify \
		--environment production \
		--destination public \
		$(HUGO_ARGS)

audit-plots:
	@./scripts/dev/audit-plots.sh $(PLOT_AUDIT_PATHS)

test-sierra: setup
	@.tools/bin/node scripts/dev/test-sierra.mjs

test:
	@$(MAKE) --no-print-directory build
	@.tools/bin/node scripts/dev/test-sierra.mjs
	@$(MAKE) --no-print-directory audit-plots
