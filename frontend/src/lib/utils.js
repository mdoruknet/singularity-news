/* Saf yardımcılar — biçimlendirme, makale normalizasyonu, karıştırma/imza,
   görünürlük filtresi ve localStorage yükleyiciler. React/DOM render'ı yok. */

import {
  FALLBACK_IMG,
  FOR_YOU,
  ALL_CATEGORIES,
  DEFAULT_PREFS,
  THEME_KEY,
  PREFS_KEY,
  PREFS_VER_KEY,
  PREFS_VERSION,
  TOKEN_KEY,
} from "./constants.js";

export function todayLong() {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "Perşembe, 25 Haziran 2026";
  }
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function safeParseBody(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
}

/* API ister zengin şemamızı, ister ham şemayı döndürsün — tek biçime indirger. */
export function normalizeArticle(a) {
  return {
    id: a.id != null ? String(a.id) : a.source_url || a.title,
    lead: Boolean(a.lead),
    category: a.category || "Gündem",
    kicker: a.kicker || a.category || "Gündem",
    title: a.title || "",
    dek: a.dek || "",
    author:
      a.author ||
      (a.rewritten
        ? "Yeniden Yazım: Singularity AI Bot"
        : "Çeviri: Singularity AI Bot"),
    rewritten:
      Boolean(a.rewritten) ||
      (typeof a.author === "string" && a.author.includes("Yeniden Yazım")),
    originalTitle: a.originalTitle || a.original_title || "",
    date: a.date || "",
    readTime:
      a.readTime ||
      (a.read_time_minutes
        ? `${a.read_time_minutes} dk okuma`
        : "Yapay zeka derlemesi"),
    image: a.image || a.image_url || FALLBACK_IMG,
    imageCaption: a.imageCaption || a.image_caption || "",
    imageCredit:
      a.imageCredit ||
      (a.source_name ? `Fotoğraf: ${a.source_name}` : "Fotoğraf: Kaynak"),
    source: a.source || { name: a.source_name || "Kaynak", url: a.source_url || "#" },
    body: safeParseBody(a.body),
  };
}

/* Bir diziyi (kopyasını) karıştırır — yenilemede gözle görülür değişim için. */
export function shuffleArr(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Akışı yeniden sıralar (manşet dahil). `lead` bayrağı sıfırlanır ki
   karıştırmadan sonra ilk haber yeni manşet olsun. */
export function reshuffle(list) {
  return shuffleArr(list.map((x) => ({ ...x, lead: false })));
}

/* Sıra-bağımsız içerik imzası — yeni haber gelip gelmediğini anlamak için. */
export function sig(list) {
  return [...new Set(list.map((a) => a.id))].sort().join("|");
}

/* Tercihler + aktif kategori filtresine göre görünürlük (kaynak: opt-out). */
export function isVisible(a, prefs, activeCategory, user) {
  const hidden = prefs.hiddenSources || [];
  const srcOK = !hidden.includes(a.source?.name);

  if (activeCategory === FOR_YOU) {
    const cats = user?.preferences?.categories;
    const catOK =
      Array.isArray(cats) && cats.length ? cats.includes(a.category) : true;
    return catOK && srcOK;
  }

  const knownCat = ALL_CATEGORIES.includes(a.category);
  const catOK = activeCategory
    ? a.category === activeCategory
    : !knownCat || prefs.categories.includes(a.category);
  return catOK && srcOK;
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const ver = localStorage.getItem(PREFS_VER_KEY);
      const categories = Array.isArray(p.categories)
        ? p.categories.filter((c) => ALL_CATEGORIES.includes(c))
        : DEFAULT_PREFS.categories;
      // Opt-out modeli: eski sürümden (sources=seçili) gelenlerde gizli liste
      // sıfırlanır → tüm kaynaklar (yenileri dahil) görünür kalır.
      const hiddenSources =
        ver !== PREFS_VERSION || !Array.isArray(p.hiddenSources)
          ? []
          : p.hiddenSources;
      return {
        categories: categories.length ? categories : DEFAULT_PREFS.categories,
        hiddenSources,
      };
    }
  } catch {
    /* yoksay */
  }
  return DEFAULT_PREFS;
}

export function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* yoksay */
  }
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export const onImgError = (e) => {
  if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
};
