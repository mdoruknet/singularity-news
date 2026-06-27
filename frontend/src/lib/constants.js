/* Uygulama sabitleri — kategoriler, kaynak grupları, depolama anahtarları, API
   adresleri ve görsel yedeği. Saf veri; React/DOM bağımlılığı yoktur. */

export const ALL_CATEGORIES = [
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
];

// Backend scraper.py SOURCE_NAMES ile birebir aynı (filtre eşleşmesi için).
export const SOURCE_GROUPS = {
  Türkiye: [
    "Sözcü", "Hürriyet", "Sabah", "Milliyet", "Habertürk", "CNN Türk", "NTV",
    "TRT Haber", "Cumhuriyet", "T24", "BBC TR", "Euronews TR", "Diken", "Mynet",
    "Ensonhaber", "Haberler.com", "TGRT", "A Haber", "Yeni Şafak",
    "Türkiye Gazetesi", "Akşam", "Karar", "OdaTV", "AA", "İHA", "DHA", "BirGün",
    "Duvar", "Korkusuz", "Aydınlık", "Halk TV", "Tele1", "Dünya",
    "Independent TR", "Onedio", "Memurlar.net", "Internet Haber",
    "Gerçek Gündem", "Haber Global",
    "Fanatik", "Fotomaç", "Sporx", "A Spor", "Ajansspor", "Fotospor",
    "beIN Sports", "NTV Spor", "Sabah Spor", "CNN Türk Spor", "TRT Spor",
    "Skorer", "Spor Arena", "Mackolik", "Tivibu Spor",
  ],
  Küresel: [
    "NYT", "CNN", "BBC News", "Google News", "The Guardian", "Fox News",
    "Washington Post", "USA Today", "NBC", "AP", "Bloomberg", "WSJ", "NY Post",
    "Newsweek", "Axios", "Politico", "NPR", "CBS", "Sky News", "Independent",
    "The Sun", "Mirror", "Metro UK", "Al Jazeera", "France 24", "Le Monde",
    "Le Figaro", "Der Spiegel", "Die Welt", "El Mundo", "Corriere", "Repubblica",
    "Jerusalem Post", "Euronews", "Reuters", "MSN", "ABC", "Telegraph",
    "The Times", "Financial Times", "Daily Mail", "HuffPost", "Haaretz", "Bild",
    "El País", "ESPN", "BBC Sport", "Sky Sports", "Marca", "AS", "L'Équipe",
    "Gazzetta", "The Athletic", "Goal", "Bleacher Report", "Sports Illustrated",
    "Fox Sports", "Eurosport",
  ],
  "Edebiyat & Kültür": [
    "The New Yorker", "NY Review of Books", "The Paris Review",
    "London Review of Books", "Granta", "ARTnews", "The Art Newspaper", "TLS",
    "Artforum",
  ],
};

export const ALL_SOURCES = [
  ...SOURCE_GROUPS.Türkiye,
  ...SOURCE_GROUPS.Küresel,
  ...SOURCE_GROUPS["Edebiyat & Kültür"],
];

// Kaynak tercihi "opt-out": hiddenSources = gizlenen kaynaklar. Boşsa hepsi
// görünür. Böylece yeni eklenen yüzlerce kaynak otomatik görünür ve seçilebilir.
export const DEFAULT_PREFS = { categories: ALL_CATEGORIES, hiddenSources: [] };

export const FOR_YOU = "Bana Özel"; // Giriş yapmış kullanıcıya özel akış etiketi.

export const THEME_KEY = "singularity:theme";
export const PREFS_KEY = "singularity:prefs";
export const PREFS_VER_KEY = "singularity:prefs:v";
export const PREFS_VERSION = "6"; // Kaynak tercihi opt-out modeline geçti (göç tetikleyici).
export const TOKEN_KEY = "singularity:token";

// Production'da Vercel/Render'da VITE_API_URL ile ezilir; yoksa yerel backend.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const API_URL = `${API_BASE}/api/articles`;
export const AUTH_URL = `${API_BASE}/api/auth`;
export const COLUMNISTS_URL = `${API_BASE}/api/columnists`;
export const SOURCES_URL = `${API_BASE}/api/sources`;

export const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80";
