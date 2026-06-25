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

## 0) Fastest path — prebuilt images from GHCR (no build on the server)

Every push to `main` builds and publishes both images to the **GitHub Container
Registry** via the `docker-publish` CI job:

- `ghcr.io/mdoruknet/singularity-frontend:latest` (and `:<commit-sha>`)
- `ghcr.io/mdoruknet/singularity-backend:latest` (and `:<commit-sha>`)

On any Docker host you can then **pull and run** — no source checkout, no build.
Create a `docker-compose.yml` like this and run `docker compose up -d`:

```yaml
services:
  backend:
    image: ghcr.io/mdoruknet/singularity-backend:latest
    ports:
      - "8000:8000"
    environment:
      - SINGULARITY_DB=/data/singularity.db
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - singularity-data:/data
    restart: unless-stopped

  scheduler:
    image: ghcr.io/mdoruknet/singularity-backend:latest
    command: python scheduler.py
    environment:
      - SINGULARITY_DB=/data/singularity.db
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - singularity-data:/data
    depends_on:
      - backend
    restart: unless-stopped

  frontend:
    image: ghcr.io/mdoruknet/singularity-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  singularity-data:
```

```bash
cp .env.example .env          # set ANTHROPIC_API_KEY (and ALLOWED_ORIGINS)
docker compose pull           # fetch the latest images from GHCR
docker compose up -d          # start frontend + backend + scheduler
```

> Pin to an immutable release by replacing `:latest` with a specific
> `:<commit-sha>` tag.
>
> ⚠️ **Frontend API URL is baked at build time.** The published frontend image
> uses the CI default `VITE_API_URL=http://localhost:8000`, which is fine when the
> browser and backend share a host. For a real domain, either rebuild the frontend
> image with `--build-arg VITE_API_URL=https://api.example.com`, or serve the API
> behind the same origin via a reverse proxy.

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
