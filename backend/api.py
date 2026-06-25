"""
api.py — React frontend'ine çevrilmiş haberleri sunan FastAPI servisi.

Çalıştırma:
    uvicorn api:app --reload --port 8000

Uç noktalar:
    GET /api/articles        → tüm makaleler (frontend ARTICLES dizisiyle aynı şekil)
    GET /api/articles/{id}   → tek makale
    POST /api/refresh        → çeviri hattını manuel tetikle (arka planda)
"""

from __future__ import annotations

import os
import uuid

from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware

from database import (
    init_db,
    query_articles,
    get_article,
    create_job,
    update_job_status,
    get_job_status,
)
from pipeline import run as run_pipeline

app = FastAPI(title="Singularity API", version="1.0.0")

# CORS sıkılaştırma: izinli kaynaklar .env'deki ALLOWED_ORIGINS'ten (virgülle
# ayrılmış) okunur. Tanımlı değilse güvenli yerel varsayılanlara düşülür.
# Örn: ALLOWED_ORIGINS=https://singularity.vercel.app,https://www.example.com
DEFAULT_ORIGINS = [
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:80",
]
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
] or DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


def _split_csv(value: str | None) -> list[str] | None:
    """'Ekonomi,Dünya' → ['Ekonomi', 'Dünya']; boşsa None."""
    if not value:
        return None
    items = [v.strip() for v in value.split(",") if v.strip()]
    return items or None


@app.get("/api/articles")
def list_articles(
    categories: str | None = None,
    sources: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Tercihlere göre filtrelenmiş makale listesini döndürür.

    Örn: /api/articles?categories=Ekonomi,Dünya&sources=NTV,Reuters
    """
    return query_articles(
        categories=_split_csv(categories),
        sources=_split_csv(sources),
        limit=limit,
    )


@app.get("/api/articles/{article_id}")
def read_article(article_id: str) -> dict:
    """Tek bir makaleyi döndürür."""
    article = get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")
    return article


def _pipeline_job(job_id: str, per_feed: int) -> None:
    """Hattı çalıştırır ve işin nihai durumunu SQLite'a yazar (çok-worker uyumlu)."""
    try:
        run_pipeline(per_feed)
        update_job_status(job_id, "completed")
    except Exception as exc:  # noqa: BLE001
        update_job_status(job_id, f"failed: {exc}")


@app.post("/api/refresh")
def refresh(
    background_tasks: BackgroundTasks,
    per_feed: int = 4,
    x_cron_secret: str | None = Header(None),
) -> dict:
    """Çeviri hattını arka planda tetikler ve takip için bir job_id döndürür.

    Maliyet koruması: CRON_SECRET tanımlıysa, istek 'x-cron-secret' başlığında
    aynı değeri taşımalıdır. Tanımlı değilse (yerel ortam) kontrol atlanır.
    """
    expected_secret = os.getenv("CRON_SECRET")
    if expected_secret and x_cron_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Unauthorized")

    job_id = str(uuid.uuid4())
    create_job(job_id)  # 'running' olarak diske yazılır; tüm worker'lar görür.
    background_tasks.add_task(_pipeline_job, job_id, per_feed)
    return {
        "status": "success",
        "job_id": job_id,
        "message": "Muhabir botlar sahaya sürüldü. Yeni ajans haberleri derleniyor…",
    }


@app.get("/api/status/{job_id}")
def job_status(job_id: str) -> dict:
    """Hangi worker'a düşerse düşsün, durumu diskten doğru okur."""
    return {"job_id": job_id, "status": get_job_status(job_id)}
