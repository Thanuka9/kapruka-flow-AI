# Kapruka Flow

**Tell us what you want. We'll build the shopping plan.**

AI-first shopping for the [Kapruka Agent Challenge 2026](https://www.kapruka.com/contactUs/agentChallenge.html). Powered entirely by the free public [Kapruka MCP](https://mcp.kapruka.com/) — no API key required.

## What makes this different

- **Intent, not search** — describe what you need in English, Sinhala, or Tanglish
- **Live Kapruka MCP** — real catalog search, delivery validation, guest checkout
- **User accounts + order history** — AI personalizes plans from your past orders
- **All Categories nav** — browse Kapruka categories like the main site
- **4 cart plans** — Ideal, Cheaper, Premium, Fast with animated diffs
- **Instant budget adjust** — drag slider, plans re-optimize in milliseconds
- **Kapruka.com UI** — red/white header, search bar, category menu

## Judge walkthrough

1. Open the live URL → confirm **MCP Live** badge in header
2. Sign in (or register) so the AI can use your order history
3. Use **All Categories** or header search to start a flow
4. Watch the MCP activity feed during processing
5. Switch cart versions → see plan diff banner
6. Checkout → real Kapruka payment URL via `kapruka_create_order`

## Quick start

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
$env:BACKEND_URL="http://localhost:8000"
npm run dev
```

Open http://localhost:3000

Health check: http://localhost:3000/api/health → `mcp.ok: true`

## Environment variables

| Variable | Scope | Default | Description |
|----------|-------|---------|-------------|
| `MCP_URL` | backend | `https://mcp.kapruka.com/mcp` | Kapruka MCP endpoint |
| `MCP_TIMEOUT` | backend | `30` | Seconds per MCP tool call |
| `MCP_MAX_RETRIES` | backend | `2` | Extra attempts on MCP failure |
| `ALLOWED_ORIGINS` | backend | `localhost:3000` | Comma-separated CORS origins |
| `ENVIRONMENT` | backend | `development` | `production` hides API docs |
| `LOG_LEVEL` | backend | `INFO` | Structured log verbosity |
| `DB_PATH` | backend | `./flow.db` | SQLite location (use a volume in prod) |
| `ALLOW_SIMULATED_CHECKOUT` | backend | `false` | Keep `false` for live judging |
| `ALLOW_FALLBACK_CATALOG` | backend | `false` | Keep `false` for live judging |
| `BACKEND_URL` | frontend | `http://localhost:8000` | FastAPI URL for the Next.js proxy |
| `PROXY_TIMEOUT_MS` | frontend | `120000` | Frontend→backend proxy timeout |

Copy `.env.example` and configure for your environment.

## Production notes

- **Security**: passwords are stored as salted PBKDF2-SHA256 hashes; CORS is locked to `ALLOWED_ORIGINS`; security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, etc.) are set by `next.config.js`.
- **Resilience**: MCP calls have bounded timeouts and retry-with-backoff; the frontend proxy returns `504`/`502` cleanly on backend issues.
- **Observability**: structured request logging on the backend; `GET /healthz` (liveness), `GET /api/health` (MCP readiness), `GET /api/version`.
- **Data**: SQLite runs in WAL mode with indexes on hot paths. Mount `DB_PATH` to a persistent volume in production.

## Architecture

```
Next.js UI  →  /api/* proxy (timeout + retry)  →  FastAPI orchestrator
                                                      ├── Intent Agent (MCP-native planner)
                                                      ├── Shopping Agent (MCP search + enrich)
                                                      ├── Delivery Agent (MCP cities + check)
                                                      └── Cart Agent (relevance + budget, 4 plans)
```

### MCP tools used

- `kapruka_search_products`
- `kapruka_get_product`
- `kapruka_list_delivery_cities`
- `kapruka_check_delivery`
- `kapruka_create_order`
- `kapruka_list_categories`

## Deploy

### Docker (recommended)

```bash
# Backend
docker build -t kapruka-flow-api ./backend
docker run -p 8000:8000 -e ALLOWED_ORIGINS="https://your-frontend" kapruka-flow-api

# Frontend (Next.js standalone)
docker build -t kapruka-flow-web ./frontend
docker run -p 3000:3000 -e BACKEND_URL="https://your-api" kapruka-flow-web
```

### Managed hosting

- **Frontend**: Vercel / Netlify — set `BACKEND_URL` to your FastAPI host
- **Backend**: Railway / Render / Fly.io — expose port 8000, set `ALLOWED_ORIGINS`, mount a volume for `DB_PATH`

Both services must be running for the full experience.
