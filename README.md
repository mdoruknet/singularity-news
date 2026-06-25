<h1 align="center">Singularity</h1>

<p align="center">
  <em>An autonomous, personalizable global news desk that scrapes the world's
  press, then uses an LLM to translate foreign reporting and <strong>rewrite
  manipulative local clickbait</strong> into calm, New-York-Times-style
  journalism — in Turkish.</em>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white">
  <img alt="Claude" src="https://img.shields.io/badge/Anthropic-Claude-D97757">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

---

## Project Vision

Most "AI news" products are content farms: machine-translated, SEO-stuffed, and
indistinguishable from the noise they aggregate. **Singularity** asks the
opposite question — *what if generative AI were used to raise editorial
standards instead of lowering them?*

The result fuses two ideas:

- **The aesthetic of a century-old broadsheet.** A pixel-faithful homage to *The
  New York Times*: a blackletter masthead, serif headlines and body copy,
  sans-serif metadata, an asymmetric ruled grid, drop caps, and a focused
  reading column — now with a first-class dark mode.
- **An autonomous GenAI newsroom.** A background pipeline scrapes global sources
  on a schedule, and an LLM acts as a senior editor: it **translates** foreign
  reporting while preserving technical terminology, and it **rewrites** sensational
  local clickbait into sober, inverted-pyramid prose.

The reader gets a quiet, authoritative paper. The engineering underneath is the
interesting part.

---

## Key Features

- 📰 **NYT-grade editorial UI** — asymmetric multi-column grid, hairline rules,
  drop caps, dedicated article view, source attribution on every story.
- 🌗 **Dark mode** — editorial anthracite (not pure black), persisted to
  `localStorage`, with a pre-paint script that eliminates the dark-mode flash.
- ⚙️ **Personalized feed** — a slide-in drawer to pick categories and sources;
  preferences persist and drive both the UI filter and server-side queries.
- 🤖 **Anti-clickbait engine** — bilingual LLM editor (translate vs. rewrite) with
  a visible **"Clickbait Prevented"** wall of shame.
- ♻️ **Autonomous scheduler** — refreshes the desk every 2 hours, collision-free.
- 🐳 **One-command deploy** — `docker compose up` brings up frontend, API, and
  scheduler with a persistent database.

---

## Architecture Decisions

These are the decisions I'd want to talk through in a review.

### 1. The Anti-Clickbait Engine

The translator is not a translator — it's an **editor with two modes**, selected
by the language of the incoming article (see
[`backend/translator.py`](backend/translator.py)):

- **Foreign-language input → Translate.** Render into fluent editorial Turkish
  while *preserving* technical vocabulary (`LLM`, `RAG`, `inference`, `AGI`,
  `fine-tuning`…), glossing on first use.
