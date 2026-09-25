.PHONY: dev build test lint typecheck release deploy backend-dev backend-build backend-test

# Extension development
dev:
	npm run dev

# Build extension for production
build:
	npm run build

# Run extension tests
test:
	npm test

# Lint extension code
lint:
	npm run lint

# Typecheck extension code
typecheck:
	npm run typecheck

# Create GitHub release
release:
	@VERSION=$$(cat package.json | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/') && \
	echo "Creating release v$$VERSION" && \
	git tag -a "v$$VERSION" -m "Release v$$VERSION" && \
	git push origin "v$$VERSION" && \
	gh release create "v$$VERSION" --generate-notes

# Backend development
backend-dev:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Backend build (install deps)
backend-build:
	cd backend && pip install -e ".[dev]"

# Backend tests
backend-test:
	cd backend && pytest -v

# Backend lint
backend-lint:
	cd backend && ruff check .

# Backend typecheck
backend-typecheck:
	cd backend && mypy app

# Full test suite
test-all: test backend-test

# Full lint suite
lint-all: lint backend-lint

# Full typecheck suite
typecheck-all: typecheck backend-typecheck

# Deploy to VPS (uses deploy script)
deploy:
	./deploy.sh