.PHONY: help setup check-tools clean setup-filters-api setup-sisu-wrapper setup-backend setup-frontend setup-certs compile-requirements

help:
	@echo "Available targets:"
	@echo "  setup                - Set up all components (includes localhost certs)"
	@echo "  check-tools          - Verify required tools are installed"
	@echo "  setup-certs          - Generate mkcert localhost certificates"
	@echo "  compile-requirements - Compile requirements.in to requirements.txt"
	@echo "  clean                - Remove virtual environments and dependencies"

check-tools:
	@command -v uv >/dev/null 2>&1 || (echo "Error: uv not found. Install from https://astral.sh/uv" && exit 1)
	@command -v node >/dev/null 2>&1 || (echo "Error: node not found. Install from https://nodejs.org" && exit 1)
	@command -v mkcert >/dev/null 2>&1 || (echo "Warning: mkcert not found. Install from https://github.com/FiloSottile/mkcert" && echo "Run 'make setup-certs' to generate certificates once mkcert is installed")

setup: check-tools setup-filters-api setup-sisu-wrapper setup-backend setup-frontend setup-certs
	@echo "✓ Setup complete!"

compile-requirements:
	@echo "Compiling requirements.in to requirements.txt..."
	cd filters-api && uv pip compile requirements.in --universal --output-file requirements.txt
	cd sisu-wrapper && uv pip compile requirements.in --universal --output-file requirements.txt
	@echo "Requirements compiled. Remember to commit the updated requirements.txt files!"

# --- Certificate Generation ---
setup-certs:
	@echo "Setting up localhost certificates with mkcert..."
	@if ! command -v mkcert >/dev/null 2>&1; then \
		echo "Error: mkcert not found"; \
		echo "Install mkcert from: https://github.com/FiloSottile/mkcert"; \
		echo ""; \
		echo "On macOS (with Homebrew):"; \
		echo "  brew install mkcert"; \
		echo ""; \
		echo "On Linux:"; \
		echo "  wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64"; \
		echo "  chmod +x mkcert-v1.4.4-linux-amd64"; \
		echo "  sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert"; \
		echo ""; \
		echo "On Windows:"; \
		echo "  choco install mkcert"; \
		exit 1; \
	fi
	@mkdir -p frontend/course-browser
	@if [ ! -f frontend/course-browser/localhost.pem ] || [ ! -f frontend/course-browser/localhost-key.pem ]; then \
		echo "Generating localhost certificates..."; \
		cd frontend/course-browser && mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1; \
		echo "✓ Certificates generated at frontend/course-browser/"; \
	else \
		echo "✓ Localhost certificates already exist"; \
	fi

# --- Backend / Python Services (using uv) ---
setup-filters-api:
	@echo "Setting up filters-api..."
	cd filters-api && \
	uv venv --python 3.12 .venv && \
	if [ -f requirements.in ]; then \
		uv pip compile requirements.in --universal --output-file requirements.txt; \
	fi && \
	uv pip sync requirements.txt && \
	cp .env.example .env || true
	@echo "✓ filters-api setup complete"

setup-sisu-wrapper:
	@echo "Setting up sisu-wrapper..."
	cd sisu-wrapper && \
	uv venv --python 3.12 .venv && \
	if [ -f requirements.in ]; then \
		uv pip compile requirements.in --universal --output-file requirements.txt; \
	fi && \
	uv pip sync requirements.txt
	@echo "✓ sisu-wrapper setup complete"

# --- Backend / Node ---
setup-backend:
	@echo "Setting up backend..."
	cd backend && \
	npm ci --ignore-scripts && \
	cp .env.example .env || true
	@echo "✓ backend setup complete"

# --- Frontend / Node ---
setup-frontend:
	@echo "Setting up frontend..."
	cd frontend/course-browser && \
	npm ci --ignore-scripts && \
	cp .env.example .env || true
	@echo "✓ frontend setup complete"

# --- Cleanup ---
clean:
	@echo "Cleaning up..."
	rm -rf filters-api/.venv sisu-wrapper/.venv
	rm -rf backend/node_modules frontend/course-browser/node_modules
	@echo "✓ Cleanup complete"

clean-certs:
	@echo "Removing localhost certificates..."
	rm -f frontend/course-browser/localhost.pem frontend/course-browser/localhost-key.pem
	@echo "✓ Certificates removed"
