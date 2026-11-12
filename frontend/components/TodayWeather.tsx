"use client";
// আবহাওয়া পাতার শুরুর "আজকের অবস্থা" কার্ড: এই মুহূর্তের তাপ, অনুভূত তাপ, আর্দ্রতা, বাতাস, আজকের সর্বোচ্চ-সর্বনিম্ন
// আর বৃষ্টির সম্ভাবনা। পেছনের রং আর ছোট animated দৃশ্য আসল অবস্থা (WMO কোড, দিন/রাত) অনুযায়ী বদলায়।
// animation শুধু SVG + CSS (.scene sc-*), "কম animation" সেটিং-এ থামে।
import { GIcon, type GIconName } from "@/components/garden-icons";
import { InfoTip } from "@/components/InfoTip";

export type Now = {
  time: string | null;
  temp: number | null;
  feels_like: number | null;
  humidity: number | null;
  rain_mm: number | null;
  code: number | null;
  cloud: number | null;
  wind: number | null;
  is_day: number | null;
  // আগামী ২ ঘণ্টায় বৃষ্টি (১৫ মিনিটের পূর্বাভাস): in_min = কত মিনিট পরে শুরু, না থাকলে null
  soon?: { in_min: number | null; total_mm: number; window_min: number } | null;
};
export type Day = { date: string; temp_max: number | null; temp_min: number | null; rain_mm: number | null; rain_prob: number | null };

type Kind = "sun" | "moon" | "partly" | "cloud" | "fog" | "rain" | "storm";

/** WMO আবহাওয়া কোড → ধরন আর বাংলা নাম */
function describe(code: number | null, day: boolean): { kind: Kind; text: string } {
  const c = code ?? -1;
  if (c === 0) return day ? { kind: "sun", text: "পরিষ্কার আকাশ, রোদ" } : { kind: "moon", text: "পরিষ্কার রাত" };
  if (c === 1) return day ? { kind: "sun", text: "প্রায় পরিষ্কার আকাশ" } : { kind: "moon", text: "প্রায় পরিষ্কার রাত" };
  if (c === 2) return { kind: day ? "partly" : "moon", text: "আংশিক মেঘলা" };
  if (c === 3) return { kind: "cloud", text: "মেঘলা আকাশ" };
  if (c === 45 || c === 48) return { kind: "fog", text: "কুয়াশা" };
  if (c >= 51 && c <= 57) return { kind: "rain", text: "গুঁড়ি গুঁড়ি বৃষ্টি" };
  if (c === 61 || c === 80) return { kind: "rain", text: "হালকা বৃষ্টি" };
  if (c === 63 || c === 81 || c === 66) return { kind: "rain", text: "বৃষ্টি" };
  if (c === 65 || c === 82 || c === 67) return { kind: "rain", text: "ভারী বৃষ্টি" };
  if (c >= 95) return { kind: "storm", text: "বজ্রসহ বৃষ্টি" };
  return { kind: day ? "partly" : "moon", text: "আবহাওয়া" };
}

const BG: Record<Kind, string> = {
  sun: "from-sky-400 via-sky-300 to-amber-200",
  partly: "from-sky-500 via-sky-400 to-sky-200",
  moon: "from-indigo-950 via-indigo-800 to-violet-700",
  cloud: "from-slate-500 via-slate-400 to-sky-300",
  fog: "from-slate-400 via-slate-300 to-slate-200",
  rain: "from-slate-700 via-sky-700 to-sky-500",
  storm: "from-slate-900 via-indigo-900 to-slate-700",
};

function Cloud({ x, y, s = 1, cls = "", fill = "rgba(255,255,255,0.95)" }: { x: number; y: number; s?: number; cls?: string; fill?: string }) {
  return (
    <g className={cls}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M10 30a12 12 0 0 1 2-24 16 16 0 0 1 30 2 11 11 0 0 1 4 22z" fill={fill} />
      </g>
    </g>
  );
}

