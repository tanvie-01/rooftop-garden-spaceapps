"use client";
// রোগ ডায়েরি আর পোকা চেনোর খোঁজার ঘর + ধরনের বোতাম, উপরের মেনুর মতো glass ক্যাপসুলে।
// বাছা ধরনের পেছনে সবুজ অংশটা সরে সরে যায় (Navbar-এর Dock-এর মতো)।
// নিচে স্ক্রল করলে (হেডার গুটানোর সাথে একই সময়ে) খোঁজার ঘর সরু হয় আর ধরনের সারি তার পাশে উঠে এক লাইনে বসে;
// উপরে ফিরলে আবার দুই লাইনে খোলে। গতি হেডারের মতোই ধীর ও নরম (০.৭৫ সেকেন্ড, ease-in-out)।
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GIcon } from "@/components/garden-icons";

const EASE = "duration-[750ms] ease-[cubic-bezier(0.65,0,0.35,1)]";

/** হেডারের মতো একই সীমা (৯০/৩০ px), যেন দুটো একসাথে গুটায় */
function useScrolledPast() {
  const [past, setPast] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const y = window.scrollY;
      setPast((c) => (c ? y > 30 : y > 90));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return past;
}

export default function FilterBar({
  query,
  onQuery,
  placeholder,
  searchLabel,
  groups,
  group,
  onGroup,
  allLabel,
  groupsLabel,
  extra,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  searchLabel: string;
  groups: string[];
  group: string;
  onGroup: (g: string) => void;
  allLabel: string;
  groupsLabel: string;
  /** খোঁজার ঘরের পাশে বাড়তি কিছু (যেমন পোকার পাতায় ফসল বাছাই) */
  extra?: React.ReactNode;
}) {
  const compact = useScrolledPast();
  const all = ["", ...groups];
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // সবুজ অংশটা বাছা বোতামের মাপে; বোতামের মাপ বদলায় (ফন্ট, সারি সরানো), তাই ResizeObserver
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.children[all.indexOf(group) + 1] as HTMLElement | undefined; // [0] = সবুজ অংশ নিজে
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const el = list.children[all.indexOf(group) + 1] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "nearest", block: "nearest" });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(list);
    document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all গ্রুপ থেকে বানানো
  }, [group, groups.join("|"), compact]);

  return (
    <div
      data-filter-compact={compact ? "" : undefined}
      className={`sticky top-[calc(var(--hdr-h,8rem)+0.25rem)] z-10 -mx-4 px-4 py-2 sm:mx-0 sm:px-0 transition-[padding] ${EASE}`}
    >
      <div
        className={`flex flex-wrap items-center gap-2 rounded-[1.75rem] border border-white/80 bg-white/85 p-1.5 shadow-[0_6px_18px_-8px_rgba(20,83,45,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition-all ${EASE}`}
      >
        <label
          className={`relative block min-w-0 transition-all ${EASE} ${compact ? "w-[42%] sm:w-72" : "w-full sm:w-auto sm:flex-1"}`}
        >
          <span className="sr-only">{searchLabel}</span>
          <span aria-hidden className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-green-700 transition-all ${EASE} ${compact ? "left-3" : "left-4"}`}>
            <GIcon name="search" className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className={`w-full truncate rounded-full border border-green-100 bg-white/90 pr-4 shadow-sm outline-none transition-all ${EASE} focus:border-green-400 focus:bg-white ${
              compact ? "py-1.5 pl-9 text-sm" : "py-2.5 pl-12 text-base"
            }`}
          />
        </label>
        {/* ফোনে গুটালে বাড়তি ঘর (ফসল বাছাই) সরে যায়, ধরনের বোতামগুলো জায়গা পায়; উপরে ফিরলে আবার আসে */}
        {extra && (
          <div
            aria-hidden={compact || undefined}
            className={`filter-extra min-w-0 transition-all ${EASE} ${
              compact ? "-mr-2 w-0 overflow-hidden opacity-0 sm:mr-0 sm:w-40 sm:overflow-visible sm:opacity-100" : "w-full sm:w-56"
            }`}
          >
            {extra}
          </div>
        )}

        {/* ধরনের সারি: খোলা অবস্থায় নিচের লাইনে পুরো চওড়ায়, গুটালে খোঁজার পাশে বাকি জায়গায় */}
        <div
          key={compact ? "c" : "e"}
          className={`filter-row no-scrollbar dock-fade min-w-0 overflow-x-auto ${compact ? "flex-1" : "basis-full"}`}
        >
          <div ref={listRef} role="group" aria-label={groupsLabel} className="relative flex w-max items-center gap-0.5">
            {pill && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 rounded-full bg-gradient-to-b from-emerald-500 to-green-600 shadow-[0_6px_16px_-4px_rgba(22,101,52,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition-[left,width] duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
                style={{ left: pill.left, width: pill.width }}
              />
            )}
            {all.map((g) => {
              const on = group === g;
              return (
                <button
                  key={g || "all"}
                  type="button"
                  onClick={() => onGroup(g)}
                  aria-pressed={on}
                  className={`relative z-10 shrink-0 whitespace-nowrap rounded-full font-medium transition-colors duration-200 ${
                    compact ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-2 text-sm"
                  } ${on ? `text-white ${pill ? "" : "bg-green-600"}` : "text-gray-600 hover:bg-white/80 hover:text-green-800"}`}
                >
                  {g || allLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
