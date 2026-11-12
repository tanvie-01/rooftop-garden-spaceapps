"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { POT_CHOICES as POTS, SOIL_TYPES, SUN_CHOICES as SUN } from "@/lib/garden";
import { CropIcon } from "@/components/crop-icons";
import { GIcon, IconText, ReasonText, type GIconName } from "@/components/garden-icons";
import { InfoTip, MoreInfo } from "@/components/InfoTip";
import { API } from "@/lib/location";
import PotGuide from "@/components/PotGuide";

type Level = "High" | "Medium" | "Low";
type Crop = {
  name: string;
  name_bn: string;
  suitability: Level;
  reasons: string[];
  plant_months: string;
  perennial: boolean;
};
type Data = {
  season: string;
  month_bn: string | null;
  recommendations: { flowers: Crop[]; fruits: Crop[]; vegetables: Crop[] };
};
type Mini = { name: string; name_bn: string };
type Overview = {
  month: number;
  month_bn: string;
  season_name: string;
  season_months: string;
  season_note: string;
  plantable: { vegetables: Mini[]; fruits: Mini[]; flowers: Mini[] };
  plantable_count: number;
  soils: { soil_type: string; name_bn: string; crops: number }[];
  soil_tip: string;
};
type Guide = {
  name: string;
  name_bn: string;
  category_bn: string;
  perennial: boolean;
  planting_time: string;
  harvest_time: string;
  growth: string;
  sunlight: string;
  pot: string;
  water: string;
  soils: string[];
  temperature: string;
  soil_prep: string;
  fertilizer: string[];
  planting: string;
  spacing: string;
  irrigation: string;
  pests: string[];
  tips: string[];
  disclaimer: string;
  source: { title: string; pages: string | null; note: string; url: string } | null;
  fertilizer_sources: { title: string; url: string }[];
};

