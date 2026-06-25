"""
scraper.py — Türkiye ve dünyadan, farklı kategorilerdeki haberleri toplar.

İki aşama:
  1) feedparser ile RSS beslemelerinden başlık + link toplanır.
  2) BeautifulSoup ile her makalenin tam gövdesi ve görseli (og:image) çekilir.

Her besleme bir kaynak (source_name), bölge (region) ve önerilen kategori
(category) ile etiketlenir; bu meta veriler çeviri/yeniden-yazım katmanına ve
filtrelemeye taşınır. URL'ler örnek niteliğindedir; kaynakların güncel RSS
adresleriyle değiştirilebilir. Kazıma, kaynakların robots.txt ve kullanım
koşullarına saygı duyularak yapılmalıdır.
"""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from typing import Iterable

import feedparser
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("singularity.scraper")

# Genişletilmiş kaynak listesi: (kaynak, bölge, kategori, rss).
# Türkçe kaynaklar yeniden-yazım (anti-clickbait), yabancılar çeviri hattına gider.
FEEDS: list[dict[str, str]] = [
    # --- Küresel ---
    {"name": "Reuters", "region": "Küresel", "category": "Dünya",
     "url": "https://www.reutersagency.com/feed/?best-topics=world&post_type=best"},
    {"name": "Reuters", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.reutersagency.com/feed/?best-topics=tech&post_type=best"},
    {"name": "AP", "region": "Küresel", "category": "Dünya",
     "url": "https://feedx.net/rss/ap.xml"},
    {"name": "Bloomberg", "region": "Küresel", "category": "Ekonomi",
     "url": "https://feeds.bloomberg.com/markets/news.rss"},
    # --- Türkiye ---
    {"name": "BBC Türkçe", "region": "Türkiye", "category": "Gündem",
     "url": "https://feeds.bbci.co.uk/turkce/rss.xml"},
    {"name": "NTV", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.ntv.com.tr/gundem.rss"},
    {"name": "NTV", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.ntv.com.tr/ekonomi.rss"},
    {"name": "NTV", "region": "Türkiye", "category": "Spor",
     "url": "https://www.ntv.com.tr/spor.rss"},
    {"name": "Sözcü", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.sozcu.com.tr/feed/"},
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36 SingularityBot/1.0"
    )
}

REQUEST_TIMEOUT = 20
POLITE_DELAY_SECONDS = 1.5  # Kaynaklara karşı kibarlık: istekler arası bekleme.


@dataclass
class RawArticle:
    """Çeviri/yeniden-yazımdan ÖNCE, kaynaktan çekilen ham içerik."""

    source_name: str
    source_url: str
    title: str
    region: str = ""          # "Türkiye" | "Küresel"
    category: str = ""        # önerilen kategori (LLM teyit eder)
    summary: str = ""
    content: str = ""
    image_url: str | None = None
    published: str | None = None
    tags: list[str] = field(default_factory=list)


def fetch_feed_entries(feed: dict[str, str], limit: int = 5) -> list[RawArticle]:
    """Tek bir besleme tanımından en yeni `limit` haberi RawArticle olarak döndürür."""
    logger.info("Besleme taranıyor: %s / %s", feed["name"], feed["category"])
    parsed = feedparser.parse(feed["url"], request_headers=HEADERS)

    if parsed.bozo:
        logger.warning("Besleme uyarısı (%s): %s", feed["name"], parsed.bozo_exception)

    articles: list[RawArticle] = []
    for entry in parsed.entries[:limit]:
        summary = BeautifulSoup(entry.get("summary", ""), "html.parser").get_text(" ", strip=True)
        tags = [t.get("term", "") for t in entry.get("tags", [])] if entry.get("tags") else []
        articles.append(
            RawArticle(
                source_name=feed["name"],
                source_url=entry.get("link", ""),
                title=entry.get("title", "").strip(),
                region=feed.get("region", ""),
                category=feed.get("category", ""),
                summary=summary,
                published=entry.get("published", entry.get("updated")),
                tags=[t for t in tags if t],
            )
        )
    return articles


def enrich_with_full_text(article: RawArticle) -> RawArticle:
    """Makale linkini ziyaret edip tam gövdeyi ve kapak görselini ekler."""
    if not article.source_url:
        return article

    try:
        resp = requests.get(article.source_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Makale indirilemedi (%s): %s", article.source_url, exc)
        return article

    soup = BeautifulSoup(resp.text, "lxml")

    for selector in [
        ("meta", {"property": "og:image"}),
        ("meta", {"name": "twitter:image"}),
    ]:
        tag = soup.find(*selector)
        if tag and tag.get("content"):
            article.image_url = tag["content"]
            break

    container = soup.find("article") or soup.body
    paragraphs: list[str] = []
    if container:
        for p in container.find_all("p"):
            text = p.get_text(" ", strip=True)
            if len(text) > 40:  # kısa "boilerplate" satırlarını ele
                paragraphs.append(text)

    article.content = "\n\n".join(paragraphs[:25])
    return article


def scrape_sources(
    feeds: list[dict[str, str]] | None = None, per_feed: int = 4
) -> Iterable[RawArticle]:
    """Tüm beslemeleri sırayla tarar, her makaleyi tam metinle zenginleştirir."""
    feeds = feeds or FEEDS
    for feed in feeds:
        try:
            entries = fetch_feed_entries(feed, limit=per_feed)
        except Exception as exc:  # noqa: BLE001 — tek besleme tüm hattı durdurmasın.
            logger.error("Besleme hatası (%s): %s", feed.get("name"), exc)
            continue

        for entry in entries:
            yield enrich_with_full_text(entry)
            time.sleep(POLITE_DELAY_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    for art in scrape_sources(per_feed=2):
        print(f"\n[{art.source_name} · {art.region} · {art.category}] {art.title}")
        print(f"  link  : {art.source_url}")
        print(f"  görsel: {art.image_url}")
        print(f"  gövde : {len(art.content)} karakter")
