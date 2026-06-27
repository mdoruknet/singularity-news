import { useState, useEffect, useRef, useMemo } from "react";
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
  Feather,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import {
  ALL_CATEGORIES,
  SOURCE_GROUPS,
  ALL_SOURCES,
  DEFAULT_PREFS,
  FOR_YOU,
  THEME_KEY,
  PREFS_KEY,
  PREFS_VER_KEY,
  PREFS_VERSION,
  TOKEN_KEY,
  FALLBACK_IMG,
} from "./lib/constants.js";
import {
  todayLong,
  initials,
  safeParseBody,
  normalizeArticle,
  shuffleArr,
  reshuffle,
  sig,
  isVisible,
  loadPrefs,
  loadTheme,
  loadToken,
  onImgError,
} from "./lib/utils.js";
import {
  fetchArticles,
  fetchColumnists,
  fetchSources,
  apiAuth,
  apiMe,
  apiSavePreferences,
} from "./lib/api.js";
import { MOCK_ARTICLES, MOCK_COLUMNISTS } from "./lib/mockData.js";
import { Kicker, Byline, Avatar, AccountControl } from "./components/ui.jsx";
import { Masthead } from "./components/Masthead.jsx";
import { CategoryBar } from "./components/CategoryBar.jsx";
import {
  LeadStory,
  ColumnStory,
  GridCard,
  EditorsPick,
  EmptyState,
  ForYouBanner,
} from "./components/cards.jsx";
import {
  AuthModal,
  PreferencesDrawer,
  HomePage,
  ArticleView,
  ColumnistsPage,
  ColumnView,
  InfoModal,
  Footer,
  LoadingScreen,
} from "./components/views.jsx";

/* ============================================================================
   SINGULARITY V2 — Kişiselleştirilebilir Küresel Haber Ajansı
   ----------------------------------------------------------------------------
   The New York Times'ın klasik editoryal tasarım dilini taklit eden, karanlık
   mod, kişiselleştirme, kullanıcı hesapları (JWT), köşe yazarları (Opinion) ve
   canlı bilgi şeridi (Live Ticker) destekli tek dosyalık React uygulaması.
   Backend yoksa yerleşik demo içerikle çalışır.
   ========================================================================== */






