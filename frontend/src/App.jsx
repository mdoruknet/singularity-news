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

/* ============================================================================
   SINGULARITY V2 — Kişiselleştirilebilir Küresel Haber Ajansı
   ----------------------------------------------------------------------------
   The New York Times'ın klasik editoryal tasarım dilini taklit eden, karanlık
   mod, kişiselleştirme, kullanıcı hesapları (JWT), köşe yazarları (Opinion) ve
   canlı bilgi şeridi (Live Ticker) destekli tek dosyalık React uygulaması.
   Backend yoksa yerleşik demo içerikle çalışır.
   ========================================================================== */






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
  sourceGroups,
  allSources,
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
          "fixed left-0 top-0 z-50 flex h-full w-[88%] max-w-sm flex-col border-r border-neutral-200 bg-white shadow-2xl transition-transform duration-300 dark:border-neutral-800 dark:bg-neutral-900 " +
          (open ? "translate-x-0" : "-translate-x-full")
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
              Kategori seçimleriniz “Bana Özel” akışınıza kaydedilir.
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
            <div className="mb-2 flex items-baseline justify-between">
              <p className="rule-star font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black dark:text-white">
                Kaynaklar
              </p>
              <span className="font-sans text-[10px] text-neutral-400 dark:text-neutral-500">
                {allSources.length} kaynak
              </span>
            </div>
            {/* Yüzlerce kaynak ekrana sığmaz: bölümü kendi içinde kaydırılabilir yap. */}
            <div className="custom-scrollbar max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(sourceGroups).map(([group, list]) => (
                <div key={group} className="mb-3">
                  <p className="sticky top-0 mt-2 mb-1 bg-white py-1 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
                    {group} · {list.length}
                  </p>
                  {list.map((s) => (
                    <CheckRow
                      key={s}
                      label={s}
                      checked={!(prefs.hiddenSources || []).includes(s)}
                      onChange={() => onToggle("hiddenSources", s)}
                    />
                  ))}
                </div>
              ))}
            </div>
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


