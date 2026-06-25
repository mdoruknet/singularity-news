import { useState, useEffect, useRef } from "react";
import {
  ExternalLink,
  ArrowLeft,
  Clock,
  Bot,
  Menu,
  Languages,
  Loader2,
  RefreshCw,
  Settings,
  Sun,
  Moon,
  X,
  SlidersHorizontal,
} from "lucide-react";

/* ============================================================================
   SINGULARITY — Kişiselleştirilebilir Küresel Haber Ajansı
   ----------------------------------------------------------------------------
   The New York Times'ın klasik editoryal tasarım dilini birebir taklit eden,
   karanlık mod ve kişiselleştirme (kategori + kaynak filtresi) destekli tek
   dosyalık React prototipi. Tüm haberler, arka plandaki anti-clickbait LLM
   motorunun ürettiği ağırbaşlı, Ters Piramit kuralına uygun metinleri simüle
   eder: yabancı kaynaklar çevrilir, yerel tık tuzakları yeniden yazılır.
   ========================================================================== */

/* ----------------------------- SABİTLER ----------------------------------- */

const ALL_CATEGORIES = [
  "Gündem",
  "Dünya",
  "Ekonomi",
  "Teknoloji",
  "Kültür",
  "Spor",
];

const SOURCE_GROUPS = {
  Türkiye: ["NTV", "Sözcü", "BBC Türkçe"],
  Küresel: ["Reuters", "AP", "Bloomberg"],
};
const ALL_SOURCES = [...SOURCE_GROUPS.Türkiye, ...SOURCE_GROUPS.Küresel];

const DEFAULT_PREFS = { categories: ALL_CATEGORIES, sources: ALL_SOURCES };

const THEME_KEY = "singularity:theme";
const PREFS_KEY = "singularity:prefs";

// Production'da Vercel'de VITE_API_URL ile ezilir; yoksa yerel backend varsayılır.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_URL = `${API_BASE}/api/articles`;
const REFRESH_URL = `${API_BASE}/api/refresh`;
const STATUS_URL = `${API_BASE}/api/status`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80";

/* ----------------------------- MOCK VERİ ---------------------------------- */
/* Backend'deki çeviri/yeniden-yazım hattının üreteceği JSON'un simülasyonu.
   Farklı kategori ve kaynaklardan, tık tuzağından arındırılmış ağırbaşlı
   editoryal metinler. */