function Art({ kind }: { kind: Kind }) {
  const sun = (cx: number, cy: number, r: number) => (
    <>
      <g className="sc-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={cx - 2} y={cy - r - 16} width="4" height="11" rx="2" fill="#fde68a" transform={`rotate(${i * 30} ${cx} ${cy})`} />
        ))}
      </g>
      <circle className="sc-pulse" cx={cx} cy={cy} r={r} fill="#fcd34d" />
      <circle cx={cx - r / 3} cy={cy - r / 3} r={r / 3.2} fill="#fef9c3" opacity="0.8" />
    </>
  );
  switch (kind) {
    case "sun":
      return sun(80, 66, 26);
    case "partly":
      return (
        <>
          {sun(92, 54, 22)}
          <Cloud x={30} y={66} s={1.25} cls="sc-drift" />
        </>
      );
    case "moon":
      return (
        <>
          {[[22, 30], [46, 18], [128, 26], [140, 64], [30, 92], [112, 100]].map(([x, y], i) => (
            <circle key={i} className="tw-star" cx={x} cy={y} r={i % 2 ? 1.6 : 2.2} fill="#fef9c3" style={{ animationDelay: `${i * 0.45}s` }} />
          ))}
          <g className="sc-bob">
            <circle cx="82" cy="62" r="26" fill="#fef3c7" />
            <circle cx="94" cy="54" r="22" fill="#4338ca" />
          </g>
          <Cloud x={52} y={86} s={0.9} cls="sc-drift-slow" fill="rgba(255,255,255,0.35)" />
        </>
      );
    case "cloud":
      return (
        <>
          <Cloud x={14} y={40} s={1.1} cls="sc-drift-slow" fill="rgba(255,255,255,0.7)" />
          <Cloud x={52} y={62} s={1.5} cls="sc-drift" />
        </>
      );
    case "fog":
      return (
        <>
          <Cloud x={40} y={26} s={1.2} cls="sc-drift-slow" fill="rgba(255,255,255,0.8)" />
          {[78, 92, 106].map((y, i) => (
            <rect key={y} className={i % 2 ? "sc-drift" : "sc-drift-slow"} x={16 + i * 6} y={y} width={120 - i * 10} height="6" rx="3" fill="rgba(255,255,255,0.75)" />
          ))}
        </>
      );
    case "rain":
    case "storm":
      return (
        <>
          <Cloud x={20} y={18} s={1.6} cls="sc-bob" fill={kind === "storm" ? "rgba(226,232,240,0.95)" : "rgba(255,255,255,0.95)"} />
          {kind === "storm" && <path className="sc-flash" d="M84 64l-12 22h11l-7 20 20-28H84l8-14z" fill="#fde047" />}
          {[34, 50, 66, 98, 114].map((x, i) => (
            <path key={x} className="sc-drop" d={`M${x} 70q3 6 0 9q-3-3 0-9z`} fill="#bae6fd" style={{ animationDelay: `${(i * 0.23) % 1.1}s` }} />
          ))}
        </>
      );
  }
}

const BN = "০১২৩৪৫৬৭৮৯";
const bn = (v: number | string) => String(v).replace(/\d/g, (d) => BN[Number(d)]);
const r0 = (v: number | null | undefined) => (v === null || v === undefined ? "–" : bn(Math.round(v)));

function clock(t: string | null) {
  if (!t) return "";
  const h = Number(t.slice(11, 13)), m = t.slice(14, 16);
  const part = h < 5 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকেল" : h < 20 ? "সন্ধ্যা" : "রাত";
  return `${part} ${bn(h % 12 || 12)}:${bn(m)}`;
}

/** ডিভাইসের ঘড়ি, ঢাকার সময়ে ("রাত ১০:১১") */
function clockMs(ms: number) {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
  return clock(`0000-00-00T${hm}`);
}

/** "এইমাত্র" / "৩ মিনিট আগে" */
function ago(ms: number) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "এইমাত্র" : `${bn(m)} মিনিট আগে`;
}

