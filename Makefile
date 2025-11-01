PYTHON := python3
NODE := node

.PHONY: all setup-filters-api setup-sisu-wrapper setup-frontend clean

all: setup-filters-api setup-sisu-wrapper setup-frontend

# --- Backend / Python Services ---

setup-filters-api:
	cd filters-api && \
	$(PYTHON) -m venv .venv && \
	. .venv/bin/activate && \
	pip install -U pip && \
	pip install -r requirements.txt && \
	cp .env.example .env || true

setup-sisu-wrapper:
	cd sisu-wrapper && \
	$(PYTHON) -m venv .venv && \
	. .venv/bin/activate && \
	pip install -U pip && \
	pip install -r requirements.txt

# --- Frontend / Node ---

setup-frontend:
	cd course-browser && \
	npm ci && \
	cp .env.example .env || true

# --- Cleanup ---

clean:
	find . -type d -name ".venv" -exec rm -rf {} +
	cd course-browser && rm -rf node_modules