const MOCK_ARTICLES = [
  {
    id: "iklim-zirvesi",
    lead: true,
    category: "Dünya",
    kicker: "İklim Diplomasisi",
    title:
      "İklim Zirvesinde Tarihi Uzlaşı: Fosil Yakıtlardan Kademeli Çıkış Metne Girdi",
    dek: "Maraton müzakerelerin ardından kabul edilen taslak, bağlayıcı yaptırım içermese de küresel enerji geçişine ilk kez ortak bir yön çiziyor.",
    author: "Çeviri: Singularity AI Bot",
    rewritten: false,
    desk: "Cenevre",
    date: "25 Haziran 2026",
    readTime: "7 dk okuma",
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80",
    imageCaption:
      "Zirvenin kapanışında kabul edilen metin, fosil yakıtlardan çıkış ifadesini ilk kez resmî sonuç belgesine taşıdı.",
    imageCredit: "Fotoğraf: Reuters",
    source: { name: "Reuters", url: "https://www.reuters.com" },
    body: [
      "Yüzü aşkın ülkenin katıldığı iklim zirvesi, fosil yakıtlardan kademeli çıkışı ilk kez resmî sonuç metnine taşıyan bir uzlaşıyla sona erdi. Karar, ihlal hâlinde işletilecek bağlayıcı bir yaptırım mekanizması içermiyor; ancak müzakereciler, ifadenin küresel enerji politikaları açısından uzun süredir aşılamayan bir eşiği geçtiğini belirtiyor.",
      "Metnin son hâli, petrol ihraç eden ülkeler ile iklim finansmanı talep eden gelişmekte olan ekonomiler arasındaki gerilimin damga vurduğu uzun bir pazarlığın ürünü oldu. Taraflar, geçiş sürecinin maliyetinin nasıl paylaşılacağı konusunda yalnızca genel bir çerçevede anlaşabildi.",
      "Çevre örgütleri sonucu temkinli karşıladı. Birçok kuruluş, metnin yönünü doğru bulmakla birlikte, somut takvim ve denetim eksikliğinin hedefleri zayıflattığı uyarısında bulundu.",
      "Sıradaki aşama, ülkelerin bu çerçeveyi kendi ulusal taahhütlerine yansıtması olacak. Gözler, bir sonraki zirveye kadar açıklanacak güncellenmiş emisyon planlarına çevrildi.",
    ],
  },
  {
    id: "kentsel-donusum",
    category: "Gündem",
    kicker: "Kentsel Politika",
    title:
      "Kentsel Dönüşümde Yeni Yönetmelik: Riskli Yapılar İçin Süreç Yeniden Düzenlendi",
    dek: "Düzenleme, deprem riski taşıyan binalarda dönüşümü hızlandırmayı ve hak sahiplerinin mali yükünü azaltmayı hedefliyor.",
    originalTitle:
      "SON DAKİKA: Milyonları ilgilendiren O KARAR çıktı! Evinizi kaybetmemek için yapmanız gereken tek şey...",
    author: "Yeniden Yazım: Singularity AI Bot",
    rewritten: true,
    desk: "Ankara",
    date: "25 Haziran 2026",
    readTime: "5 dk okuma",
    image:
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Yeni yönetmelik, riskli yapı tespitinden yıkım ve yeniden inşa aşamasına kadar olan süreci kısaltmayı amaçlıyor.",
    imageCredit: "Fotoğraf: NTV",
    source: { name: "NTV", url: "https://www.ntv.com.tr" },
    body: [
      "Riskli yapıların dönüşümüne ilişkin yönetmelik, başvuru ve tespit süreçlerini yeniden düzenleyen değişikliklerle güncellendi. Düzenlemenin temel amacı, deprem riski taşıyan binalarda dönüşümü hızlandırmak ve hak sahiplerinin karşılaştığı bürokratik ve mali engelleri azaltmak olarak açıklandı.",
      "Yeni çerçeveye göre risk tespiti, yıkım kararı ve yeniden inşa izinleri için öngörülen idari süreler kısaltılıyor; hak sahiplerine sağlanan kira ve taşınma desteklerinin kapsamı ise yeniden tanımlanıyor.",
      "Şehir plancıları ve mühendislik örgütleri, hız kazandıran adımları olumlu bulmakla birlikte, denetimin niteliğinden ödün verilmemesi gerektiğini vurguluyor. Uzmanlara göre sürecin başarısı, sahadaki uygulamanın titizliğine bağlı olacak.",
      "Düzenlemenin kademeli olarak yürürlüğe gireceği, önceliğin yüksek riskli bölgelerdeki yapı stokuna verileceği belirtildi.",
    ],
  },
  {
    id: "piyasa-faiz",
    category: "Ekonomi",
    kicker: "Para Politikası",
    title: "Küresel Piyasalar Merkez Bankalarının Faiz Sinyaline Kilitlendi",
    dek: "Yatırımcılar, enflasyondaki yavaşlamanın faiz indirimi beklentilerini güçlendirip güçlendirmeyeceğini değerlendiriyor.",
    author: "Çeviri: Singularity AI Bot",
    rewritten: false,
    desk: "New York",
    date: "24 Haziran 2026",
    readTime: "6 dk okuma",
    image:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Tahvil getirileri ve hisse endeksleri, merkez bankalarının atacağı bir sonraki adıma göre yön arıyor.",
    imageCredit: "Fotoğraf: Bloomberg",
    source: { name: "Bloomberg", url: "https://www.bloomberg.com" },
    body: [
      "Küresel piyasalar, başlıca merkez bankalarının faiz patikasına ilişkin vereceği sinyalleri beklerken temkinli bir seyir izliyor. Yatırımcıların odağında, son verilerde gözlenen enflasyon yavaşlamasının para politikasında gevşemeye kapı aralayıp aralamayacağı sorusu var.",
      "Analistler, enflasyondaki düşüşün istikrarlı hâle gelmesi durumunda faiz indirimi beklentilerinin güçleneceğini; ancak bankaların erken bir gevşemeden kaçınmak için ihtiyatlı bir dil tutmayı sürdürebileceğini belirtiyor.",
      "Tahvil getirilerindeki hareketlilik, hisse senedi piyasalarındaki sektörel ayrışmayı da derinleştiriyor. Faize duyarlı teknoloji hisseleri öne çıkarken, savunmacı sektörler görece yatay seyrediyor.",
      "Piyasa katılımcıları, önümüzdeki dönemde açıklanacak istihdam ve büyüme verilerinin, fiyatlamaların yönünü belirleyen asıl etken olacağı görüşünde.",
    ],
  },
  {
    id: "ai-cip-talebi",
    category: "Teknoloji",
    kicker: "Yapay Zeka Altyapısı",
    title:
      "Yapay Zeka Çip Talebi, Veri Merkezi Yatırımlarını Rekor Seviyeye Taşıdı",
    dek: "Bulut sağlayıcılarının kapasite yarışı, enerji ve tedarik zinciri üzerinde yeni baskılar oluşturuyor.",
    author: "Çeviri: Singularity AI Bot",
    rewritten: false,
    desk: "San Francisco",
    date: "24 Haziran 2026",
    readTime: "6 dk okuma",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Büyük dil modellerinin (LLM) çıkarım (inference) yükü, hızlandırıcı çiplere olan talebi katladı.",
    imageCredit: "Fotoğraf: Reuters",
    source: { name: "Reuters", url: "https://www.reuters.com" },
    body: [
      "Yapay zeka hızlandırıcı çiplerine olan talep, bulut sağlayıcılarının veri merkezi yatırımlarını rekor seviyeye taşıdı. Büyük dil modellerinin (LLM) hem eğitim hem de çıkarım (inference) yükü, işlem kapasitesine yönelik talebi öngörülerin ötesine çıkardı.",
      "Sektör yöneticileri, asıl darboğazın yalnızca çip üretimi değil; bu çipleri besleyecek elektrik, soğutma ve yüksek bant genişlikli bellek (HBM) tedariki olduğunu vurguluyor. Kapasite yarışı, enerji altyapısı üzerinde de yeni baskılar oluşturuyor.",
      "Maliyet tarafında ise çelişkili bir tablo var: Birim çıkarım maliyeti düşmeyi sürdürürken, toplam talebin patlaması nedeniyle şirketlerin altyapı harcamaları artıyor. Analistler bunu “verimlilik arttıkça tüketimin de artması” olarak yorumluyor.",
      "Uzmanlara göre önümüzdeki dönemde rekabet, ham işlem gücünden çok enerji verimliliği ve tedarik zinciri dayanıklılığı üzerinden şekillenecek.",
    ],
  },
  {
    id: "anadolu-kazi",
    category: "Kültür",
    kicker: "Arkeoloji",
    title:
      "Anadolu'daki Kazılarda Antik Kente Ait Yeni Bir Bölüm Gün Yüzüne Çıktı",
    dek: "Arkeologlar, buluntuların bölgenin ticaret tarihine ilişkin bilinenleri genişletebileceğini belirtiyor.",
    originalTitle:
      "Kazıda bulunanlar HERKESİ ŞOKE ETTİ! Arkeologlar gözlerine inanamadı, bakın ne çıktı...",
    author: "Yeniden Yazım: Singularity AI Bot",
    rewritten: true,
    desk: "İzmir",
    date: "23 Haziran 2026",
    readTime: "4 dk okuma",
    image:
      "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Kazı ekibi, açığa çıkarılan yapının kentin kamusal yaşamına ait olduğunu değerlendiriyor.",
    imageCredit: "Fotoğraf: BBC Türkçe",
    source: { name: "BBC Türkçe", url: "https://www.bbc.com/turkce" },
    body: [
      "Anadolu'da sürdürülen kazı çalışmalarında, antik bir kente ait olduğu değerlendirilen yeni bir yapı topluluğu gün yüzüne çıkarıldı. Arkeologlar, buluntuların bölgenin ticaret ve gündelik yaşam tarihine ilişkin bilinenleri genişletebileceğini belirtiyor.",
      "Kazı ekibinin ilk değerlendirmelerine göre, açığa çıkarılan bölüm kentin kamusal alanlarından birine ait olabilir. Yapıdaki düzen ve kullanılan malzeme, dönemin yerleşim anlayışına dair ipuçları sunuyor.",
      "Buluntuların ayrıntılı tarihlendirmesi ve niteliğinin belirlenmesi için laboratuvar analizlerinin süreceği; çalışmaların sonuçlarının akademik yayınlarla paylaşılacağı bildirildi.",
    ],
  },
  {
    id: "olimpiyat-hazirlik",
    category: "Spor",
    kicker: "Olimpiyatlar",
    title: "Olimpiyat Hazırlıkları Hız Kazandı; Sürdürülebilirlik Öne Çıkıyor",
    dek: "Organizasyon komitesi, tesislerin büyük bölümünün mevcut altyapıdan uyarlanacağını açıkladı.",
    author: "Çeviri: Singularity AI Bot",
    rewritten: false,
    desk: "Paris",
    date: "23 Haziran 2026",
    readTime: "5 dk okuma",
    image:
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Komite, yeni inşaat yerine mevcut tesislerin yeniden işlevlendirilmesine öncelik verildiğini açıkladı.",
    imageCredit: "Fotoğraf: AP",
    source: { name: "AP", url: "https://apnews.com" },
    body: [
      "Olimpiyat oyunlarına yönelik hazırlıklar hız kazanırken, organizasyon komitesi bu kez merkeze sürdürülebilirliği koyduğunu açıkladı. Komiteye göre tesislerin büyük bölümü sıfırdan inşa edilmeyecek; mevcut altyapı yeniden işlevlendirilecek.",
      "Yaklaşımın temel gerekçesi olarak maliyetlerin kontrol altında tutulması ve oyunların uzun vadeli çevresel etkisinin azaltılması gösteriliyor. Geçici yapılar ve yenilenebilir enerji kullanımının kapsamının genişletilmesi planlanıyor.",
      "Ulaşım ve güvenlik planlaması ise hazırlıkların en kritik başlıkları arasında. Komite, kentteki günlük yaşamı en az düzeyde aksatacak bir lojistik modeli üzerinde çalışıldığını belirtti.",
      "Sporcu kotaları ve eleme takvimine ilişkin ayrıntıların önümüzdeki haftalarda netleşmesi bekleniyor.",
    ],
  },
  {
    id: "mufredat-guncelleme",
    category: "Gündem",
    kicker: "Eğitim",
    title: "Okullarda Yeni Müfredat: Değişiklikler ve Uygulama Takvimi Belli Oldu",
    dek: "Güncellenen programın kademeli olarak devreye alınacağı, önceliğin temel becerilere verileceği bildirildi.",
    originalTitle:
      "Velileri ÇILDIRTAN müfredat değişikliği! O dersler kalkıyor mu? İşte şok eden detaylar...",
    author: "Yeniden Yazım: Singularity AI Bot",
    rewritten: true,
    desk: "Ankara",
    date: "22 Haziran 2026",
    readTime: "4 dk okuma",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Yeni program, sınıf seviyelerine göre kademeli olarak uygulamaya alınacak.",
    imageCredit: "Fotoğraf: Sözcü",
    source: { name: "Sözcü", url: "https://www.sozcu.com.tr" },
    body: [
      "Okullarda uygulanacak güncellenmiş müfredatın içeriği ve uygulama takvimi açıklandı. Yapılan değişikliklerde önceliğin temel okuryazarlık, matematik ve dijital beceriler gibi alanlara verildiği belirtiliyor.",
      "Yetkililer, yeni programın tüm sınıf düzeylerinde aynı anda değil, kademeli olarak devreye alınacağını duyurdu. Bu yaklaşımın amacı, öğretmenlerin uyum süreci için yeterli zamana sahip olması olarak açıklandı.",
      "Eğitimciler, değişikliklerin başarısının ders kitapları, öğretmen eğitimi ve ölçme-değerlendirme araçlarının uyumuna bağlı olduğunu vurguluyor.",
      "Uygulamanın ilk aşamasının önümüzdeki öğretim yılında başlayacağı bildirildi.",
    ],
  },
];