- **Turkish clickbait input → Rewrite.** Strip sensational patterns ("you won't
  believe…", "shocking", emotional bait), keep the verifiable facts, and rewrite
  in the **inverted-pyramid** style — most important fact first (which is also the
  paragraph that gets the drop cap).

The LLM returns a **validated structured object** (Pydantic via the Anthropic
SDK's `messages.parse`), including a `rewritten` flag. When a piece was rewritten,
the **original clickbait headline is stored** (`original_title`) and surfaced in
the UI struck through, under a red **"Clickbait Prevented"** label — a small *wall
of shame* that makes the editorial value tangible:

```
✂ CLICKBAIT PREVENTED
"SHOCKING: the decision that affects MILLIONS — the one thing you must do…"
New zoning regulation streamlines the process for at-risk buildings   ← clean headline
```

### 2. Resilient Architecture — a zero-dependency job queue

The API runs with **4 uvicorn workers**. The naive way to add "refresh" and
"scheduling" — an in-process dict and an in-process cron — breaks under
multiprocessing: the dict isn't shared across workers, and the cron fires four
times. The textbook fix is Redis. I avoided that dependency.

- **Multi-worker job queue on SQLite.** Job state lives in a `jobs` table
  ([`backend/database.py`](backend/database.py)). `POST /api/refresh` writes
  `running` to disk and returns a `job_id`; `GET /api/status/{job_id}` reads it
  back. Any worker answers correctly because the source of truth is the shared
  disk, not a worker's memory.
- **Collision-free scheduling.** Cron lives in a **separate single-process
  service** ([`backend/scheduler.py`](backend/scheduler.py), APScheduler with
  `max_instances=1, coalesce=True`), so the pipeline runs exactly once per cycle
  regardless of API worker count.
- **A self-cleaning database.** Old jobs are pruned before each insert. This hid a
  subtle bug worth calling out: timestamps are stored as ISO-8601
  (`2026-06-25T13:30:00+00:00`, `T`-separated, offset-aware), but SQLite's
  `datetime('now', '-24 hours')` emits a space-separated, offset-naive string.
  A raw string `<=` comparison is therefore lexicographically wrong (`'T'` `0x54`
  vs space `0x20`). The fix normalizes **both** sides:
  ```sql
  DELETE FROM jobs WHERE datetime(created_at) <= datetime('now', ?)
  ```

> **When does this break?** SQLite is the right call for a single host. For
> multi-node horizontal scaling, swap the `jobs` table for Postgres/Redis — the
> interface (`create_job` / `update_job_status` / `get_job_status`) is already
> abstracted for exactly that move.

### 3. Frontend Engineering — correct async under React

The "New Edition" button triggers a background job and then **long-polls** for
completion. Two classic React traps were handled deliberately:

- **Stale closure in the poll loop.** A `setTimeout` poll that reads `isRefreshing`
  from state captures a stale value and the guard misfires. The active job id is
  tracked in a **`useRef`** instead, so the loop always reads the live value and
  cancels itself cleanly when a newer refresh starts. Timeouts are measured with
  `Date.now()` rather than a second stale `setTimeout`.
- **Double-fetch guard.** Live mode re-queries the API whenever preferences
  change (`[live, JSON.stringify(prefs)]`). A **`liveFetchDidMount`** ref skips the
  very first run so we don't duplicate the initial load.
- **Schema-tolerant ingestion.** `normalizeArticle` accepts both the rich API
  shape and a flatter one (`image_url`, `read_time_minutes`, `source_url`) and
  fills sensible defaults, so the UI never crashes on a missing field.
- **No flash of the wrong theme.** A tiny inline script in
  [`frontend/index.html`](frontend/index.html) applies the persisted theme before
  React mounts.

### 4. Graceful degradation

The frontend ships with built-in demo content and falls back to it when the API
is unreachable — so the single-file prototype works standalone (great for a
portfolio link) and lights up with live data when the backend is running. A
status chip shows **Live** vs **Demo**.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 6, Tailwind CSS v4 (`@custom-variant` dark mode), lucide-react |
| **Backend** | FastAPI, Uvicorn (4 workers), Pydantic |
| **AI** | Anthropic Claude (`claude-opus-4-8`) via structured outputs (`messages.parse`) |
| **Scraping** | feedparser (RSS), BeautifulSoup + lxml (full text & `og:image`) |
| **Data** | SQLite (articles + multi-worker job queue) |
| **Scheduling** | APScheduler (single-process, anti-collision) |
| **Infra** | Docker, Docker Compose, Nginx (multi-stage build, named volume) |

---

## Repository Layout

```
.
├── frontend/             # Vite + React SPA (single-file App.jsx)
│   ├── src/App.jsx       # entire UI: masthead, grid, article view, drawer, dark mode
│   ├── Dockerfile        # multi-stage: node build → nginx serve
│   └── nginx.conf        # SPA fallback + asset caching
├── backend/
│   ├── scraper.py        # RSS + article/full-text scraping (TR + global sources)
│   ├── translator.py     # bilingual anti-clickbait LLM editor (structured output)
│   ├── database.py       # SQLite: articles, filtering, job queue, self-cleaning
│   ├── pipeline.py       # orchestration: scrape → edit → persist (dedupes)
│   ├── scheduler.py      # autonomous every-2-hours trigger (single process)
│   ├── api.py            # FastAPI: articles, filtering, refresh + job status
│   └── Dockerfile
├── docker-compose.yml    # frontend + backend + scheduler + named volume
└── DEPLOYMENT.md         # Vercel / Render / Fly.io / DigitalOcean guides
```

---

## Local Setup

### Option A — Docker (everything, one command)

```bash
cp .env.example .env          # set ANTHROPIC_API_KEY
docker compose up --build
```

- Frontend → http://localhost (port 80)
- API → http://localhost:8000/api/articles
- The scheduler runs the pipeline on boot, then every 2 hours.
- Articles persist in the `singularity-data` volume across restarts.

### Option B — Manual (two terminals)

**Frontend**

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

**Backend**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set ANTHROPIC_API_KEY
python pipeline.py --per 3    # scrape → translate/rewrite → store
uvicorn api:app --reload      # http://localhost:8000
```

Without a backend, the frontend still runs on built-in demo content.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles?categories=Ekonomi,Dünya&sources=NTV,Reuters` | Filtered article list |
| `GET` | `/api/articles/{id}` | Single article |
| `POST` | `/api/refresh` | Trigger the pipeline; returns a `job_id` |
| `GET` | `/api/status/{job_id}` | `running` / `completed` / `failed` / `not_found` |

---

## Disclaimer

Singularity is an engineering portfolio project. All articles belong to their
original publishers; the platform only provides AI-assisted translation,
rewriting, and aggregation, and links back to every source. Scraping respects
each source's `robots.txt` and terms of use.
