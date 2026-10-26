# Blinkit Customer Support

This existing project combines a React chat UI, an Express/Mastra backend,
SQLite conversation storage, FAQ retrieval, and a Python NLP service. Keep the
OpenRouter key in the root `.env` file only; never put it in frontend settings.

## Project structure

- `frontend/` — React, TypeScript, and Vite customer chat.
- `backend/src/` — Express API, Mastra agent, SQLite helpers, FAQ retrieval,
  and support ticket routes.
- `python-services/app/` — FastAPI intent and sentiment API.
- `python-services/tests/` — focused Python NLP tests.
- `.env.example` — environment template. Do not commit `.env`.

## Run the app on Windows

Start each service in a separate PowerShell terminal. From the project root,
copy `.env.example` to `.env` if needed, then set `OPENROUTER_API_KEY` to a
valid key. The backend requires Node.js 22 or newer.

**Backend**

```powershell
Set-Location .\backend
npm install
npm run dev
```

**Python NLP service**

```powershell
Set-Location .\python-services
& '<your-python-executable>' -m pip install -r requirements-api.txt
& '<your-python-executable>' -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Replace `<your-python-executable>` with your Python 3.11 executable path.
The full `requirements.txt` also includes heavier optional deep-learning and
notebook dependencies; `requirements-api.txt` contains only what Phase 3 needs.

**Frontend**

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite forwards `/api` requests to Express on
port 3001. The Python service must be reachable at `PYTHON_SERVICE_URL` in
`.env` (default `http://127.0.0.1:8001`). Chat requires a valid OpenRouter key.

ChromaDB is used when a Chroma server is available at `CHROMA_URL` (default
`http://localhost:8000`). If it is unavailable, the chat uses bundled FAQ
documents with local keyword matching; it does not silently claim Chroma is
connected.

## Current phase status

- **Phase 1 — complete:** React chat, Express routes, and the Mastra agent's
  OpenRouter integration. Actual model replies require a valid API key.
- **Phase 2 — implemented:** Python-backed intent and sentiment enrichment,
  ChromaDB FAQ search with an offline bundled-FAQ fallback, SQLite conversation
  and message persistence, history reload, analytics events, and a ticket
  creation endpoint.
- **Phase 3 — implemented:** FastAPI `/intent`, `/sentiment`, and `/health`
  endpoints; intent uses a small trained NumPy MLP, while sentiment uses a
  transparent lexicon analyzer.
- **Phase 4 — not implemented:** Analytics dashboard and product-damage image
  classification.
- **Phase 5 — not implemented:** Five syllabus notebooks and comprehensive
  project-wide documentation/tests.

## Verification

Build TypeScript projects separately:

```powershell
Set-Location .\frontend
npm run build
Set-Location ..\backend
npm run build
```

Run the Python NLP unit tests from `python-services/`:

```powershell
& '<your-python-executable>' -m unittest discover -s tests
```

Health endpoints are `http://localhost:3001/api/health` and
`http://localhost:8001/health`. Backend health reports whether Python NLP and
ChromaDB are reachable without exposing any API keys.