/* --------------------------- YARDIMCILAR ---------------------------------- */

function todayLong() {
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

function safeParseBody(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
}

/* API ister zengin şemamızı, ister ham şemayı (image_url, read_time_minutes,
   source_url …) döndürsün — ikisini de tek biçime indirger. */
function normalizeArticle(a) {
  return {
    id: a.id != null ? String(a.id) : a.source_url || a.title,
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

/* Canlı API'den (varsa) tercihlere göre haberleri çeker. */
async function fetchArticles(prefs) {
  const params = new URLSearchParams();
  if (
    prefs?.categories?.length &&
    prefs.categories.length < ALL_CATEGORIES.length
  ) {
    params.set("categories", prefs.categories.join(","));
  }
  if (prefs?.sources?.length && prefs.sources.length < ALL_SOURCES.length) {
    params.set("sources", prefs.sources.join(","));
  }
  const qs = params.toString();
  const res = await fetch(qs ? `${API_URL}?${qs}` : API_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json?.data ?? [];
  return list.map(normalizeArticle);
}

/* Tercihler + aktif kategori filtresine göre görünürlük. Bilinmeyen
   (canlı veriden gelen) kategori/kaynak filtrelenmez, daima gösterilir. */
function isVisible(a, prefs, activeCategory) {
  const knownCat = ALL_CATEGORIES.includes(a.category);
  const catOK = activeCategory
    ? a.category === activeCategory
    : !knownCat || prefs.categories.includes(a.category);
  const knownSrc = ALL_SOURCES.includes(a.source?.name);
  const srcOK = !knownSrc || prefs.sources.includes(a.source.name);
  return catOK && srcOK;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        categories: Array.isArray(p.categories)
          ? p.categories
          : DEFAULT_PREFS.categories,
        sources: Array.isArray(p.sources) ? p.sources : DEFAULT_PREFS.sources,
      };
    }
  } catch {
    /* yoksay */
  }
  return DEFAULT_PREFS;
}

function loadTheme() {
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

const onImgError = (e) => {
  if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
};

/* ------------------------------ META --------------------------------------- */

function Kicker({ children, className = "" }) {
  return (
    <div
      className={
        "font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400 " +
        className
      }
    >
      {children}
    </div>
  );
}

function Byline({ article, className = "" }) {
  const Icon = article.rewritten ? SlidersHorizontal : Bot;
  return (
    <div
      className={
        "font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 " +
        className
      }
    >
      <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
        <Icon size={12} strokeWidth={2} />
        {article.author}
      </span>
    </div>
  );
}

/* ------------------------------ HEADER ------------------------------------- */

function Masthead({
  goHome,
  live = false,
  isRefreshing = false,
  onRefresh,
  theme,
  onToggleTheme,
  onOpenPrefs,
}) {
  const date = todayLong();
  return (
    <header className="w-full">
      {/* Üst hizmet çubuğu */}
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="flex items-center justify-between border-b border-neutral-300 py-1.5 font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <div className="hidden items-center gap-4 sm:flex">
            <span>{date}</span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <span>Bugünün Gazetesi</span>
          </div>
          <button
            onClick={goHome}
            className="flex items-center gap-1.5 transition hover:text-black dark:hover:text-white sm:hidden"
            aria-label="Ana sayfa"
          >
            <Menu size={14} /> Singularity
          </button>

          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className={
                "hidden items-center gap-1.5 sm:inline-flex " +
                (live
                  ? "text-green-700 dark:text-green-500"
                  : "text-neutral-500 dark:text-neutral-400")
              }
              title={
                live
                  ? "Backend API'sine bağlı (canlı çeviri)"
                  : "Yerleşik demo içeriği"
              }
            >
              <span
                className={
                  "inline-block h-1.5 w-1.5 rounded-full " +
                  (live ? "bg-green-600" : "bg-neutral-400")
                }
              />
              {live ? "Canlı" : "Demo"}
            </span>

            {live && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Botları yeni haber taraması için sahaya sür"
                className={
                  "hidden items-center gap-1.5 font-semibold sm:inline-flex " +
                  (isRefreshing
                    ? "cursor-wait text-blue-600 dark:text-blue-400"
                    : "transition hover:text-black dark:hover:text-white")
                }
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                {isRefreshing ? "Baskı Hazırlanıyor…" : "Yeni Baskı"}
              </button>
            )}

            <button
              onClick={onOpenPrefs}
              className="inline-flex items-center gap-1.5 font-semibold transition hover:text-black dark:hover:text-white"
              title="Akışımı özelleştir"
            >
              <Settings size={13} />
              <span className="hidden md:inline">Akışımı Özelleştir</span>
            </button>

            <button
              onClick={onToggleTheme}
              aria-label="Açık / koyu tema"
              title="Açık / koyu tema"
              className="inline-flex items-center transition hover:text-black dark:hover:text-white"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Logo bloğu */}
      <div className="mx-auto max-w-[1280px] px-4 pt-3 pb-2 text-center">
        <div className="flex items-end justify-between gap-4">
          <div className="hidden w-44 text-left font-sans text-[10px] uppercase leading-tight tracking-[0.1em] text-neutral-500 dark:text-neutral-400 lg:block">
            <p className="font-bold text-neutral-700 dark:text-neutral-300">
              VOL. MMXXVI · No. 1
            </p>
            <p className="mt-1">
              Dünyanın haberleri — gazetecilik diliyle, tık tuzağından arınmış.
            </p>
          </div>

          <button
            onClick={goHome}
            className="group mx-auto block flex-1 select-none"
            aria-label="Singularity ana sayfa"
          >
            <h1
              className="font-blackletter text-6xl leading-none text-black transition-opacity group-hover:opacity-80 dark:text-white sm:text-7xl md:text-8xl"
              style={{ letterSpacing: "0.01em" }}
            >
              Singularity
            </h1>
          </button>

          <div className="hidden w-44 text-right font-sans text-[10px] uppercase leading-tight tracking-[0.1em] text-neutral-500 dark:text-neutral-400 lg:block">
            <p className="font-bold text-neutral-700 dark:text-neutral-300">
              Küresel Edisyon
            </p>
            <p className="mt-1">Otomatik tarama · Yapay zeka editörü</p>
          </div>
        </div>

        <p className="rule-star mx-auto mt-3 inline-block font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
          Kişiselleştirilebilir Küresel Haber Ajansı
        </p>
      </div>
    </header>
  );
}