export default function App() {
  const [view, setView] = useState("home"); // home | article | columnists | column
  const [activeId, setActiveId] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null); // { columnist, column }
  const [articles, setArticles] = useState(() =>
    MOCK_ARTICLES.map(normalizeArticle)
  );
  const [columnists, setColumnists] = useState(MOCK_COLUMNISTS);
  const [sourceGroups, setSourceGroups] = useState(SOURCE_GROUPS);
  const allSources = useMemo(
    () => Object.values(sourceGroups).flat(),
    [sourceGroups]
  );
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState("");

  const [theme, setTheme] = useState(loadTheme);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [activeCategory, setActiveCategory] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [token, setToken] = useState(loadToken);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState(null); // Footer bilgi modalı
  const [feedRefreshing, setFeedRefreshing] = useState(false); // akış yenileme
  const [pullView, setPullView] = useState(0); // aşağı-çekme mesafesi (px)
  const [polling, setPolling] = useState(false); // taze haber yoklanıyor

  const articlesSigRef = useRef(""); // son canlı içerik imzası
  const pollTimerRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const liveRef = useRef(live);
  liveRef.current = live;
  const liveFetchDidMount = useRef(false);
  const refreshFeedRef = useRef(() => {});

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

  // Tercihleri kalıcı kıl (sürüm damgasıyla — kaynak göçü için).
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      localStorage.setItem(PREFS_VER_KEY, PREFS_VERSION);
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
          articlesSigRef.current = sig(list);
          setArticles(list);
          setLive(true);
        }
      })
      .catch(() => {
        /* Backend yoksa demo içeriğe düşülür. */
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          // Backend uyanırken taze haberleri arka planda tarıyor; yoklamaya başla.
          startPolling();
        }
      });

    // Köşe yazarlarını da çekmeyi dene (başarısızsa mock kalır).
    fetchColumnists()
      .then((list) => {
        if (!cancelled && list.length) setColumnists(list);
      })
      .catch(() => {});

    // Kaynak listesini API'den çek (filtreyi dinamik doldur; yoksa fallback).
    fetchSources()
      .then((groups) => {
        if (!cancelled && groups) setSourceGroups(groups);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
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
        if (u?.preferences?.categories?.length) {
          setPrefs((p) => ({ ...p, categories: u.preferences.categories }));
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

  // Backend taze haberleri arka planda tarar; biz birkaç saniyede bir yoklayıp
  // (polling) yeni içerik düşünce akışı otomatik güncelleriz.
  const startPolling = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    let tries = 0;
    let netErrors = 0;
    const MAX = 10;
    const EVERY = 5000;
    setPolling(true);
    const stop = () => {
      setPolling(false);
      pollTimerRef.current = null;
    };
    const tick = async () => {
      tries += 1;
      let ok = false;
      try {
        const list = await fetchArticles(prefsRef.current);
        ok = true;
        if (list.length && sig(list) !== articlesSigRef.current) {
          articlesSigRef.current = sig(list);
          setArticles(reshuffle(list));
          setLive(true);
          try {
            const cols = await fetchColumnists();
            if (cols.length) setColumnists(cols);
          } catch {
            /* yoksay */
          }
          setToast("Yeni haberler akışa düştü.");
          setTimeout(() => setToast(""), 2500);
        }
      } catch {
        netErrors += 1; // backend yoksa erken dur (demo modunda boşuna yoklama yok)
      }
      if (!ok && netErrors >= 2) return stop();
      if (tries < MAX) pollTimerRef.current = setTimeout(tick, EVERY);
      else stop();
    };
    pollTimerRef.current = setTimeout(tick, EVERY);
  };

  // Akışı yenile: her zaman canlıyı dene (sunucuda taze tarama tetiklenir),
  // sonuç gelene kadar da yoklamayı (polling) başlat.
  const refreshFeed = async () => {
    if (feedRefreshing) return;
    setFeedRefreshing(true);
    try {
      const list = await fetchArticles(prefsRef.current).catch(() => []);
      if (list.length) {
        articlesSigRef.current = sig(list);
        setArticles(reshuffle(list));
        setLive(true);
        try {
          const cols = await fetchColumnists();
          if (cols.length) setColumnists(shuffleArr(cols));
        } catch {
          /* yoksay */
        }
        // Tek bildirim: kısa onay. Taze haber zaten geldiği için "aranıyor"
        // göstergesi AÇILMAZ (eşzamanlı çift bildirim olmasın).
        setToast("Akış yenilendi.");
      } else {
        // Henüz canlı haber yok: demoyu tazele ve sunucu taramasını yokla.
        // Burada SADECE "Taze haberler aranıyor…" göstergesi çıkar; ikinci bildirim yok.
        setArticles(reshuffle(MOCK_ARTICLES.map(normalizeArticle)));
        setColumnists((prev) => shuffleArr(prev));
        startPolling();
      }
    } finally {
      setFeedRefreshing(false);
      setTimeout(() => setToast(""), 2500);
    }
  };
  refreshFeedRef.current = refreshFeed;

  // Mobilde "aşağı çekip bırak" (pull-to-refresh) jesti.
  useEffect(() => {
    const PULL_THRESHOLD = 70;
    let startY = null;
    let dist = 0;

    const onStart = (e) => {
      startY = window.scrollY <= 0 ? e.touches[0].clientY : null;
      dist = 0;
    };
    const onMove = (e) => {
      if (startY == null) return;
      if (window.scrollY > 0) {
        startY = null;
        dist = 0;
        setPullView(0);
        return;
      }
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        dist = Math.min(dy * 0.5, 120); // sönümlenmiş mesafe
        setPullView(dist);
      }
    };
    const onEnd = () => {
      if (dist > PULL_THRESHOLD) refreshFeedRef.current();
      startY = null;
      dist = 0;
      setPullView(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  // Sayfa yeniden görünür olduğunda (uygulamaya dönüş = manuel yenileme) tazele.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && liveRef.current) {
        refreshFeedRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

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
      const set = new Set(p[key] || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (key === "categories") {
        return { ...p, categories: ALL_CATEGORIES.filter((x) => set.has(x)) };
      }
      // hiddenSources: sırasız küme (gizlenen kaynaklar).
      return { ...p, hiddenSources: [...set] };
    });
  // "Tümünü Seç": tüm kategoriler + hiçbir kaynak gizli değil.
  const selectAllPrefs = () =>
    setPrefs({ categories: [...ALL_CATEGORIES], hiddenSources: [] });
  // "Temizle": kategori yok + tüm kaynaklar gizli.
  const clearPrefs = () =>
    setPrefs({ categories: [], hiddenSources: [...allSources] });

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
    if (data.user?.preferences?.categories?.length) {
      setPrefs((p) => ({ ...p, categories: data.user.preferences.categories }));
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

  const onSubscribe = (mail) => {
    setToast(`Bültene kaydoldunuz: ${mail}`);
    setTimeout(() => setToast(""), 3500);
  };

  const active = activeId ? articles.find((a) => a.id === activeId) : null;
  const visible = articles.filter((a) =>
    isVisible(a, prefs, activeCategory, user)
  );
  const inForYou = activeCategory === FOR_YOU && view === "home";

  if (loading) return <LoadingScreen />;

  const pulling = pullView > 0 || feedRefreshing;

  return (
    <div className="min-h-screen bg-white text-[#121212] dark:bg-neutral-900 dark:text-gray-200">
      {/* Aşağı-çek / yenile göstergesi */}
      {pulling && (
        <div
          className="safe-top pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-center"
          style={{ opacity: feedRefreshing ? 1 : Math.min(pullView / 70, 1) }}
        >
          <div className="mt-2 flex items-center gap-2 rounded-full bg-black px-3.5 py-1.5 text-white shadow-lg dark:bg-white dark:text-black">
            <RefreshCw
              size={14}
              className={feedRefreshing ? "animate-spin" : ""}
              style={
                feedRefreshing ? undefined : { transform: `rotate(${pullView * 3}deg)` }
              }
            />
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em]">
              {feedRefreshing
                ? "Yenileniyor…"
                : pullView > 70
                  ? "Bırak, yenilensin"
                  : "Yenilemek için çek"}
            </span>
          </div>
        </div>
      )}

      <Masthead
        goHome={goHome}
        live={live}
        onRefreshFeed={refreshFeed}
        feedRefreshing={feedRefreshing}
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
          activeCategory={activeCategory}
          onOpen={openArticle}
          onOpenPrefs={() => setDrawerOpen(true)}
        />
      )}

      <Footer
        goHome={goHome}
        onSelectCategory={selectCategory}
        onOpenColumnists={openColumnists}
        onOpenInfo={setInfoTitle}
        onSubscribe={onSubscribe}
      />

      <InfoModal
        open={!!infoTitle}
        title={infoTitle}
        onClose={() => setInfoTitle(null)}
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
        sourceGroups={sourceGroups}
        allSources={allSources}
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

      {polling && !toast && (
        <div className="fixed bottom-6 left-6 z-[55] inline-flex items-center gap-2 rounded-full bg-black/85 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur dark:bg-white/90 dark:text-black">
          <Loader2 size={13} className="animate-spin" />
          Taze haberler aranıyor…
        </div>
      )}
    </div>
  );
}
