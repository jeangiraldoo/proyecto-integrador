.PHONY: install-back-deps install-front-deps

install-back-deps:
	cd server && uv sync

install-front-deps:
	cd client && npm install

setup-deps: install-back-deps install-front-deps

run-front:
	cd client && npm run dev

run-back:
	cd server && uv run manage.py runserver

run: run-front run-back
