"""
scraper.py — Türkiye ve dünyadan 80+ gazeteden, farklı kategorilerde haber toplar.

İki aşama:
  1) RSS beslemelerinden başlık + link toplanır (EŞZAMANLI / multi-thread).
  2) BeautifulSoup ile her makalenin tam gövdesi ve görseli (og:image) çekilir.

Ölçek (150+ kaynak) için tasarım kararları:
  • Çekim, `ThreadPoolExecutor(max_workers=20)` ile PARALEL yapılır; aksi hâlde
    yüzlerce kaynağı ardışık taramak Render'ı timeout'a düşürür.
  • Her HTTP isteğinde `timeout=7` vardır; yavaş/ölü kaynaklar `try/except` ile
    sessizce atlanır (sistem kilitlenmez).
  • Her kaynaktan yalnızca EN YENİ 3 haber (`entries[:3]`) alınır (RAM/DB kalkanı).
  • Gerçek RSS adresi bilinen kaynaklar doğrudan; bilinmeyenler "Google News RSS
    Proxy" (site: araması) üzerinden çekilir — böylece adres kaymalarında bile
    güncel haber döner.

Kazıma, kaynakların robots.txt ve kullanım koşullarına saygı duyularak yapılmalıdır.
"""

from __future__ import annotations

import os
import re
import logging
from dataclasses import dataclass, field
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterable

import feedparser
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("singularity.scraper")

# Sistemdeki kanonik kategori listesi (frontend ile birebir aynı sırada).
CATEGORIES = [
    "Gündem",
    "Türkiye",
    "Dünya",
    "Ekonomi",
    "Teknoloji",
    "İş",
    "Kültür Sanat",
    "Edebiyat",
    "Yaşam Tarzı",
    "Spor",
]

# --- Eşzamanlılık ve kalkan ayarları ---
# Render free (512MB RAM) için düşük tutulur; SCRAPE_WORKERS ile ezilebilir.
# Yüksek paralellik (32) belleği/CPU'yu şişirip taramayı yarıda çökertiyordu.
MAX_WORKERS = int(os.environ.get("SCRAPE_WORKERS", "10"))
REQUEST_TIMEOUT = 7       # Her HTTP isteği için sabit 7 sn timeout.
PER_FEED_DEFAULT = 3      # Her kaynaktan yalnızca en yeni 3 haber.

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36 SingularityBot/1.0"
    )
}


def _gnews(query: str, hl: str = "tr", gl: str = "TR") -> str:
    """Google News RSS arama proxy'si üretir (gerçek RSS bilinmeyen kaynaklar için)."""
    return (
        f"https://news.google.com/rss/search?q={quote(query)}"
        f"&hl={hl}&gl={gl}&ceid={gl}:{hl}"
    )


def _gnews_site(domain: str, hl: str = "tr", gl: str = "TR") -> str:
    """Belirli bir siteden son 3 günün haberlerini Google News üzerinden çeker."""
    return _gnews(f"site:{domain} when:3d", hl, gl)


