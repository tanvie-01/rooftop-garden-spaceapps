"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { api, POT_CHOICES, SOIL_TYPES, SUN_CHOICES, type Plant } from "@/lib/garden";
import { CropIcon } from "@/components/crop-icons";
import { GIcon, IconText, ReasonText, type GIconName } from "@/components/garden-icons";
import { InfoTip, MoreInfo } from "@/components/InfoTip";
import { API, loadLocation } from "@/lib/location";
import PotGuide from "@/components/PotGuide";

type Level = "High" | "Medium" | "Low";
type Climate = { temp_c: number | null; rain_mm: number | null; sun_kwh: number | null; soil_wetness_pct: number | null; humidity_pct: number | null };
type CatalogCrop = { name: string; name_bn: string; category: string; perennial: boolean; family: string; family_bn: string };
type Suggestion = {
  name: string;
  name_bn: string;
  family_bn: string;
  plant_month_bn: string;
  plant_months: string;
  days_to_harvest: number;
  suitability: Level;
  reasons: string[];
  source: { title: string; url: string; pages: string | null } | null;
};
type Result = {
  months: { month: number; month_bn: string; climate: Climate | null; note: string }[];
  previous: { name_bn: string; family_bn: string }[];
  warnings: string[];
  suggestions: Suggestion[];
  avoid: { name: string; name_bn: string; family_bn: string; reason: string }[];
  nasa: boolean;
  sources: { title: string; url: string; note: string }[];
};

const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const SOILS = SOIL_TYPES.filter((s) => s.value);
const SOIL_AGE = [
  { value: "", label: "জানা নেই" },
  { value: "0", label: "নতুন মাটি (৬ মাসের কম)" },
  { value: "6", label: "প্রায় ৬ মাস" },
  { value: "12", label: "প্রায় ১ বছর" },
  { value: "24", label: "২ বছর বা বেশি" },
];
const LEVEL: Record<Level, { bn: string; cls: string }> = {
  High: { bn: "খুবই উপযোগী", cls: "bg-green-100 text-green-800 ring-green-200" },
  Medium: { bn: "উপযোগী", cls: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  Low: { bn: "কম উপযোগী", cls: "bg-red-50 text-red-700 ring-red-100" },
};
const REASON_STYLE: Record<string, string> = { "✓": "text-green-700", "✗": "text-red-700", "△": "text-amber-700" };
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

const noop = () => () => {};
const thisMonth = () => new Date().getMonth() + 1;

function nearest(choices: { value: number }[], v: number) {
  return choices.reduce((a, b) => (Math.abs(b.value - v) < Math.abs(a.value - v) ? b : a)).value;
}

function monthsSince(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth());
}

