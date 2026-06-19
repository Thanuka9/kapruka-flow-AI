# Backend — Kapruka Flow

FastAPI orchestrator for the Kapruka Agent Challenge.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Key endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/intent` | POST | Full MCP pipeline (intent + cart via `mcp_intelligence`) |
| `/api/checkout` | POST | `kapruka_create_order` guest checkout |
| `/api/health` | GET | Kapruka MCP readiness |
| `/api/session` | GET | Restore cart session |
| `/api/cities` | GET | Delivery city autocomplete |

## Environment

See root `.env.example`. For hackathon demos keep:

- `ALLOW_SIMULATED_CHECKOUT=false`
- `ALLOW_FALLBACK_CATALOG=false`
