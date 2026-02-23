.PHONY: install-back-deps install-front-deps run-front run-back

BACKEND_DIR = cd server
FRONTEND_DIR = cd client

install-back-deps:
	$(BACKEND_DIR) && uv sync

install-front-deps:
	$(FRONTEND_DIR) && npm install

setup-deps: install-back-deps install-front-deps

run-front:
	$(FRONTEND_DIR) && npm run dev

run-back:
	$(BACKEND_DIR) && uv run manage.py runserver

run: run-front run-back
