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

-- Kullanıcı hesapları (JWT auth). preferences JSON olarak saklanır.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    name          TEXT,
    password_hash TEXT NOT NULL,
    preferences   TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL
);

-- Köşe yazarları (Opinion). slug, frontend yönlendirmesinde kullanılır.
CREATE TABLE IF NOT EXISTS columnists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    title      TEXT,
    bio        TEXT,
    avatar     TEXT,
    created_at TEXT NOT NULL
);

-- Köşe yazıları. columnist_id, yazara bağlar.
CREATE TABLE IF NOT EXISTS columns (
    id           TEXT PRIMARY KEY,
    columnist_id INTEGER NOT NULL,
    kicker       TEXT,
    title        TEXT NOT NULL,
    dek          TEXT,
    body_json    TEXT NOT NULL,
    read_time    TEXT,
    date         TEXT,
    image        TEXT,
    created_at   TEXT NOT NULL,
    FOREIGN KEY (columnist_id) REFERENCES columnists (id)
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


# --------------------------------------------------------------------------- #
#  Kullanıcılar — kayıt, giriş, kişiselleştirme tercihleri (JWT auth).
# --------------------------------------------------------------------------- #


def _user_to_public(row: sqlite3.Row) -> dict:
    """DB satırını parola hash'i HARİÇ, güvenli bir kullanıcı sözlüğüne çevirir."""
    try:
        prefs = json.loads(row["preferences"]) if row["preferences"] else {}
    except (json.JSONDecodeError, TypeError):
        prefs = {}
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"] or row["email"].split("@")[0],
        "preferences": prefs,
    }


def create_user(email: str, password_hash: str, name: str = "", preferences: dict | None = None) -> dict:
    """Yeni bir kullanıcı oluşturur ve genel (parolasız) temsilini döndürür."""
    email = email.strip().lower()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO users (email, name, password_hash, preferences, created_at)
            VALUES (?,?,?,?,?)
            """,
            (
                email,
                name.strip() or email.split("@")[0],
                password_hash,
                json.dumps(preferences or {}, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return _user_to_public(row)


def get_user_auth(email: str) -> dict | None:
    """Giriş doğrulaması için parola hash'iyle birlikte kullanıcıyı döndürür."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()
        if not row:
            return None
        public = _user_to_public(row)
        public["password_hash"] = row["password_hash"]
        return public


def get_user(user_id: int) -> dict | None:
    """id ile genel (parolasız) kullanıcıyı döndürür."""
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _user_to_public(row) if row else None


def update_user_preferences(user_id: int, preferences: dict) -> dict | None:
    """Kullanıcının kişiselleştirme tercihlerini günceller."""
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET preferences = ? WHERE id = ?",
            (json.dumps(preferences, ensure_ascii=False), user_id),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _user_to_public(row) if row else None


# --------------------------------------------------------------------------- #
#  Köşe yazarları (Opinion) — yazarlar ve yazıları.
# --------------------------------------------------------------------------- #


def _columnist_to_frontend(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "title": row["title"],
        "bio": row["bio"],
        "avatar": row["avatar"],
    }


def _column_to_frontend(row: sqlite3.Row, columnist: dict | None = None) -> dict:
    return {
        "id": row["id"],
        "columnistId": row["columnist_id"],
        "kicker": row["kicker"],
        "title": row["title"],
        "dek": row["dek"],
        "body": json.loads(row["body_json"]),
        "readTime": row["read_time"],
        "date": row["date"],
        "image": row["image"],
        "columnist": columnist,
    }


def get_columnists() -> list[dict]:
    """Tüm köşe yazarlarını döndürür."""
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM columnists ORDER BY id ASC").fetchall()
        return [_columnist_to_frontend(r) for r in rows]


def get_columnist(slug: str) -> dict | None:
    """Tek bir yazarı, yazılarıyla birlikte döndürür."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM columnists WHERE slug = ?", (slug,)
        ).fetchone()
        if not row:
            return None
        columnist = _columnist_to_frontend(row)
        col_rows = conn.execute(
            "SELECT * FROM columns WHERE columnist_id = ? ORDER BY created_at DESC",
            (row["id"],),
        ).fetchall()
        columnist["columns"] = [_column_to_frontend(c) for c in col_rows]
        return columnist


def get_all_columns(limit: int = 30) -> list[dict]:
    """En yeni köşe yazılarını, yazar bilgisi gömülü olarak döndürür."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM columns ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        result = []
        for r in rows:
            crow = conn.execute(
                "SELECT * FROM columnists WHERE id = ?", (r["columnist_id"],)
            ).fetchone()
            result.append(
                _column_to_frontend(r, _columnist_to_frontend(crow) if crow else None)
            )
        return result


