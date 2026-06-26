"""
pipeline.py — Uçtan uca, HİBRİT otomasyon hattı (maliyet kalkanlı).

  tara (scraper)  →  [karar: AI mı, ham mı?]  →  kaydet (database)

Maliyet Kalkanı (Hybrid):
  Sık aralıklı (örn. 10 dk) çalıştığımız için yüzlerce haberi Claude'a yollamak
  faturayı patlatır. Bu yüzden hatta bir KARAR katmanı eklenmiştir:

    • Yabancı dildeki "besleme manşeti" (feed_rank < HEADLINE_RANKS)  → AI ÇEVİRİR
    • Türkçe TIK TUZAĞI başlık (is_clickbait)                         → AI YENİDEN YAZAR
    • Geri kalan rutin haberler / skorlar                            → AI'SIZ, HAM kaydedilir
                                                                        (rewritten=False)

  Ek olarak AI_BUDGET, tek bir turda yapılacak AI çağrısı sayısını sınırlar;
  böylece besleme sayısı artsa da maliyet öngörülebilir kalır.

Çalıştırma:
    python pipeline.py            # tüm varsayılan kaynakları işle
    python pipeline.py --per 2    # her kaynaktan 2 haber
"""

from __future__ import annotations

import os
import argparse
import logging

from dotenv import load_dotenv

from scraper import (
    fetch_all_feeds,
    enrich_many,
    is_clickbait,
    scrape_columnists,
    RawArticle,
    PER_FEED_DEFAULT,
)
from translator import translate_article
from database import init_db, article_exists, save_article, save_columnists

load_dotenv()  # .env içindeki ANTHROPIC_API_KEY'i yükle.

logger = logging.getLogger("singularity.pipeline")

# --- Hibrit ayarları (maliyet kalkanı) ---
# AI_BUDGET: tek turda en çok bu kadar AI (Claude) çağrısı yapılır. 150+ kaynak
# her 10 dakikada içeri aksa da, fatura bu sınırla öngörülebilir kalır. Ortamdan
# (AI_BUDGET) ezilebilir; varsayılan 12 (tur başına 10–15 aralığında).
AI_BUDGET = int(os.environ.get("AI_BUDGET", "12"))
HEADLINE_RANKS = 1    # Her beslemenin ilk N haberi "manşet" sayılır (AI'a gider).


def _should_use_ai(raw: RawArticle, ai_used: int) -> bool:
    """Bu haber AI'a mı gitmeli, yoksa ham mı kaydedilmeli?

    Maliyet kalkanı: AI yalnızca (a) bütçe dolmadıysa VE (b) haber gerçekten
    katma değer gerektiriyorsa (yabancı manşet → çeviri, Türkçe tık tuzağı →
    yeniden yazım) devreye girer.
    """
    if ai_used >= AI_BUDGET:
        return False
    is_foreign = raw.region != "Türkiye"
    if is_foreign and raw.feed_rank < HEADLINE_RANKS:
        return True  # Yabancı manşet → çeviri şart.
    if not is_foreign and is_clickbait(raw.title):
        return True  # Türkçe tık tuzağı → temizleyip yeniden yaz.
    return False


def _estimate_read_time(paragraphs: list[str]) -> str:
    words = sum(len(p.split()) for p in paragraphs)
    minutes = max(1, round(words / 200))
    return f"{minutes} dk okuma"


def _save_raw_passthrough(raw: RawArticle) -> str:
    """Haberi AI kullanmadan, orijinal hâliyle (rewritten=False) kaydeder.

    Hibrit hattın 'ucuz' kolu: rutin haberler ve skorlar buradan geçer.
    """
    paragraphs = [
        p.strip() for p in (raw.content or "").split("\n\n") if p.strip()
    ]
    if not paragraphs:
        paragraphs = [raw.summary] if raw.summary else [raw.title]

    dek = (raw.summary or paragraphs[0])[:200].strip()
    category = raw.category or "Gündem"

    return save_article(
        source_url=raw.source_url,
        source_name=raw.source_name,
        original_title=raw.title,
        category=category,
        kicker=category,
        title=raw.title,
        dek=dek,
        read_time=_estimate_read_time(paragraphs),
        image=raw.image_url,
        image_caption="",
        image_credit=f"Fotoğraf: {raw.source_name}",
        body=paragraphs[:8],
        rewritten=False,
        author=f"Kaynak: {raw.source_name}",
    )


