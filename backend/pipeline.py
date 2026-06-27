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
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv

from scraper import (
    fetch_feed_entries,
    is_clickbait,
    scrape_columnists,
    RawArticle,
    PER_FEED_DEFAULT,
    FEEDS,
    MAX_WORKERS,
)
from translator import translate_article
from database import init_db, article_exists, save_article, save_columnists, try_claim

load_dotenv()  # .env içindeki ANTHROPIC_API_KEY'i yükle.

logger = logging.getLogger("singularity.pipeline")

# --- Hibrit ayarları (maliyet kalkanı) ---
# AI_BUDGET: tek turda en çok bu kadar AI (Claude) çağrısı yapılır. 150+ kaynak
# her 10 dakikada içeri aksa da, fatura bu sınırla öngörülebilir kalır. Ortamdan
# (AI_BUDGET) ezilebilir; varsayılan 12 (tur başına 10–15 aralığında).
AI_BUDGET = int(os.environ.get("AI_BUDGET", "4"))
HEADLINE_RANKS = 1    # Her beslemenin ilk N haberi "manşet" sayılır (AI'a gider).

# AI çeviri kapısı: çeviri adımı en fazla bu kadar saniyede bir çalışır. Auto-scrape
# her 90 sn'de dönse de, ücretsiz Gemini'nin küçük GÜNLÜK kotasını korumak için
# çeviri SEYREK yapılır (varsayılan 20 dk = 1200 sn). AI_MIN_INTERVAL ile ezilebilir;
# faturalandırma açıksa 0 yapıp her turda çevirebilirsiniz.
AI_MIN_INTERVAL = int(os.environ.get("AI_MIN_INTERVAL", "1200"))

# İÇERİK FİLTRESİ: RSS akışında gerçek gövde/özet sunmayan (yalnızca başlık veren)
# haberler akışa DÜŞMEZ. Yüzlerce kaynak olduğundan, aynı önemli haber içeriğiyle
# birlikte başka bir kaynakta zaten yer alır ve o sürüm akışa girer. MIN_BODY_CHARS
# ile ezilebilir (0 → filtre kapalı).
MIN_BODY_CHARS = int(os.environ.get("MIN_BODY_CHARS", "140"))


def _has_real_content(raw: RawArticle) -> bool:
    """Haberin RSS akışında gerçek bir gövdesi/özeti var mı? (sadece başlık değil)

    content:encoded (tam gövde) varsa çoğu zaman geçer. Yoksa özet (description)
    yeterince uzun VE başlığın tekrarı değilse geçer. İçeriği olmayanlar elenir.
    """
    body = (raw.content or raw.summary or "").strip()
    if not body:
        return False
    title = (raw.title or "").strip().lower()
    bl = body.lower()
    # Özet yalnızca başlığı tekrarlıyorsa (Google News proxy snippet'leri gibi) → içerik yok.
    if bl == title or (bl.startswith(title) and len(body) < len(title) + 25):
        return False
    return len(body) >= MIN_BODY_CHARS


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


