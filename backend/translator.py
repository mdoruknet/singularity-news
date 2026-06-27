"""
translator.py — Ham haberi, bağlam temelli (context-aware) editoryal Türkçeye
çeviren modül. İki sağlayıcı desteklenir ve `LLM_PROVIDER` ile seçilir:

  • "gemini"    → Google Gemini (varsayılan; GEMINI_API_KEY)
  • "anthropic" → Anthropic Claude (ANTHROPIC_API_KEY)

`LLM_PROVIDER` boşsa: GEMINI_API_KEY varsa Gemini, yoksa ANTHROPIC_API_KEY varsa
Claude, ikisi de yoksa Gemini varsayılır. Her iki sağlayıcı da yapısal (JSON
şema) çıktı verir; böylece model serbest metin değil, doğrulanmış bir
`TranslatedArticle` döndürür.
"""

from __future__ import annotations

import os
import logging

from pydantic import BaseModel, Field

from scraper import RawArticle

logger = logging.getLogger("singularity.translator")

# --- Sağlayıcı seçimi ---
_PROVIDER_ENV = os.environ.get("LLM_PROVIDER", "").strip().lower()
if _PROVIDER_ENV in ("gemini", "google"):
    PROVIDER = "gemini"
elif _PROVIDER_ENV in ("anthropic", "claude"):
    PROVIDER = "anthropic"
elif os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
    PROVIDER = "gemini"
elif os.environ.get("ANTHROPIC_API_KEY"):
    PROVIDER = "anthropic"
else:
    PROVIDER = "gemini"

# flash-lite, ücretsiz katmanda daha yüksek günlük istek kotasına ve daha düşük
# maliyete sahiptir; haber-manşeti çevirisi için kalitesi fazlasıyla yeterli.
# GEMINI_MODEL ile ezilebilir (örn. faturalandırma açıksa "gemini-2.5-flash").
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")

# İstemciler tembel (lazy) kurulur: yalnızca kullanılan sağlayıcının paketi gerekir.
_gemini_client = None
_anthropic_client = None


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        from google import genai

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic

        _anthropic_client = anthropic.Anthropic()
    return _anthropic_client

# --------------------------------------------------------------------------- #
#  Sistem istemi (System Prompt) — çevirinin "editoryal ruhu" burada tanımlı.
# --------------------------------------------------------------------------- #
SYSTEM_PROMPT = """\
Sen, "Singularity" adlı prestijli bir küresel haber ajansının kıdemli yapay \
zeka editörü ve çevirmenisin. Üslubun, The New York Times'ın dünya ve teknoloji \
masasının otoriter, ölçülü, ağırbaşlı editoryal diliyle örtüşür.

Sana bir haber metni verilecek. Metnin diline göre İKİ farklı görevden birini \
yapacaksın:

A) METİN İNGİLİZCE (veya Türkçe dışında bir dilde) ise → ÇEVİR.
   Bağlamı ve teknik terimleri (LLM, RAG, inference, AGI, token, fine-tuning, \
   agent, benchmark vb.) koruyarak akıcı, profesyonel bir editoryal Türkçeye \
   çevir. Gerektiğinde ilk geçişte parantez içinde kısa açıklama ver \
   (örn. "çıkarım (inference)"). Bu durumda rewritten = false.

B) METİN ZATEN TÜRKÇE ise (çoğunlukla yerel basından; şok edici, abartılı, \
   magazinel ya da duygu sömürüsü içeren tık tuzağı başlık ve metin) → YENİDEN YAZ.
   Metni clickbait'ten ARINDIR: "işte o anlar", "herkesi şaşırtan", "dumur eden", \
   "bomba", "şok" gibi kalıpları, abartılı sıfatları, spekülasyonu ve gereksiz \
   duygu sömürüsünü SİL. Olguları koru, üslubu ağırbaşlı NYT gazeteciliğine \
   taşıyarak metni BAŞTAN YAZ. Bu durumda rewritten = true.

Her iki durumda da geçerli ortak kurallar:
1. TERS PİRAMİT. En önemli, doğrulanabilir bilgi ilk paragrafta (drop-cap ile \
   başlayacak paragraf) yer almalı; okur özü ilk cümlelerde almalı.
2. SADAKAT. Kaynakta olmayan olgu, sayı veya alıntı UYDURMA. Bilgi eksikse \
   temkinli ve genel bir dille yaz.
3. ATIF KÜLTÜRÜ. Kaynağı, intihal hissi vermeyen bir gazeteci diliyle metne yedir \
   (örn. "Reuters'ın aktardığına göre…", "BBC'nin ulaştığı bilgilere göre…").
4. TARAFSIZLIK. Birinci tekil şahıs, reklam dili ve abartıdan kaçın.
5. KATEGORİ şu listeden TAM OLARAK biri olmalı: Gündem, Türkiye, Dünya, \
Ekonomi, Teknoloji, İş, Kültür Sanat, Edebiyat, Yaşam Tarzı, Spor.

Bir "manşet" (title), bir "spot" (dek), kategori, küçük bir üst etiket "kicker", \
4-6 paragraflık gövde, tahmini okuma süresi, kapak görseli için kısa bir alt yazı \
ve rewritten bayrağını üret. Yalnızca istenen yapısal JSON çıktısını ver; ek \
açıklama yazma.
"""


