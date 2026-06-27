/* Ağ katmanı — dayanıklı apiFetch (timeout + exponential backoff retry) ve
   üzerine kurulu API yardımcıları (haberler, köşe yazarları, kaynaklar, auth). */

import {
  ALL_CATEGORIES,
  API_URL,
  AUTH_URL,
  COLUMNISTS_URL,
  SOURCES_URL,
} from "./constants.js";
import { normalizeArticle } from "./utils.js";

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function _backoffDelay(attempt, retryAfter) {
  const ra = retryAfter ? parseInt(retryAfter, 10) : NaN;
  if (!Number.isNaN(ra)) return Math.min(ra * 1000, 15000); // sunucunun Retry-After'ına saygı
  const base = 500 * 2 ** attempt; // 500, 1000, 2000, 4000…
  return Math.min(base + Math.random() * 300, 8000); // jitter + tavan
}

/* Geçici hatalar (ağ kopması, zaman aşımı, 429, 5xx) yeniden denenir; kalıcı
   hatalar (4xx; 401/404/409 vb.) çağırana olduğu gibi döner. Render free-tier
   ~50 sn soğuk başlangıcını ve anlık dalgalanmaları tolere eder. */
export async function apiFetch(url, { retries = 3, timeoutMs = 25000, ...options } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      // Başarılı, kalıcı hata ya da son deneme → çağırana ver (yorumlamak ona kalsın).
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        return res;
      }
      await _sleep(_backoffDelay(attempt, res.headers.get("Retry-After")));
    } catch (err) {
      clearTimeout(timer); // ağ hatası ya da zaman aşımı (abort)
      lastErr = err;
      if (attempt === retries) throw err;
      await _sleep(_backoffDelay(attempt));
    }
  }
  throw lastErr;
}

/* Canlı API'den (varsa) tercihlere göre haberleri çeker. Kaynak filtresi
   istemci tarafında (opt-out) yapılır; sunucudan geniş bir liste çekilir. */
export async function fetchArticles(prefs) {
  const params = new URLSearchParams();
  if (
    prefs?.categories?.length &&
    prefs.categories.length < ALL_CATEGORIES.length
  ) {
    params.set("categories", prefs.categories.join(","));
  }
  // Geniş çek: seyrek kategoriler (örn. Türkiye) "en yeni N" penceresinden
  // taşmasın diye yüksek tutulur; kategori sekmeleri istemci tarafında filtrelenir.
  params.set("limit", "500");
  const res = await apiFetch(`${API_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json?.data ?? [];
  return list.map(normalizeArticle);
}

/* Köşe yazarlarını API'den çeker. */
export async function fetchColumnists() {
  const res = await apiFetch(COLUMNISTS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

/* Kaynak gruplarını (bölgeye göre) API'den çeker; filtreyi dinamik doldurur. */
export async function fetchSources() {
  const res = await apiFetch(SOURCES_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json && typeof json === "object" ? json : null;
}

/* -------- Auth API yardımcıları -------- */
export async function apiAuth(path, body) {
  const res = await apiFetch(`${AUTH_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    retries: 1, // mutasyon: soğuk başlangıç için tek yeniden deneme yeterli
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "İşlem başarısız.");
  return data;
}

export async function apiMe(token) {
  const res = await apiFetch(`${AUTH_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    retries: 2,
  });
  if (!res.ok) throw new Error("Oturum geçersiz");
  return res.json();
}

export async function apiSavePreferences(token, prefs) {
  await apiFetch(`${AUTH_URL}/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      categories: prefs.categories,
      sources: [],
    }),
    retries: 1,
  }).catch(() => {});
}
