#!/usr/bin/env python3
"""
mobile.py — Singularity'yi aynı Wi-Fi ağındaki telefonlara "native app" gibi açar.

Yaptıkları:
  1) Bilgisayarın yerel ağ IP'sini (192.168.x.x …) otomatik bulur.
  2) Kök .env içindeki VITE_API_URL ve ALLOWED_ORIGINS satırlarını bu IP'ye göre
     günceller (diğer satırları korur; .env yoksa .env.example'dan oluşturur).
  3) `docker compose down` + `docker compose up -d --build` ile sistemi yeni IP
     ayarlarıyla (ve güncel frontend imajıyla) ayağa kaldırır.
  4) http://<IP> adresinin QR kodunu terminale dev gibi çizer.

Kullanım:
    python mobile.py
"""

from __future__ import annotations

import re
import sys
import socket
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"


def find_local_ip() -> str:
    """UDP soketini dış bir adrese 'bağlayarak' aktif yerel ağ IP'sini bulur."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # paket gönderilmez; sadece arayüz seçilir
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def update_env(ip: str) -> None:
    """VITE_API_URL ve ALLOWED_ORIGINS'i IP'ye göre yeniler, gerisini korur."""
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    elif ENV_EXAMPLE.exists():
        lines = ENV_EXAMPLE.read_text(encoding="utf-8").splitlines()
        print("ℹ️  .env bulunamadı; .env.example'dan oluşturuldu "
              "(ANTHROPIC_API_KEY'i doldurmayı unutmayın).")
    else:
        lines = ["ANTHROPIC_API_KEY=sk-ant-..."]

    # Hedef iki anahtarı çıkar, diğer her şeyi koru.
    pattern = re.compile(r"\s*(VITE_API_URL|ALLOWED_ORIGINS)\s*=")
    kept = [ln for ln in lines if not pattern.match(ln)]

    kept.append(f"VITE_API_URL=http://{ip}:8000")
    kept.append(
        "ALLOWED_ORIGINS="
        f"http://localhost,http://localhost:5173,http://{ip},http://{ip}:80"
    )

    ENV_PATH.write_text("\n".join(kept) + "\n", encoding="utf-8")
    print(f"📝 .env güncellendi → VITE_API_URL=http://{ip}:8000")


def docker_up() -> bool:
    """docker compose'u yeni IP ayarlarıyla yeniden ayağa kaldırır."""
    if shutil.which("docker") is None:
        print("\n⚠️  Docker bulunamadı; konteynerler başlatılamadı.")
        print("    Docker Desktop kurup `python mobile.py`'yi tekrar çalıştırın,")
        print("    ya da geliştirme modu için (frontend klasöründe):")
        print("        npm run dev -- --host      →  http://<IP>:5173")
        return False
    try:
        subprocess.run(["docker", "compose", "down"], cwd=ROOT, check=False)
        subprocess.run(
            ["docker", "compose", "up", "-d", "--build"], cwd=ROOT, check=True
        )
        print("🐳 Konteynerler ayakta (frontend :80, backend :8000, scheduler).")
        return True
    except subprocess.CalledProcessError as exc:
        print(f"⚠️  docker compose hatası: {exc}")
        return False


def _draw_qr_python(url: str) -> bool:
    """Saf-Python QR (TTY gerektirmez, ağ paket indirmesine bağımlı değil)."""
    try:
        import qrcode
    except ImportError:
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "--quiet", "qrcode"],
                check=True,
            )
            import qrcode  # noqa: F811
        except Exception:
            return False
    qr = qrcode.QRCode(border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)
    return True


def draw_qr(url: str) -> None:
    """Terminale QR kodu çizer: önce Python qrcode, olmazsa npx qrcode-terminal."""
    bar = "═" * 54
    print(f"\n{bar}")
    print(f"  📱  Telefonunuzun kamerasıyla tarayın:  {url}")
    print(f"{bar}\n")
    if _draw_qr_python(url):
        return
    # Yedek: npx qrcode-terminal
    try:
        subprocess.run(["npx", "--yes", "qrcode-terminal", url], check=False)
    except FileNotFoundError:
        print("(QR çizilemedi — yukarıdaki adresi telefon tarayıcısına elle yazın.)")


def main() -> None:
    ip = find_local_ip()
    print(f"🌐 Yerel ağ IP adresi: {ip}")
    update_env(ip)
    docker_up()
    draw_qr(f"http://{ip}")
    print("\n✨ Hazır! Telefonunuz aynı Wi-Fi ağındaysa QR'ı tarayıp")
    print("   tarayıcı menüsünden 'Ana Ekrana Ekle' ile native app gibi kullanın.")


if __name__ == "__main__":
    main()