export default function TodayWeather({
  now,
  today,
  place,
  updatedAt,
  refreshing = false,
  onRefresh,
  clock: nowMs,
}: {
  now: Now | null;
  today: Day | undefined;
  place: string;
  updatedAt?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  clock?: number;
}) {
  const day = (now?.is_day ?? 1) === 1;
  const { kind, text } = describe(now?.code ?? null, day);
  const dark = kind === "moon" || kind === "rain" || kind === "storm" || kind === "cloud";
  const stats: { icon: GIconName; label: string; value: string }[] = [
    { icon: "thermo", label: "অনুভূত", value: `${r0(now?.feels_like)}°` },
    { icon: "water", label: "আর্দ্রতা", value: `${r0(now?.humidity)}%` },
    { icon: "wind", label: "বাতাস", value: `${r0(now?.wind)} কিমি/ঘ` },
    { icon: "rain", label: "আজ বৃষ্টির সম্ভাবনা", value: today?.rain_prob === null || today?.rain_prob === undefined ? "–" : `${bn(today.rain_prob)}%` },
  ];
  return (
    <section
      aria-label="আজকের আবহাওয়া"
      className={`today-in relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br ${BG[kind]} p-5 shadow-lg sm:p-6 ${dark ? "text-white" : "text-slate-900"}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/20 blur-2xl" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${dark ? "text-white/85" : "text-slate-700"}`}>
        <GIcon name="pin" className="h-4 w-4" /> {place}
        {(nowMs || now?.time) && (
          <span className={`font-normal ${dark ? "text-white/70" : "text-slate-600"}`}>· এখন {nowMs ? clockMs(nowMs) : clock(now!.time)}</span>
        )}
      </p>
      <div className="mt-2 flex items-end gap-3">
        <p className="text-6xl font-bold leading-none tracking-tight sm:text-7xl">{r0(now?.temp)}°</p>
        <div className="pb-1">
          <p className="text-lg font-bold">{text}</p>
          {today && (
            <p className={`text-sm ${dark ? "text-white/80" : "text-slate-700"}`}>
              আজ সর্বোচ্চ {r0(today.temp_max)}° · সর্বনিম্ন {r0(today.temp_min)}°
            </p>
          )}
        </div>
      </div>
      </div>
      {/* আবহাওয়ার ছবি নিজের জায়গায়, টাইলের উপর পড়ে না */}
      <svg viewBox="0 0 160 120" aria-hidden className="scene pointer-events-none h-24 w-32 shrink-0 sm:h-32 sm:w-44">
        <Art kind={kind} />
      </svg>
      </div>
      <ul className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s, i) => (
          <li
            key={s.label}
            style={{ animationDelay: `${150 + i * 90}ms` }}
            className={`today-stat rounded-2xl p-3 backdrop-blur-sm ${dark ? "bg-white/15 ring-1 ring-white/20" : "bg-white/55 ring-1 ring-white/70"}`}
          >
            <p className={`flex items-center gap-1 text-xs ${dark ? "text-white/80" : "text-slate-600"}`}>
              <GIcon name={s.icon} className="h-4 w-4" /> {s.label}
            </p>
            <p className="mt-0.5 text-lg font-bold">{s.value}</p>
          </li>
        ))}
      </ul>
      {/* হঠাৎ বৃষ্টি: আগামী ২ ঘণ্টার ১৫-মিনিটের পূর্বাভাসে বৃষ্টি থাকলে আগেভাগে জানানো */}
      {now?.soon && now.soon.in_min !== null && (
        <p className="relative mt-3 flex items-center gap-2 rounded-2xl bg-sky-100/90 px-3 py-2 text-sm font-semibold text-sky-900 ring-1 ring-sky-200">
          <GIcon name="rain" className="h-5 w-5 shrink-0" />
          {now.soon.in_min <= 0 ? "এখনই বৃষ্টি হতে পারে" : `প্রায় ${bn(now.soon.in_min)} মিনিটের মধ্যে বৃষ্টি হতে পারে`}
          {now.soon.total_mm > 0 && <span className="font-normal">(২ ঘণ্টায় ~{bn(now.soon.total_mm)} মিমি)</span>}
        </p>
      )}
      <div className={`relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${dark ? "text-white/70" : "text-slate-600"}`}>
        <InfoTip label="তথ্য কোথা থেকে" peek={false} tone={dark ? "text-white" : "text-slate-700"} sources={[{ title: "Open-Meteo: আবহাওয়ার পূর্বাভাস", url: "https://open-meteo.com/" }]}>
          মডেলভিত্তিক অনুমান, আপনার ছাদের সরাসরি মাপ নয়। এখনকার অবস্থা ১৫ মিনিট পরপর হালনাগাদ হয়; পাতা খোলা থাকলে ৫ মিনিট পরপর নতুন করে আনা হয়।
          {now?.time && <> শেষ মাপ: {clock(now.time)}।</>}
        </InfoTip>
        {updatedAt && nowMs && (
          <span className="ml-auto flex items-center gap-1.5">
            আপডেট: {ago(nowMs - updatedAt)}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="এখনই আবার আনুন"
                title="এখনই আবার আনুন"
                className={`rounded-full p-1 transition hover:bg-white/25 disabled:opacity-60 ${dark ? "" : "hover:bg-white/60"}`}
              >
                <GIcon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
          </span>
        )}
      </div>
    </section>
  );
}

export function TodayWeatherSkeleton() {
  return <div className="mb-6 h-56 animate-pulse rounded-3xl bg-gradient-to-br from-sky-100 to-green-100" />;
}