const CATS = ["vegetables", "fruits", "flowers"] as const;
const bnNum = (n: number) => n.toLocaleString("bn-BD");
const TITLES: Record<string, string> = { vegetables: "সবজি", fruits: "ফল", flowers: "ফুল" };
const TITLE_ICON: Record<string, GIconName> = { vegetables: "leaf", fruits: "harvest", flowers: "flower" };
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const SOILS = SOIL_TYPES.filter((s) => s.value);
const WATER = [
  { value: "daily", label: "প্রতিদিন" },
  { value: "alternate", label: "একদিন পরপর" },
  { value: "weekly", label: "সপ্তাহে ২-৩ বার" },
];
const LEVEL: Record<Level, { bn: string; en: string; cls: string }> = {
  High: { bn: "খুবই উপযোগী", en: "Highly Suitable", cls: "bg-green-100 text-green-800 ring-green-200" },
  Medium: { bn: "উপযোগী", en: "Suitable", cls: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  Low: { bn: "কম উপযোগী", en: "Less Suitable", cls: "bg-red-50 text-red-700 ring-red-100" },
};
// কারণের শুরুর চিহ্ন (✓ মিলেছে, ✗ মেলেনি, △ আংশিক) অনুযায়ী রং
const REASON_STYLE: Record<string, string> = { "✓": "text-green-700", "✗": "text-red-700", "△": "text-amber-700" };

// সার্ভারে মাস জানা নেই (0), ব্রাউজারে এই মাস; তাই hydration-এ অমিল হয় না
const noop = () => () => {};
const thisMonth = () => new Date().getMonth() + 1;

export default function CropsPage() {
  const auth = useAuth();
  const nowMonth = useSyncExternalStore(noop, thisMonth, () => 0);
  const [picked, setPicked] = useState<number | null>(null);
  const month = picked ?? nowMonth;
  const [soil, setSoil] = useState("Loamy");
  const [pot, setPot] = useState(15);
  const [sun, setSun] = useState(6);
  const [water, setWater] = useState("daily");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Crop | null>(null);
  const closeGuide = useCallback(() => setOpen(null), []);

  // মাস বদলালে সেই মাসের সারাংশ (লগইন লাগে না)
  useEffect(() => {
    if (!month) return;
    const ctrl = new AbortController();
    fetch(`${API}/api/crops/month?month=${month}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOverview(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [month]);

  async function recommend() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/crops/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soil_type: soil, pot_liters: pot, sunlight_hours: sun, water, month: month || undefined }),
      });
      if (!res.ok) throw new Error("ইনপুট ঠিক নেই");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "সাজেশন আনা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-green-200 bg-white p-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200";
  const loggedIn = auth.status === "in";

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader
        icon="leaf"
        title="স্মার্ট ফসল পরামর্শ"
        subtitle="আপনার ছাদে কোন ফসল মানাবে"
      />

      <p className="mb-4 text-sm text-gray-600">
        টবে আগে কোনো ফসল ছিল?{" "}
        <Link href="/rotation" className="font-semibold text-green-700 underline">
          <IconText icon="refresh">পরের ফসল কী লাগাবো দেখুন</IconText>
        </Link>
      </p>

      {/* বাছাই */}
      <div className="grid gap-4 rounded-3xl border border-green-100 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="calendar">মাস</IconText>
          <select value={month || ""} onChange={(e) => setPicked(Number(e.target.value))} className={input}>
            {!month && <option value="">...</option>}
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
                {i + 1 === nowMonth ? " (এই মাস)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <span className="flex items-center gap-1"><IconText icon="soil">মাটির ধরন</IconText><InfoTip label="মিশ্রণ ব্যবহার করুন?" peek={false}>দোআঁশ মাটির সাথে গোবর/ভার্মিকম্পোস্ট আর কোকোপিট মেশানো থাকলে, বা নার্সারির রেডি মিক্স হলে “টবের মিশ্রণ” বেছে নিন। <a href="/soil#mix" className="font-semibold text-green-700 underline">উপাদান চিনুন</a></InfoTip></span>
          <select value={soil} onChange={(e) => setSoil(e.target.value)} className={input}>
            {SOILS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <span className="flex items-center gap-1"><IconText icon="pot">টবের আকার</IconText><PotGuide value={pot} onPick={setPot} /></span>
          <select value={pot} onChange={(e) => setPot(Number(e.target.value))} className={input}>
            {POTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="sun">দৈনিক রোদ</IconText>
          <select value={sun} onChange={(e) => setSun(Number(e.target.value))} className={input}>
            {SUN.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="water">পানি দিতে পারবেন</IconText>
          <select value={water} onChange={(e) => setWater(e.target.value)} className={input}>
            {WATER.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={recommend}
          disabled={loading || !month}
          className="self-end rounded-full bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "খোঁজা হচ্ছে..." : "ফসল সাজেস্ট করুন"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}

      {/* মাসের সারাংশ */}
      {overview ? <MonthOverview o={overview} /> : <div className="mt-6 h-48 animate-pulse rounded-3xl bg-green-50" />}

      {/* সুপারিশ */}
      {data && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-green-900">
            আপনার জন্য সেরা ফসল ({data.month_bn}){" "}
            <InfoTip label="কীভাবে বাছা হয়" hint="নিয়মভিত্তিক পরামর্শ">মাস, টব, রোদ, পানি আর মাটি মিলিয়ে নিয়মভিত্তিক পরামর্শ। জাত ও এলাকাভেদে লাগানোর সময় কিছুটা আগে-পরে হতে পারে।</InfoTip>
          </h2>
          {auth.status === "out" ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-900">
                <b>বিস্তারিত চাষ নির্দেশিকা চান?</b> লগইন করলে প্রতিটা ফসলের সার, পানি, দূরত্ব, রোগ-পোকা আর ফসল তোলার সময়
                দেখতে পাবেন।
              </p>
              <Link
                href="/login?next=/crops"
                className="shrink-0 rounded-full bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-green-700"
              >
                Gmail দিয়ে লগইন
              </Link>
            </div>
          ) : (
            loggedIn && (
              <p className="mt-2 text-sm text-gray-600">যেকোনো ফসলের <b>বিস্তারিত</b> চাপলে পুরো চাষ নির্দেশিকা দেখবেন।</p>
            )
          )}

          {CATS.map((cat) => (
            <div key={cat} className="mt-6">
              <h3 className="text-xl font-bold text-green-900"><IconText icon={TITLE_ICON[cat]}>{TITLES[cat]}</IconText></h3>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                {data.recommendations[cat].map((c) => (
                  <CropCard key={c.name} c={c} auth={auth.status} onDetails={() => setOpen(c)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {open && <GuideDialog crop={open} onClose={closeGuide} />}
    </main>
  );
}

function MonthOverview({ o }: { o: Overview }) {
  const max = Math.max(1, ...o.soils.map((s) => s.crops));
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-green-100 bg-green-50 px-6 py-4">
        <h2 className="text-xl font-bold text-green-900"><IconText icon="calendar">{o.month_bn}</IconText></h2>
        <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">{o.season_name}</span>
        <span className="text-xs text-gray-500">{o.season_months}</span>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm text-gray-700"><GIcon name="cloudSun" className="mr-1.5 h-4 w-4 text-green-700" />{o.season_note}</p>
          <p className="mt-4 text-sm font-semibold text-green-900">এই মাসে লাগানো যায় ({bnNum(o.plantable_count)}টি)</p>
          <div className="mt-2 space-y-2">
            {CATS.map((cat) =>
              o.plantable[cat].length ? (
                <div key={cat} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-xs text-gray-500">{TITLES[cat]}</span>
                  {o.plantable[cat].map((c) => (
                    <span key={c.name} className="rounded-full bg-green-50 px-2.5 py-1 text-sm text-green-900 ring-1 ring-green-100">
                      <CropIcon name={c.name} className="mr-1 h-4 w-4" /> {c.name_bn}
                    </span>
                  ))}
                </div>
              ) : null,
            )}
            {o.plantable_count === 0 && <p className="text-sm text-gray-500">এই মাসে নতুন করে লাগানোর মতো ফসল তালিকায় নেই।</p>}
          </div>
        </div>
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold text-green-900">
            উপযুক্ত মাটি <InfoTip label="টবের মাটির টিপস">{o.soil_tip}</InfoTip>
          </p>
          <ul className="mt-2 space-y-2">
            {o.soils.map((s) => (
              <li key={s.soil_type} className="text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>{s.name_bn}</span>
                  <span className="text-xs text-gray-500">{bnNum(s.crops)}টি ফসলে মানায়</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${(s.crops / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CropCard({ c, auth, onDetails }: { c: Crop; auth: "loading" | "in" | "out"; onDetails: () => void }) {
  const lv = LEVEL[c.suitability];
  return (
    <div className="flex flex-col rounded-2xl border border-green-100 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-50" aria-hidden>
          <CropIcon name={c.name} className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight text-green-900">{c.name_bn}</p>
          <p className="text-xs text-gray-500">
            {c.name}
            {c.perennial && " · বহুবর্ষী"}
          </p>
        </div>
      </div>
      <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${lv.cls}`}>
        {lv.bn} <span className="font-normal opacity-70">· {lv.en}</span>
      </span>
      <ul className="mt-3 space-y-1 text-sm">
        {c.reasons.map((r) => (
          <li key={r} className={REASON_STYLE[r[0]] ?? "text-gray-600"}>
            <ReasonText text={r} />
          </li>
        ))}
      </ul>
      <p className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
        <GIcon name="calendar" className="h-3.5 w-3.5" />লাগানোর সময়: {c.plant_months}
      </p>
      <div className="mt-auto pt-4">
        {auth === "in" ? (
          <button
            onClick={onDetails}
            className="w-full rounded-full border border-green-600 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-600 hover:text-white"
          >
            <IconText icon="book">বিস্তারিত চাষ নির্দেশিকা</IconText>
          </button>
        ) : auth === "out" ? (
          <Link
            href="/login?next=/crops"
            className="flex w-full items-center justify-center gap-1 rounded-full bg-gray-50 py-2 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
          >
            <GIcon name="lock" className="h-4 w-4" /> লগইন করে বিস্তারিত দেখুন
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function GuideDialog({ crop, onClose }: { crop: Crop; onClose: () => void }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const ctrl = new AbortController();
    fetch(`${API}/api/crops/guide/${encodeURIComponent(crop.name)}`, { credentials: "include", signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 401) throw new Error("লগইনের মেয়াদ শেষ, আবার লগইন করুন।");
        if (!r.ok) throw new Error("নির্দেশিকা আনা যায়নি।");
        setGuide(await r.json());
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    return () => {
      document.removeEventListener("keydown", onKey);
      ctrl.abort();
    };
  }, [crop.name, onClose]);

  const facts = guide
    ? [
        { icon: "calendar" as GIconName, label: "লাগানোর সময়", value: guide.planting_time },
        { icon: "basket" as GIconName, label: "ফসল তোলা", value: guide.harvest_time },
        { icon: "sun" as GIconName, label: "রোদ", value: guide.sunlight },
        { icon: "water" as GIconName, label: "পানি", value: guide.water },
        { icon: "pot" as GIconName, label: "টব", value: guide.pot },
        { icon: "thermo" as GIconName, label: "তাপমাত্রা", value: guide.temperature },
        { icon: "soil" as GIconName, label: "উপযুক্ত মাটি", value: guide.soils.join(", ") },
        { icon: "clock" as GIconName, label: "বৃদ্ধির সময়", value: guide.growth },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4 text-white">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/90" aria-hidden>
            <CropIcon name={crop.name} className="h-10 w-10" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="guide-title" className="text-xl font-bold">
              {crop.name_bn} চাষ নির্দেশিকা
            </h2>
            <p className="text-sm text-green-50">
              {crop.name} · {LEVEL[crop.suitability].bn}
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="বন্ধ করুন" className="rounded-full px-3 py-1 text-2xl hover:bg-white/20">
            <GIcon name="x" className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
          {!guide && !error && <div className="h-64 animate-pulse rounded-2xl bg-green-50" />}
          {guide && (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                {facts.map((f) => (
                  <div key={f.label} className="rounded-2xl bg-green-50 p-3">
                    <dt className="text-xs font-semibold text-green-700">
                      <IconText icon={f.icon}>{f.label}</IconText>
                    </dt>
                    <dd className="mt-1 text-sm text-gray-800">{f.value}</dd>
                  </div>
                ))}
              </dl>

              <GuideSection icon="soil" title="মাটি প্রস্তুতি">
                <p>{guide.soil_prep}</p>
              </GuideSection>
              <GuideSection icon="leaf" title="সার: কতটুকু ও কখন">
                <ul className="list-disc space-y-1 pl-5">
                  {guide.fertilizer.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </GuideSection>
              <GuideSection icon="sprout" title="রোপণ পদ্ধতি ও দূরত্ব">
                <p>{guide.planting}</p>
                <p className="mt-1"><GIcon name="ruler" className="mr-1.5 h-4 w-4 text-green-700" />{guide.spacing}</p>
              </GuideSection>
              <GuideSection icon="can" title="সেচ">
                <p>{guide.irrigation}</p>
              </GuideSection>
              <GuideSection icon="bug" title="রোগ ও পোকা">
                <ul className="list-disc space-y-1 pl-5">
                  {guide.pests.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </GuideSection>
              {guide.tips.length > 0 && (
                <GuideSection icon="bulb" title="আরও কিছু কথা">
                  <ul className="list-disc space-y-1 pl-5">
                    {guide.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </GuideSection>
              )}
              <MoreInfo
                title="উৎস ও সতর্কতা"
                items={[
                  guide.source ? `লাগানোর সময়: ${guide.source.note}` : "এই ফসলের লাগানোর সময় এখনো সরকারি উৎস দিয়ে যাচাই করা হয়নি।",
                  guide.disclaimer,
                ]}
                sources={[
                  ...(guide.source
                    ? [{ title: `${guide.source.title}${guide.source.pages ? `, পৃষ্ঠা ${guide.source.pages}` : ""}`, url: guide.source.url }]
                    : []),
                  ...guide.fertilizer_sources.map((f) => ({ title: `সার: ${f.title}`, url: f.url })),
                ]}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GuideSection({ icon, title, children }: { icon: GIconName; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="font-semibold text-green-900">
        <IconText icon={icon} iconClass="h-5 w-5 text-green-700">{title}</IconText>
      </h3>
      <div className="mt-1 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}