def get_column(column_id: str) -> dict | None:
    """Tek bir köşe yazısını yazar bilgisiyle döndürür."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM columns WHERE id = ?", (column_id,)
        ).fetchone()
        if not row:
            return None
        crow = conn.execute(
            "SELECT * FROM columnists WHERE id = ?", (row["columnist_id"],)
        ).fetchone()
        return _column_to_frontend(row, _columnist_to_frontend(crow) if crow else None)


def seed_columnists() -> None:
    """Başlangıçta (boşsa) mock köşe yazarlarını ve birkaç yazıyı ekler."""
    with _connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS n FROM columnists").fetchone()["n"]
        if count:
            return  # Zaten dolu; tekrar ekleme.

    now = datetime.now(timezone.utc)
    date_str = now.strftime("%d %B %Y")
    iso = now.isoformat()

    columnists = [
        {
            "slug": "elif-deniz",
            "name": "Elif Deniz",
            "title": "Teknoloji & Toplum",
            "bio": "Yapay zekânın gündelik hayatı nasıl yeniden kurduğunu yazıyor. "
            "Eski bir yazılım mühendisi; teknoloji ile etik arasındaki gerilim hattında dolaşıyor.",
            "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
            "columns": [
                {
                    "kicker": "Yapay Zekâ",
                    "title": "Makineler Düşünmüyor; Biz Onlara Anlam Yüklüyoruz",
                    "dek": "Büyük dil modellerini 'akıllı' sanmak, aynanın içindeki kendi yansımamıza hayran olmaktır.",
                    "body": [
                        "Bir sistemin akıcı cümleler kurması, onu düşünen bir özne yapmaz. Yapay zekânın bugünkü hâli, devasa bir örüntü tahmin makinesidir; bizim ona yüklediğimiz anlamı bize geri yansıtır.",
                        "Yine de bu yansımayı küçümsemek yanlış olur. İnsanların çoğu kararını da sezgi ve örüntü üzerinden verir. Asıl mesele, makinenin 'düşünüp düşünmediği' değil; onu hangi sorumlulukla kullandığımızdır.",
                        "Teknolojiyi büyüleyici kılan, onun bize kendimizi gösteren bir ayna oluşudur. Tehlike de buradadır: Aynaya çok uzun bakan, dışarıdaki dünyayı unutur.",
                        "Önümüzdeki on yılda asıl tartışma, modellerin ne kadar 'zeki' olduğu değil; toplumun bu araçlar üzerindeki denetimini nasıl koruyacağı olacak.",
                    ],
                    "read_time": "4 dk okuma",
                    "image": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
                },
                {
                    "kicker": "Mahremiyet",
                    "title": "Veri Senin Gölgen: Onu Kimseye Ödünç Verme",
                    "dek": "Ücretsiz olan her hizmetin bedelini, çoğu zaman farkında olmadan kendi mahremiyetimizle ödüyoruz.",
                    "body": [
                        "Dijital hayatta hiçbir şey gerçekten ücretsiz değildir. Bedelini ödediğimiz para değilse, büyük olasılıkla bedeli kendi verimizdir.",
                        "Veri, kişinin gölgesi gibidir: Nereye gittiğini, neye baktığını, neyden çekindiğini taşır. Bu gölgeyi pazarlayan bir ekonomi, mahremiyeti bir lükse çevirir.",
                        "Çözüm, teknolojiden kaçmak değil; kullanıcının kendi verisi üzerinde söz sahibi olduğu bir mimariyi talep etmektir.",
                    ],
                    "read_time": "3 dk okuma",
                    "image": "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=1200&q=80",
                },
            ],
        },
        {
            "slug": "mert-kayhan",
            "name": "Mert Kayhan",
            "title": "Ekonomi & Piyasalar",
            "bio": "Piyasaların gürültüsü altındaki sinyali arıyor. Makroekonomi, faiz ve "
            "küresel ticaret üzerine soğukkanlı analizler yazıyor.",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
            "columns": [
                {
                    "kicker": "Para Politikası",
                    "title": "Faiz Kararlarını Okumak: Sözcüklerin Ardındaki Niyet",
                    "dek": "Merkez bankalarının asıl mesajı genelde rakamlarda değil, cümlelerin tonundadır.",
                    "body": [
                        "Piyasalar yalnızca faiz oranını değil, kararı anlatan metnin kelimelerini de fiyatlar. Bir 'temkinli' sözcüğü, çoğu zaman çeyrek puanlık bir adımdan daha güçlü sinyal taşır.",
                        "Yatırımcının işi, bu dilin ardındaki niyeti ölçmektir. Enflasyon yavaşlasa bile bankalar erken gevşemekten kaçınır; çünkü güvenilirlik, bir kez kaybedildiğinde pahalıya geri alınır.",
                        "Uzun vadede kazanan, manşete değil; eğilime bakandır.",
                    ],
                    "read_time": "5 dk okuma",
                    "image": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
                },
            ],
        },
        {
            "slug": "selin-aydin",
            "name": "Selin Aydın",
            "title": "Kültür & Edebiyat",
            "bio": "Kitapların, sahnelerin ve kentin kültürel nabzının peşinde. "
            "Edebiyatın gündelik hayata sızan o sessiz gücünü anlatıyor.",
            "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
            "columns": [
                {
                    "kicker": "Edebiyat",
                    "title": "Yavaş Okumanın İncelikli Bir İsyan Oluşu",
                    "dek": "Her şeyin hızlandığı bir çağda bir romanı ağırdan almak, sessiz bir başkaldırıdır.",
                    "body": [
                        "Bildirimlerin sürekli böldüğü bir dikkat ekonomisinde, bir kitabı baştan sona, acele etmeden okumak neredeyse politik bir tavra dönüşüyor.",
                        "Yavaş okumak, metnin değil okurun da derinleşmesidir. Cümlenin içinde oyalanmak, hızını kaybetmiş gibi görünse de aslında düşünceyi geri kazanmaktır.",
                        "Edebiyat, bize zamanı yeniden nasıl sahipleneceğimizi öğretir. Belki de en radikal eylem, telefonu bırakıp bir sayfayı ikinci kez okumaktır.",
                    ],
                    "read_time": "3 dk okuma",
                    "image": "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=80",
                },
            ],
        },
        {
            "slug": "deniz-toprak",
            "name": "Deniz Toprak",
            "title": "Spor",
            "bio": "Sahanın içindeki taktikten soyunma odasının psikolojisine, "
            "sporu bir anlatı olarak okuyor.",
            "avatar": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=256&q=80",
            "columns": [
                {
                    "kicker": "Futbol",
                    "title": "Modern Futbolda Kazanan Takım Değil, Sistem",
                    "dek": "Yıldız oyuncu çağı kapanıyor; artık şampiyonluğu kolektif bir fikir belirliyor.",
                    "body": [
                        "Bugün şampiyon olan takımlar, bir oyuncunun parıltısına değil; sahanın her metrekaresini kapsayan bir oyun fikrine yaslanıyor.",
                        "Pres, top kullanımı ve geçiş hızları artık sezgiyle değil, veriyle yönetiliyor. Yine de futbolun ruhu, bu hesapların arasından sıyrılan o öngörülemez ana dair.",
                        "Sistem kazandırır; ama insanı tribüne bağlayan, o sistemin çatlağından doğan beklenmedik kahramanlıktır.",
                    ],
                    "read_time": "4 dk okuma",
                    "image": "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
                },
            ],
        },
    ]

    with _connect() as conn:
        for c in columnists:
            cur = conn.execute(
                """
                INSERT INTO columnists (slug, name, title, bio, avatar, created_at)
                VALUES (?,?,?,?,?,?)
                """,
                (c["slug"], c["name"], c["title"], c["bio"], c["avatar"], iso),
            )
            columnist_id = cur.lastrowid
            for col in c["columns"]:
                col_id = _slugify(col["title"], c["slug"] + col["title"])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO columns
                    (id, columnist_id, kicker, title, dek, body_json, read_time, date, image, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        col_id,
                        columnist_id,
                        col["kicker"],
                        col["title"],
                        col["dek"],
                        json.dumps(col["body"], ensure_ascii=False),
                        col["read_time"],
                        date_str,
                        col["image"],
                        iso,
                    ),
                )


if __name__ == "__main__":
    init_db()
    seed_columnists()
    print(f"Veritabanı hazır: {DB_PATH}")
    print(f"Kayıtlı makale sayısı: {len(get_all_articles())}")
    print(f"Köşe yazarı sayısı: {len(get_columnists())}")