function HomePage({ articles, onOpen, onOpenPrefs, activeCategory }) {
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
          {leftCol.length > 0 && activeCategory === "Ekonomi" && (
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
                {c.bio ||
                  `${c.title} — en güncel köşe yazıları aşağıda derlendi; tamamını kaynağında okuyabilirsiniz.`}
              </p>
              {(c.columns || []).length > 0 ? (
                <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {c.columns.map((col) => (
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
              ) : (
                c.page && (
                  <a
                    href={c.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-neutral-700 transition hover:border-black hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
                  >
                    <ExternalLink size={14} /> Yazılarını oku
                  </a>
                )
              )}
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

        {/* Gerçek yazının tamamı kaynağında okunur (alıntı + atıf). */}
        {column.sourceUrl && (
          <div className="mt-8 flex justify-center">
            <a
              href={column.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 border border-black bg-white px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:bg-black hover:text-white dark:border-neutral-500 dark:bg-transparent dark:text-white dark:hover:bg-white dark:hover:text-black"
            >
              <ExternalLink size={13} />
              Tüm yazıyı {column.sourceName || columnist.title} sitesinde oku
            </a>
          </div>
        )}

        <div className="mt-10 flex items-center gap-3 border-t border-neutral-300 pt-5 dark:border-neutral-700">
          <Avatar src={columnist.avatar} name={columnist.name} size={44} />
          <p className="font-serif text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            <strong className="text-black dark:text-white">{columnist.name}</strong>
            {columnist.bio ? ` — ${columnist.bio}` : ` · ${columnist.title}`}
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

// Footer linklerinin açtığı bilgi modalının içeriği (kısa, demo metinler).
const FOOTER_CONTENT = {
  "Erişilebilirlik":
    "Singularity, WCAG 2.1 AA hedefleriyle tasarlanır: yüksek kontrast, klavye ile gezinme, ekran okuyucu uyumu ve karanlık mod. Erişilebilirlikle ilgili geri bildirimlerinizi her zaman bekleriz.",
  "Yardım":
    "Sık sorulanlar: Akışınızı 'Akışımı Özelleştir' menüsünden kategorilere ve kaynaklara göre kişiselleştirebilir, 'Bana Özel' sekmesiyle yalnızca seçtiğiniz konuları görebilirsiniz. Sayfayı yenilemek için mobilde aşağı çekin.",
  "Gizlilik Politikası":
    "Verileriniz yalnızca deneyiminizi kişiselleştirmek için kullanılır. Tercihleriniz cihazınızda saklanır; üçüncü taraflarla pazarlama amacıyla paylaşılmaz. Bu bir demo platformudur; tüm haberler ilgili kaynaklarına aittir.",
  "Çerez Politikası":
    "Temel çerezler oturum ve tema/tercih tercihlerinizi hatırlamak için kullanılır. İzleme/analiz çerezleri yalnızca onayınızla etkinleşir. Tarayıcı ayarlarından çerezleri her zaman temizleyebilirsiniz.",
  "Hizmet Şartları":
    "Singularity, kamuya açık haber kaynaklarını yapay zeka ile derleyen, çeviren ve tık tuzağından arındıran bir okuma platformudur. İçerikler bilgilendirme amaçlıdır; doğruluk için lütfen orijinal kaynağa başvurun.",
  "Abonelikler":
    "Şimdilik tüm içerik ücretsizdir. Yakında 'Premium' ile reklamsız okuma, sınırsız 'Bana Özel' akışı ve köşe yazarı arşivi sunmayı planlıyoruz.",
};

function InfoModal({ open, title, onClose, onSelectCategory, onOpenColumnists }) {
  if (!open) return null;
  const isSitemap = title === "Site Haritası";
  const isContact = title === "Bize Ulaşın";
  const go = (fn) => {
    fn();
    onClose();
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
        className="modal-pop relative max-h-[85vh] w-full max-w-lg overflow-y-auto border border-neutral-300 bg-white p-7 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-3 top-3 rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X size={20} />
        </button>

        <Kicker>Singularity</Kicker>
        <h2 className="mt-1 font-display text-3xl font-extrabold text-black dark:text-white">
          {title}
        </h2>
        <div className="rule-star mt-3 mb-5 h-px" />

        {isSitemap ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                Bölümler
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => go(() => onSelectCategory(c))}
                    className="border border-neutral-300 px-3 py-1.5 font-sans text-[12px] font-semibold text-neutral-700 transition hover:border-black hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => go(onOpenColumnists)}
                  className="border border-neutral-300 px-3 py-1.5 font-sans text-[12px] font-semibold italic text-neutral-700 transition hover:border-black hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
                >
                  Köşe Yazarları
                </button>
              </div>
            </div>
          </div>
        ) : isContact ? (
          <div className="space-y-4 font-serif text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
            <p>
              Görüş, öneri ve düzeltme talepleriniz için editoryal masamıza
              ulaşabilirsiniz. Genellikle bir iş günü içinde dönüş yapıyoruz.
            </p>
            <a
              href="mailto:iletisim@singularity.news"
              className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              iletisim@singularity.news
            </a>
          </div>
        ) : (
          <p className="font-serif text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
            {FOOTER_CONTENT[title] ||
              "Bu bölüm yakında ayrıntılı içerikle güncellenecek."}
          </p>
        )}
      </div>
    </div>
  );
}

function Footer({ goHome, onSelectCategory, onOpenColumnists, onOpenInfo, onSubscribe }) {
  const [email, setEmail] = useState("");
  const submitNewsletter = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    onSubscribe(email.trim());
    setEmail("");
  };
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
                    <button
                      onClick={() => onOpenInfo(l)}
                      className="font-sans text-[13px] text-neutral-600 transition hover:text-black hover:underline dark:text-neutral-400 dark:hover:text-white"
                    >
                      {l}
                    </button>
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
            <form onSubmit={submitNewsletter} className="mt-3 flex">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta"
                className="w-full border border-neutral-300 bg-transparent px-2.5 py-2 font-sans text-[12px] text-black outline-none focus:border-black dark:border-neutral-700 dark:text-white dark:focus:border-white"
              />
              <button
                type="submit"
                className="shrink-0 border border-l-0 border-black bg-black px-3 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black"
              >
                Katıl
              </button>
            </form>
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
                <button
                  key={l}
                  onClick={() => onOpenInfo(l)}
                  className="transition hover:text-black dark:hover:text-white"
                >
                  {l}
                </button>
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
