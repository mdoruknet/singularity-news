"""
scheduler.py — Otonom, çakışmasız (anti-collision) zamanlayıcı.

API'yi `--workers 4` ile çalıştırdığımızda, zamanlamayı API süreci içine koymak
işi 4 kez tetikler. Bunu önlemek için zamanlama AYRI bir tek-süreçlik servise
taşınır (docker-compose'taki "scheduler" servisi). Böylece çeviri hattı her
periyotta yalnızca bir kez çalışır.

APScheduler'ın `max_instances=1` + `coalesce=True` ayarları, bir çalışma uzarsa
üst üste binmeyi de engeller.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

from database import init_db
from pipeline import run as run_pipeline

load_dotenv()  # .env içindeki ANTHROPIC_API_KEY'i yükle.

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("singularity.scheduler")

# Sık güncelleme: artık her 10 dakikada bir taranır. Maliyet, pipeline'daki
# hibrit karar katmanı + AI_BUDGET ile (saatlik değil) tur başına sınırlanır.
INTERVAL_MINUTES = 10  # Her 10 dakikada bir tara.
PER_FEED = 3           # Kaynak başına haber sayısı.


def job() -> None:
    """Tek bir tarama+çeviri turu."""
    logger.info("⏱️  Zamanlanmış tarama başlıyor…")
    try:
        run_pipeline(PER_FEED)
        logger.info("✅ Zamanlanmış tarama tamamlandı.")
    except Exception:  # noqa: BLE001 — bir tur hata verse de scheduler ayakta kalsın.
        logger.exception("❌ Zamanlanmış tarama hatası")


def main() -> None:
    init_db()

    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(
        job,
        trigger="interval",
        minutes=INTERVAL_MINUTES,
        id="singularity-pipeline",
        max_instances=1,  # üst üste binmeyi engelle
        coalesce=True,    # kaçırılan tetiklemeleri tek seferde topla
    )

    logger.info("🗞️  Scheduler başladı — her %d dakikada bir çalışacak.", INTERVAL_MINUTES)
    job()  # Açılışta hemen bir kez çalıştır (boş veritabanını doldurmak için).

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler durduruluyor.")


if __name__ == "__main__":
    main()
