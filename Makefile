.PHONY: dev build typecheck backend-dev backend-build backend-test backend-lint

dev:
	npm run dev

build:
	npm run build

typecheck:
	npx tsc --noEmit

backend-build:
	cd backend && python -m pip install -e '.[dev]'

backend-dev:
	cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

backend-test:
	cd backend && pytest -q

backend-lint:
	cd backend && ruff check app tests
