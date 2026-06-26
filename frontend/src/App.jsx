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
  User,
  LogOut,
  TrendingUp,
  TrendingDown,
  Feather,
  ChevronRight,
  Sparkles,
} from "lucide-react";

/* ============================================================================
   SINGULARITY V2 — Kişiselleştirilebilir Küresel Haber Ajansı
   ----------------------------------------------------------------------------
   The New York Times'ın klasik editoryal tasarım dilini taklit eden, karanlık
   mod, kişiselleştirme, kullanıcı hesapları (JWT), köşe yazarları (Opinion) ve
   canlı bilgi şeridi (Live Ticker) destekli tek dosyalık React uygulaması.
   Backend yoksa yerleşik demo içerikle çalışır.
   ========================================================================== */

/* ----------------------------- SABİTLER ----------------------------------- */

const ALL_CATEGORIES = [
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

const SOURCE_GROUPS = {
  Türkiye: ["NTV", "Hürriyet", "Sözcü", "BBC Türkçe"],
  Küresel: ["Reuters", "AP", "Bloomberg", "The Guardian", "BBC"],
};
const ALL_SOURCES = [...SOURCE_GROUPS.Türkiye, ...SOURCE_GROUPS.Küresel];

const DEFAULT_PREFS = { categories: ALL_CATEGORIES, sources: ALL_SOURCES };

const FOR_YOU = "Bana Özel"; // Giriş yapmış kullanıcıya özel akış etiketi.

const THEME_KEY = "singularity:theme";
const PREFS_KEY = "singularity:prefs";
const TOKEN_KEY = "singularity:token";

// Production'da Vercel/Render'da VITE_API_URL ile ezilir; yoksa yerel backend.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_URL = `${API_BASE}/api/articles`;
const REFRESH_URL = `${API_BASE}/api/refresh`;
const STATUS_URL = `${API_BASE}/api/status`;
const AUTH_URL = `${API_BASE}/api/auth`;
const COLUMNISTS_URL = `${API_BASE}/api/columnists`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80";

/* ----------------------------- MOCK VERİ ---------------------------------- */
/* Backend'deki çeviri/yeniden-yazım hattının üreteceği JSON'un simülasyonu. */

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
    category: "Türkiye",
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
    category: "Kültür Sanat",
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
    id: "borsa-sirket",
    category: "İş",
    kicker: "Şirketler",
    title: "Teknoloji Şirketlerinden Yeni Yatırım Dalgası: İstihdam Hedefleri Büyüyor",
    dek: "Sektör temsilcileri, nitelikli iş gücü ihtiyacının önümüzdeki dönemde belirleyici olacağını söylüyor.",
    author: "Çeviri: Singularity AI Bot",
    rewritten: false,
    desk: "İstanbul",
    date: "22 Haziran 2026",
    readTime: "5 dk okuma",
    image:
      "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Şirketler, büyüme planlarında yapay zeka ve veri yetkinliklerini merkeze alıyor.",
    imageCredit: "Fotoğraf: The Guardian",
    source: { name: "The Guardian", url: "https://www.theguardian.com" },
    body: [
      "Teknoloji sektöründeki şirketler, yeni bir yatırım ve istihdam dalgasının eşiğinde olduklarını açıkladı. Büyüme planlarının merkezinde, yapay zeka ve veri analitiği alanlarındaki nitelikli iş gücü ihtiyacı yer alıyor.",
      "Sektör temsilcileri, yatırımların yalnızca yeni ürünlere değil; aynı zamanda mevcut çalışanların yeniden becerilendirilmesine (reskilling) ayrılacağını vurguluyor.",
      "İnsan kaynakları uzmanları, önümüzdeki dönemde rekabetin ürün kadar yetenek üzerinden de yaşanacağını; şirketlerin esnek çalışma modelleriyle nitelikli profilleri çekmeye çalışacağını belirtiyor.",
    ],
  },
  {
    id: "roman-odul",
    category: "Edebiyat",
    kicker: "Ödüller",
    title: "Yılın Roman Ödülü Sahibini Buldu: Jüriden 'Sessiz Ama Sarsıcı' Değerlendirmesi",
    dek: "Ödüllü eser, hafıza ve aidiyet temalarını ince bir dille işlediği gerekçesiyle öne çıktı.",
    author: "Çeviri: Singularity AI Bot",
    rewritten: false,
    desk: "Londra",
    date: "22 Haziran 2026",
    readTime: "4 dk okuma",
    image:
      "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Jüri, eserin gösterişten uzak ama derin bir anlatı kurduğunu belirtti.",
    imageCredit: "Fotoğraf: The Guardian",
    source: { name: "The Guardian", url: "https://www.theguardian.com" },
    body: [
      "Yılın en prestijli roman ödüllerinden biri, hafıza ve aidiyet temalarını işleyen bir eserin oldu. Jüri, kitabın “sessiz ama sarsıcı” anlatımını ve dilindeki incelikli ekonomiyi öne çıkardı.",
      "Değerlendirmede, eserin büyük olaylardan çok gündelik ayrıntıların içinde derinleşen bir kurgu kurduğu vurgulandı. Ödülün, yazarın daha geniş bir okur kitlesine ulaşmasına katkı sağlaması bekleniyor.",
      "Edebiyat çevreleri, kararı çağdaş romanın yönüne dair bir işaret olarak yorumladı: Gösterişli değil, derinlikli anlatıya yöneliş.",
    ],
  },
  {
    id: "uyku-saglik",
    category: "Yaşam Tarzı",
    kicker: "Sağlıklı Yaşam",
    title: "Uzmanlardan Dijital Detoks Önerisi: Uyku Kalitesi Ekranla Düşüyor",
    dek: "Araştırmalar, yatmadan önceki ekran süresinin uyku düzenini bozduğuna dikkat çekiyor.",
    originalTitle:
      "Bunu yapan PİŞMAN OLMUYOR! Uzmanların gizlediği o sır ortaya çıktı, herkes şaşkın...",
    author: "Yeniden Yazım: Singularity AI Bot",
    rewritten: true,
    desk: "İstanbul",
    date: "21 Haziran 2026",
    readTime: "3 dk okuma",
    image:
      "https://images.unsplash.com/photo-1511295742362-92c96b1cf484?auto=format&fit=crop&w=1200&q=80",
    imageCaption:
      "Uzmanlar, yatmadan bir saat önce ekranları bırakmanın uyku kalitesini artırdığını belirtiyor.",
    imageCredit: "Fotoğraf: Hürriyet",
    source: { name: "Hürriyet", url: "https://www.hurriyet.com.tr" },
    body: [
      "Uyku sağlığı üzerine çalışan uzmanlar, yatmadan önceki ekran kullanımının uyku kalitesini olumsuz etkilediğine dikkat çekiyor. Mavi ışığa maruz kalmanın, vücudun doğal uyku ritmini geciktirebildiği belirtiliyor.",
      "Uzmanlar, akşam saatlerinde ekran süresini azaltmayı, yatmadan önce kısa bir “dijital detoks” uygulamayı ve uyku ortamını karanlık tutmayı öneriyor.",
      "Küçük alışkanlık değişikliklerinin bile zamanla uyku düzenine olumlu yansıyabileceği vurgulanıyor.",
    ],
  },
];

