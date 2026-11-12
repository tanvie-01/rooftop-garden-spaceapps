"use client";
// পাতা পরিষ্কার রাখার নিয়ম: প্রযুক্তিগত ব্যাখ্যা, হিসাবের নিয়ম আর উৎস সরাসরি লেখা হয় না।
// - InfoTip: শিরোনামের পাশে ছোট ⓘ; চাপলে glass বাক্সে ব্যাখ্যা/উৎস।
// - MoreInfo: অংশের নিচে ভাঁজ করা "উৎস ও বিস্তারিত" তালিকা।
// উৎস কখনো মুছে ফেলা হয় না, শুধু এক ক্লিক দূরে থাকে।
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GIcon } from "@/components/garden-icons";

export type Src = { title: string; url?: string | null };

const GLASS =
  "border border-white/80 bg-gradient-to-br from-white/[0.97] to-white/90 backdrop-blur-xl " +
  "shadow-[0_16px_40px_-12px_rgba(20,83,45,0.4),inset_0_1px_0_rgba(255,255,255,0.9)]";

function SourceLinks({ sources }: { sources: Src[] }) {
  return (
    <ul className="mt-2 space-y-1 border-t border-green-100 pt-2">
      {sources.map((s) => (
        <li key={s.title} className="flex gap-1.5">
          <GIcon name="book" className="mt-0.5 h-3.5 w-3.5 text-green-700" />
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">
              {s.title}
            </a>
          ) : (
            <span>{s.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** ছোট ⓘ বোতাম; চাপলে ব্যাখ্যা আর (থাকলে) উৎস। বাইরে চাপলে বা Esc-এ বন্ধ।
 *  YouTube-এর ⓘ-এর মতো: প্রথমবার চোখে পড়লে এক লাইনের লেখা (hint, না দিলে label) একটু দেখায়,
 *  তারপর গুটিয়ে শুধু ⓘ থাকে। peek={false} দিলে দেখায় না (একই পাতায় অনেকগুলো হলে)। */
export function InfoTip({
  label = "কীভাবে হিসাব হয়",
  hint,
  peek = true,
  children,
  sources,
  align = "left",
  tone = "text-green-700",
}: {
  label?: string;
  hint?: string;
  peek?: boolean;
  children?: React.ReactNode;
  sources?: Src[];
  align?: "left" | "right";
  tone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; above: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const id = useId();

  // বাক্সটা পাতার সবার উপরে (portal) আঁকা হয়, ⓘ-এর নিচে, পর্দার ভেতরে আটকে রেখে;
  // কার্ডের ভেতরে আঁকলে পাশের জিনিস উপরে উঠে আসত আর কিনারা পেরিয়ে যেত
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const width = Math.min(304, window.innerWidth - 24);
    const want = align === "right" ? r.right - width : r.left;
    setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(want, window.innerWidth - width - 12)), width, above: r.top - 8 });
  }, [open, align]);

  // নিচে জায়গা না থাকলে ⓘ-এর উপরে খোলা
  useLayoutEffect(() => {
    const h = pop.current?.offsetHeight;
    if (!pos || !h) return;
    if (pos.top + h > window.innerHeight - 8 && pos.above - h > 8) setPos({ ...pos, top: pos.above - h });
  }, [pos]);

  // প্রথমবার পর্দায় এলে ~১.৮ সেকেন্ড লেখাটা দেখান, তারপর গুটিয়ে ফেলুন
  useEffect(() => {
    if (!peek || !box.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        timer = setTimeout(() => {
          setPeeking(true);
          timer = setTimeout(() => setPeeking(false), 1800);
        }, 600);
      },
      { threshold: 1 },
    );
    io.observe(box.current);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [peek]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    // ভেতরের কোনো অংশ (তালিকা, কার্ড) স্ক্রল করলেও বন্ধ; scroll event উপরে ওঠে না, তাই capture দিয়ে শোনা
    const onScroll = (e: Event) => {
      if (!pop.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away as unknown as EventListener, { passive: true });
    document.addEventListener("keydown", esc);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away as unknown as EventListener);
      document.removeEventListener("keydown", esc);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // খোলা বাক্স ৮ সেকেন্ড পরে নিজেই বন্ধ হয়; মাউস বা আঙুল বাক্সের উপর থাকলে অপেক্ষা করে
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (!open || hold) return;
    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, [open, hold]);

  return (
    <span ref={box} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => {
          setPeeking(false);
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        // ফোনে লেখা ছড়ালে পাশের জিনিস সরে যায়, তাই সেখানে শুধু ⓘ-এর চারপাশে আলো (জায়গা নেয় না);
        // after: আঙুলে চাপার জায়গা বড় করে, layout বদলায় না
        className={`relative inline-flex items-center rounded-full p-0.5 text-xs font-medium transition-all duration-500 ease-out after:absolute after:-inset-2.5 hover:opacity-100 focus:opacity-100 ${tone} ${
          peeking ? "bg-green-50 opacity-100 shadow-sm ring-2 ring-green-200 sm:pl-1.5 sm:pr-2.5 sm:ring-1 sm:ring-green-100" : "opacity-60"
        }`}
      >
        <GIcon name="info" className="h-4 w-4" />
        <span
          aria-hidden
          className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-out max-sm:hidden ${
            peeking ? "ml-1 max-w-[16rem] opacity-100" : "ml-0 max-w-0 opacity-0"
          }`}
        >
          {hint ?? label}
        </span>
      </button>
      {open &&
        pos &&
        createPortal(
          <span
            ref={pop}
            id={id}
            role="note"
            onMouseEnter={() => setHold(true)}
            onMouseLeave={() => setHold(false)}
            onTouchStart={() => setHold(true)}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className={`glass-in fixed z-[80] block rounded-2xl p-3 text-left text-xs font-normal leading-relaxed text-gray-700 ${GLASS}`}
          >
            <span className="mb-1 block font-semibold text-green-900">{label}</span>
            {children}
            {sources && sources.length > 0 && <SourceLinks sources={sources} />}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** অংশের নিচে ভাঁজ করা "উৎস ও বিস্তারিত"। */
export function MoreInfo({ items = [], sources = [], title = "উৎস ও বিস্তারিত" }: { items?: React.ReactNode[]; sources?: Src[]; title?: string }) {
  if (!items.length && !sources.length) return null;
  return (
    <details className="group mt-4 rounded-2xl bg-green-50/70 px-4 py-2.5 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-green-800">
        <GIcon name="info" className="h-4 w-4" />
        {title}
        <span className="ml-auto text-gray-400 transition group-open:rotate-180">▾</span>
      </summary>
      {items.length > 0 && (
        <ul className="mt-2 list-disc space-y-1.5 pl-6 text-xs leading-relaxed text-gray-600 marker:text-green-600">
          {items.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {sources.length > 0 && (
        <div className="text-xs text-gray-600">
          <SourceLinks sources={sources} />
        </div>
      )}
    </details>
  );
}