# --------------------------------------------------------------------------- #
#  GERÇEK RSS beslemeleri (adresi bilinen, görsel/gövde veren kaynaklar).
# --------------------------------------------------------------------------- #
_REAL_FEEDS: list[dict[str, str]] = [
    # ----- Küresel (İngilizce) -----
    {"name": "NYT", "region": "Küresel", "category": "Dünya",
     "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"},
    {"name": "NYT", "region": "Küresel", "category": "Teknoloji",
     "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"},
    {"name": "NYT", "region": "Küresel", "category": "İş",
     "url": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"},
    {"name": "CNN", "region": "Küresel", "category": "Dünya",
     "url": "http://rss.cnn.com/rss/edition_world.rss"},
    {"name": "CNN", "region": "Küresel", "category": "Teknoloji",
     "url": "http://rss.cnn.com/rss/edition_technology.rss"},
    {"name": "BBC News", "region": "Küresel", "category": "Dünya",
     "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
    {"name": "BBC News", "region": "Küresel", "category": "Teknoloji",
     "url": "https://feeds.bbci.co.uk/news/technology/rss.xml"},
    {"name": "BBC News", "region": "Küresel", "category": "Ekonomi",
     "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
    {"name": "Google News", "region": "Küresel", "category": "Gündem",
     "url": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"},
    {"name": "The Guardian", "region": "Küresel", "category": "Dünya",
     "url": "https://www.theguardian.com/world/rss"},
    {"name": "The Guardian", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.theguardian.com/technology/rss"},
    {"name": "The Guardian", "region": "Küresel", "category": "Edebiyat",
     "url": "https://www.theguardian.com/books/rss"},
    {"name": "The Guardian", "region": "Küresel", "category": "Kültür Sanat",
     "url": "https://www.theguardian.com/culture/rss"},
    {"name": "The Guardian", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://www.theguardian.com/lifeandstyle/rss"},
    {"name": "The Guardian", "region": "Küresel", "category": "Spor",
     "url": "https://www.theguardian.com/football/rss"},
    {"name": "The Guardian", "region": "Küresel", "category": "İş",
     "url": "https://www.theguardian.com/uk/business/rss"},
    {"name": "Fox News", "region": "Küresel", "category": "Dünya",
     "url": "https://moxie.foxnews.com/google-publisher/world.xml"},
    {"name": "Washington Post", "region": "Küresel", "category": "Dünya",
     "url": "https://feeds.washingtonpost.com/rss/world"},
    {"name": "USA Today", "region": "Küresel", "category": "Gündem",
     "url": "http://rssfeeds.usatoday.com/usatoday-NewsTopStories"},
    {"name": "NBC", "region": "Küresel", "category": "Dünya",
     "url": "https://feeds.nbcnews.com/nbcnews/public/world"},
    {"name": "AP", "region": "Küresel", "category": "Dünya",
     "url": "https://feedx.net/rss/ap.xml"},
    {"name": "Bloomberg", "region": "Küresel", "category": "Ekonomi",
     "url": "https://feeds.bloomberg.com/markets/news.rss"},
    {"name": "WSJ", "region": "Küresel", "category": "Dünya",
     "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml"},
    {"name": "WSJ", "region": "Küresel", "category": "Ekonomi",
     "url": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"},
    {"name": "WSJ", "region": "Küresel", "category": "Teknoloji",
     "url": "https://feeds.a.dj.com/rss/RSSWSJD.xml"},
    {"name": "NY Post", "region": "Küresel", "category": "Gündem",
     "url": "https://nypost.com/feed/"},
    {"name": "Newsweek", "region": "Küresel", "category": "Dünya",
     "url": "https://www.newsweek.com/rss"},
    {"name": "Axios", "region": "Küresel", "category": "İş",
     "url": "https://api.axios.com/feed/"},
    {"name": "Politico", "region": "Küresel", "category": "Dünya",
     "url": "https://www.politico.com/rss/politicopicks.xml"},
    {"name": "NPR", "region": "Küresel", "category": "Gündem",
     "url": "https://feeds.npr.org/1001/rss.xml"},
    {"name": "CBS", "region": "Küresel", "category": "Dünya",
     "url": "https://www.cbsnews.com/latest/rss/world"},
    {"name": "Sky News", "region": "Küresel", "category": "Dünya",
     "url": "https://feeds.skynews.com/feeds/rss/world.xml"},
    {"name": "Independent", "region": "Küresel", "category": "Dünya",
     "url": "https://www.independent.co.uk/news/world/rss"},
    {"name": "The Sun", "region": "Küresel", "category": "Spor",
     "url": "https://www.thesun.co.uk/sport/feed/"},
    {"name": "Mirror", "region": "Küresel", "category": "Gündem",
     "url": "https://www.mirror.co.uk/news/?service=rss"},
    {"name": "Metro UK", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://metro.co.uk/feed/"},
    {"name": "Al Jazeera", "region": "Küresel", "category": "Dünya",
     "url": "https://www.aljazeera.com/xml/rss/all.xml"},
    {"name": "France 24", "region": "Küresel", "category": "Dünya",
     "url": "https://www.france24.com/en/rss"},
    {"name": "Le Monde", "region": "Küresel", "category": "Dünya",
     "url": "https://www.lemonde.fr/rss/une.xml"},
    {"name": "Le Figaro", "region": "Küresel", "category": "Dünya",
     "url": "https://www.lefigaro.fr/rss/figaro_actualites.xml"},
    {"name": "Der Spiegel", "region": "Küresel", "category": "Dünya",
     "url": "https://www.spiegel.de/schlagzeilen/tops/index.rss"},
    {"name": "Die Welt", "region": "Küresel", "category": "Dünya",
     "url": "https://www.welt.de/feeds/latest.rss"},
    {"name": "El Mundo", "region": "Küresel", "category": "Dünya",
     "url": "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml"},
    {"name": "Corriere", "region": "Küresel", "category": "Dünya",
     "url": "https://xml2.corriereobjects.it/rss/homepage.xml"},
    {"name": "Repubblica", "region": "Küresel", "category": "Dünya",
     "url": "https://www.repubblica.it/rss/homepage/rss2.0.xml"},
    {"name": "Jerusalem Post", "region": "Küresel", "category": "Dünya",
     "url": "https://www.jpost.com/rss/rssfeedsfrontpage.aspx"},
    {"name": "Euronews", "region": "Küresel", "category": "Dünya",
     "url": "https://www.euronews.com/rss"},
    # ----- Dünya Sporu -----
    {"name": "ESPN", "region": "Küresel", "category": "Spor",
     "url": "https://www.espn.com/espn/rss/news"},
    {"name": "BBC Sport", "region": "Küresel", "category": "Spor",
     "url": "https://feeds.bbci.co.uk/sport/rss.xml"},
    {"name": "Sky Sports", "region": "Küresel", "category": "Spor",
     "url": "https://www.skysports.com/rss/12040"},
    {"name": "Marca", "region": "Küresel", "category": "Spor",
     "url": "https://e00-marca.uecdn.es/rss/portada.xml"},
    {"name": "AS", "region": "Küresel", "category": "Spor",
     "url": "https://as.com/rss/tags/ultimas_noticias.xml"},
    {"name": "L'Équipe", "region": "Küresel", "category": "Spor",
     "url": "https://www.lequipe.fr/rss/actu_rss.xml"},
    {"name": "Gazzetta", "region": "Küresel", "category": "Spor",
     "url": "https://www.gazzetta.it/rss/home.xml"},
    # ----- Elit Edebiyat & Kültür (yalnızca Edebiyat / Kültür Sanat) -----
    {"name": "The New Yorker", "region": "Kültür", "category": "Edebiyat",
     "url": "https://www.newyorker.com/feed/everything"},
    {"name": "NY Review of Books", "region": "Kültür", "category": "Edebiyat",
     "url": "https://www.nybooks.com/feed/"},
    {"name": "The Paris Review", "region": "Kültür", "category": "Edebiyat",
     "url": "https://www.theparisreview.org/blog/feed/"},
    {"name": "London Review of Books", "region": "Kültür", "category": "Edebiyat",
     "url": "https://www.lrb.co.uk/feeds/rss"},
    {"name": "Granta", "region": "Kültür", "category": "Edebiyat",
     "url": "https://granta.com/feed/"},
    {"name": "ARTnews", "region": "Kültür", "category": "Kültür Sanat",
     "url": "https://www.artnews.com/feed/"},
    {"name": "The Art Newspaper", "region": "Kültür", "category": "Kültür Sanat",
     "url": "https://www.theartnewspaper.com/rss"},
    # ----- Türkiye -----
    {"name": "Sözcü", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.sozcu.com.tr/feed/"},
    {"name": "Hürriyet", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.hurriyet.com.tr/rss/gundem"},
    {"name": "Hürriyet", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.hurriyet.com.tr/rss/ekonomi"},
    {"name": "Hürriyet", "region": "Türkiye", "category": "Spor",
     "url": "https://www.hurriyet.com.tr/rss/spor"},
    {"name": "Hürriyet", "region": "Türkiye", "category": "Edebiyat",
     "url": "https://www.hurriyet.com.tr/rss/kitap-sanat"},
    {"name": "Sabah", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.sabah.com.tr/rss/gundem.xml"},
    {"name": "Sabah", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.sabah.com.tr/rss/ekonomi.xml"},
    {"name": "Sabah Spor", "region": "Türkiye", "category": "Spor",
     "url": "https://www.sabah.com.tr/rss/spor.xml"},
    {"name": "Skorer", "region": "Türkiye", "category": "Spor",
     "url": "https://www.milliyet.com.tr/rss/rssnew/skorerrss.xml"},
    {"name": "CNN Türk Spor", "region": "Türkiye", "category": "Spor",
     "url": "https://www.cnnturk.com/feed/rss/spor/news"},
    {"name": "Milliyet", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml"},
    {"name": "Milliyet", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.milliyet.com.tr/rss/rssnew/ekonomirss.xml"},
    {"name": "Habertürk", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.haberturk.com/rss"},
    {"name": "Habertürk", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.haberturk.com/rss/ekonomi.xml"},
    {"name": "CNN Türk", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.cnnturk.com/feed/rss/all/news"},
    {"name": "CNN Türk", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.cnnturk.com/feed/rss/ekonomi/news"},
    {"name": "NTV", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.ntv.com.tr/gundem.rss"},
    {"name": "NTV", "region": "Türkiye", "category": "Ekonomi",
     "url": "https://www.ntv.com.tr/ekonomi.rss"},
    {"name": "NTV", "region": "Türkiye", "category": "Teknoloji",
     "url": "https://www.ntv.com.tr/teknoloji.rss"},
    {"name": "NTV Spor", "region": "Türkiye", "category": "Spor",
     "url": "https://www.ntv.com.tr/spor.rss"},
    {"name": "NTV", "region": "Türkiye", "category": "Kültür Sanat",
     "url": "https://www.ntv.com.tr/sanat.rss"},
    {"name": "NTV", "region": "Türkiye", "category": "Yaşam Tarzı",
     "url": "https://www.ntv.com.tr/yasam.rss"},
    {"name": "TRT Haber", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.trthaber.com/sondakika.rss"},
    {"name": "Cumhuriyet", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.cumhuriyet.com.tr/rss/son_dakika.xml"},
    {"name": "T24", "region": "Türkiye", "category": "Gündem",
     "url": "https://t24.com.tr/rss"},
    {"name": "BBC TR", "region": "Türkiye", "category": "Türkiye",
     "url": "https://feeds.bbci.co.uk/turkce/rss.xml"},
    {"name": "Euronews TR", "region": "Türkiye", "category": "Dünya",
     "url": "https://tr.euronews.com/rss"},
    {"name": "Diken", "region": "Türkiye", "category": "Gündem",
     "url": "https://www.diken.com.tr/feed/"},
]

# --------------------------------------------------------------------------- #
#  GOOGLE NEWS PROXY kaynakları — gerçek RSS adresi bilinmeyen/oynak olanlar.
#  (ad, bölge, kategori, alan adı, dil, ülke)
# --------------------------------------------------------------------------- #
_PROXY_SOURCES: list[tuple[str, str, str, str, str, str]] = [
    # ----- Küresel -----
    ("Reuters", "Küresel", "Dünya", "reuters.com", "en-US", "US"),
    ("MSN", "Küresel", "Gündem", "msn.com", "en-US", "US"),
    ("ABC", "Küresel", "Dünya", "abcnews.go.com", "en-US", "US"),
    ("Telegraph", "Küresel", "Dünya", "telegraph.co.uk", "en-GB", "GB"),
    ("The Times", "Küresel", "Dünya", "thetimes.co.uk", "en-GB", "GB"),
    ("Financial Times", "Küresel", "Ekonomi", "ft.com", "en-GB", "GB"),
    ("Daily Mail", "Küresel", "Yaşam Tarzı", "dailymail.co.uk", "en-GB", "GB"),
    ("HuffPost", "Küresel", "Yaşam Tarzı", "huffpost.com", "en-US", "US"),
    ("Haaretz", "Küresel", "Dünya", "haaretz.com", "en-US", "US"),
    ("Bild", "Küresel", "Gündem", "bild.de", "de", "DE"),
    ("El País", "Küresel", "Dünya", "elpais.com", "es", "ES"),
    # ----- Elit Edebiyat & Kültür (yalnızca Edebiyat / Kültür Sanat) -----
    ("TLS", "Kültür", "Edebiyat", "the-tls.co.uk", "en-US", "US"),
    ("Artforum", "Kültür", "Kültür Sanat", "artforum.com", "en-US", "US"),
    # ----- Dünya Sporu (proxy) -----
    ("The Athletic", "Küresel", "Spor", "nytimes.com/athletic", "en-US", "US"),
    ("Goal", "Küresel", "Spor", "goal.com", "en-US", "US"),
    ("Bleacher Report", "Küresel", "Spor", "bleacherreport.com", "en-US", "US"),
    ("Sports Illustrated", "Küresel", "Spor", "si.com", "en-US", "US"),
    ("Fox Sports", "Küresel", "Spor", "foxsports.com", "en-US", "US"),
    ("Eurosport", "Küresel", "Spor", "eurosport.com", "en-US", "US"),
    # ----- Türkiye Sporu -----
    ("Fanatik", "Türkiye", "Spor", "fanatik.com.tr", "tr", "TR"),
    ("Fotomaç", "Türkiye", "Spor", "fotomac.com.tr", "tr", "TR"),
    ("Sporx", "Türkiye", "Spor", "sporx.com", "tr", "TR"),
    ("A Spor", "Türkiye", "Spor", "aspor.com.tr", "tr", "TR"),
    ("Ajansspor", "Türkiye", "Spor", "ajansspor.com", "tr", "TR"),
    ("Fotospor", "Türkiye", "Spor", "fotospor.com", "tr", "TR"),
    ("beIN Sports", "Türkiye", "Spor", "beinsports.com.tr", "tr", "TR"),
    ("TRT Spor", "Türkiye", "Spor", "trtspor.com.tr", "tr", "TR"),
    ("Spor Arena", "Türkiye", "Spor", "hurriyet.com.tr/sporarena", "tr", "TR"),
    ("Mackolik", "Türkiye", "Spor", "mackolik.com", "tr", "TR"),
    ("Tivibu Spor", "Türkiye", "Spor", "tivibuspor.com.tr", "tr", "TR"),
    # ----- Türkiye -----
    ("Mynet", "Türkiye", "Gündem", "mynet.com", "tr", "TR"),
    ("Ensonhaber", "Türkiye", "Gündem", "ensonhaber.com", "tr", "TR"),
    ("Haberler.com", "Türkiye", "Gündem", "haberler.com", "tr", "TR"),
    ("TGRT", "Türkiye", "Gündem", "tgrthaber.com.tr", "tr", "TR"),
    ("A Haber", "Türkiye", "Gündem", "ahaber.com.tr", "tr", "TR"),
    ("Yeni Şafak", "Türkiye", "Gündem", "yenisafak.com", "tr", "TR"),
    ("Türkiye Gazetesi", "Türkiye", "Gündem", "turkiyegazetesi.com.tr", "tr", "TR"),
    ("Akşam", "Türkiye", "Gündem", "aksam.com.tr", "tr", "TR"),
    ("Karar", "Türkiye", "Gündem", "karar.com", "tr", "TR"),
    ("OdaTV", "Türkiye", "Gündem", "odatv4.com", "tr", "TR"),
    ("AA", "Türkiye", "Gündem", "aa.com.tr", "tr", "TR"),
    ("İHA", "Türkiye", "Gündem", "iha.com.tr", "tr", "TR"),
    ("DHA", "Türkiye", "Gündem", "dha.com.tr", "tr", "TR"),
    ("BirGün", "Türkiye", "Gündem", "birgun.net", "tr", "TR"),
    ("Duvar", "Türkiye", "Gündem", "gazeteduvar.com.tr", "tr", "TR"),
    ("Korkusuz", "Türkiye", "Gündem", "korkusuz.com.tr", "tr", "TR"),
    ("Aydınlık", "Türkiye", "Gündem", "aydinlik.com.tr", "tr", "TR"),
    ("Halk TV", "Türkiye", "Gündem", "halktv.com.tr", "tr", "TR"),
    ("Tele1", "Türkiye", "Gündem", "tele1.com.tr", "tr", "TR"),
    ("Dünya", "Türkiye", "Ekonomi", "dunya.com", "tr", "TR"),
    ("Independent TR", "Türkiye", "Dünya", "indyturk.com", "tr", "TR"),
    ("Onedio", "Türkiye", "Yaşam Tarzı", "onedio.com", "tr", "TR"),
    ("Memurlar.net", "Türkiye", "Gündem", "memurlar.net", "tr", "TR"),
    ("Internet Haber", "Türkiye", "Gündem", "internethaber.com", "tr", "TR"),
    ("Gerçek Gündem", "Türkiye", "Gündem", "gercekgundem.com", "tr", "TR"),
    ("Haber Global", "Türkiye", "Gündem", "haberglobal.com.tr", "tr", "TR"),
]



# --------------------------------------------------------------------------- #
#  EK PREMIUM KAYNAKLAR (Tier-1/Tier-2) — gerçek RSS + Google News proxy.
# --------------------------------------------------------------------------- #
_EXTRA_REAL = [
    {"name": "The Atlantic", "region": "Küresel", "category": "Dünya",
     "url": "https://www.theatlantic.com/feed/all/"},
    {"name": "Time", "region": "Küresel", "category": "Dünya",
     "url": "https://time.com/feed/"},
    {"name": "Vox", "region": "Küresel", "category": "Dünya",
     "url": "https://www.vox.com/rss/index.xml"},
    {"name": "ProPublica", "region": "Küresel", "category": "Dünya",
     "url": "https://www.propublica.org/feeds/propublica/main"},
    {"name": "Quartz", "region": "Küresel", "category": "Ekonomi",
     "url": "https://qz.com/rss"},
    {"name": "Deutsche Welle", "region": "Küresel", "category": "Dünya",
     "url": "https://rss.dw.com/rdf/rss-en-all"},
    {"name": "The Conversation", "region": "Küresel", "category": "Dünya",
     "url": "https://theconversation.com/global/articles.atom"},
    {"name": "Forbes", "region": "Küresel", "category": "İş",
     "url": "https://www.forbes.com/business/feed/"},
    {"name": "Business Insider", "region": "Küresel", "category": "Ekonomi",
     "url": "https://www.businessinsider.com/rss"},
    {"name": "MarketWatch", "region": "Küresel", "category": "Ekonomi",
     "url": "http://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "Fast Company", "region": "Küresel", "category": "İş",
     "url": "https://www.fastcompany.com/latest/rss"},
    {"name": "Entrepreneur", "region": "Küresel", "category": "İş",
     "url": "https://www.entrepreneur.com/latest.rss"},
    {"name": "Wired", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.wired.com/feed/rss"},
    {"name": "The Verge", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.theverge.com/rss/index.xml"},
    {"name": "TechCrunch", "region": "Küresel", "category": "Teknoloji",
     "url": "https://techcrunch.com/feed/"},
    {"name": "Ars Technica", "region": "Küresel", "category": "Teknoloji",
     "url": "https://feeds.arstechnica.com/arstechnica/index"},
    {"name": "Engadget", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.engadget.com/rss.xml"},
    {"name": "CNET", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.cnet.com/rss/news/"},
    {"name": "Gizmodo", "region": "Küresel", "category": "Teknoloji",
     "url": "https://gizmodo.com/rss"},
    {"name": "MacRumors", "region": "Küresel", "category": "Teknoloji",
     "url": "https://feeds.macrumors.com/MacRumors-All"},
    {"name": "TechRadar", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.techradar.com/rss"},
    {"name": "VentureBeat", "region": "Küresel", "category": "Teknoloji",
     "url": "https://venturebeat.com/feed/"},
    {"name": "Mashable", "region": "Küresel", "category": "Teknoloji",
     "url": "https://mashable.com/feeds/rss/all"},
    {"name": "New Scientist", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.newscientist.com/feed/home/"},
    {"name": "Hacker News", "region": "Küresel", "category": "Teknoloji",
     "url": "https://news.ycombinator.com/rss"},
    {"name": "Android Authority", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.androidauthority.com/feed/"},
    {"name": "Tom's Hardware", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.tomshardware.com/feeds/all"},
    {"name": "PC Gamer", "region": "Küresel", "category": "Teknoloji",
     "url": "https://www.pcgamer.com/rss/"},
    {"name": "Hyperallergic", "region": "Kültür", "category": "Kültür Sanat",
     "url": "https://hyperallergic.com/feed/"},
    {"name": "Literary Hub", "region": "Kültür", "category": "Edebiyat",
     "url": "https://lithub.com/feed/"},
    {"name": "Open Culture", "region": "Kültür", "category": "Edebiyat",
     "url": "https://www.openculture.com/feed"},
    {"name": "Aeon", "region": "Kültür", "category": "Edebiyat",
     "url": "https://aeon.co/feed.rss"},
    {"name": "Smithsonian", "region": "Kültür", "category": "Kültür Sanat",
     "url": "https://www.smithsonianmag.com/rss/latest_articles/"},
    {"name": "Vogue", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://www.vogue.com/feed/rss"},
    {"name": "GQ", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://www.gq.com/feed/rss"},
    {"name": "Vanity Fair", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://www.vanityfair.com/feed/rss"},
    {"name": "Bon Appétit", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://www.bonappetit.com/feed/rss"},
    {"name": "Architectural Digest", "region": "Küresel", "category": "Yaşam Tarzı",
     "url": "https://www.architecturaldigest.com/feed/rss"},
    {"name": "Webrazzi", "region": "Türkiye", "category": "Teknoloji",
     "url": "https://webrazzi.com/feed"},
    {"name": "DonanımHaber", "region": "Türkiye", "category": "Teknoloji",
     "url": "https://www.donanimhaber.com/rss/tum/"},
    {"name": "ShiftDelete", "region": "Türkiye", "category": "Teknoloji",
     "url": "https://shiftdelete.net/feed"},
    {"name": "Technopat", "region": "Türkiye", "category": "Teknoloji",
     "url": "https://www.technopat.net/feed/"},
    {"name": "Edebiyat Haber", "region": "Türkiye", "category": "Edebiyat",
     "url": "https://www.edebiyathaber.net/feed/"},
]

_EXTRA_PROXY = [
    ("The Economist", "Küresel", "Dünya", "economist.com", "en-US", "US"),
    ("Foreign Affairs", "Küresel", "Dünya", "foreignaffairs.com", "en-US", "US"),
    ("Foreign Policy", "Küresel", "Dünya", "foreignpolicy.com", "en-US", "US"),
    ("Nikkei Asia", "Küresel", "Dünya", "asia.nikkei.com", "en-US", "US"),
    ("SCMP", "Küresel", "Dünya", "scmp.com", "en-US", "US"),
    ("Semafor", "Küresel", "Dünya", "semafor.com", "en-US", "US"),
    ("Project Syndicate", "Küresel", "Dünya", "project-syndicate.org", "en-US", "US"),
    ("CNBC", "Küresel", "Ekonomi", "cnbc.com", "en-US", "US"),
    ("Barron's", "Küresel", "Ekonomi", "barrons.com", "en-US", "US"),
    ("Morningstar", "Küresel", "Ekonomi", "morningstar.com", "en-US", "US"),
    ("Seeking Alpha", "Küresel", "Ekonomi", "seekingalpha.com", "en-US", "US"),
    ("Yahoo Finance", "Küresel", "Ekonomi", "finance.yahoo.com", "en-US", "US"),
    ("Capital Economics", "Küresel", "Ekonomi", "capitaleconomics.com", "en-US", "US"),
    ("S&P Global", "Küresel", "Ekonomi", "spglobal.com", "en-US", "US"),
    ("IMF Blog", "Küresel", "Ekonomi", "imf.org", "en-US", "US"),
    ("World Bank", "Küresel", "Ekonomi", "worldbank.org", "en-US", "US"),
    ("OECD", "Küresel", "Ekonomi", "oecd.org", "en-US", "US"),
    ("Harvard Business Review", "Küresel", "İş", "hbr.org", "en-US", "US"),
    ("Fortune", "Küresel", "İş", "fortune.com", "en-US", "US"),
    ("Bloomberg Businessweek", "Küresel", "İş", "bloomberg.com/businessweek", "en-US", "US"),
    ("Inc.", "Küresel", "İş", "inc.com", "en-US", "US"),
    ("McKinsey", "Küresel", "İş", "mckinsey.com", "en-US", "US"),
    ("BCG", "Küresel", "İş", "bcg.com", "en-US", "US"),
    ("Bain", "Küresel", "İş", "bain.com", "en-US", "US"),
    ("MIT Sloan Review", "Küresel", "İş", "sloanreview.mit.edu", "en-US", "US"),
    ("The Information", "Küresel", "Teknoloji", "theinformation.com", "en-US", "US"),
    ("MIT Technology Review", "Küresel", "Teknoloji", "technologyreview.com", "en-US", "US"),
    ("IEEE Spectrum", "Küresel", "Teknoloji", "spectrum.ieee.org", "en-US", "US"),
    ("404 Media", "Küresel", "Teknoloji", "404media.co", "en-US", "US"),
    ("ZDNet", "Küresel", "Teknoloji", "zdnet.com", "en-US", "US"),
    ("AnandTech", "Küresel", "Teknoloji", "anandtech.com", "en-US", "US"),
    ("Futurism", "Küresel", "Teknoloji", "futurism.com", "en-US", "US"),
    ("SiliconANGLE", "Küresel", "Teknoloji", "siliconangle.com", "en-US", "US"),
    ("Frieze", "Kültür", "Kültür Sanat", "frieze.com", "en-US", "US"),
    ("Artnet", "Kültür", "Kültür Sanat", "news.artnet.com", "en-US", "US"),
    ("Artsy", "Kültür", "Kültür Sanat", "artsy.net", "en-US", "US"),
    ("Apollo", "Kültür", "Kültür Sanat", "apollo-magazine.com", "en-US", "US"),
    ("ArtReview", "Kültür", "Kültür Sanat", "artreview.com", "en-US", "US"),
    ("BBC Culture", "Kültür", "Kültür Sanat", "bbc.com/culture", "en-US", "US"),
    ("Wallpaper", "Kültür", "Kültür Sanat", "wallpaper.com", "en-US", "US"),
    ("Dazed", "Kültür", "Kültür Sanat", "dazeddigital.com", "en-US", "US"),
    ("Juxtapoz", "Kültür", "Kültür Sanat", "juxtapoz.com", "en-US", "US"),
    ("Poetry Foundation", "Kültür", "Edebiyat", "poetryfoundation.org", "en-US", "US"),
    ("LA Review of Books", "Kültür", "Edebiyat", "lareviewofbooks.org", "en-US", "US"),
    ("Guernica", "Kültür", "Edebiyat", "guernicamag.com", "en-US", "US"),
    ("Public Books", "Kültür", "Edebiyat", "publicbooks.org", "en-US", "US"),
    ("Bookforum", "Kültür", "Edebiyat", "bookforum.com", "en-US", "US"),
    ("JSTOR Daily", "Kültür", "Edebiyat", "daily.jstor.org", "en-US", "US"),
    ("Monocle", "Küresel", "Yaşam Tarzı", "monocle.com", "en-US", "US"),
    ("National Geographic", "Küresel", "Yaşam Tarzı", "nationalgeographic.com", "en-US", "US"),
    ("Condé Nast Traveler", "Küresel", "Yaşam Tarzı", "cntraveler.com", "en-US", "US"),
    ("Esquire", "Küresel", "Yaşam Tarzı", "esquire.com", "en-US", "US"),
    ("Travel+Leisure", "Küresel", "Yaşam Tarzı", "travelandleisure.com", "en-US", "US"),
    ("Food & Wine", "Küresel", "Yaşam Tarzı", "foodandwine.com", "en-US", "US"),
    ("Dwell", "Küresel", "Yaşam Tarzı", "dwell.com", "en-US", "US"),
    ("Robb Report", "Küresel", "Yaşam Tarzı", "robbreport.com", "en-US", "US"),
    ("CBS Sports", "Küresel", "Spor", "cbssports.com", "en-US", "US"),
    ("NBC Sports", "Küresel", "Spor", "nbcsports.com", "en-US", "US"),
    ("DAZN", "Küresel", "Spor", "dazn.com", "en-US", "US"),
    ("TNT Sports", "Küresel", "Spor", "tntsports.co.uk", "en-GB", "GB"),
    ("TSN", "Küresel", "Spor", "tsn.ca", "en-US", "US"),
    ("RMC Sport", "Küresel", "Spor", "rmcsport.bfmtv.com", "fr", "FR"),
    ("Kicker", "Küresel", "Spor", "kicker.de", "de", "DE"),
    ("Cricbuzz", "Küresel", "Spor", "cricbuzz.com", "en-US", "US"),
    ("NFL", "Küresel", "Spor", "nfl.com", "en-US", "US"),
    ("NBA", "Küresel", "Spor", "nba.com", "en-US", "US"),
    ("Yahoo Sports", "Küresel", "Spor", "sports.yahoo.com", "en-US", "US"),
    ("Olympics", "Küresel", "Spor", "olympics.com", "en-US", "US"),
    ("Medyascope", "Türkiye", "Gündem", "medyascope.tv", "tr", "TR"),
    ("Gazete Oksijen", "Türkiye", "Gündem", "gazeteoksijen.com", "tr", "TR"),
    ("DW Türkçe", "Türkiye", "Gündem", "dw.com/tr", "tr", "TR"),
    ("NOW Haber", "Türkiye", "Gündem", "nowhaber.com", "tr", "TR"),
    ("Ekonomim", "Türkiye", "Ekonomi", "ekonomim.com", "tr", "TR"),
    ("Bloomberg HT", "Türkiye", "Ekonomi", "bloomberght.com", "tr", "TR"),
    ("Capital Türkiye", "Türkiye", "İş", "capital.com.tr", "tr", "TR"),
    ("Fortune Türkiye", "Türkiye", "İş", "fortuneturkey.com", "tr", "TR"),
    ("Patronlar Dünyası", "Türkiye", "Ekonomi", "patronlardunyasi.com", "tr", "TR"),
    ("Para Analiz", "Türkiye", "Ekonomi", "paraanaliz.com", "tr", "TR"),
    ("CNBC-e", "Türkiye", "Ekonomi", "cnbce.com", "tr", "TR"),
    ("Investing Türkiye", "Türkiye", "Ekonomi", "tr.investing.com", "tr", "TR"),
    ("Business HT", "Türkiye", "İş", "businessht.com.tr", "tr", "TR"),
    ("Fast Company Türkiye", "Türkiye", "İş", "fastcompany.com.tr", "tr", "TR"),
    ("LOG", "Türkiye", "Teknoloji", "log.com.tr", "tr", "TR"),
    ("Tamindir", "Türkiye", "Teknoloji", "tamindir.com", "tr", "TR"),
    ("CHIP Türkiye", "Türkiye", "Teknoloji", "chip.com.tr", "tr", "TR"),
    ("Hardware Plus", "Türkiye", "Teknoloji", "hwp.com.tr", "tr", "TR"),
    ("Merlin'in Kazanı", "Türkiye", "Teknoloji", "merlininkazani.com", "tr", "TR"),
    ("PC Hocası", "Türkiye", "Teknoloji", "pchocasi.com.tr", "tr", "TR"),
    ("ArtDog İstanbul", "Türkiye", "Kültür Sanat", "artdogistanbul.com", "tr", "TR"),
    ("Sanat Dünyamız", "Türkiye", "Kültür Sanat", "ykykultur.com.tr", "tr", "TR"),
    ("İKSV", "Türkiye", "Kültür Sanat", "iksv.org", "tr", "TR"),
    ("Bant Mag", "Türkiye", "Kültür Sanat", "bantmag.com", "tr", "TR"),
    ("Argonotlar", "Türkiye", "Kültür Sanat", "argonotlar.com", "tr", "TR"),
    ("Artful Living", "Türkiye", "Kültür Sanat", "artfulliving.com.tr", "tr", "TR"),
    ("Milliyet Sanat", "Türkiye", "Kültür Sanat", "milliyetsanat.com", "tr", "TR"),
    ("K24", "Türkiye", "Edebiyat", "t24.com.tr/k24", "tr", "TR"),
    ("Notos", "Türkiye", "Edebiyat", "notosoloji.com", "tr", "TR"),
    ("Varlık", "Türkiye", "Edebiyat", "varlik.com.tr", "tr", "TR"),
    ("KafkaOkur", "Türkiye", "Edebiyat", "kafkaokur.com", "tr", "TR"),
    ("OT Dergi", "Türkiye", "Edebiyat", "otdergi.com", "tr", "TR"),
    ("SabitFikir", "Türkiye", "Edebiyat", "sabitfikir.com", "tr", "TR"),
    ("Atlas", "Türkiye", "Yaşam Tarzı", "atlasdergisi.com", "tr", "TR"),
    ("Vogue Türkiye", "Türkiye", "Yaşam Tarzı", "vogue.com.tr", "tr", "TR"),
    ("GQ Türkiye", "Türkiye", "Yaşam Tarzı", "gqturkey.com", "tr", "TR"),
    ("Elle Türkiye", "Türkiye", "Yaşam Tarzı", "elle.com.tr", "tr", "TR"),
    ("NatGeo Türkiye", "Türkiye", "Yaşam Tarzı", "nationalgeographic.com.tr", "tr", "TR"),
    ("Skylife", "Türkiye", "Yaşam Tarzı", "skylife.com", "tr", "TR"),
    ("FoodinLife", "Türkiye", "Yaşam Tarzı", "foodinlife.com.tr", "tr", "TR"),
    ("Socrates", "Türkiye", "Spor", "socratesdergi.com", "tr", "TR"),
]

def _build_feeds() -> list[dict[str, str]]:
    """Gerçek RSS + Google News proxy kaynaklarını tek bir besleme listesinde birleştirir."""
    feeds = list(_REAL_FEEDS) + list(_EXTRA_REAL)
    for name, region, category, domain, hl, gl in _PROXY_SOURCES + _EXTRA_PROXY:
        feeds.append(
            {
                "name": name,
                "region": region,
                "category": category,
                "url": _gnews_site(domain, hl, gl),
            }
        )
    return feeds


# 80+ gazete, 110+ besleme (bazı kaynakların birden çok kategori beslemesi var).
FEEDS: list[dict[str, str]] = _build_feeds()

# Frontend filtresiyle birebir aynı olması için kaynak adları (bölgeye göre).
# "Kültür" = elit edebiyat & kültür kaynakları (ayrı grup olarak listelenir).
SOURCE_NAMES: dict[str, list[str]] = {"Türkiye": [], "Küresel": [], "Kültür": []}
for _f in FEEDS:
    _bucket = SOURCE_NAMES.get(_f["region"], SOURCE_NAMES["Küresel"])
    if _f["name"] not in _bucket:
        _bucket.append(_f["name"])


# --------------------------------------------------------------------------- #
#  GERÇEK KÖŞE YAZARLARI — yazarların kendi yayımlanmış yazıları toplanır.
#  (Uydurma metin ÜRETİLMEZ; yalnızca gerçek yazıların başlığı + özeti + linki.)
#  Küresel: The Guardian yazar başına RSS (güvenilir, gerçek imza).
#  Türkiye: Google News (yazar adı + gazete) ile gerçek köşe yazıları.
# --------------------------------------------------------------------------- #
COLUMNISTS: list[dict[str, str]] = [
    {"slug": "marina-hyde", "name": "Marina Hyde", "title": "The Guardian · Köşe Yazarı",
     "page": "https://www.theguardian.com/profile/marinahyde",
     "url": "https://www.theguardian.com/profile/marinahyde/rss"},
    {"slug": "george-monbiot", "name": "George Monbiot", "title": "The Guardian · Çevre & Politika",
     "page": "https://www.theguardian.com/profile/georgemonbiot",
     "url": "https://www.theguardian.com/profile/georgemonbiot/rss"},
    {"slug": "owen-jones", "name": "Owen Jones", "title": "The Guardian · Politika",
     "page": "https://www.theguardian.com/profile/owen-jones",
     "url": "https://www.theguardian.com/profile/owen-jones/rss"},
    {"slug": "polly-toynbee", "name": "Polly Toynbee", "title": "The Guardian · Politika",
     "page": "https://www.theguardian.com/profile/pollytoynbee",
     "url": "https://www.theguardian.com/profile/pollytoynbee/rss"},
    {"slug": "jonathan-freedland", "name": "Jonathan Freedland", "title": "The Guardian · Köşe Yazarı",
     "page": "https://www.theguardian.com/profile/jonathanfreedland",
     "url": "https://www.theguardian.com/profile/jonathanfreedland/rss"},
    {"slug": "ahmet-hakan", "name": "Ahmet Hakan", "title": "Hürriyet · Köşe Yazarı",
     "page": "https://www.hurriyet.com.tr/yazarlar/ahmet-hakan/",
     "url": _gnews_site("hurriyet.com.tr/yazarlar/ahmet-hakan", "tr", "TR")},
    {"slug": "abdulkadir-selvi", "name": "Abdulkadir Selvi", "title": "Hürriyet · Köşe Yazarı",
     "page": "https://www.hurriyet.com.tr/yazarlar/abdulkadir-selvi/",
     "url": _gnews_site("hurriyet.com.tr/yazarlar/abdulkadir-selvi", "tr", "TR")},
    {"slug": "deniz-zeyrek", "name": "Deniz Zeyrek", "title": "Sözcü · Köşe Yazarı",
     "page": "https://www.sozcu.com.tr/yazarlari/deniz-zeyrek/",
     "url": _gnews('"Deniz Zeyrek" köşe yazısı', "tr", "TR")},
    {"slug": "mehmet-y-yilmaz", "name": "Mehmet Y. Yılmaz", "title": "Köşe Yazarı",
     "page": "https://www.google.com/search?q=Mehmet+Y.+Y%C4%B1lmaz+k%C3%B6%C5%9Fe+yaz%C4%B1s%C4%B1",
     "url": _gnews('"Mehmet Y. Yılmaz" köşe yazısı', "tr", "TR")},
]


def _estimate_read_minutes(text: str) -> int:
    return max(1, round(len(text.split()) / 200))


def scrape_columnist(columnist: dict[str, str]) -> dict:
    """Tek bir yazarın GERÇEK son yazılarını çeker (özet + link; AI yok)."""
    entries = fetch_feed_entries(
        {"name": columnist["name"], "url": columnist["url"],
         "region": "", "category": "Görüş"},
        limit=4,
    )
    columns = []
    for e in entries:
        excerpt = (e.summary or e.title).strip()
        columns.append(
            {
                "title": e.title,
                "dek": excerpt[:220],
                "body": [excerpt] if excerpt else [e.title],
                "read_time": f"{_estimate_read_minutes(excerpt)} dk okuma",
                "source_url": e.source_url,
                "source_name": columnist["title"].split(" · ")[0],
            }
        )
    return {
        "slug": columnist["slug"],
        "name": columnist["name"],
        "title": columnist["title"],
        "page": columnist.get("page", ""),
        "avatar": None,  # Gerçek kişi: baş harf avatarı kullanılır (sahte foto yok).
        "columns": columns,
    }


def scrape_columnists() -> list[dict]:
    """Tüm köşe yazarlarının gerçek yazılarını PARALEL toplar."""
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(scrape_columnist, c) for c in COLUMNISTS]
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception:  # noqa: BLE001
                continue
    # Kararlı sıra (config sırası) için slug'a göre yeniden diz.
    order = {c["slug"]: i for i, c in enumerate(COLUMNISTS)}
    results.sort(key=lambda r: order.get(r["slug"], 99))
    return results


# Türkçe tık tuzağı (clickbait) işaretleri — hibrit hatta "AI'a yolla" kararını verir.
CLICKBAIT_MARKERS = [
    "şok", "şoke", "bomba", "dumur", "çıldırt", "küplere bin", "ağzı açık",
    "işte o an", "herkesi şaşırt", "gözler", "inanamad", "inanamayacak",
    "bakın ne", "ne oldu biliyor", "son dakika", "flaş", "skandal", "olay",
    "akılalmaz", "akıl almaz", "inanılmaz", "müthiş", "korkunç", "dehşet",
    "ortalık karıştı", "gözünüze inanama", "tek hamlede", "az önce",
    "duyan kulaklarına inanama", "herkes bunu konuşuyor", "çıldırttı",
    "yıllardır yanlış", "meğer", "bir anda", "olanlar oldu",
]

_CAPS_RUN = re.compile(r"(?:\b[A-ZÇĞİÖŞÜ]{2,}\b[\s,!?-]*){3,}")


def is_clickbait(title: str) -> bool:
    """Başlık Türkçe tık tuzağı işaretleri taşıyorsa True döner (heuristik)."""
    if not title:
        return False
    low = title.lower()
    if any(marker in low for marker in CLICKBAIT_MARKERS):
        return True
    # Aşırı noktalama (şok dili) veya art arda BÜYÜK HARFLE bağırma.
    if "!!!" in title or "?!" in title or title.count("!") >= 2:
        return True
    if _CAPS_RUN.search(title):
        return True
    return False


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
    feed_rank: int = 0        # beslemedeki sıra (0 = besleme manşeti)


def _image_from_entry(entry, summary_html: str) -> str | None:
    """RSS girdisinden görseli SAYFA İNDİRMEDEN çıkarır (hız için).

    media:thumbnail / media:content / enclosure / <img> sırasıyla denenir.
    """
    for key in ("media_thumbnail", "media_content"):
        media = entry.get(key)
        if media and isinstance(media, list) and media[0].get("url"):
            return media[0]["url"]
    for link in entry.get("links", []) or []:
        if link.get("rel") == "enclosure" and str(link.get("type", "")).startswith("image"):
            return link.get("href")
    for enc in entry.get("enclosures", []) or []:
        if str(enc.get("type", "")).startswith("image") and enc.get("href"):
            return enc.get("href")
    if summary_html and "<img" in summary_html:
        m = re.search(r'<img[^>]+src=["\\\']([^"\\\']+)', summary_html)
        if m:
            return m.group(1)
    return None


def fetch_feed_entries(feed: dict[str, str], limit: int = PER_FEED_DEFAULT) -> list[RawArticle]:
    """Tek bir beslemeden en yeni `limit` haberi RawArticle olarak döndürür.

    Görsel de RSS'ten (sayfa indirmeden) çıkarılır → hızlı. HTTP timeout=7;
    hata/yavaşlık durumunda boş liste döner (sessizce atlanır).
    """
    try:
        resp = requests.get(feed["url"], headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
    except Exception:  # noqa: BLE001 — ölü/yavaş kaynak tüm turu durdurmasın.
        logger.debug("Besleme atlandı: %s", feed.get("name"))
        return []

    articles: list[RawArticle] = []
    for rank, entry in enumerate(parsed.entries[:limit]):  # SADECE en yeni 3.
        summary_html = entry.get("summary", "")
        summary = BeautifulSoup(summary_html, "html.parser").get_text(" ", strip=True)
        tags = [t.get("term", "") for t in entry.get("tags", [])] if entry.get("tags") else []
        articles.append(
            RawArticle(
                source_name=feed["name"],
                source_url=entry.get("link", ""),
                title=entry.get("title", "").strip(),
                region=feed.get("region", ""),
                category=feed.get("category", ""),
                summary=summary,
                image_url=_image_from_entry(entry, summary_html),
                published=entry.get("published", entry.get("updated")),
                tags=[t for t in tags if t],
                feed_rank=rank,
            )
        )
    return articles


def fetch_all_feeds(
    feeds: list[dict[str, str]] | None = None, per_feed: int = PER_FEED_DEFAULT
) -> list[RawArticle]:
    """Tüm beslemeleri PARALEL (ThreadPoolExecutor) tarar, RawArticle listesi döndürür.

    Henüz tam metin/görsel ÇEKİLMEZ — yalnızca RSS düzeyi (başlık + özet + link).
    Tekrar/zenginleştirme kararı çağırana (pipeline) bırakılır.
    """
    feeds = feeds or FEEDS
    results: list[RawArticle] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_feed_entries, f, per_feed) for f in feeds]
        for fut in as_completed(futures):
            try:
                results.extend(fut.result())
            except Exception:  # noqa: BLE001
                continue
    logger.info("Paralel tarama: %d besleme → %d ham haber", len(feeds), len(results))
    return results


def enrich_with_full_text(article: RawArticle) -> RawArticle:
    """Makale linkini ziyaret edip tam gövdeyi ve kapak görselini ekler (timeout=7)."""
    if not article.source_url:
        return article

    try:
        resp = requests.get(article.source_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        return article  # Sessizce geç; RSS özeti yeterli.

    try:
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
    except Exception:  # noqa: BLE001 — ayrıştırma hatası tüm turu durdurmasın.
        return article
    return article


def enrich_many(articles: list[RawArticle]) -> list[RawArticle]:
    """Verilen makaleleri PARALEL (ThreadPoolExecutor) tam metinle zenginleştirir."""
    if not articles:
        return articles
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        list(executor.map(enrich_with_full_text, articles))
    return articles


def scrape_sources(
    feeds: list[dict[str, str]] | None = None, per_feed: int = PER_FEED_DEFAULT
) -> Iterable[RawArticle]:
    """Tüm beslemeleri tarar ve (Google News dışı) makaleleri tam metinle zenginleştirir.

    Geriye-dönük uyumluluk için korunur; pipeline daha verimli olan
    fetch_all_feeds + enrich_many akışını ayrı ayrı kullanır.
    """
    raws = fetch_all_feeds(feeds, per_feed)
    enrich_many([r for r in raws if "news.google.com" not in (r.source_url or "")])
    return raws


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    print(f"Toplam besleme: {len(FEEDS)} | Türkiye: {len(SOURCE_NAMES['Türkiye'])} "
          f"kaynak, Küresel: {len(SOURCE_NAMES['Küresel'])} kaynak")
    raws = fetch_all_feeds(per_feed=2)
    for art in raws[:10]:
        print(f"\n[{art.source_name} · {art.region} · {art.category}] {art.title[:70]}")
        print(f"  link: {art.source_url[:80]}")
