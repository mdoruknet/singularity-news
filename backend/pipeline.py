"""
pipeline.py — Uçtan uca otomasyon hattı.

  tara (scraper)  →  çevir (translator/Claude)  →  kaydet (database)

Bu betik bir cron job (örn. her saat başı) olarak çalıştırılmak üzere
tasarlanmıştır. Daha önce işlenmiş URL'leri atlar, böylece aynı haberi
iki kez çevirmez (ve API maliyetini boşa harcamaz).

Çalıştırma:
    python pipeline.py            # tüm varsayılan kaynakları işle
    python pipeline.py --per 2    # her kaynaktan 2 haber
"""

from __future__ import annotations

import argparse
import logging

from dotenv import load_dotenv

from scraper import scrape_sources
from translator import translate_article
from database import init_db, article_exists, save_article

load_dotenv()  # .env içindeki ANTHROPIC_API_KEY'i yükle.

logger = logging.getLogger("singularity.pipeline")


def run(per_feed: int = 4) -> None:
    init_db()
    processed, skipped, failed = 0, 0, 0

    for raw in scrape_sources(per_feed=per_feed):
        if not raw.source_url:
            continue

        # 1) Tekrarı önle.
        if article_exists(raw.source_url):
            logger.info("Atlandı (mevcut): %s", raw.title[:60])
            skipped += 1
            continue

        # 2) Claude ile bağlam temelli çeviri.
        try:
            translated = translate_article(raw)
        except Exception as exc:  # noqa: BLE001 — tek hata tüm hattı durdurmasın.
            logger.error("Çeviri başarısız (%s): %s", raw.title[:60], exc)
            failed += 1
            continue

        # 3) Veritabanına kaydet (frontend formatında).
        article_id = save_article(
            source_url=raw.source_url,
            source_name=raw.source_name,
            original_title=raw.title,  # orijinal (çoğu zaman tık tuzağı) başlık
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
        logger.info("Kaydedildi: %s (%s)", translated.title[:60], article_id)
        processed += 1

    logger.info(
        "Hat tamamlandı — işlenen: %d, atlanan: %d, hatalı: %d",
        processed,
        skipped,
        failed,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Singularity haber çeviri hattı")
    parser.add_argument("--per", type=int, default=4, help="Kaynak başına haber sayısı")
    args = parser.parse_args()
    run(per_feed=args.per)
