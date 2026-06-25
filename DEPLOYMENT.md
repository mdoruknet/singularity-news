# Deployment Guide — Singularity

This project is split into a **static frontend** (Vite/React) and a **stateful
backend** (FastAPI + SQLite + an autonomous scheduler). They deploy
independently. The single most important production concern is **SQLite
persistence**: the database must live on a disk that survives restarts and
redeploys.

```
┌──────────────┐        HTTPS        ┌─────────────────────────────┐
│  Frontend    │  ───────────────▶   │  Backend (FastAPI, 4 workers)│
│  Vercel/CDN  │   VITE_API_URL      │  + Scheduler (1 process)     │
└──────────────┘                     │  + SQLite on Persistent Disk │
                                     └─────────────────────────────┘
```

---

## 1) Frontend → Vercel

The frontend is a static SPA; any static host works, but Vercel is simplest.

| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm ci` |

**Environment variable** (Project → Settings → Environment Variables):

```
VITE_API_URL = https://your-backend-domain.com
```

> Vite inlines env vars **at build time**, so set `VITE_API_URL` before the build
> and trigger a redeploy whenever the backend URL changes. The code falls back to
> `http://localhost:8000` when the variable is absent (local dev).

CORS: add the Vercel domain to `allow_origins` in [`backend/api.py`](backend/api.py)
(or switch to an env-driven allowlist) so the browser can call the API.

---

## 2) Backend → Docker (Render / Fly.io / DigitalOcean)

The backend image is defined in [`backend/Dockerfile`](backend/Dockerfile)
(`uvicorn api:app --workers 4`). Whatever the platform, you must:

1. Build the `backend/` Docker image.
2. Attach a **persistent disk** and point `SINGULARITY_DB` at it.
3. Provide `ANTHROPIC_API_KEY`.
4. Run the **scheduler** as a *separate* process (never inside the 4-worker API).

### Option A — Render.com

- **Web Service** from `backend/` (Docker).
  - Add a **Disk**, mount path e.g. `/data` (1 GB is plenty).
  - Env: `SINGULARITY_DB=/data/singularity.db`, `ANTHROPIC_API_KEY=…`
  - Render injects `$PORT`; set the start command to
    `uvicorn api:app --host 0.0.0.0 --port $PORT --workers 4`.
- **Background Worker** (same repo/Dockerfile) for the scheduler.
  - Start command: `python scheduler.py`
  - Mount the **same** disk at `/data`, same env vars.

### Option B — Fly.io

```bash
fly launch --no-deploy            # generates fly.toml from backend/Dockerfile
fly volumes create singularity_data --size 1
```

In `fly.toml`:

```toml
[mounts]
  source = "singularity_data"
  destination = "/data"

[env]
  SINGULARITY_DB = "/data/singularity.db"
```

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

Run the scheduler as a second Fly **process group** (or a separate app) executing
`python scheduler.py`, mounting the same volume.

### Option C — DigitalOcean Droplet (Docker Compose)

The most faithful to local — runs all three services with a named volume.

```bash
# On the droplet
git clone <repo> && cd singularity
cp .env.example .env            # set ANTHROPIC_API_KEY and VITE_API_URL
docker compose up -d --build
```

- `docker-compose.yml` already declares the `singularity-data` **named volume**
  mounted at `/data` for both `backend` and `scheduler`, so the DB persists across
  `docker compose down/up`.
- Put **Nginx or Caddy** in front for TLS (Let's Encrypt) and route the API
  domain → `:8000`, the app domain → `:80`.
- ⚠️ Never `docker volume rm singularity-data` — that deletes every stored article.

---

## 3) Production checklist

- [ ] `VITE_API_URL` points at the real backend (HTTPS) and frontend rebuilt.
- [ ] Backend CORS `allow_origins` includes the frontend domain.
- [ ] `SINGULARITY_DB` is on a **persistent disk/volume**, not the container FS.
- [ ] `ANTHROPIC_API_KEY` set on **both** backend and scheduler.
- [ ] Scheduler runs as **one** process (not multiplied by API workers).
- [ ] Backups: snapshot the disk or periodically copy `singularity.db` off-box.

> **Scaling note:** the job queue uses SQLite, which is correct for a single host
> (multi-worker safe). For multi-node horizontal scaling, move job state to
> Postgres/Redis — see the "Resilient Architecture" section in the README.