export default function RotationPage() {
  const auth = useAuth();
  const nowMonth = useSyncExternalStore(noop, thisMonth, () => 0);
  const [picked, setPicked] = useState<number | null>(null);
  const month = picked ?? nowMonth;
  const [catalog, setCatalog] = useState<CatalogCrop[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [fromPlant, setFromPlant] = useState("");
  const [last, setLast] = useState("");
  const [before, setBefore] = useState("");
  const [soil, setSoil] = useState("Loamy");
  const [pot, setPot] = useState(15);
  const [sun, setSun] = useState(6);
  const [soilAge, setSoilAge] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/rotation/crops`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCatalog)
      .catch(() => {});
  }, []);

  // লগইন থাকলে নিজের বাগানের টব থেকে ভরে নেওয়া যায় (আর্কাইভ করা গাছও, কারণ ওগুলোই "আগের ফসল")
  useEffect(() => {
    if (auth.status !== "in") return;
    api<Plant[]>("/plants?status=all")
      .then(setPlants)
      .catch(() => {});
  }, [auth.status]);

  const known = new Set(catalog.map((c) => c.name));
  const seasonal = catalog.filter((c) => !c.perennial);
  const myPlants = plants.filter((p) => known.has(p.name));

  function fillFromPlant(id: string) {
    setFromPlant(id);
    const p = myPlants.find((x) => String(x.id) === id);
    if (!p) return;
    // একই জায়গার (zone) অন্য গাছগুলো এই টবের আগের ফসল ধরা হয়, সবচেয়ে নতুন আগে
    const sameZone = p.zone
      ? myPlants
          .filter((x) => x.id !== p.id && x.zone === p.zone && (x.planted_on ?? "") <= (p.planted_on ?? ""))
          .sort((a, b) => (b.planted_on ?? "").localeCompare(a.planted_on ?? ""))
      : [];
    setLast(p.name);
    setBefore(sameZone[0]?.name ?? "");
    setPot(nearest(POT_CHOICES, p.pot_liters));
    if (p.sunlight_hours != null) setSun(nearest(SUN_CHOICES, p.sunlight_hours));
    if (p.soil_type) setSoil(p.soil_type);
    const oldest = [p, ...sameZone].map((x) => monthsSince(x.planted_on)).filter((m): m is number => m != null);
    setSoilAge(oldest.length ? String(nearest(SOIL_AGE.slice(1).map((s) => ({ value: Number(s.value) })), Math.max(...oldest))) : "");
  }

  async function suggest() {
    setError("");
    setLoading(true);
    try {
      const { lat, lon } = loadLocation();
      const previous = [last, before].filter((n, i, a) => n && a.indexOf(n) === i);
      const res = await fetch(`${API}/api/rotation/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previous, soil_type: soil, pot_liters: pot, sunlight_hours: sun, month: month || undefined,
          soil_age_months: soilAge === "" ? null : Number(soilAge), lat, lon,
        }),
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
  const cropOptions = (
    <>
      <option value="">নতুন টব / জানা নেই</option>
      {seasonal.map((c) => (
        <option key={c.name} value={c.name}>
          {c.name_bn} ({c.family_bn})
        </option>
      ))}
      {catalog.filter((c) => c.perennial).map((c) => (
        <option key={c.name} value={c.name}>
          {c.name_bn} (বহুবর্ষী)
        </option>
      ))}
    </>
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader
        icon="refresh"
        title="পরের ফসল কী লাগাবো"
        subtitle="টবে আগে কী ছিল দেখে পরের ফসল"
      />

      <div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
        <GIcon name="bulb" className="mr-1 h-4 w-4" /><b>কেন ঘোরাবেন?</b> একই গোত্রের ফসল (যেমন টমেটো → বেগুন → মরিচ) পরপর একই টবে লাগালে তাদের রোগ-পোকা মাটিতে
        থেকে যায় আর মাটির একই পুষ্টি বারবার খরচ হয়। তাই পরের বার অন্য গোত্রের ফসল লাগান।
      </div>

      <div className="grid gap-4 rounded-3xl border border-green-100 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        {myPlants.length > 0 && (
          <label className="text-sm font-medium text-gray-700 sm:col-span-2 lg:col-span-3">
            <IconText icon="home">আমার বাগানের একটা টব থেকে ভরে নিন</IconText>
            <select value={fromPlant} onChange={(e) => fillFromPlant(e.target.value)} className={input}>
              <option value="">বেছে নিন (না চাইলে নিচে নিজে দিন)</option>
              {myPlants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname || p.name_bn || p.name}
                  {p.zone ? ` · ${p.zone}` : ""}
                  {p.status === "archived" ? " (আর্কাইভ)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="sprout">এই টবে শেষ ফসল</IconText>
          <select value={last} onChange={(e) => setLast(e.target.value)} className={input}>
            {cropOptions}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="clock">তার আগে (জানলে)</IconText>
          <select value={before} onChange={(e) => setBefore(e.target.value)} className={input}>
            {cropOptions}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="calendar">কবে লাগাবেন</IconText>
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
          <span className="flex items-center gap-1"><IconText icon="pot">টবের আকার</IconText><PotGuide value={pot} onPick={setPot} /></span>
          <select value={pot} onChange={(e) => setPot(Number(e.target.value))} className={input}>
            {POT_CHOICES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          <IconText icon="sun">দৈনিক রোদ</IconText>
          <select value={sun} onChange={(e) => setSun(Number(e.target.value))} className={input}>
            {SUN_CHOICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
          <IconText icon="clock">টবের মাটি কত পুরোনো</IconText>
          <select value={soilAge} onChange={(e) => setSoilAge(e.target.value)} className={input}>
            {SOIL_AGE.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={suggest}
          disabled={loading || !month}
          className="self-end rounded-full bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:opacity-50 sm:col-span-2 lg:col-span-1"
        >
          {loading ? "হিসাব হচ্ছে..." : "পরের ফসল দেখান"}
        </button>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"><GIcon name="warning" className="mr-1 h-4 w-4" />{error}</p>}

      {data && (
        <div className="mt-8 space-y-6">
          {/* NASA জলবায়ু */}
          <section className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5">
            <h2 className="text-lg font-bold text-indigo-950"><GIcon name="satellite" className="mr-1.5 h-5 w-5" />লাগানোর মাসগুলোতে আপনার এলাকার আবহাওয়া{" "}
              <InfoTip label="NASA-র এই তথ্য কী" hint="NASA POWER, ২৫ বছরের গড়" tone="text-indigo-700" sources={[{ title: "NASA POWER Climatology API", url: "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/" }]}>
                NASA POWER-এর ২০০১-২০২৫ সালের মাসিক গড় (স্যাটেলাইট ও মডেলভিত্তিক)। এটা খোলা মাঠের হিসাব, টবের মাটি এর চেয়ে দ্রুত শুকায়। এলাকা বদলাতে আবহাওয়া পাতার মানচিত্রে জায়গা বাছুন।
              </InfoTip>
            </h2>
            {data.nasa ? (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {data.months.map((m, i) => {
                    // একই কথা বারবার নয়: আগের মাসের মতো হলে আর লেখা হয় না
                    const newNote = m.note && m.note !== data.months[i - 1]?.note;
                    const c = m.climate;
                    const stats: { icon: GIconName; tint: string; value: string; label: string }[] = c
                      ? [
                          ...(c.temp_c != null ? [{ icon: "thermo" as const, tint: "text-orange-500 bg-orange-50", value: `${bn(c.temp_c)}°`, label: "গড় তাপ" }] : []),
                          ...(c.rain_mm != null ? [{ icon: "rain" as const, tint: "text-sky-600 bg-sky-50", value: `${bn(c.rain_mm)}`, label: "বৃষ্টি, মিমি" }] : []),
                          ...(c.sun_kwh != null ? [{ icon: "sun" as const, tint: "text-amber-500 bg-amber-50", value: `${bn(c.sun_kwh)}`, label: "রোদ, kWh" }] : []),
                          ...(c.soil_wetness_pct != null ? [{ icon: "water" as const, tint: "text-teal-600 bg-teal-50", value: `${bn(c.soil_wetness_pct)}%`, label: "মাটির ভেজা" }] : []),
                        ]
                      : [];
                    return (
                      <div key={m.month} className="rounded-3xl border border-white bg-white p-4 shadow-sm">
                        <p className="flex items-center gap-2 text-lg font-bold text-indigo-950">
                          <GIcon name="calendar" className="h-5 w-5 text-indigo-500" />
                          {m.month_bn}
                        </p>
                        {stats.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {stats.map((s) => (
                              <div key={s.label} className="flex items-center gap-2 rounded-2xl bg-gray-50/80 p-2.5">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
                                  <GIcon name={s.icon} className="h-5 w-5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-lg font-bold leading-tight text-gray-900">{s.value}</span>
                                  <span className="block truncate text-xs text-gray-500">{s.label}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {newNote && <p className="mt-3 rounded-2xl bg-indigo-50/70 px-3 py-2 text-sm leading-relaxed text-indigo-900">{m.note}</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-600">NASA-র তথ্য এখন আনা যায়নি; বাকি সাজেশন ঠিক আছে।</p>
            )}
          </section>

          {data.warnings.length > 0 && (
            <section className="space-y-2">
              {data.warnings.map((w) => (
                <p key={w} className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <GIcon name="warning" className="mr-1.5 h-4 w-4" />{w}
                </p>
              ))}
            </section>
          )}

          <section>
            <h2 className="text-xl font-bold text-green-900">
              <GIcon name="check" className="mr-1.5 h-5 w-5" />পরের ফসল হিসেবে ভালো
              {data.previous[0] && <span className="text-base font-normal text-gray-600"> (আগে ছিল {data.previous[0].name_bn}, {data.previous[0].family_bn})</span>}
            </h2>
            {data.suggestions.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">এই মাসগুলোতে লাগানোর মতো মৌসুমি ফসল পাওয়া যায়নি। অন্য মাস বেছে দেখুন।</p>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {data.suggestions.map((s) => (
                  <article key={s.name} className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold text-green-900">
                          <CropIcon name={s.name} className="mr-1 h-6 w-6" /> {s.name_bn}
                        </h3>
                        <p className="flex flex-wrap items-center gap-x-1 text-xs text-gray-500">
                          {s.family_bn} · লাগান {s.plant_month_bn} · ফসল ~{bn(s.days_to_harvest)} দিনে
                          {s.source && (
                            <InfoTip
                              label="লাগানোর মাসের উৎস"
                              peek={false}
                              sources={[{ title: `${s.source.title}${s.source.pages ? `, পৃষ্ঠা ${s.source.pages}` : ""}`, url: s.source.url }]}
                            />
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${LEVEL[s.suitability].cls}`}>
                        {LEVEL[s.suitability].bn}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {s.reasons.map((r) => (
                        <li key={r} className={REASON_STYLE[r[0]] ?? "text-gray-700"}>
                          <ReasonText text={r} />
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>

          {data.avoid.length > 0 && (
            <section className="rounded-3xl border border-red-100 bg-red-50/50 p-5">
              <h2 className="text-lg font-bold text-red-900"><GIcon name="ban" className="mr-1.5 h-5 w-5" />এই টবে এখন লাগাবেন না</h2>
              <ul className="mt-2 space-y-2 text-sm text-red-900">
                {data.avoid.map((a) => (
                  <li key={a.name}>
                    <CropIcon name={a.name} className="mr-1 h-5 w-5" /> <b>{a.name_bn}</b>: {a.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <MoreInfo title="উৎস" sources={data.sources.map((s) => ({ title: `${s.title}: ${s.note}`, url: s.url }))} />
        </div>
      )}
    </main>
  );
}