/* Logonun hemen altındaki dinamik kategori barı */
function CategoryBar({ categories, active, onSelect }) {
  const items = ["Tümü", ...categories];
  return (
    <nav className="border-y-[3px] border-double border-black dark:border-neutral-500">
      <div className="mx-auto max-w-[1280px] px-4">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-2 font-sans text-[12px] font-semibold uppercase tracking-[0.1em] text-neutral-700 dark:text-neutral-300">
          {items.map((c) => {
            const isActive = (c === "Tümü" && !active) || c === active;
            return (
              <li key={c}>
                <button
                  onClick={() => onSelect(c === "Tümü" ? null : c)}
                  className={
                    isActive
                      ? "text-black underline decoration-2 underline-offset-4 dark:text-white"
                      : "transition hover:text-black dark:hover:text-white"
                  }
                >
                  {c}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/* ----------------------- TERCİH ÇEKMECESİ (DRAWER) ------------------------ */

function CheckRow({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between border-b border-neutral-200 py-2.5 dark:border-neutral-800">
      <span className="font-serif text-[15px] text-neutral-900 dark:text-gray-200">
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-black dark:accent-white"
      />
    </label>
  );
}

function PreferencesDrawer({
  open,
  onClose,
  prefs,
  onToggle,
  onSelectAll,
  onClear,
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
        aria-hidden="true"
      />
      <aside
        className={
          "fixed right-0 top-0 z-50 flex h-full w-[88%] max-w-sm flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 dark:border-neutral-800 dark:bg-neutral-900 " +
          (open ? "translate-x-0" : "translate-x-full")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Akışımı özelleştir"
      >
        <header className="flex items-start justify-between border-b border-neutral-300 px-5 py-4 dark:border-neutral-700">
          <div>
            <Kicker>Tercihler</Kicker>
            <h2 className="mt-1 font-display text-2xl font-bold text-black dark:text-white">
              Akışımı Özelleştir
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="mb-6">
            <p className="rule-star mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black dark:text-white">
              Kategoriler
            </p>
            {ALL_CATEGORIES.map((c) => (
              <CheckRow
                key={c}
                label={c}
                checked={prefs.categories.includes(c)}
                onChange={() => onToggle("categories", c)}
              />
            ))}
          </section>

          <section>
            <p className="rule-star mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black dark:text-white">
              Kaynaklar
            </p>
            {Object.entries(SOURCE_GROUPS).map(([group, list]) => (
              <div key={group} className="mb-3">
                <p className="mt-2 mb-1 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                  {group}
                </p>
                {list.map((s) => (
                  <CheckRow
                    key={s}
                    label={s}
                    checked={prefs.sources.includes(s)}
                    onChange={() => onToggle("sources", s)}
                  />
                ))}
              </div>
            ))}
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-neutral-300 px-5 py-4 dark:border-neutral-700">
          <button
            onClick={onSelectAll}
            className="flex-1 border border-neutral-300 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-700 transition hover:border-black hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
          >
            Tümünü Seç
          </button>
          <button
            onClick={onClear}
            className="flex-1 border border-neutral-300 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-700 transition hover:border-black hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
          >
            Temizle
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-black bg-black py-2 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Bitti
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ----------------------- ANA SAYFA: KART TÜRLERİ -------------------------- */

function LeadStory({ article, onOpen }) {
  return (
    <article className="flex flex-col">
      <Kicker className="mb-2">{article.kicker}</Kicker>
      <button onClick={() => onOpen(article.id)} className="group text-left">
        <h2 className="font-display text-[2.6rem] font-extrabold leading-[1.04] tracking-tight text-black transition group-hover:text-neutral-700 dark:text-white dark:group-hover:text-neutral-300 sm:text-5xl">
          {article.title}
        </h2>
      </button>
      <p className="mt-3 font-display text-lg italic leading-snug text-neutral-700 dark:text-neutral-300">
        {article.dek}
      </p>

      <button
        onClick={() => onOpen(article.id)}
        className="img-zoom mt-4 block w-full"
      >
        <img
          src={article.image}
          alt={article.title}
          onError={onImgError}
          className="aspect-[16/9] w-full object-cover"
          loading="lazy"
        />
      </button>
      <p className="mt-2 font-sans text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
        {article.imageCaption}{" "}
        <span className="text-neutral-400 dark:text-neutral-500">
          {article.imageCredit}
        </span>
      </p>

      <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <p className="font-serif text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-300">
          {article.body[0]}
        </p>
        <button
          onClick={() => onOpen(article.id)}
          className="mt-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-black underline decoration-2 underline-offset-4 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
        >
          Devamını Oku →
        </button>
      </div>
    </article>
  );
}

function ColumnStory({ article, onOpen, withImage = false }) {
  return (
    <article className="flex flex-col">
      <Kicker className="mb-1.5">{article.category}</Kicker>
      <button onClick={() => onOpen(article.id)} className="group text-left">
        <h3 className="font-display text-[1.35rem] font-bold leading-[1.12] text-black transition group-hover:text-neutral-700 dark:text-white dark:group-hover:text-neutral-300">
          {article.title}
        </h3>
      </button>
      {withImage && (
        <button
          onClick={() => onOpen(article.id)}
          className="img-zoom mt-3 block w-full"
        >
          <img
            src={article.image}
            alt={article.title}
            onError={onImgError}
            className="aspect-[3/2] w-full object-cover"
            loading="lazy"
          />
        </button>
      )}
      <p className="mt-2 font-serif text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-400">
        {article.dek}
      </p>
      <Byline article={article} className="mt-2" />
    </article>
  );
}

function GridCard({ article, onOpen }) {
  return (
    <article className="flex flex-col">
      <button
        onClick={() => onOpen(article.id)}
        className="img-zoom mb-3 block w-full"
      >
        <img
          src={article.image}
          alt={article.title}
          onError={onImgError}
          className="aspect-[3/2] w-full object-cover"
          loading="lazy"
        />
      </button>
      <Kicker className="mb-1.5">{article.category}</Kicker>
      <button onClick={() => onOpen(article.id)} className="group text-left">
        <h3 className="font-display text-[1.25rem] font-bold leading-[1.14] text-black transition group-hover:text-neutral-700 dark:text-white dark:group-hover:text-neutral-300">
          {article.title}
        </h3>
      </button>
      <p className="mt-2 font-serif text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-400">
        {article.dek}
      </p>
      <Byline article={article} className="mt-2" />
    </article>
  );
}

function EditorsPick({ articles, onOpen }) {
  return (
    <div className="border border-black bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/60">
      <p className="rule-star mb-3 text-center font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black dark:text-white">
        Editörün Seçimi
      </p>
      <ol className="divide-y divide-neutral-300 dark:divide-neutral-700">
        {articles.map((a, i) => (
          <li key={a.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="font-display text-2xl font-bold leading-none text-neutral-300 dark:text-neutral-600">
              {i + 1}
            </span>
            <button onClick={() => onOpen(a.id)} className="group text-left">
              <h4 className="font-display text-[15px] font-bold leading-snug text-black transition group-hover:text-neutral-600 dark:text-white dark:group-hover:text-neutral-300">
                {a.title}
              </h4>
              <span className="mt-1 inline-flex items-center gap-1 font-sans text-[10px] uppercase tracking-[0.1em] text-neutral-500 dark:text-neutral-400">
                <Clock size={10} /> {a.readTime}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------ ANA SAYFA ---------------------------------- */

function EmptyState({ onOpenPrefs }) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <p className="font-display text-2xl font-bold text-black dark:text-white">
        Seçili tercihlere uygun haber yok
      </p>
      <p className="mt-3 font-serif text-neutral-600 dark:text-neutral-400">
        Daha fazla kategori veya kaynak seçerek akışınızı genişletebilirsiniz.
      </p>
      <button
        onClick={onOpenPrefs}
        className="mt-6 inline-flex items-center gap-2 border border-black px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-black transition hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
      >
        <Settings size={14} /> Akışımı Özelleştir
      </button>
    </div>
  );
}

function HomePage({ articles, onOpen, onOpenPrefs }) {
  if (!articles.length) return <EmptyState onOpenPrefs={onOpenPrefs} />;

  const lead = articles.find((a) => a.lead) || articles[0];
  const rest = articles.filter((a) => a.id !== lead.id);
  const leftCol = rest.slice(0, 2);
  const rightCol = rest.slice(2, 3);
  const bottomRow = rest.slice(3, 7);

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-16">
      <section className="grid grid-cols-1 gap-y-8 py-6 lg:grid-cols-12 lg:gap-y-0">
        {/* SOL SÜTUN */}
        <div className="space-y-6 lg:col-span-3 lg:border-r lg:border-neutral-300 lg:pr-6 lg:dark:border-neutral-800">
          {leftCol.map((a, i) => (
            <div
              key={a.id}
              className={
                i > 0
                  ? "border-t border-neutral-200 pt-6 dark:border-neutral-800"
                  : undefined
              }
            >
              <ColumnStory article={a} onOpen={onOpen} />
            </div>
          ))}
          {leftCol.length > 0 && (
            <div className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <Kicker className="mb-2">Piyasa Notu</Kicker>
              <p className="font-serif text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-400">
                Enflasyon ve faiz beklentileri arasındaki denge, küresel
                piyasalarda dalgalanmayı sürdürüyor. Yatırımcılar merkez
                bankalarının yön sinyalini bekliyor.
              </p>
            </div>
          )}
        </div>

        {/* ORTA SÜTUN — DEV MANŞET */}
        <div className="lg:col-span-6 lg:px-6">
          <LeadStory article={lead} onOpen={onOpen} />
        </div>

        {/* SAĞ SÜTUN */}
        <div className="space-y-6 lg:col-span-3 lg:border-l lg:border-neutral-300 lg:pl-6 lg:dark:border-neutral-800">
          {rightCol.map((a) => (
            <ColumnStory key={a.id} article={a} onOpen={onOpen} withImage />
          ))}
          <EditorsPick articles={articles.slice(0, 4)} onOpen={onOpen} />
        </div>
      </section>

      {bottomRow.length > 0 && (
        <section className="border-t-[3px] border-double border-black pt-6 dark:border-neutral-500">
          <p className="rule-star mb-6 text-center font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-black dark:text-white">
            Gündemdeki Diğer Gelişmeler
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-neutral-300 lg:dark:divide-neutral-800">
            {bottomRow.map((a) => (
              <div key={a.id} className="lg:px-5 lg:first:pl-0 lg:last:pr-0">
                <GridCard article={a} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/* ----------------------------- MAKALE GÖRÜNÜMÜ ----------------------------- */

function ArticleView({ article, articles, onOpen, goHome }) {
  const related = articles.filter((a) => a.id !== article.id).slice(0, 3);

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20">
      <div className="flex items-center justify-between border-b border-neutral-200 py-3 font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 font-semibold text-black transition hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
        >
          <ArrowLeft size={14} /> Ana Sayfa
        </button>
        <span>{article.category}</span>
      </div>

      <article className="mx-auto max-w-[720px] pt-8">
        <Kicker className="text-center">{article.kicker}</Kicker>

        {/* Clickbait katili: orijinal tık tuzağı başlığı üstü çizili gösterilir */}
        {article.rewritten && article.originalTitle && (
          <div className="mt-3 flex flex-col items-center gap-1 text-center">
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
              ✂ Tık Tuzağı Önlendi
            </span>
            <span
              className="max-w-xl font-serif text-sm italic text-neutral-500 line-through decoration-red-500/50 dark:text-neutral-400"
              title={article.originalTitle}
            >
              “{article.originalTitle}”
            </span>
          </div>
        )}

        <h1 className="mt-3 text-center font-display text-[2.4rem] font-extrabold leading-[1.06] tracking-tight text-black dark:text-white sm:text-[3rem]">
          {article.title}
        </h1>
        <p className="mt-4 text-center font-display text-xl italic leading-snug text-neutral-700 dark:text-neutral-300">
          {article.dek}
        </p>

        <div className="mt-6 flex flex-col items-center gap-2 border-y border-neutral-300 py-3 font-sans text-[12px] uppercase tracking-[0.1em] text-neutral-600 dark:border-neutral-700 dark:text-neutral-400 sm:flex-row sm:justify-center sm:gap-4">
          <span className="inline-flex items-center gap-1.5 font-bold text-black dark:text-white">
            {article.rewritten ? <SlidersHorizontal size={13} /> : <Bot size={13} />}
            {article.author}
          </span>
          <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">
            |
          </span>
          <span>{article.date}</span>
          <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">
            |
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={12} /> {article.readTime}
          </span>
        </div>

        <div className="mt-4 flex justify-center">
          <a
            href={article.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 border border-black bg-white px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:bg-black hover:text-white dark:border-neutral-500 dark:bg-transparent dark:text-white dark:hover:bg-white dark:hover:text-black"
          >
            <ExternalLink size={13} />
            Haberi Kaynağında Oku — {article.source.name}
          </a>
        </div>
      </article>

      <figure className="mx-auto mt-8 max-w-[900px]">
        <img
          src={article.image}
          alt={article.title}
          onError={onImgError}
          className="w-full object-cover"
          loading="lazy"
        />
        <figcaption className="mt-2 border-l-2 border-neutral-300 pl-3 font-sans text-[12px] leading-snug text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          {article.imageCaption}{" "}
          <span className="text-neutral-400 dark:text-neutral-500">
            {article.imageCredit}
          </span>
        </figcaption>
      </figure>

      <div className="mx-auto mt-10 max-w-[680px]">
        {article.body.map((para, i) => (
          <p
            key={i}
            className={
              "font-display text-[1.22rem] leading-[1.7] text-neutral-900 dark:text-gray-200 " +
              (i === 0 ? "drop-cap" : "mt-6")
            }
          >
            {para}
          </p>
        ))}

        <div className="mt-10 border-y border-neutral-300 bg-neutral-50 px-5 py-4 dark:border-neutral-700 dark:bg-neutral-800/60">
          <p className="flex items-start gap-2 font-sans text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {article.rewritten ? (
              <SlidersHorizontal size={15} className="mt-0.5 shrink-0" />
            ) : (
              <Languages size={15} className="mt-0.5 shrink-0" />
            )}
            <span>
              {article.rewritten ? (
                <>
                  Bu metin, <strong>{article.source.name}</strong> kaynağındaki
                  haberin tık tuzağı (clickbait) ve duygu sömürüsünden
                  arındırılarak, en önemli bilgi başa alınacak biçimde (Ters
                  Piramit) yeniden yazılmış hâlidir.
                </>
              ) : (
                <>
                  Bu metin, <strong>{article.source.name}</strong> kaynağındaki
                  orijinal haberin Singularity yapay zeka motoru tarafından,
                  teknik terimler korunarak yapılan bağlam temelli çevirisidir.
                </>
              )}{" "}
              Doğruluk için lütfen{" "}
              <a
                href={article.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-black underline underline-offset-2 dark:text-white"
              >
                orijinal kaynağa
              </a>{" "}
              başvurun.
            </span>
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href={article.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-black underline decoration-2 underline-offset-4 hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
          >
            <ExternalLink size={14} />
            {article.source.name} sitesinde tüm haberi görüntüle
          </a>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-[1100px] border-t-[3px] border-double border-black pt-6 dark:border-neutral-500">
          <p className="rule-star mb-6 text-center font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-black dark:text-white">
            İlgili Haberler
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x sm:divide-neutral-300 sm:dark:divide-neutral-800">
            {related.map((a) => (
              <div key={a.id} className="sm:px-5 sm:first:pl-0 sm:last:pr-0">
                <GridCard article={a} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/* ------------------------------- FOOTER ----------------------------------- */

function Footer({ goHome }) {
  return (
    <footer className="border-t-[3px] border-double border-black dark:border-neutral-500">
      <div className="mx-auto max-w-[1280px] px-4 py-10 text-center">
        <button onClick={goHome} aria-label="Singularity ana sayfa">
          <h2 className="font-blackletter text-4xl text-black dark:text-white">
            Singularity
          </h2>
        </button>
        <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
          Kişiselleştirilebilir Küresel Haber Ajansı · Anti-Clickbait Editör
        </p>
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 font-sans text-[12px] text-neutral-600 dark:text-neutral-400">
          {ALL_CATEGORIES.map((s) => (
            <span key={s} className="hover:text-black dark:hover:text-white">
              {s}
            </span>
          ))}
        </div>
        <p className="mt-8 font-sans text-[11px] text-neutral-400 dark:text-neutral-500">
          © {new Date().getFullYear()} Singularity. Tüm haberler ilgili
          kaynaklarına aittir; bu platform yalnızca yapay zeka destekli çeviri,
          derleme ve düzenleme sunar.
        </p>
      </div>
    </footer>
  );
}

/* ----------------------------- YÜKLEME EKRANI ----------------------------- */

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white text-center dark:bg-neutral-900">
      <h1 className="font-blackletter text-5xl text-black dark:text-white">
        Singularity
      </h1>
      <p className="mt-4 inline-flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
        <Loader2 size={14} className="animate-spin" />
        Editoryal Masa Derleniyor…
      </p>
    </div>
  );
}

/* -------------------------------- APP ------------------------------------- */

export default function App() {
  const [view, setView] = useState("home");
  const [activeId, setActiveId] = useState(null);
  const [articles, setArticles] = useState(() =>
    MOCK_ARTICLES.map(normalizeArticle)
  );
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState("");

  const [theme, setTheme] = useState(loadTheme);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [activeCategory, setActiveCategory] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refreshJobRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const liveFetchDidMount = useRef(false);

  // Tema: <html>'e uygula ve kalıcı kıl.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* yoksay */
    }
  }, [theme]);

  // Tercihleri kalıcı kıl.
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* yoksay */
    }
  }, [prefs]);

  // Açılışta canlı API'yi dene; başarısızsa yerleşik demo içerikle devam et.
  useEffect(() => {
    let cancelled = false;
    fetchArticles(prefsRef.current)
      .then((list) => {
        if (!cancelled && list.length) {
          setArticles(list);
          setLive(true);
        }
      })
      .catch(() => {
        /* Backend yoksa demo içeriğe düşülür. */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Görünüm değiştiğinde sayfayı başa sar.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, activeId]);

  // Canlı modda tercihler değişince sunucudan filtrelenmiş veriyi yeniden çek.
  // (Demo modunda istemci-tarafı filtre yeterli; gereksiz istek atılmaz.)
  useEffect(() => {
    if (!live) return;
    if (!liveFetchDidMount.current) {
      // İlk canlıya geçiş zaten açılış fetch'iyle yapıldı; tekrarlama.
      liveFetchDidMount.current = true;
      return;
    }
    let cancelled = false;
    fetchArticles(prefs)
      .then((list) => {
        if (!cancelled) setArticles(list);
      })
      .catch(() => {
        /* yoksay — mevcut liste korunur */
      });
    return () => {
      cancelled = true;
    };
    // prefs derin karşılaştırması için stringify (gereksiz render tetiklemesini önler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, JSON.stringify(prefs)]);

  // "Yeni Baskı": hattı tetikler, /api/status'u yoklayarak gerçek bitişi bekler.
  const handleRefresh = async () => {
    if (isRefreshing || !live) return;
    setIsRefreshing(true);
    setToast("Editoryal masa taramaya başladı…");

    const finish = (msg, ms = 5000) => {
      refreshJobRef.current = null;
      setIsRefreshing(false);
      setToast(msg);
      setTimeout(() => setToast(""), ms);
    };

    try {
      const res = await fetch(REFRESH_URL, { method: "POST" });
      if (!res.ok) throw new Error("API hatası");
      const data = await res.json();
      if (!data.job_id) throw new Error("job_id alınamadı");

      refreshJobRef.current = data.job_id;
      setToast(data.message || "Muhabir botlar sahaya sürüldü…");

      const startedAt = Date.now();
      const TIMEOUT_MS = 180000;

      const poll = async () => {
        if (refreshJobRef.current !== data.job_id) return;
        if (Date.now() - startedAt > TIMEOUT_MS) {
          finish("Tarama zaman aşımına uğradı. Arka planda sürüyor olabilir.");
          return;
        }
        try {
          const sres = await fetch(`${STATUS_URL}/${data.job_id}`);
          const sdata = await sres.json();
          if (sdata.status === "completed") {
            try {
              const list = await fetchArticles(prefsRef.current);
              if (list.length) setArticles(list);
            } catch {
              /* yoksay */
            }
            finish("Yeni baskı hazır! Haberler güncellendi.");
          } else if (
            sdata.status === "not_found" ||
            (typeof sdata.status === "string" && sdata.status.startsWith("failed"))
          ) {
            finish("Haber derleme sırasında bir hata oluştu.");
          } else {
            setTimeout(poll, 3000);
          }
        } catch {
          setTimeout(poll, 5000);
        }
      };
      setTimeout(poll, 3000);
    } catch {
      finish("Haber merkezi ile bağlantı kurulamadı.", 3000);
    }
  };

  const openArticle = (id) => {
    setActiveId(id);
    setView("article");
  };
  const goHome = () => {
    setView("home");
    setActiveId(null);
  };
  const toggleTheme = () =>
    setTheme((t) => (t === "dark" ? "light" : "dark"));

  const togglePref = (key, value) =>
    setPrefs((p) => {
      const set = new Set(p[key]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      const canonical = key === "categories" ? ALL_CATEGORIES : ALL_SOURCES;
      return { ...p, [key]: canonical.filter((x) => set.has(x)) };
    });
  const selectAllPrefs = () =>
    setPrefs({ categories: [...ALL_CATEGORIES], sources: [...ALL_SOURCES] });
  const clearPrefs = () => setPrefs({ categories: [], sources: [] });

  const active = activeId ? articles.find((a) => a.id === activeId) : null;
  const visible = articles.filter((a) => isVisible(a, prefs, activeCategory));

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white text-[#121212] dark:bg-neutral-900 dark:text-gray-200">
      <Masthead
        goHome={goHome}
        live={live}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenPrefs={() => setDrawerOpen(true)}
      />
      <CategoryBar
        categories={prefs.categories}
        active={activeCategory}
        onSelect={setActiveCategory}
      />

      {view === "article" && active ? (
        <ArticleView
          article={active}
          articles={articles}
          onOpen={openArticle}
          goHome={goHome}
        />
      ) : (
        <HomePage
          articles={visible}
          onOpen={openArticle}
          onOpenPrefs={() => setDrawerOpen(true)}
        />
      )}

      <Footer goHome={goHome} />

      <PreferencesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        prefs={prefs}
        onToggle={togglePref}
        onSelectAll={selectAllPrefs}
        onClear={clearPrefs}
      />

      {toast && (
        <div className="toast-in fixed bottom-6 right-6 z-[60] max-w-sm bg-black px-6 py-3 font-sans text-sm tracking-wide text-white shadow-2xl dark:bg-white dark:text-black">
          {toast}
        </div>
      )}
    </div>
  );
}
