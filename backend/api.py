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
import re
import uuid
import threading

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import (
    init_db,
    query_articles,
    get_article,
    create_job,
    update_job_status,
    get_job_status,
    create_user,
    get_user_auth,
    update_user_preferences,
    get_columnists,
    get_columnist,
    get_all_columns,
    get_column,
    save_columnists,
    try_claim_scrape,
)
from scraper import COLUMNISTS, scrape_columnists, SOURCE_NAMES
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from pipeline import run as run_pipeline

app = FastAPI(title="Singularity API", version="1.0.0")

# Otomatik tarama: son taramadan bu kadar saniye geçtiyse, gelen istek arka
# planda yeni bir tarama tetikler (trafik-tetiklemeli; Render free için ideal).
AUTO_SCRAPE_INTERVAL = int(os.environ.get("AUTO_SCRAPE_INTERVAL", "90"))


def _safe_pipeline_run() -> None:
    try:
        run_pipeline()
    except Exception:  # noqa: BLE001
        pass


def _maybe_scrape(min_interval: int = AUTO_SCRAPE_INTERVAL) -> None:
    """Tarama yeterince eskiyse, arka planda (bloklamadan) yeni tarama başlatır."""
    if try_claim_scrape(min_interval):
        threading.Thread(target=_safe_pipeline_run, daemon=True).start()

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


def _refresh_columnists_bg() -> None:
    """Gerçek köşe yazılarını arka planda toplar (açılışı bloklamaz)."""
    try:
        save_columnists(scrape_columnists())
    except Exception:  # noqa: BLE001
        pass


@app.on_event("startup")
def _startup() -> None:
    init_db()
    # Yazar üst bilgisini anında ekle (bölüm boş kalmasın); gerçek yazıları
    # arka planda topla.
    save_columnists([{**c, "columns": []} for c in COLUMNISTS])
    threading.Thread(target=_refresh_columnists_bg, daemon=True).start()
    # Açılışta (servis uyandığında) hemen bir tarama başlat: veritabanı boşsa
    # taze haberler kısa sürede dolsun.
    _maybe_scrape()


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

    Her istek, tarama eskiyse arka planda taze bir tarama tetikler (debounce'lu);
    böylece sayfa yenilendikçe yeni haberler kısa sürede akışa düşer.

    Örn: /api/articles?categories=Ekonomi,Dünya&sources=NTV,Reuters
    """
    _maybe_scrape()
    return query_articles(
        categories=_split_csv(categories),
        sources=_split_csv(sources),
        limit=limit,
    )


@app.get("/api/sources")
def list_sources() -> dict:
    """Bölgeye göre gruplanmış kaynak adlarını döndürür (frontend filtresi için)."""
    return SOURCE_NAMES


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
def refresh(background_tasks: BackgroundTasks, per_feed: int = 4) -> dict:
    """Çeviri hattını arka planda tetikler ve takip için bir job_id döndürür."""
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


# --------------------------------------------------------------------------- #
#  Kimlik doğrulama (Auth) — kayıt, giriş, profil, tercihler.
# --------------------------------------------------------------------------- #

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterBody(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str = ""


class LoginBody(BaseModel):
    email: str
    password: str


class PreferencesBody(BaseModel):
    categories: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)


@app.post("/api/auth/register")
def register(body: RegisterBody) -> dict:
    """Yeni hesap oluşturur ve oturum token'ı döndürür."""
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Geçerli bir e-posta girin.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Parola en az 6 karakter olmalı.")
    if get_user_auth(email) is not None:
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayıtlı.")

    user = create_user(
        email=email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    token = create_access_token(user["id"])
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def login(body: LoginBody) -> dict:
    """E-posta + parola ile giriş yapar ve oturum token'ı döndürür."""
    record = get_user_auth(body.email)
    if record is None or not verify_password(body.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya parola hatalı.")
    record.pop("password_hash", None)
    token = create_access_token(record["id"])
    return {"token": token, "user": record}


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    """Geçerli token'a karşılık gelen kullanıcıyı döndürür."""
    return user


@app.put("/api/auth/preferences")
def save_preferences(
    body: PreferencesBody, user: dict = Depends(get_current_user)
) -> dict:
    """Giriş yapmış kullanıcının kişiselleştirme tercihlerini günceller."""
    updated = update_user_preferences(
        user["id"], {"categories": body.categories, "sources": body.sources}
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return updated


# --------------------------------------------------------------------------- #
#  Köşe yazarları (Opinion).
# --------------------------------------------------------------------------- #


@app.get("/api/columnists")
def list_columnists() -> list[dict]:
    """Tüm köşe yazarlarını döndürür."""
    return get_columnists()


@app.get("/api/columnists/{slug}")
def read_columnist(slug: str) -> dict:
    """Tek bir yazarı, yazılarıyla birlikte döndürür."""
    columnist = get_columnist(slug)
    if not columnist:
        raise HTTPException(status_code=404, detail="Yazar bulunamadı")
    return columnist


@app.get("/api/columns")
def list_columns(limit: int = 30) -> list[dict]:
    """En yeni köşe yazılarını döndürür."""
    return get_all_columns(limit=limit)


@app.get("/api/columns/{column_id}")
def read_column(column_id: str) -> dict:
    """Tek bir köşe yazısını döndürür."""
    column = get_column(column_id)
    if not column:
        raise HTTPException(status_code=404, detail="Köşe yazısı bulunamadı")
    return column