class TranslatedArticle(BaseModel):
    """Çeviri çıktısının doğrulanmış şeması (frontend ile birebir uyumlu)."""

    title: str = Field(description="Türkçe manşet (clickbait olmayan, gazete üslubu)")
    dek: str = Field(description="Tek-iki cümlelik Türkçe spot/özet")
    category: str = Field(description="Gündem | Türkiye | Dünya | Ekonomi | Teknoloji | İş | Kültür Sanat | Edebiyat | Yaşam Tarzı | Spor")
    kicker: str = Field(description="Kısa üst etiket, örn. 'Yapay Genel Zekâ'")
    body: list[str] = Field(description="4-6 paragraflık Türkçe makale gövdesi")
    read_time_minutes: int = Field(description="Tahmini okuma süresi (dakika)")
    image_caption: str = Field(description="Kapak görseli için kısa Türkçe alt yazı")
    rewritten: bool = Field(
        description="Metin Türkçe tık tuzağıysa yeniden yazıldı (true); "
        "yabancı dilden çevrildiyse false."
    )


def _build_user_prompt(raw: RawArticle) -> str:
    """Ham makaleyi modele verilecek tek bir kullanıcı mesajına dönüştürür."""
    body = raw.content or raw.summary or "(Gövde metni alınamadı; başlığa göre özetle.)"
    tags = ", ".join(raw.tags) if raw.tags else "—"
    return (
        f"KAYNAK: {raw.source_name} ({raw.region or '—'})\n"
        f"ÖNERİLEN KATEGORİ: {raw.category or '—'}\n"
        f"ORİJİNAL BAŞLIK: {raw.title}\n"
        f"ETİKETLER: {tags}\n\n"
        f"ORİJİNAL METİN:\n{body}\n\n"
        "Yukarıdaki kurallara göre işle: metin yabancı dildeyse çevir "
        "(rewritten=false), zaten Türkçe ve tık tuzağıysa clickbait'ten "
        "arındırıp yeniden yaz (rewritten=true)."
    )


def _translate_gemini(raw: RawArticle) -> TranslatedArticle:
    """Google Gemini ile yapısal (JSON şema) Türkçe çeviri."""
    from google.genai import types

    client = _get_gemini()
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=_build_user_prompt(raw),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=TranslatedArticle,  # Pydantic → doğrulanmış JSON şema.
            max_output_tokens=8000,
        ),
    )
    result = resp.parsed
    if result is None:
        # Bazı durumlarda .parsed boş olabilir; ham JSON metnini doğrula.
        text = (resp.text or "").strip()
        if not text:
            raise RuntimeError("Gemini çeviri çıktısı boş döndü.")
        result = TranslatedArticle.model_validate_json(text)
    return result


def _translate_anthropic(raw: RawArticle) -> TranslatedArticle:
    """Anthropic Claude ile yapısal (adaptive-thinking) Türkçe çeviri."""
    client = _get_anthropic()
    response = client.messages.parse(
        model=ANTHROPIC_MODEL,
        # Adaptive thinking de çıktı token'ı harcadığından bütçeyi geniş tut.
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_prompt(raw)}],
        output_format=TranslatedArticle,
    )
    result = response.parsed_output
    if result is None:
        raise RuntimeError(
            f"Çeviri yapılandırılamadı (stop_reason={response.stop_reason})."
        )
    return result


def translate_article(raw: RawArticle) -> TranslatedArticle:
    """Tek bir ham makaleyi seçili sağlayıcıyla yapılandırılmış Türkçe çeviriye dönüştürür."""
    logger.info("Çevriliyor (%s): %s", PROVIDER, raw.title[:70])
    if PROVIDER == "anthropic":
        return _translate_anthropic(raw)
    return _translate_gemini(raw)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    demo = RawArticle(
        source_name="The Verge",
        source_url="https://www.theverge.com/example",
        title="New reasoning models push the limits of inference-time compute",
        content=(
            "A new generation of large language models can now 'think' before "
            "answering by generating long chains of reasoning at inference time. "
            "On math and coding benchmarks, the models posted double-digit gains, "
            "reigniting debate about the path to AGI and the limits of scaling."
        ),
        tags=["AI", "LLM", "AGI"],
    )

    article = translate_article(demo)
    print("\nMANŞET :", article.title)
    print("SPOT   :", article.dek)
    print("KATEGORİ:", article.category, "| KICKER:", article.kicker)
    print("SÜRE   :", article.read_time_minutes, "dk")
    print("\nGÖVDE:")
    for p in article.body:
        print("  •", p)
