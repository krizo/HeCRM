.PHONY: venv install dev test lint format clean

VENV ?= .venv
PY   ?= $(VENV)/bin/python
PIP  ?= $(VENV)/bin/pip

venv:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip

install: venv
	$(PIP) install -e ".[dev]"

dev:
	$(VENV)/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	$(VENV)/bin/pytest -q

lint:
	$(VENV)/bin/ruff check .

format:
	$(VENV)/bin/ruff format .

clean:
	rm -rf $(VENV) .pytest_cache .ruff_cache *.egg-info build dist
