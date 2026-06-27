/* Logonun altındaki dinamik kategori barı (Tümü, kategoriler, Köşe Yazarları). */

import { Sparkles, Feather } from "lucide-react";
import { FOR_YOU } from "../lib/constants.js";

export function CategoryBar({
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
