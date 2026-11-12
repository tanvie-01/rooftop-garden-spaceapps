"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import LogoMark from "@/components/LogoMark";
import { logout, useAuth, type User } from "@/lib/auth";

// সব পাতা "Rooftop Garden"-এর নিচে মাঝখানে একটা glass capsule-এ; লগইনের পরেও এক ক্লিকে যাওয়া যায়
// (আগে লগইন করলে জায়গা কমে মেনু ☰-এর ভেতরে চলে যেত)। বাছা পাতার পেছনের সবুজ অংশটা সরে সরে যায়।
// also: একই প্যানেলের অন্য পাতাগুলোতেও এই বোতাম সবুজ থাকে (সুস্থ বাগান = রোগ ডায়েরি + পোকা + জৈব সার + ঘরোয়া পদ্ধতি)
const links: { href: string; label: string; icon: IconName; also?: string[] }[] = [
  { href: "/dashboard", label: "আমার বাগান", icon: "garden" },
  { href: "/weather", label: "আবহাওয়া", icon: "weather" },
  { href: "/soil", label: "মাটি", icon: "soil" },
  { href: "/crops", label: "ফসল", icon: "crops" },
  { href: "/rotation", label: "পরের ফসল", icon: "rotation" },
  { href: "/disease", label: "সুস্থ বাগান", icon: "diary", also: ["/pests", "/fertilizer", "/remedies"] },
  { href: "/plan", label: "পরিকল্পনা", icon: "plan" },
  { href: "/community", label: "কমিউনিটি", icon: "community" },
  { href: "/chat", label: "AI সহকারী", icon: "ai" },
];