def _save_translated(raw: RawArticle, translated) -> None:
    """Çevrilmiş/yeniden-yazılmış makaleyi kaydeder."""
    save_article(
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


def run(per_feed: int = PER_FEED_DEFAULT) -> None:
    init_db()
    processed_ai, processed_raw, skipped, failed = 0, 0, 0, 0

    seen: set[str] = set()
    ai_candidates: list[RawArticle] = []
    ai_done = False  # Bu turda AI çeviri adımı bir kez çalıştı mı?

    def flush_ai() -> None:
        """Toplanan AI adaylarını ERKEN işler — taramanın bitmesini beklemeden.

        Kota dostu kapı: en fazla AI_MIN_INTERVAL'da bir, AI_BUDGET kadar manşet
        çevrilir. Kapı kapalıysa (yakın zamanda çevrildi) adaylar ham kaydedilir;
        haber ÇÖPE ATILMAZ. Tur başına yalnızca bir kez gerçek iş yapar (ai_done).

        Neden erken: ücretsiz katmanda tarama yavaş/yarıda kesilebiliyor; çeviri
        en sonda olunca hiç çalışmıyordu. Bütçe dolar dolmaz çevirip güvenceye alırız.
        """
        nonlocal processed_ai, processed_raw, failed, ai_done, ai_candidates
        if ai_done or not ai_candidates:
            return
        ai_done = True
        cands, ai_candidates = ai_candidates, []
        gate_open = try_claim("last_ai", AI_MIN_INTERVAL)
        for raw in cands:
            if gate_open:
                try:
                    _save_translated(raw, translate_article(raw))
                    processed_ai += 1
                    continue
                except Exception as exc:  # noqa: BLE001 — tek hata hattı durdurmasın.
                    logger.error("AI işleme başarısız (%s): %s", raw.title[:60], exc)
            try:
                _save_raw_passthrough(raw)  # Kapı kapalı / hata → ham kaydet.
                processed_raw += 1
            except Exception:  # noqa: BLE001
                failed += 1

    # 1) AKIŞLI TARAMA + ANINDA KAYIT + ERKEN ÇEVİRİ. Her kaynak tamamlandıkça
    #    rutin haberleri HEMEN ham kaydederiz; AI adayları (yabancı manşet / Türkçe
    #    tık tuzağı) AI_BUDGET'a ulaşır ulaşmaz hemen çevrilir (flush_ai). Böylece
    #    haberler saniyeler içinde, çeviriler de taramanın bitişine bağlı kalmadan
    #    güvenilir biçimde düşer; bellek düşük seyreder; yarıda kesilse bile kalır.
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_feed_entries, f, per_feed) for f in FEEDS]
        for fut in as_completed(futures):
            try:
                entries = fut.result()
            except Exception:  # noqa: BLE001 — tek besleme hatası taramayı durdurmasın.
                continue
            for raw in entries:
                if not raw.source_url or raw.source_url in seen:
                    continue
                seen.add(raw.source_url)
                if article_exists(raw.source_url):
                    skipped += 1
                    continue
                if not _has_real_content(raw):
                    skipped += 1  # Sadece başlık, içerik yok → akışa düşürme.
                    continue
                if not ai_done and _should_use_ai(raw, len(ai_candidates)):
                    ai_candidates.append(raw)
                    if len(ai_candidates) >= AI_BUDGET:
                        flush_ai()  # Yeterli aday → hemen çevir (erken, kota dostu).
                    continue
                try:
                    _save_raw_passthrough(raw)  # HEMEN kaydet → akış anında dolar.
                    processed_raw += 1
                except Exception as exc:  # noqa: BLE001
                    logger.error("Ham kayıt başarısız (%s): %s", raw.title[:60], exc)
                    failed += 1
    flush_ai()  # Tarama bitti; AI_BUDGET'a ulaşılmadıysa kalan adayları işle.
    logger.info("Akışlı kayıt tamam: %d ham, %d AI çevirisi.", processed_raw, processed_ai)

    # 5) Gerçek köşe yazarlarının gerçek yazılarını da tazele (AI yok).
    try:
        save_columnists(scrape_columnists())
        logger.info("Köşe yazarları güncellendi.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Köşe yazarı taraması başarısız: %s", exc)

    logger.info(
        "Hat tamamlandı — AI: %d, ham: %d, atlanan: %d, hatalı: %d (AI bütçesi: %d)",
        processed_ai,
        processed_raw,
        skipped,
        failed,
        AI_BUDGET,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Singularity haber çeviri hattı (hibrit)")
    parser.add_argument("--per", type=int, default=PER_FEED_DEFAULT, help="Kaynak başına haber sayısı")
    args = parser.parse_args()
    run(per_feed=args.per)
