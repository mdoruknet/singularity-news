#!/usr/bin/env python3
"""
generate_icons.py — Singularity PWA ikonlarını Pillow ile üretir.

Tasarım: koyu antrasit zeminde, fütüristik bir "neural node" (yapay zeka ağ
düğümleri) grafiği — SingularityNET/SingularityOS amblemini andıran cyan→mor
degrade düğümler ve bağlantılar — ve bir köşesinde küçük, zarif bir "NEWS"
yazısı. 192x192 ve 512x512 (maskable uyumlu, içerik güvenli alanda) + 180
(apple-touch) PNG çıktısı verir.

Çalıştırma:
    python scripts/generate_icons.py
"""

from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "frontend", "public"))

SS = 4  # süper-örnekleme (anti-aliasing için 4x render, sonra küçült)

# Antrasit zemin degradesi (merkez → kenar).
BG_CENTER = (28, 35, 51)   # #1c2333
BG_EDGE = (9, 11, 16)      # #090b10

# Fütüristik düğüm/bağlantı paleti (cyan → mor).
C_CYAN = (34, 211, 238)    # #22d3ee
C_VIOLET = (167, 139, 250) # #a78bfa
C_PINK = (244, 114, 182)   # #f472b6


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _radial_background(size: int) -> Image.Image:
    """Merkezi aydınlık, kenarları koyu antrasit radyal degrade üretir."""
    grid = 160  # küçük ızgarada hesapla, sonra büyüt (hız).
    img = Image.new("RGB", (grid, grid))
    px = img.load()
    c = (grid - 1) / 2.0
    maxd = math.hypot(c, c)
    for y in range(grid):
        for x in range(grid):
            d = math.hypot(x - c, y - c) / maxd
            d = min(1.0, d ** 1.15)
            px[x, y] = _lerp(BG_CENTER, BG_EDGE, d)
    return img.resize((size, size), Image.LANCZOS)


def _node_color(t: float):
    """t∈[0,1] boyunca cyan→mor→pembe degrade."""
    if t < 0.5:
        return _lerp(C_CYAN, C_VIOLET, t * 2)
    return _lerp(C_VIOLET, C_PINK, (t - 0.5) * 2)


def _load_font(px_size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, px_size)
            except OSError:
                continue
    return ImageFont.load_default()


def _draw_tracked_text(draw, center_x, y, text, font, fill, tracking):
    """Harf aralıklı (letter-spaced) metni yatayda ortalayarak çizer."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = center_x - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking


def build_icon(size: int, with_text: bool = True) -> Image.Image:
    S = size * SS
    base = _radial_background(S).convert("RGBA")

    # İçerik güvenli alanı (maskable: kenarlardan ~%16 boşluk).
    cx, cy = S / 2, S * 0.46
    R = S * 0.32  # ağın yarıçapı

    # Düğüm yerleşimi: merkez hub + çevresinde 6 düğüm + 2 yörünge düğümü.
    nodes = [(cx, cy, 0.5, 0.052)]  # (x, y, renk_t, yarıçap_oranı)
    ring = 6
    for i in range(ring):
        ang = math.pi / 2 + i * (2 * math.pi / ring)
        nx = cx + R * math.cos(ang)
        ny = cy + R * math.sin(ang)
        nodes.append((nx, ny, i / (ring - 1), 0.038))
    # Daha küçük dış yörünge düğümleri (derinlik hissi).
    for i, ang in enumerate((math.pi * 0.2, math.pi * 1.25)):
        nx = cx + R * 0.62 * math.cos(ang)
        ny = cy + R * 0.62 * math.sin(ang)
        nodes.append((nx, ny, 0.7 + 0.3 * i, 0.024))

    # Bağlantılar: hub→tüm halka + halkayı çevreleyen kenarlar.
    edges = [(0, j) for j in range(1, ring + 1)]
    for i in range(1, ring + 1):
        nxt = i + 1 if i < ring else 1
        edges.append((i, nxt))
    edges += [(1, 7), (4, 8), (0, 7), (0, 8)]

    graph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(graph)

    # Kenarlar (çizgiler).
    for a, b in edges:
        x1, y1 = nodes[a][0], nodes[a][1]
        x2, y2 = nodes[b][0], nodes[b][1]
        col = _node_color((nodes[a][2] + nodes[b][2]) / 2)
        gd.line([(x1, y1), (x2, y2)], fill=col + (150,), width=max(1, int(S * 0.006)))

    # Düğümler (parlak çekirdek + ince halka).
    for x, y, t, rr in nodes:
        r = S * rr
        col = _node_color(t)
        gd.ellipse([x - r, y - r, x + r, y + r], fill=col + (255,))
        gd.ellipse(
            [x - r * 1.7, y - r * 1.7, x + r * 1.7, y + r * 1.7],
            outline=col + (90,),
            width=max(1, int(S * 0.004)),
        )

    # Yumuşak ışıma (glow): grafiğin bulanık bir kopyasını altına koy.
    glow = graph.filter(ImageFilter.GaussianBlur(radius=S * 0.018))
    base = Image.alpha_composite(base, glow)
    base = Image.alpha_composite(base, graph)

    # Köşede zarif "NEWS" yazısı.
    if with_text:
        td = ImageDraw.Draw(base)
        font = _load_font(int(S * 0.072))
        _draw_tracked_text(
            td,
            cx,
            S * 0.83,
            "NEWS",
            font,
            (226, 232, 240, 235),  # açık gri
            tracking=S * 0.045,
        )

    return base.resize((size, size), Image.LANCZOS).convert("RGB")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "icon-180.png": 180,
    }
    for name, size in targets.items():
        icon = build_icon(size, with_text=size >= 180)
        path = os.path.join(OUT_DIR, name)
        icon.save(path, "PNG")
        print(f"✓ {name} ({size}x{size}) → {path}")
    print("PWA ikonları üretildi.")


if __name__ == "__main__":
    main()