/* Backend yoksa kullanılacak köşe yazarı demosu (DB seed'iyle birebir uyumlu). */
const MOCK_COLUMNISTS = [
  {
    id: 1,
    slug: "elif-deniz",
    name: "Elif Deniz",
    title: "Teknoloji & Toplum",
    bio: "Yapay zekânın gündelik hayatı nasıl yeniden kurduğunu yazıyor. Eski bir yazılım mühendisi; teknoloji ile etik arasındaki gerilim hattında dolaşıyor.",
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
    columns: [
      {
        id: "makineler-dusunmuyor",
        kicker: "Yapay Zekâ",
        title: "Makineler Düşünmüyor; Biz Onlara Anlam Yüklüyoruz",
        dek: "Büyük dil modellerini 'akıllı' sanmak, aynanın içindeki kendi yansımamıza hayran olmaktır.",
        readTime: "4 dk okuma",
        date: "25 Haziran 2026",
        image:
          "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
        body: [
          "Bir sistemin akıcı cümleler kurması, onu düşünen bir özne yapmaz. Yapay zekânın bugünkü hâli, devasa bir örüntü tahmin makinesidir; bizim ona yüklediğimiz anlamı bize geri yansıtır.",
          "Yine de bu yansımayı küçümsemek yanlış olur. İnsanların çoğu kararını da sezgi ve örüntü üzerinden verir. Asıl mesele, makinenin 'düşünüp düşünmediği' değil; onu hangi sorumlulukla kullandığımızdır.",
          "Teknolojiyi büyüleyici kılan, onun bize kendimizi gösteren bir ayna oluşudur. Tehlike de buradadır: Aynaya çok uzun bakan, dışarıdaki dünyayı unutur.",
          "Önümüzdeki on yılda asıl tartışma, modellerin ne kadar 'zeki' olduğu değil; toplumun bu araçlar üzerindeki denetimini nasıl koruyacağı olacak.",
        ],
      },
      {
        id: "veri-senin-golgen",
        kicker: "Mahremiyet",
        title: "Veri Senin Gölgen: Onu Kimseye Ödünç Verme",
        dek: "Ücretsiz olan her hizmetin bedelini, çoğu zaman farkında olmadan kendi mahremiyetimizle ödüyoruz.",
        readTime: "3 dk okuma",
        date: "23 Haziran 2026",
        image:
          "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=1200&q=80",
        body: [
          "Dijital hayatta hiçbir şey gerçekten ücretsiz değildir. Bedelini ödediğimiz para değilse, büyük olasılıkla bedeli kendi verimizdir.",
          "Veri, kişinin gölgesi gibidir: Nereye gittiğini, neye baktığını, neyden çekindiğini taşır. Bu gölgeyi pazarlayan bir ekonomi, mahremiyeti bir lükse çevirir.",
          "Çözüm, teknolojiden kaçmak değil; kullanıcının kendi verisi üzerinde söz sahibi olduğu bir mimariyi talep etmektir.",
        ],
      },
    ],
  },
  {
    id: 2,
    slug: "mert-kayhan",
    name: "Mert Kayhan",
    title: "Ekonomi & Piyasalar",
    bio: "Piyasaların gürültüsü altındaki sinyali arıyor. Makroekonomi, faiz ve küresel ticaret üzerine soğukkanlı analizler yazıyor.",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
    columns: [
      {
        id: "faiz-kararlarini-okumak",
        kicker: "Para Politikası",
        title: "Faiz Kararlarını Okumak: Sözcüklerin Ardındaki Niyet",
        dek: "Merkez bankalarının asıl mesajı genelde rakamlarda değil, cümlelerin tonundadır.",
        readTime: "5 dk okuma",
        date: "24 Haziran 2026",
        image:
          "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
        body: [
          "Piyasalar yalnızca faiz oranını değil, kararı anlatan metnin kelimelerini de fiyatlar. Bir 'temkinli' sözcüğü, çoğu zaman çeyrek puanlık bir adımdan daha güçlü sinyal taşır.",
          "Yatırımcının işi, bu dilin ardındaki niyeti ölçmektir. Enflasyon yavaşlasa bile bankalar erken gevşemekten kaçınır; çünkü güvenilirlik, bir kez kaybedildiğinde pahalıya geri alınır.",
          "Uzun vadede kazanan, manşete değil; eğilime bakandır.",
        ],
      },
    ],
  },
  {
    id: 3,
    slug: "selin-aydin",
    name: "Selin Aydın",
    title: "Kültür & Edebiyat",
    bio: "Kitapların, sahnelerin ve kentin kültürel nabzının peşinde. Edebiyatın gündelik hayata sızan o sessiz gücünü anlatıyor.",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
    columns: [
      {
        id: "yavas-okuma",
        kicker: "Edebiyat",
        title: "Yavaş Okumanın İncelikli Bir İsyan Oluşu",
        dek: "Her şeyin hızlandığı bir çağda bir romanı ağırdan almak, sessiz bir başkaldırıdır.",
        readTime: "3 dk okuma",
        date: "23 Haziran 2026",
        image:
          "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=80",
        body: [
          "Bildirimlerin sürekli böldüğü bir dikkat ekonomisinde, bir kitabı baştan sona, acele etmeden okumak neredeyse politik bir tavra dönüşüyor.",
          "Yavaş okumak, metnin değil okurun da derinleşmesidir. Cümlenin içinde oyalanmak, hızını kaybetmiş gibi görünse de aslında düşünceyi geri kazanmaktır.",
          "Edebiyat, bize zamanı yeniden nasıl sahipleneceğimizi öğretir. Belki de en radikal eylem, telefonu bırakıp bir sayfayı ikinci kez okumaktır.",
        ],
      },
    ],
  },
  {
    id: 4,
    slug: "deniz-toprak",
    name: "Deniz Toprak",
    title: "Spor",
    bio: "Sahanın içindeki taktikten soyunma odasının psikolojisine, sporu bir anlatı olarak okuyor.",
    avatar:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=256&q=80",
    columns: [
      {
        id: "kazanan-sistem",
        kicker: "Futbol",
        title: "Modern Futbolda Kazanan Takım Değil, Sistem",
        dek: "Yıldız oyuncu çağı kapanıyor; artık şampiyonluğu kolektif bir fikir belirliyor.",
        readTime: "4 dk okuma",
        date: "22 Haziran 2026",
        image:
          "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
        body: [
          "Bugün şampiyon olan takımlar, bir oyuncunun parıltısına değil; sahanın her metrekaresini kapsayan bir oyun fikrine yaslanıyor.",
          "Pres, top kullanımı ve geçiş hızları artık sezgiyle değil, veriyle yönetiliyor. Yine de futbolun ruhu, bu hesapların arasından sıyrılan o öngörülemez ana dair.",
          "Sistem kazandırır; ama insanı tribüne bağlayan, o sistemin çatlağından doğan beklenmedik kahramanlıktır.",
        ],
      },
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

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
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

/* API ister zengin şemamızı, ister ham şemayı döndürsün — tek biçime indirger. */
function normalizeArticle(a) {
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

/* Köşe yazarlarını API'den çeker. */
async function fetchColumnists() {
  const res = await fetch(COLUMNISTS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

/* -------- Auth API yardımcıları -------- */
async function apiAuth(path, body) {
  const res = await fetch(`${AUTH_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "İşlem başarısız.");
  return data;
}

async function apiMe(token) {
  const res = await fetch(`${AUTH_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Oturum geçersiz");
  return res.json();
}

async function apiSavePreferences(token, prefs) {
  await fetch(`${AUTH_URL}/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      categories: prefs.categories,
      sources: prefs.sources,
    }),
  }).catch(() => {});
}

/* Tercihler + aktif kategori filtresine göre görünürlük. */
function isVisible(a, prefs, activeCategory, user) {
  const knownSrc = ALL_SOURCES.includes(a.source?.name);
  const srcOK = !knownSrc || prefs.sources.includes(a.source.name);

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

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
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

/* Yuvarlak yazar avatarı — görsel yüklenemezse baş harflere düşer. */
function Avatar({ src, name, size = 56, className = "" }) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        style={dim}
        className={
          "shrink-0 rounded-full object-cover ring-1 ring-neutral-300 dark:ring-neutral-700 " +
          className
        }
        loading="lazy"
      />
    );
  }
  return (
    <span
      style={{ ...dim, fontSize: size * 0.36 }}
      className={
        "inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-display font-bold text-white ring-1 ring-neutral-300 dark:bg-neutral-200 dark:text-neutral-900 dark:ring-neutral-700 " +
        className
      }
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------- CANLI BİLGİ ŞERİDİ --------------------------- */

const TICKER_INSTRUMENTS = [
  { label: "BİST 100", base: 9847.32, decimals: 2, suffix: "" },
  { label: "Dolar", base: 32.41, decimals: 3, suffix: " ₺" },
  { label: "Euro", base: 35.18, decimals: 3, suffix: " ₺" },
  { label: "Gram Altın", base: 2486.7, decimals: 2, suffix: " ₺" },
];

const TICKER_MATCHES = [
  "⚽ Galatasaray 2–1 Fenerbahçe · 76'",
  "⚽ Beşiktaş 0–0 Trabzonspor · 54'",
  "🏀 Anadolu Efes 78–74 F.Bahçe Beko · Ç4",
  "⚽ Real Madrid 3–2 Barcelona · 88'",
  "⚽ Başakşehir 1–0 Antalyaspor · 63'",
  "🏐 VakıfBank 2–1 Eczacıbaşı · 3. set",
];

const fmtNum = (n, d) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });

function LiveTicker() {
  const [vals, setVals] = useState(() =>
    TICKER_INSTRUMENTS.map((i) => ({ ...i, value: i.base }))
  );

  // Her saniye inandırıcı bir "rastgele yürüyüş" ile fiyatları güncelle.
  useEffect(() => {
    const id = setInterval(() => {
      setVals((prev) =>
        prev.map((v) => {
          const drift = (Math.random() - 0.5) * v.base * 0.0012;
          const lo = v.base * 0.985;
          const hi = v.base * 1.015;
          const next = Math.min(hi, Math.max(lo, v.value + drift));
          return { ...v, value: next };
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="safe-top bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex max-w-[1280px] items-stretch gap-3 px-4">
        <span className="flex shrink-0 items-center gap-1.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="hidden sm:inline">Canlı</span>
        </span>

        {/* Piyasa kutuları */}
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto py-1.5 font-sans text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {vals.map((v) => {
            const change = ((v.value - v.base) / v.base) * 100;
            const up = change >= 0;
            return (
              <span
                key={v.label}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
              >
                <span className="font-semibold uppercase tracking-wide text-neutral-400">
                  {v.label}
                </span>
                <span className="font-mono tabular-nums text-neutral-100">
                  {fmtNum(v.value, v.decimals)}
                  {v.suffix}
                </span>
                <span
                  className={
                    "inline-flex items-center gap-0.5 font-mono tabular-nums " +
                    (up ? "text-emerald-400" : "text-red-400")
                  }
                >
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {up ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>

        {/* Kayan maç sonuçları (marquee) */}
        <div className="hidden min-w-0 max-w-[42%] flex-1 items-center overflow-hidden border-l border-neutral-800 pl-3 md:flex">
          <div className="ticker-marquee py-1.5 font-sans text-[11px] text-neutral-300">
            {[...TICKER_MATCHES, ...TICKER_MATCHES].map((m, i) => (
              <span key={i} className="mx-5 whitespace-nowrap">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ HEADER ------------------------------------- */

function AccountControl({ user, onOpenAuth, onLogout, onForYou, compact = false }) {
  if (!user) {
    return (
      <button
        onClick={onOpenAuth}
        className="inline-flex items-center gap-1.5 font-semibold transition hover:text-black dark:hover:text-white"
        title="Giriş yap veya kayıt ol"
      >
        <User size={13} />
        <span className={compact ? "hidden sm:inline" : ""}>Giriş Yap</span>
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={onForYou}
        className="inline-flex items-center gap-1.5 transition hover:text-black dark:hover:text-white"
        title="Bana Özel akışım"
      >
        <Avatar src={user.avatar} name={user.name} size={20} />
        <span className="hidden max-w-[120px] truncate font-semibold normal-case tracking-normal sm:inline">
          {user.name}
        </span>
      </button>
      <button
        onClick={onLogout}
        aria-label="Çıkış yap"
        title="Çıkış yap"
        className="inline-flex items-center transition hover:text-black dark:hover:text-white"
      >
        <LogOut size={14} />
      </button>
    </span>
  );
}

function Masthead({
  goHome,
  live = false,
  isRefreshing = false,
  onRefresh,
  theme,
  onToggleTheme,
  onOpenPrefs,
  user,
  onOpenAuth,
  onLogout,
  onForYou,
}) {
  const date = todayLong();
  return (
    <header className="w-full">
      {/* Üst hizmet çubuğu */}
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="flex items-center justify-between border-b border-neutral-300 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
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

          <div className="flex items-center gap-2.5 sm:gap-4">
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

            <AccountControl
              user={user}
              onOpenAuth={onOpenAuth}
              onLogout={onLogout}
              onForYou={onForYou}
              compact
            />

            <button
              onClick={onOpenPrefs}
              className="inline-flex items-center gap-1.5 font-semibold transition hover:text-black dark:hover:text-white"
              title="Akışımı özelleştir"
            >
              <Settings size={13} />
              <span className="hidden md:inline">Özelleştir</span>
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
            <h1 className="font-logo text-[2rem] leading-none text-black transition-opacity group-hover:opacity-80 dark:text-white sm:text-4xl md:text-6xl lg:text-7xl">
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

        <p className="rule-star mx-auto mt-3 inline-block font-sans text-[9px] font-semibold uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 sm:text-[10px] sm:tracking-[0.3em]">
          Kişiselleştirilebilir Küresel Haber Ajansı
        </p>
      </div>
    </header>
  );
}

/* Logonun hemen altındaki dinamik kategori barı */
function CategoryBar({
  categories,
  active,
  onSelect,
  user,
  onOpenColumnists,
  columnistsActive = false,
}) {
  const items = [...(user ? [FOR_YOU] : []), "Tümü", ...categories];
  return (
    <nav className="border-y-[3px] border-double border-black dark:border-neutral-500">
      <div className="mx-auto max-w-[1280px] px-4">
        <ul className="flex flex-nowrap items-center justify-start gap-x-5 gap-y-1 overflow-x-auto py-2 font-sans text-[12px] font-semibold uppercase tracking-[0.1em] text-neutral-700 [scrollbar-width:none] dark:text-neutral-300 sm:flex-wrap sm:justify-center [&::-webkit-scrollbar]:hidden">
          {items.map((c) => {
            const isForYou = c === FOR_YOU;
            const isActive =
              !columnistsActive &&
              ((c === "Tümü" && !active) || c === active);
            return (
              <li key={c} className="shrink-0">
                <button
                  onClick={() => onSelect(c === "Tümü" ? null : c)}
                  className={
                    (isForYou
                      ? "inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 "
                      : "") +
                    (isActive
                      ? "text-black underline decoration-2 underline-offset-4 dark:text-white"
                      : "transition hover:text-black dark:hover:text-white")
                  }
                >
                  {isForYou && <Sparkles size={12} />}
                  {c}
                </button>
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              onClick={onOpenColumnists}
              className={
                "inline-flex items-center gap-1 italic " +
                (columnistsActive
                  ? "text-black underline decoration-2 underline-offset-4 dark:text-white"
                  : "transition hover:text-black dark:hover:text-white")
              }
            >
              <Feather size={12} /> Köşe Yazarları
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/* ------------------------------ AUTH MODAL --------------------------------- */

function AuthModal({ open, onClose, onLogin, onRegister }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setError("");
      setBusy(false);
    }
  }, [open, mode]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await onLogin(email.trim(), password);
      else await onRegister(email.trim(), password, name.trim());
    } catch (err) {
      setError(err.message || "Bir hata oluştu.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="modal-pop relative w-full max-w-md border border-neutral-300 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-3 top-3 rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="px-7 pt-8 pb-6">
          <p className="text-center font-logo text-3xl text-black dark:text-white">
            Singularity
          </p>
          <Kicker className="mt-2 text-center">
            {mode === "login" ? "Hesabınıza Giriş Yapın" : "Yeni Hesap Oluşturun"}
          </Kicker>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Ad Soyad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 font-serif text-[15px] text-black outline-none transition focus:border-black dark:border-neutral-700 dark:text-white dark:focus:border-white"
              />
            )}
            <input
              type="email"
              required
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 font-serif text-[15px] text-black outline-none transition focus:border-black dark:border-neutral-700 dark:text-white dark:focus:border-white"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Parola (en az 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 font-serif text-[15px] text-black outline-none transition focus:border-black dark:border-neutral-700 dark:text-white dark:focus:border-white"
            />

            {error && (
              <p className="font-sans text-[12px] text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 border border-black bg-black py-2.5 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
            </button>
          </form>

          <p className="mt-5 text-center font-sans text-[12px] text-neutral-500 dark:text-neutral-400">
            {mode === "login" ? "Hesabınız yok mu? " : "Zaten üye misiniz? "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-bold text-black underline underline-offset-2 dark:text-white"
            >
              {mode === "login" ? "Kayıt Olun" : "Giriş Yapın"}
            </button>
          </p>
        </div>
      </div>
    </div>
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
  user,
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
          {user && (
            <p className="mb-4 border border-amber-300 bg-amber-50 px-3 py-2 font-sans text-[12px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
              <Sparkles size={12} className="mr-1 inline" />
              Seçimleriniz “Bana Özel” akışınıza kaydedilir.
            </p>
          )}
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
        <h2 className="font-display text-[2rem] font-extrabold leading-[1.06] tracking-tight text-black transition group-hover:text-neutral-700 dark:text-white dark:group-hover:text-neutral-300 sm:text-[2.6rem] sm:leading-[1.04] md:text-5xl">
          {article.title}
        </h2>
      </button>
      <p className="mt-3 font-display text-base italic leading-snug text-neutral-700 dark:text-neutral-300 sm:text-lg">
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

function ForYouBanner({ user }) {
  return (
    <div className="border-b border-neutral-200 bg-amber-50/60 dark:border-neutral-800 dark:bg-amber-900/10">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-2.5 font-sans text-[12px] text-amber-800 dark:text-amber-300">
        <Sparkles size={14} />
        <span className="font-bold uppercase tracking-[0.12em]">Bana Özel</span>
        <span className="text-amber-700/80 dark:text-amber-400/70">
          — {user?.name} için seçtiğiniz kategorilerden derlendi
        </span>
      </div>
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

        <h1 className="mt-3 text-center font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight text-black dark:text-white sm:text-[2.4rem] sm:leading-[1.06] md:text-[3rem]">
          {article.title}
        </h1>
        <p className="mt-4 text-center font-display text-lg italic leading-snug text-neutral-700 dark:text-neutral-300 sm:text-xl">
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
              "font-serif text-[1.18rem] leading-[1.75] text-neutral-900 dark:text-gray-200 sm:text-[1.2rem] " +
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

/* -------------------------- KÖŞE YAZARLARI (OPINION) ---------------------- */

function ColumnistsPage({ columnists, onOpenColumn, goHome }) {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-20">
      <div className="flex items-center justify-between border-b border-neutral-200 py-3 font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 font-semibold text-black transition hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
        >
          <ArrowLeft size={14} /> Ana Sayfa
        </button>
        <span>Opinion</span>
      </div>

      <div className="py-8 text-center">
        <Kicker>Görüş</Kicker>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-black dark:text-white sm:text-5xl">
          Köşe Yazarları
        </h1>
        <p className="mx-auto mt-3 max-w-xl font-display text-lg italic text-neutral-600 dark:text-neutral-400">
          Singularity yazarlarından dünyaya, ekonomiye ve kültüre ağırbaşlı bakışlar.
        </p>
      </div>

      <div className="space-y-10 border-t-[3px] border-double border-black pt-8 dark:border-neutral-500">
        {columnists.map((c) => (
          <section
            key={c.slug}
            className="grid grid-cols-1 gap-5 border-b border-neutral-200 pb-10 last:border-b-0 dark:border-neutral-800 sm:grid-cols-[auto_1fr]"
          >
            <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:text-center">
              <Avatar src={c.avatar} name={c.name} size={88} />
              <div className="sm:mt-3 sm:w-40">
                <h2 className="font-display text-xl font-bold leading-tight text-black dark:text-white">
                  {c.name}
                </h2>
                <p className="mt-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
                  {c.title}
                </p>
              </div>
            </div>

            <div>
              <p className="font-serif text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                {c.bio}
              </p>
              <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {(c.columns || []).map((col) => (
                  <li key={col.id}>
                    <button
                      onClick={() => onOpenColumn(c, col)}
                      className="group flex w-full items-start gap-3 py-3 text-left"
                    >
                      <ChevronRight
                        size={16}
                        className="mt-1 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-black dark:group-hover:text-white"
                      />
                      <span>
                        <span className="font-display text-[1.1rem] font-bold leading-snug text-black transition group-hover:text-neutral-600 dark:text-white dark:group-hover:text-neutral-300">
                          {col.title}
                        </span>
                        <span className="mt-1 block font-serif text-[13px] italic leading-snug text-neutral-600 dark:text-neutral-400">
                          {col.dek}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function ColumnView({ columnist, column, onBack, goHome }) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-20">
      <div className="flex items-center justify-between border-b border-neutral-200 py-3 font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 font-semibold text-black transition hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
        >
          <ArrowLeft size={14} /> Köşe Yazarları
        </button>
        <span>Opinion · {column.kicker}</span>
      </div>

      <article className="mx-auto max-w-[720px] pt-8">
        <Kicker className="text-center">{column.kicker}</Kicker>
        <h1 className="mt-3 text-center font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight text-black dark:text-white sm:text-[2.4rem] md:text-[2.8rem]">
          {column.title}
        </h1>
        <p className="mt-4 text-center font-display text-lg italic leading-snug text-neutral-700 dark:text-neutral-300 sm:text-xl">
          {column.dek}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 border-y border-neutral-300 py-4 dark:border-neutral-700">
          <Avatar src={columnist.avatar} name={columnist.name} size={48} />
          <div className="text-left">
            <p className="font-display text-[15px] font-bold text-black dark:text-white">
              {columnist.name}
            </p>
            <p className="font-sans text-[11px] uppercase tracking-[0.1em] text-neutral-500 dark:text-neutral-400">
              {columnist.title}
              {column.date ? ` · ${column.date}` : ""}
              {column.readTime ? ` · ${column.readTime}` : ""}
            </p>
          </div>
        </div>
      </article>

      {column.image && (
        <figure className="mx-auto mt-8 max-w-[900px]">
          <img
            src={column.image}
            alt={column.title}
            onError={onImgError}
            className="w-full object-cover"
            loading="lazy"
          />
        </figure>
      )}

      <div className="mx-auto mt-10 max-w-[680px]">
        {(column.body || []).map((para, i) => (
          <p
            key={i}
            className={
              "font-serif text-[1.18rem] leading-[1.75] text-neutral-900 dark:text-gray-200 sm:text-[1.2rem] " +
              (i === 0 ? "drop-cap" : "mt-6")
            }
          >
            {para}
          </p>
        ))}

        <div className="mt-10 flex items-center gap-3 border-t border-neutral-300 pt-5 dark:border-neutral-700">
          <Avatar src={columnist.avatar} name={columnist.name} size={44} />
          <p className="font-serif text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            <strong className="text-black dark:text-white">{columnist.name}</strong>{" "}
            — {columnist.bio}
          </p>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------- FOOTER ----------------------------------- */

const FOOTER_LINKS = {
  "Singularity Hakkında": ["Bize Ulaşın", "Erişilebilirlik", "Site Haritası", "Yardım"],
  Kurumsal: ["Gizlilik Politikası", "Çerez Politikası", "Hizmet Şartları", "Abonelikler"],
};

function Footer({ goHome, onSelectCategory, onOpenColumnists }) {
  return (
    <footer className="border-t-[3px] border-double border-black dark:border-neutral-500">
      <div className="mx-auto max-w-[1280px] px-4 py-12">
        <div className="text-center">
          <button onClick={goHome} aria-label="Singularity ana sayfa">
            <h2 className="font-logo text-4xl text-black dark:text-white sm:text-5xl">
              Singularity
            </h2>
          </button>
          <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            Kişiselleştirilebilir Küresel Haber Ajansı · Anti-Clickbait Editör
          </p>
        </div>

        {/* Link sütunları */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Kategoriler (çalışan) */}
          <div className="col-span-2 sm:col-span-1">
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-black dark:text-white">
              Bölümler
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-1">
              {ALL_CATEGORIES.map((c) => (
                <li key={c}>
                  <button
                    onClick={() => onSelectCategory(c)}
                    className="font-sans text-[13px] text-neutral-600 transition hover:text-black hover:underline dark:text-neutral-400 dark:hover:text-white"
                  >
                    {c}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={onOpenColumnists}
                  className="font-sans text-[13px] italic text-neutral-600 transition hover:text-black hover:underline dark:text-neutral-400 dark:hover:text-white"
                >
                  Köşe Yazarları
                </button>
              </li>
            </ul>
          </div>

          {/* Kurumsal link blokları */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <p className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-black dark:text-white">
                {heading}
              </p>
              <ul className="mt-3 space-y-1.5">
                {links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="font-sans text-[13px] text-neutral-600 transition hover:text-black hover:underline dark:text-neutral-400 dark:hover:text-white"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Bülten */}
          <div>
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-black dark:text-white">
              Bülten
            </p>
            <p className="mt-3 font-serif text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              Günün ağırbaşlı özeti, her sabah kutunuzda.
            </p>
            <div className="mt-3 flex">
              <input
                type="email"
                placeholder="E-posta"
                className="w-full border border-neutral-300 bg-transparent px-2.5 py-2 font-sans text-[12px] text-black outline-none focus:border-black dark:border-neutral-700 dark:text-white dark:focus:border-white"
              />
              <button
                onClick={(e) => e.preventDefault()}
                className="shrink-0 border border-l-0 border-black bg-black px-3 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black"
              >
                Katıl
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800 sm:flex-row sm:justify-between">
          <p className="font-sans text-[11px] text-neutral-400 dark:text-neutral-500">
            © {new Date().getFullYear()} Singularity. Tüm haberler ilgili
            kaynaklarına aittir.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-sans text-[11px] text-neutral-400 dark:text-neutral-500">
            {["Bize Ulaşın", "Gizlilik Politikası", "Hizmet Şartları", "Çerez Politikası"].map(
              (l) => (
                <a
                  key={l}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="transition hover:text-black dark:hover:text-white"
                >
                  {l}
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------- YÜKLEME EKRANI ----------------------------- */

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white text-center dark:bg-neutral-900">
      <h1 className="font-logo text-5xl text-black dark:text-white">
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
  const [view, setView] = useState("home"); // home | article | columnists | column
  const [activeId, setActiveId] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null); // { columnist, column }
  const [articles, setArticles] = useState(() =>
    MOCK_ARTICLES.map(normalizeArticle)
  );
  const [columnists, setColumnists] = useState(MOCK_COLUMNISTS);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState("");

  const [theme, setTheme] = useState(loadTheme);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [activeCategory, setActiveCategory] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [token, setToken] = useState(loadToken);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const refreshJobRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const tokenRef = useRef(token);
  tokenRef.current = token;
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

    // Köşe yazarlarını da çekmeyi dene (başarısızsa mock kalır).
    fetchColumnists()
      .then((list) => {
        if (!cancelled && list.length) setColumnists(list);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Saklı token varsa oturumu doğrula ve kullanıcıyı yükle.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiMe(token)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        if (u?.preferences?.categories?.length || u?.preferences?.sources?.length) {
          setPrefs({
            categories: u.preferences.categories?.length
              ? u.preferences.categories
              : DEFAULT_PREFS.categories,
            sources: u.preferences.sources?.length
              ? u.preferences.sources
              : DEFAULT_PREFS.sources,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Token geçersiz: temizle.
          setToken(null);
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {
            /* yoksay */
          }
        }
      });
    return () => {
      cancelled = true;
    };
    // Yalnızca ilk token yüklemesinde çalışsın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Görünüm değiştiğinde sayfayı başa sar.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, activeId, activeColumn]);

  // Canlı modda tercihler değişince sunucudan filtrelenmiş veriyi yeniden çek.
  useEffect(() => {
    if (!live) return;
    if (!liveFetchDidMount.current) {
      liveFetchDidMount.current = true;
      return;
    }
    let cancelled = false;
    fetchArticles(prefs)
      .then((list) => {
        if (!cancelled) setArticles(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
    setActiveColumn(null);
  };
  const openColumnists = () => {
    setView("columnists");
    setActiveId(null);
  };
  const openColumn = (columnist, column) => {
    setActiveColumn({ columnist, column });
    setView("column");
  };
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const selectCategory = (c) => {
    setActiveCategory(c);
    setView("home");
    setActiveId(null);
    setActiveColumn(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  // Tercih çekmecesi kapanınca, giriş yapılmışsa sunucuya kaydet.
  const closeDrawer = () => {
    setDrawerOpen(false);
    if (tokenRef.current) {
      apiSavePreferences(tokenRef.current, prefsRef.current);
      setUser((u) => (u ? { ...u, preferences: { ...prefsRef.current } } : u));
    }
  };

  // ---- Auth akışları ----
  const persistToken = (tok) => {
    setToken(tok);
    try {
      localStorage.setItem(TOKEN_KEY, tok);
    } catch {
      /* yoksay */
    }
  };

  const handleLogin = async (email, password) => {
    const data = await apiAuth("login", { email, password });
    persistToken(data.token);
    setUser(data.user);
    if (
      data.user?.preferences?.categories?.length ||
      data.user?.preferences?.sources?.length
    ) {
      setPrefs({
        categories: data.user.preferences.categories?.length
          ? data.user.preferences.categories
          : DEFAULT_PREFS.categories,
        sources: data.user.preferences.sources?.length
          ? data.user.preferences.sources
          : DEFAULT_PREFS.sources,
      });
    }
    setActiveCategory(FOR_YOU);
    setView("home");
    setAuthOpen(false);
    setToast(`Hoş geldiniz, ${data.user.name}.`);
    setTimeout(() => setToast(""), 4000);
  };

  const handleRegister = async (email, password, name) => {
    const data = await apiAuth("register", { email, password, name });
    persistToken(data.token);
    // Yeni kullanıcının "Bana Özel"i, mevcut yerel seçimlerle başlasın.
    apiSavePreferences(data.token, prefsRef.current);
    setUser({ ...data.user, preferences: { ...prefsRef.current } });
    setActiveCategory(FOR_YOU);
    setView("home");
    setAuthOpen(false);
    setToast(`Hesabınız oluşturuldu. Hoş geldiniz, ${data.user.name}.`);
    setTimeout(() => setToast(""), 4000);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* yoksay */
    }
    if (activeCategory === FOR_YOU) setActiveCategory(null);
    setToast("Çıkış yapıldı.");
    setTimeout(() => setToast(""), 3000);
  };

  const goForYou = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setActiveCategory(FOR_YOU);
    setView("home");
    setActiveId(null);
    setActiveColumn(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const active = activeId ? articles.find((a) => a.id === activeId) : null;
  const visible = articles.filter((a) =>
    isVisible(a, prefs, activeCategory, user)
  );
  const inForYou = activeCategory === FOR_YOU && view === "home";

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white text-[#121212] dark:bg-neutral-900 dark:text-gray-200">
      <LiveTicker />
      <Masthead
        goHome={goHome}
        live={live}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenPrefs={() => setDrawerOpen(true)}
        user={user}
        onOpenAuth={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onForYou={goForYou}
      />
      <CategoryBar
        categories={prefs.categories.length ? prefs.categories : ALL_CATEGORIES}
        active={activeCategory}
        onSelect={selectCategory}
        user={user}
        onOpenColumnists={openColumnists}
        columnistsActive={view === "columnists" || view === "column"}
      />

      {inForYou && <ForYouBanner user={user} />}

      {view === "columnists" ? (
        <ColumnistsPage
          columnists={columnists}
          onOpenColumn={openColumn}
          goHome={goHome}
        />
      ) : view === "column" && activeColumn ? (
        <ColumnView
          columnist={activeColumn.columnist}
          column={activeColumn.column}
          onBack={openColumnists}
          goHome={goHome}
        />
      ) : view === "article" && active ? (
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

      <Footer
        goHome={goHome}
        onSelectCategory={selectCategory}
        onOpenColumnists={openColumnists}
      />

      <PreferencesDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        prefs={prefs}
        onToggle={togglePref}
        onSelectAll={selectAllPrefs}
        onClear={clearPrefs}
        user={user}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      {toast && (
        <div className="toast-in fixed bottom-6 right-6 z-[60] max-w-sm bg-black px-6 py-3 font-sans text-sm tracking-wide text-white shadow-2xl dark:bg-white dark:text-black">
          {toast}
        </div>
      )}
    </div>
  );
}
