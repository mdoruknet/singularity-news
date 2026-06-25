"""
database.py — Çevrilen haberleri saklayan basit SQLite katmanı.

Harici bir ORM'e bağımlı kalmamak için yalnızca standart kütüphanedeki
`sqlite3` kullanılır. Çok sütunlu liste alanları (body, source) JSON olarak
saklanır ve okurken çözülür. Kayıtların `id` alanı, frontend'in beklediği
slug formatındadır.
"""

from __future__ import annotations

import os
import re
import json
import sqlite3
import hashlib
from datetime import datetime, timezone

DB_PATH = os.environ.get("SINGULARITY_DB", "singularity.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    id            TEXT PRIMARY KEY,
    source_url    TEXT UNIQUE NOT NULL,
    source_name   TEXT NOT NULL,
    original_title TEXT,
    category      TEXT,
    kicker        TEXT,
    title         TEXT NOT NULL,
    dek           TEXT,
    author        TEXT,
    date          TEXT,
    read_time     TEXT,
    image         TEXT,
    image_caption TEXT,
    image_credit  TEXT,
    rewritten     INTEGER NOT NULL DEFAULT 0,
    body_json     TEXT NOT NULL,
    created_at    TEXT NOT NULL
);

-- Çok-worker uyumlu iş (job) takip tablosu: "Yeni Baskı" durumunu diskte tutar.
CREATE TABLE IF NOT EXISTS jobs (
    job_id     TEXT PRIMARY KEY,
    status     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Tabloyu (yoksa) oluşturur."""
    with _connect() as conn:
        conn.executescript(SCHEMA)


def _slugify(title: str, source_url: str) -> str:
    """Türkçe başlıktan URL-dostu, çakışmayan bir kimlik üretir."""
    base = title.lower()
    replacements = {"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u"}
    for tr, en in replacements.items():
        base = base.replace(tr, en)
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:60]
    short_hash = hashlib.sha1(source_url.encode("utf-8")).hexdigest()[:6]
    return f"{base}-{short_hash}" if base else short_hash


def article_exists(source_url: str) -> bool:
    """Bu kaynak URL'i daha önce işlendiyse True döner (tekrar çeviriyi önler)."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM articles WHERE source_url = ?", (source_url,)
        ).fetchone()
        return row is not None


def save_article(
    *,
    source_url: str,
    source_name: str,
    category: str,
    kicker: str,
    original_title: str = "",
    title: str,
    dek: str,
    read_time: str,
    image: str | None,
    image_caption: str,
    body: list[str],
    image_credit: str = "Fotoğraf: Kaynak",
    author: str = "Çeviri: Singularity AI Bot",
    rewritten: bool = False,
) -> str:
    """Çevrilmiş/yeniden-yazılmış bir makaleyi kaydeder ve atanan id'yi döndürür."""
    article_id = _slugify(title, source_url)
    date_str = datetime.now(timezone.utc).strftime("%d %B %Y")

    with _connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO articles
            (id, source_url, source_name, original_title, category, kicker, title,
             dek, author, date, read_time, image, image_caption, image_credit,
             rewritten, body_json, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                article_id,
                source_url,
                source_name,
                original_title,
                category,
                kicker,
                title,
                dek,
                author,
                date_str,
                read_time,
                image,
                image_caption,
                image_credit,
                1 if rewritten else 0,
                json.dumps(body, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    return article_id


def _row_to_frontend(row: sqlite3.Row) -> dict:
    """DB satırını, React frontend'inin ARTICLES şemasına dönüştürür."""
    return {
        "id": row["id"],
        "category": row["category"],
        "kicker": row["kicker"],
        "title": row["title"],
        "dek": row["dek"],
        "author": row["author"],
        "date": row["date"],
        "readTime": row["read_time"],
        "image": row["image"],
        "imageCaption": row["image_caption"],
        "imageCredit": row["image_credit"],
        "rewritten": bool(row["rewritten"]),
        "originalTitle": row["original_title"],
        "source": {"name": row["source_name"], "url": row["source_url"]},
        "body": json.loads(row["body_json"]),
    }


def get_all_articles(limit: int = 50) -> list[dict]:
    """En yeni makaleleri frontend formatında döndürür."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM articles ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_row_to_frontend(r) for r in rows]


def query_articles(
    categories: list[str] | None = None,
    sources: list[str] | None = None,
    limit: int = 50,
) -> list[dict]:
    """Kategori ve/veya kaynak filtresine göre makaleleri döndürür.

    Filtre verilmezse tüm makaleleri döndürür. Frontend'in
    ?categories=Ekonomi,Dünya&sources=NTV,Reuters sorgusunu karşılar.
    """
    clauses: list[str] = []
    params: list = []

    if categories:
        placeholders = ",".join("?" * len(categories))
        clauses.append(f"category IN ({placeholders})")
        params.extend(categories)
    if sources:
        placeholders = ",".join("?" * len(sources))
        clauses.append(f"source_name IN ({placeholders})")
        params.extend(sources)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f"SELECT * FROM articles{where} ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    with _connect() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [_row_to_frontend(r) for r in rows]


def get_article(article_id: str) -> dict | None:
    """Tek bir makaleyi id ile döndürür."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
        return _row_to_frontend(row) if row else None


# --------------------------------------------------------------------------- #
#  İş (job) takibi — "Yeni Baskı" yenilemesinin durumu (çok-worker uyumlu).
# --------------------------------------------------------------------------- #


def cleanup_old_jobs(hours: int = 24) -> None:
    """Belirtilen saatten eski iş kayıtlarını siler (jobs tablosu sonsuz büyümesin).

    created_at ISO-8601 (…T…+00:00) saklandığından, SQLite'ın boşluk ayraçlı
    datetime() çıktısıyla doğru karşılaştırmak için iki tarafı da datetime() ile
    normalize ederiz.
    """
    with _connect() as conn:
        conn.execute(
            "DELETE FROM jobs WHERE datetime(created_at) <= datetime('now', ?)",
            (f"-{hours} hours",),
        )


def create_job(job_id: str) -> None:
    """Yeni bir işi 'running' olarak kaydeder (tüm worker'lar görebilir)."""
    cleanup_old_jobs()  # Yeni iş eklemeden önce eski kayıtları sessizce temizle.
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO jobs (job_id, status, created_at) VALUES (?, 'running', ?)",
            (job_id, datetime.now(timezone.utc).isoformat()),
        )


def update_job_status(job_id: str, status: str) -> None:
    """Bir işin durumunu günceller (completed / failed: ...)."""
    with _connect() as conn:
        conn.execute(
            "UPDATE jobs SET status = ?, updated_at = ? WHERE job_id = ?",
            (status, datetime.now(timezone.utc).isoformat(), job_id),
        )


def get_job_status(job_id: str) -> str:
    """Bir işin güncel durumunu döndürür; yoksa 'not_found'."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT status FROM jobs WHERE job_id = ?", (job_id,)
        ).fetchone()
        return row["status"] if row else "not_found"


if __name__ == "__main__":
    init_db()
    print(f"Veritabanı hazır: {DB_PATH}")
    print(f"Kayıtlı makale sayısı: {len(get_all_articles())}")
