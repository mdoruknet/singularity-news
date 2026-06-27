/* Üst başlık — mobil yapışkan bar (NYT tarzı) + masaüstü gazete logosu. */

import { Menu, RefreshCw, Sun, Moon, Settings } from "lucide-react";
import { AccountControl } from "./ui.jsx";
import { todayLong } from "../lib/utils.js";

export function Masthead({
  goHome,
  live = false,
  onRefreshFeed,
  feedRefreshing = false,
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
    <header className="sticky top-0 z-30 w-full sm:static">
      {/* === MOBİL (NYT tarzı): ☰ sol · Singularity orta · ikonlar sağ — YAPIŞKAN === */}
      <div className="safe-top border-b border-neutral-300 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 sm:hidden">
        <div className="flex items-center justify-between px-3 py-2">
          {/* SOL: menü (eşit genişlik → başlık tam ortada kalsın) */}
          <div className="flex flex-1 justify-start">
            <button
              onClick={onOpenPrefs}
              aria-label="Menü"
              title="Menü"
              className="-ml-1 p-1 text-neutral-700 transition hover:text-black dark:text-neutral-300 dark:hover:text-white"
            >
              <Menu size={22} />
            </button>
          </div>
          {/* ORTA: logo + ince alt başlık */}
          <button
            onClick={goHome}
            aria-label="Singularity ana sayfa"
            className="flex shrink-0 select-none flex-col items-center leading-none"
          >
            <span className="font-logo text-[1.55rem] leading-none text-black dark:text-white">
              Singularity
            </span>
            <span className="mt-[3px] font-sans text-[7.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Küresel Haber Ajansı
            </span>
          </button>
          {/* SAĞ: tema + hesap (yenile yok — aşağı çekerek yenileniyor) */}
          <div className="flex flex-1 items-center justify-end gap-3 text-neutral-700 dark:text-neutral-300">
            <button
              onClick={onToggleTheme}
              aria-label="Açık / koyu tema"
              title="Açık / koyu tema"
              className="transition hover:text-black dark:hover:text-white"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <AccountControl
              user={user}
              onOpenAuth={onOpenAuth}
              onLogout={onLogout}
              onForYou={onForYou}
              compact
              size={18}
            />
          </div>
        </div>
      </div>

      {/* === MASAÜSTÜ: gazete düzeni (mobilde gizli) === */}
      {/* Üst hizmet çubuğu */}
      <div className="safe-top mx-auto hidden max-w-[1280px] px-4 sm:block">
        <div className="flex items-center justify-between border-b border-neutral-300 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <div className="hidden items-center gap-4 sm:flex">
            <span>{date}</span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <span>Bugünün Gazetesi</span>
          </div>
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

            <button
              onClick={onRefreshFeed}
              disabled={feedRefreshing}
              aria-label="Akışı yenile"
              title="Haberleri yenile"
              className={
                "inline-flex items-center transition hover:text-black dark:hover:text-white " +
                (feedRefreshing ? "cursor-wait text-blue-600 dark:text-blue-400" : "")
              }
            >
              <RefreshCw size={14} className={feedRefreshing ? "animate-spin" : ""} />
            </button>

            <AccountControl
              user={user}
              onOpenAuth={onOpenAuth}
              onLogout={onLogout}
              onForYou={onForYou}
              compact
            />

            <button
              onClick={onOpenPrefs}
              className="hidden items-center gap-1.5 font-semibold transition hover:text-black dark:hover:text-white sm:inline-flex"
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

      {/* Logo bloğu (yalnızca masaüstü; mobilde üstteki yapışkan bar var) */}
      <div className="mx-auto hidden max-w-[1280px] px-4 pt-3 pb-2 text-center sm:block">
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
            <h1 className="font-logo text-[2.5rem] leading-none text-black transition-opacity group-hover:opacity-80 dark:text-white sm:text-6xl md:text-7xl lg:text-8xl">
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
