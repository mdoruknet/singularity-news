/* Ana sayfa kart türleri — manşet, sütun, ızgara, editör seçimi, boş durum, Bana Özel afişi. */

import { Clock, Settings, Sparkles } from "lucide-react";
import { Kicker, Byline } from "./ui.jsx";
import { onImgError } from "../lib/utils.js";

export function LeadStory({ article, onOpen }) {
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

export function ColumnStory({ article, onOpen, withImage = false }) {
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

export function GridCard({ article, onOpen }) {
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

export function EditorsPick({ articles, onOpen }) {
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

export function EmptyState({ onOpenPrefs }) {
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

export function ForYouBanner({ user }) {
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