// mobile: ফোনে পাতার সারি পর্দার নিচে ভাসমান glass বারে (উপরে জায়গা খায় না, বুড়ো আঙুলের নাগালে)
function Dock({ pathname, mobile = false }: { pathname: string | null; mobile?: boolean }) {
  const under = (href: string) => pathname === href || !!pathname?.startsWith(`${href}/`);
  const isActive = (href: string) => under(href) || !!links.find((l) => l.href === href)?.also?.some(under);
  // চাপার সাথে সাথেই সবুজ অংশ নতুন পাতায় সরে যায়; পাতা লোড হওয়ার অপেক্ষা নয়
  const [clicked, setClicked] = useState<{ href: string; from: string | null } | null>(null);
  const routeIdx = links.findIndex((l) => isActive(l.href));
  const pending = clicked && clicked.from === pathname ? links.findIndex((l) => l.href === clicked.href) : -1;
  const activeIdx = pending >= 0 ? pending : routeIdx;
  const listRef = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // সবুজ অংশটা বাছা পাতার মাপে বসানো; ছোট পর্দায় বাছা পাতাটা মাঝখানে স্ক্রল করে আনা
  useLayoutEffect(() => {
    const measure = () => {
      const el = activeIdx >= 0 ? (listRef.current?.children[activeIdx] as HTMLElement | undefined) : undefined;
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const el = activeIdx >= 0 ? (listRef.current?.children[activeIdx] as HTMLElement | undefined) : undefined;
    el?.scrollIntoView({ inline: "center", block: "nearest" });
    window.addEventListener("resize", measure);
    // হেডার গুটালে বোতামগুলো ঘন হয় (padding বদলায়), তাই তালিকার মাপ বদলালেও সবুজ অংশ নতুন করে বসে
    const ro = typeof ResizeObserver !== "undefined" && listRef.current ? new ResizeObserver(measure) : null;
    if (ro && listRef.current) ro.observe(listRef.current);
    document.fonts?.ready.then(measure); // বাংলা ফন্ট লোড হলে লেখার মাপ বদলায়
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [activeIdx]);

  return (
    <div
      className={
        mobile
          ? "dock-up fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[max(10px,env(safe-area-inset-bottom))]"
          : "dock-wrap flex justify-center px-3 pb-[var(--dock-pb,12px)] transition-[padding] duration-[750ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
      }
    >
      <div
        className={`${mobile ? "" : "dock-in hdr-capsule"} no-scrollbar dock-fade max-w-full overflow-x-auto rounded-full border border-white/80 p-1 backdrop-blur-xl ${
          mobile
            ? "bg-white/80 shadow-[0_10px_30px_-8px_rgba(20,83,45,0.4),inset_0_1px_0_rgba(255,255,255,0.9)]"
            : "bg-white/60 shadow-[0_4px_14px_-6px_rgba(20,83,45,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]"
        }`}
      >
        <ul ref={listRef} className="relative flex w-max items-center gap-0.5">
          {links.map((l, i) => {
            const active = i === activeIdx;
            return (
              <li key={l.href} className="dock-item relative z-10" style={{ animationDelay: `${180 + i * 40}ms` }}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setClicked({ href: l.href, from: pathname })}
                  className={`flex items-center whitespace-nowrap rounded-full font-medium transition-colors duration-200 ${
                    mobile ? "flex-col gap-0.5 px-3 py-1.5 text-[11px]" : "gap-1.5 px-3.5 py-2 text-sm"
                  } ${
                    active
                      ? `text-white ${pill ? "" : "bg-green-600"}`
                      : "text-gray-600 hover:bg-white/80 hover:text-green-800 hover:[text-shadow:0_0_0.7px_currentColor,0_0_0.7px_currentColor]"
                  }`}
                >
                  <Icon name={l.icon} className={`${mobile ? "h-5 w-5" : "h-4 w-4"} shrink-0`} />
                  {l.label}
                </Link>
              </li>
            );
          })}
          {pill && (
            <li
              aria-hidden
              className="pointer-events-none absolute inset-y-0 rounded-full bg-gradient-to-b from-emerald-500 to-green-600 shadow-[0_6px_16px_-4px_rgba(22,101,52,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition-[left,width] duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
              style={{ left: pill.left, width: pill.width }}
            />
          )}
        </ul>
      </div>
    </div>
  );
}

function ActiveDock({ mobile }: { mobile?: boolean }) {
  return <Dock pathname={usePathname()} mobile={mobile} />;
}

// cacheComponents চালু থাকায় usePathname() Suspense-এর ভেতরে থাকতে হয়।
// পাতার সারি শুধু লগইনের পরে; তখন উপর থেকে নেমে খুলে যায় (আগে থেকে পড়ে থাকে না)।
// compact: নিচে স্ক্রল করলে মেনুর সারিটা উপরে উঠে লোগো আর অ্যাকাউন্টের মাঝখানে বসে (এক সারির হেডার)
function NavDock({ mobile = false, compact = false }: { mobile?: boolean; compact?: boolean }) {
  const auth = useAuth();
  if (auth.status !== "in") return null;
  return (
    <nav
      aria-label="পাতাগুলো"
      className={
        mobile
          ? "sm:hidden"
          : `relative z-30 hidden transition-[margin] duration-[750ms] ease-[cubic-bezier(0.65,0,0.35,1)] sm:block ${compact ? "-mt-[50px]" : "mt-0"}`
      }
    >
      <Suspense fallback={<Dock pathname={null} mobile={mobile} />}>
        <ActiveDock mobile={mobile} />
      </Suspense>
    </nav>
  );
}

// হেডার গুটানো/খোলার একই ধীর, নরম গতি (শুরু আর শেষ আস্তে)। লেখা গুটানোর সময় আগে মিলিয়ে যায়
// (মেনু উঠে আসার আগেই), আর খোলার সময় জায়গা খোলার পরে ধীরে ফুটে ওঠে, যেন কখনো একটার উপর আরেকটা না পড়ে।
const HDR_EASE = "cubic-bezier(0.65,0,0.35,1)";
const fadeStyle = (compact: boolean): React.CSSProperties => ({
  transition: compact
    ? `max-width 750ms ${HDR_EASE}, max-height 750ms ${HDR_EASE}, margin 750ms ${HDR_EASE}, transform 750ms ${HDR_EASE}, opacity 280ms ease-out`
    : `max-width 750ms ${HDR_EASE}, max-height 750ms ${HDR_EASE}, margin 750ms ${HDR_EASE}, transform 750ms ${HDR_EASE}, opacity 420ms ease-in 330ms`,
});

function Avatar({ user, size }: { user: User; size: number }) {
  return user.picture ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
    <img src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" className="rounded-full" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // বাইরে ক্লিক বা Esc চাপলে মেনু বন্ধ
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (auth.status === "loading") return <span className="block h-9 w-9 animate-pulse rounded-full bg-green-100" />;
  if (auth.status === "out") {
    // লগইনের আগে মেনু থাকে না, তাই নিয়মের পাতাটা লগইন বোতামের ঠিক নিচে
    return (
      <div className="flex flex-col items-end gap-1">
        <Link
          href="/login"
          className="flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-green-600/30 transition hover:bg-green-700"
        >
          <Icon name="login" /> লগইন
        </Link>
        <Link href="/guide" className="grad-border flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-green-800 shadow-sm transition hover:shadow-md">
          <Icon name="diary" className="h-3.5 w-3.5 text-green-600" /> ব্যবহারের নিয়ম
        </Link>
      </div>
    );
  }

  const u = auth.user;
  async function signOut() {
    setLeaving(true);
    await logout();
    setLeaving(false);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="অ্যাকাউন্ট মেনু"
        title={compact ? u.name : undefined}
        className={`flex items-center rounded-full border py-1 pl-1 transition-all duration-[750ms] ease-[cubic-bezier(0.65,0,0.35,1)] ${
          compact ? "gap-0 pr-1" : "gap-2 pr-3"
        } ${open ? "border-green-400 bg-green-50" : "border-green-100 bg-white hover:border-green-300"}`}
      >
        <Avatar user={u} size={30} />
        {/* নাম আর তীর ছোট হয়ে ছবির ভেতরে ঢুকে যায় (compact), আবার বেরিয়ে আসে */}
        <span
          aria-hidden={compact}
          style={fadeStyle(compact)}
          className={`flex items-center gap-2 overflow-hidden whitespace-nowrap ${
            compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[11rem] translate-x-0 opacity-100"
          }`}
        >
          <span className="font-brand max-w-[8rem] truncate text-sm font-semibold text-green-900">{u.name}</span>
          <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-xl shadow-green-900/10">
          <div className="flex items-center gap-3 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
            <Avatar user={u} size={40} />
            <div className="min-w-0">
              <p className="font-brand brand-gradient truncate text-base font-bold">{u.name}</p>
              <p className="truncate text-xs text-gray-500">{u.email}</p>
            </div>
          </div>
          <div className="p-2">
            <Link
              href="/guide"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-green-50"
            >
              <Icon name="diary" className="h-4 w-4 text-green-700" /> ব্যবহারের নিয়ম
            </Link>
            <button
              role="menuitem"
              onClick={signOut}
              disabled={leaving}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <Icon name="logout" /> {leaving ? "লগআউট হচ্ছে..." : "লগআউট"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// "Garden"-এর অক্ষরে লোগোর মতো সবুজ থেকে লেবু-সবুজ (অক্ষর আলাদা ঘোরে, তাই gradient অক্ষর-প্রতি রঙে)
const LOGO: [string, string][] = [
  ..."Rooftop".split("").map((c) => [c, "#14532d"] as [string, string]),
  [" ", ""],
  ...["#15803d", "#0f9a55", "#10b981", "#34b95f", "#5cc23b", "#84cc16"].map((c, i) => ["Garden"[i], c] as [string, string]),
];

// প্রতিটা অক্ষরের গোড়া থেকে আলাদা লতা গজায়, পাতা মেলে অক্ষরটা ঢেকে ফেলে; সব ঢাকা হলে অক্ষরগুলো
// ঝাঁকি দিয়ে ঘুরে নিজেদের ছাড়িয়ে নেয়, লতা ঝরে যায়, আবার শুরু (১২ সেকেন্ডে এক পাক, globals.css)
const VINE_START = 1500;
function LetterVine({ i }: { i: number }) {
  const d = VINE_START + i * 160; // বাঁ থেকে ডানে একটার পর একটা অক্ষরে
  const flip = i % 2 ? -1 : 1;
  return (
    <svg aria-hidden viewBox="0 0 12 24" preserveAspectRatio="none" className="vines pointer-events-none absolute inset-x-0 bottom-0 h-full w-full">
      <g transform={flip < 0 ? "matrix(-1 0 0 1 12 0)" : undefined}>
        <g transform="translate(3 17)">
          <path className="vine-leaf" d="M0 0C1.3 -2.6 4.4 -3.2 5.8 -2C4.4 .7 2 1.2 0 0Z" fill="#16a34a" style={{ animationDelay: `${d + 250}ms` }} />
        </g>
        <g transform="translate(9 12) scale(-1 1)">
          <path className="vine-leaf" d="M0 0C1.3 -2.6 4.4 -3.2 5.8 -2C4.4 .7 2 1.2 0 0Z" fill="#4ade80" style={{ animationDelay: `${d + 450}ms` }} />
        </g>
        <g transform="translate(4 7)">
          <path className="vine-leaf" d="M0 0C1 -2 3.4 -2.6 4.6 -1.5C3.4 .6 1.5 .9 0 0Z" fill="#22c55e" style={{ animationDelay: `${d + 650}ms` }} />
        </g>
      </g>
    </svg>
  );
}

/** নিচে নামলে হেডার এক সারিতে গুটিয়ে যায়, উপরে ফিরলে আবার খোলে। দুই সীমা আলাদা (৯০/৩০ px),
 *  যেন সীমার কাছে থামলে বারবার লাফ না দেয়। scroll শোনা হয় requestAnimationFrame দিয়ে, হালকা। */
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const y = window.scrollY;
      setCompact((c) => (c ? y > 30 : y > 90));
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
  return compact;
}

export default function Navbar() {
  const compact = useCompact();
  // হেডার আবার খুললে (উপরে ফিরলে) টব থেকে চারা গজানো আর অক্ষর উল্টে আসা আবার চলে; key বদলালে
  // অংশটা নতুন করে বসে আর CSS animation শুরু থেকে চলে। নিচে স্ক্রল করা অবস্থায় refresh করলে
  // প্রথম animation লুকানো অবস্থায় শেষ হয়ে যেত, তাই এটা দরকার।
  const [replay, setReplay] = useState(0);
  const wasCompact = useRef(false);
  useEffect(() => {
    if (wasCompact.current && !compact) setReplay((n) => n + 1);
    wasCompact.current = compact;
  }, [compact]);
  const headerRef = useRef<HTMLElement>(null);

  // হেডারের আসল উচ্চতা CSS-এ (--hdr-h): পাতার sticky খোঁজার ঘর/ট্যাব এর ঠিক নিচে লেগে থাকে,
  // হেডার গুটালে তারাও উপরে উঠে আসে। animation চলাকালীনও মাপ বদলায়, তাই ResizeObserver।
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const set = () => document.documentElement.style.setProperty("--hdr-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => ro.disconnect();
  }, []);

  return (
    <>
    <header
      ref={headerRef}
      data-compact={compact ? "" : undefined}
      style={{ ["--dock-pb" as string]: compact ? "6px" : "12px" }}
      className="sticky top-0 z-50 rounded-b-[1.75rem] border-b border-white/60 bg-gradient-to-b from-white/85 to-green-50/55 shadow-[0_8px_24px_-18px_rgba(20,83,45,0.35)] backdrop-blur-xl"
    >
      <div
        className={`relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 transition-[padding] duration-[750ms] ease-[cubic-bezier(0.65,0,0.35,1)] ${
          compact ? "py-2" : "py-3"
        }`}
      >
        <Link href="/" aria-label="Rooftop Garden" className="group flex items-center">
          <LogoMark
            key={`logo-${replay}`}
            className={`drop-shadow-[0_6px_10px_rgba(22,101,52,0.35)] transition-all duration-[750ms] ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:-rotate-6 ${compact ? "h-9 w-9" : "h-10 w-10"}`}
          />
          {/* লেখাটা সরু হয়ে লোগোর ভেতরে মিলিয়ে যায় (compact), উপরে ফিরলে আবার বেরিয়ে আসে */}
          <span
            style={fadeStyle(compact)}
            className={`font-brand flex flex-col overflow-hidden leading-none ${
              compact
                ? "ml-0 max-h-9 max-w-0 -translate-x-3 scale-90 opacity-0"
                : "ml-2.5 max-h-16 max-w-[260px] translate-x-0 scale-100 opacity-100"
            }`}
          >
            <span className="relative">
            <span key={`name-${replay}`} className="logo-flip text-[22px] font-bold" aria-label="Rooftop Garden">
              {LOGO.map(([ch, color], i) => (
                <span key={i} aria-hidden className="relative" style={{ color, animationDelay: `${i * 55}ms, ${VINE_START + i * 40}ms` }}>
                  {ch === " " ? " " : ch}
                  {ch !== " " && <LetterVine i={i} />}
                </span>
              ))}
            </span>
            </span>
            <span className="mt-1 hidden text-[11px] font-medium tracking-wide text-green-700/70 sm:block">ছাদবাগানের স্মার্ট সহকারী</span>
          </span>
        </Link>
        <div className="hidden sm:block">
          <UserMenu compact={compact} />
        </div>
        <div className="sm:hidden">
          <UserMenu compact />
        </div>
      </div>
      <NavDock compact={compact} />
      {/* মেনুর ঠিক নিচে নরম ঝাপসা কিনারা, হঠাৎ কাটা দাগ নয় */}
      <div aria-hidden className="menu-blur-edge pointer-events-none absolute inset-x-0 top-full h-6" />
    </header>
    <NavDock mobile />
    </>
  );
}
