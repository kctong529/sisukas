.PHONY: help setup check-tools clean setup-filters-api setup-sisu-wrapper setup-frontend compile-requirements

help:
	@echo "Available targets:"
	@echo "  setup                - Set up all components"
	@echo "  check-tools          - Verify required tools are installed"
	@echo "  compile-requirements - Compile requirements.in to requirements.txt"
	@echo "  clean                - Remove virtual environments and dependencies"

check-tools:
	@command -v uv >/dev/null 2>&1 || (echo "Error: uv not found. Install from https://astral.sh/uv" && exit 1)
	@command -v node >/dev/null 2>&1 || (echo "Error: node not found. Install from https://nodejs.org" && exit 1)

setup: check-tools setup-filters-api setup-sisu-wrapper setup-frontend

compile-requirements:
	@echo "Compiling requirements.in to requirements.txt..."
	cd filters-api && uv pip compile requirements.in --universal --output-file requirements.txt
	cd sisu-wrapper && uv pip compile requirements.in --universal --output-file requirements.txt
	@echo "Requirements compiled. Remember to commit the updated requirements.txt files!"

# --- Backend / Python Services (using uv) ---

setup-filters-api:
	cd filters-api && \
	uv venv --python 3.12 .venv && \
	if [ -f requirements.in ]; then \
		uv pip compile requirements.in --universal --output-file requirements.txt; \
	fi && \
	uv pip sync requirements.txt && \
	cp .env.example .env || true

setup-sisu-wrapper:
	cd sisu-wrapper && \
	uv venv --python 3.12 .venv && \
	if [ -f requirements.in ]; then \
		uv pip compile requirements.in --universal --output-file requirements.txt; \
	fi && \
	uv pip sync requirements.txt

# --- Frontend / Node ---

setup-frontend:
	cd frontend/course-browser && \
	npm ci --ignore-scripts && \
	cp .env.example .env || true

# --- Cleanup ---

clean:
	rm -rf filters-api/.venv sisu-wrapper/.venv
	rm -rf frontend/course-browser/node_modules