def run(per_feed: int = PER_FEED_DEFAULT) -> None:
    init_db()
    processed_ai, processed_raw, skipped, failed = 0, 0, 0, 0
    ai_used = 0

    # 1) PARALEL RSS taraması (150+ kaynak, timeout=7, kaynak başına 3 haber).
    raws = fetch_all_feeds(per_feed=per_feed)

    # 2) Tekrarı ÖNCE ele (zenginleştirmeden önce dedup → boşuna sayfa indirme yok).
    fresh: list[RawArticle] = []
    seen: set[str] = set()
    for raw in raws:
        if not raw.source_url or raw.source_url in seen:
            continue
        seen.add(raw.source_url)
        if article_exists(raw.source_url):
            skipped += 1
            continue
        fresh.append(raw)

    # 3) Yalnızca YENİ ve Google-News-dışı makaleleri PARALEL zenginleştir
    #    (Google News linkleri yönlendirme olduğundan og:image/gövde vermez).
    enrich_many([r for r in fresh if "news.google.com" not in (r.source_url or "")])

    # 4) Her makale için karar: AI'a mı, ham mı?
    for raw in fresh:
        if _should_use_ai(raw, ai_used):
            try:
                translated = translate_article(raw)
                ai_used += 1
            except Exception as exc:  # noqa: BLE001 — tek hata tüm hattı durdurmasın.
                logger.error("AI işleme başarısız (%s): %s", raw.title[:60], exc)
                failed += 1
                continue

            article_id = save_article(
                source_url=raw.source_url,
                source_name=raw.source_name,
                original_title=raw.title,
                category=translated.category,
                kicker=translated.kicker,
                title=translated.title,
                dek=translated.dek,
                read_time=f"{translated.read_time_minutes} dk okuma",
                image=raw.image_url,
                image_caption=translated.image_caption,
                image_credit=f"Fotoğraf: {raw.source_name}",
                body=translated.body,
                rewritten=translated.rewritten,
                author=(
                    "Yeniden Yazım: Singularity AI Bot"
                    if translated.rewritten
                    else "Çeviri: Singularity AI Bot"
                ),
            )
            logger.info("AI ile kaydedildi: %s (%s)", translated.title[:60], article_id)
            processed_ai += 1
        else:
            # Ucuz kol: AI'sız, ham kayıt (rutin haber / skor). Bütçe dolsa veya
            # tık tuzağı olmasa bile haber ÇÖPE ATILMAZ; rewritten=False kaydedilir.
            try:
                article_id = _save_raw_passthrough(raw)
            except Exception as exc:  # noqa: BLE001
                logger.error("Ham kayıt başarısız (%s): %s", raw.title[:60], exc)
                failed += 1
                continue
            logger.info("Ham kaydedildi (AI'sız): %s (%s)", raw.title[:60], article_id)
            processed_raw += 1

    # 5) Gerçek köşe yazarlarının gerçek yazılarını da tazele (AI yok).
    try:
        save_columnists(scrape_columnists())
        logger.info("Köşe yazarları güncellendi.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Köşe yazarı taraması başarısız: %s", exc)

    logger.info(
        "Hat tamamlandı — AI: %d, ham: %d, atlanan: %d, hatalı: %d (AI bütçesi: %d/%d)",
        processed_ai,
        processed_raw,
        skipped,
        failed,
        ai_used,
        AI_BUDGET,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Singularity haber çeviri hattı (hibrit)")
    parser.add_argument("--per", type=int, default=PER_FEED_DEFAULT, help="Kaynak başına haber sayısı")
    args = parser.parse_args()
    run(per_feed=args.per)
