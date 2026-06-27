/* Paylaşılan küçük UI parçaları — kicker etiketi, künye (byline), yazar avatarı
   ve hesap kontrolü (giriş / "Bana Özel" / çıkış). */

import { useState } from "react";
import { SlidersHorizontal, Bot, User, LogOut } from "lucide-react";
import { initials } from "../lib/utils.js";

export function Kicker({ children, className = "" }) {
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

export function Byline({ article, className = "" }) {
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
export function Avatar({ src, name, size = 56, className = "" }) {
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

export function AccountControl({ user, onOpenAuth, onLogout, onForYou, compact = false }) {
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
