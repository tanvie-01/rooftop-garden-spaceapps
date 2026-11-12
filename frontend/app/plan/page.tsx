"use client";
import { useState } from "react";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import PotGuide from "@/components/PotGuide";
import { POT_CHOICES, SOIL_TYPES, SUN_CHOICES, api, errorText, type Plant } from "@/lib/garden";
import { CropIcon } from "@/components/crop-icons";
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { InfoTip, MoreInfo } from "@/components/InfoTip";
import { API, areaLabel, useGardenLocation } from "@/lib/location";

type Item = { name: string; name_bn: string; category: string; pot?: string; existing?: boolean };
type MonthPlan = {
  index: number;
  month: number;
  month_bn: string;
  year: number;
  climate: { avg_temp: number; rain_mm: number };
  plant: Item[];
  harvest: Item[];
  watering: string;
  fertilize: string[];
  prune: string;
  tips: string[];
};
type Plan = {
  crops: Item[];
  current_crops: Item[];
  months: MonthPlan[];
  notes: string[];
};
// একই রকম কয়েকটা টব; current থাকলে টবে এখন সেই গাছ আছে ("আমার বাগান" থেকে আনা)
type Group = {
  id: number;
  count: number;
  pot: number;
  soil: string;
  sun: number;
  current?: string;
  current_bn?: string;
  planted_on?: string | null;
};

const SOILS = SOIL_TYPES.filter((s) => s.value);
const MAX_POTS = 20;
// backend-এর plan.POT_LETTERS-এর সাথে মিল রেখে
const LETTERS = "ক খ গ ঘ ঙ চ ছ জ ঝ ঞ ট ঠ ড ঢ ণ ত থ দ ধ ন".split(" ");
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bn = (n: number) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
const nearest = (v: number, list: { value: number }[]) =>
  list.reduce((a, b) => (Math.abs(b.value - v) < Math.abs(a.value - v) ? b : a)).value;
let nextId = 1;
const newGroup = (g: Partial<Group> = {}): Group => ({ id: nextId++, count: 1, pot: 15, soil: "Loamy", sun: 6, ...g });

// একই ফসল কয়েকটা টবে থাকলে একবার দেখিয়ে সংখ্যা আর টবের অক্ষর বসানো হয় (যেমন "জিনিয়া ×২ · ক")
function grouped(items: Item[]) {
  const out: (Item & { n: number; pots: string[] })[] = [];
  for (const it of items) {
    const found = out.find((o) => o.name === it.name && !!o.existing === !!it.existing);
    if (found) {
      found.n += 1;
      if (it.pot && !found.pots.includes(it.pot)) found.pots.push(it.pot);
    } else out.push({ ...it, n: 1, pots: it.pot ? [it.pot] : [] });
  }
  return out;
}

function Chips({ items, cls }: { items: Item[]; cls: string }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {grouped(items).map((c) => (
        <span key={c.name + (c.existing ? "-now" : "")} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm ${cls}`}>
          <CropIcon name={c.name} className="h-4 w-4" /> {c.name_bn}
          {c.n > 1 && ` ×${bn(c.n)}`}
          {c.existing && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">চলতি</span>}
        </span>
      ))}
    </span>
  );
}

const MONTH_SHORT = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
type Cell = "plant" | "grow" | "harvest" | null;

/** প্রতিটা ফসলের ১২ মাসের অবস্থা: লাগানো, বাড়ছে, নাকি তোলার সময়। মাসওয়ারি plant/harvest থেকেই হিসাব। */
function yearGrid(plan: Plan) {
  const now = new Set(plan.current_crops.map((c) => c.name));
  const rows = [...plan.current_crops, ...plan.crops.filter((c) => !now.has(c.name))];
  return rows.map((c) => {
    const has = (list: Item[]) => list.some((x) => x.name === c.name);
    const cells: Cell[] = plan.months.map((m) => (has(m.harvest) ? "harvest" : has(m.plant) ? "plant" : null));
    // টবে আগে থেকে থাকা গাছ: প্রথম তোলার আগ পর্যন্ত "বাড়ছে"
    if (now.has(c.name)) for (let j = 0; j < cells.length && cells[j] === null; j++) cells[j] = "grow";
    // লাগানোর পর প্রথম ফসল তোলা পর্যন্ত (বা বছরের শেষ পর্যন্ত) "বাড়ছে"
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== "plant") continue;
      for (let j = i + 1; j < cells.length && cells[j] === null; j++) cells[j] = "grow";
    }
    return { crop: c, cells, existing: now.has(c.name) };
  });
}

const CELL_STYLE: Record<Exclude<Cell, null>, string> = {
  plant: "bg-green-600",
  grow: "bg-green-200",
  harvest: "bg-amber-400",
};

function YearCalendar({ plan }: { plan: Plan }) {
  const rows = yearGrid(plan);
  return (
    <section className="mt-6 rounded-3xl border border-green-100 bg-white px-3 py-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-0">
        <h2 className="text-xl font-bold text-green-900"><IconText icon="calendar">বছরের ক্যালেন্ডার</IconText></h2>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          {[
            ["bg-green-600", "লাগান"],
            ["bg-green-200", "বাড়ছে"],
            ["bg-amber-400", "তুলুন"],
          ].map(([cls, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${cls}`} /> {label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-y-1.5 text-[10px] sm:min-w-[560px] sm:text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="sticky left-0 z-10 w-8 bg-white text-left font-medium sm:w-28" />
              {plan.months.map((m) => (
                <th key={m.index} className={`font-medium ${m.index === 0 ? "text-green-700" : ""}`}>
                  {MONTH_SHORT[m.month - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ crop, cells, existing }) => (
              <tr key={crop.name}>
                {/* ফোনে শুধু আইকন, যেন পুরো বছর এক স্ক্রিনে ধরে */}
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white pr-1 text-sm text-gray-800 sm:pr-2" title={crop.name_bn}>
                  <CropIcon name={crop.name} className="h-5 w-5" />
                  <span className="hidden sm:inline">
                    {" "}
                    {crop.name_bn}
                    {existing && <span className="text-xs text-amber-700"> · চলতি</span>}
                  </span>
                </td>
                {cells.map((c, i) => (
                  <td key={i} className="px-px sm:px-0.5">
                    <div
                      className={`h-5 ${c ? CELL_STYLE[c] : "bg-gray-50"} ${
                        c && cells[i - 1] !== c ? "rounded-l-md" : ""
                      } ${c && cells[i + 1] !== c ? "rounded-r-md" : ""} ${!c ? "rounded-lg" : ""}`}
                      title={c ? { plant: "লাগান", grow: "বাড়ছে", harvest: "তুলুন" }[c] : ""}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// লাগান/তুলুন আলাদা ছোট টেবিলে: প্রতি সারিতে একটা ফসল, কোন টবে, কয়টা
function CropTable({ title, items, tone }: { title: React.ReactNode; items: Item[]; tone: "green" | "amber" }) {
  const box = tone === "green" ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900";
  const line = tone === "green" ? "divide-green-100" : "divide-amber-100";
  return (
    <div className={`rounded-2xl p-3 text-sm ${box}`}>
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="pb-1.5 font-bold">{title}</th>
            <th className="w-14 pb-1.5 text-center text-xs font-medium opacity-70">টব</th>
            <th className="w-12 pb-1.5 text-right text-xs font-medium opacity-70">কয়টা</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${line}`}>
          {grouped(items).map((c) => (
            <tr key={c.name + (c.existing ? "-now" : "")}>
              <td className="py-1.5">
                <CropIcon name={c.name} className="mr-1 h-4 w-4" /> {c.name_bn}
                {c.existing && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">চলতি</span>}
              </td>
              <td className="py-1.5 text-center">
                {c.pots.length > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-green-800">{c.pots.join(", ")}</span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{bn(c.n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthCard({ m }: { m: MonthPlan }) {
  const care = [
    ...m.fertilize.map((t) => ({ icon: "leaf" as GIconName, t })),
    ...(m.prune ? [{ icon: "scissors" as GIconName, t: m.prune }] : []),
    ...m.tips.map((t) => ({ icon: "bulb" as GIconName, t })),
  ];
  const now = m.index === 0;
  return (
    <div className={`flex flex-col rounded-3xl border bg-white p-5 shadow-sm ${now ? "border-green-500 ring-2 ring-green-100" : "border-green-100"}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-green-900">
          {m.month_bn} <span className="font-normal text-gray-400">{bn(m.year)}</span>
          {now && <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 align-middle text-xs font-semibold text-white">এই মাস</span>}
        </h3>
        <div className="flex shrink-0 gap-1 text-xs">
          <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700"><GIcon name="thermo" className="h-3.5 w-3.5" /> {bn(m.climate.avg_temp)}°</span>
          <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700"><GIcon name="rain" className="h-3.5 w-3.5" /> {bn(m.climate.rain_mm)} মিমি</span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {m.plant.length > 0 && <CropTable title={<IconText icon="sprout" iconClass="h-4 w-4">লাগান</IconText>} items={m.plant} tone="green" />}
        {m.harvest.length > 0 && <CropTable title={<IconText icon="basket" iconClass="h-4 w-4">তুলুন</IconText>} items={m.harvest} tone="amber" />}
        {!m.plant.length && !m.harvest.length && (
          <p className="rounded-2xl bg-gray-50 p-2.5 text-sm text-gray-500">নতুন কিছু লাগানো বা তোলা নেই, চলতি গাছের যত্ন নিন।</p>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-700"><GIcon name="water" className="mr-1 h-4 w-4 text-sky-600" />{m.watering}</p>

      {care.length > 0 && (
        <details className="group mt-auto pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-green-700">
            এই মাসের যত্ন ({bn(care.length)})
            <span className="text-xs transition group-open:rotate-180">▾</span>
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
            {care.map((c) => (
              <li key={c.t} className="flex gap-2">
                <GIcon name={c.icon} className="mt-0.5 h-4 w-4 text-green-700" />
                <span>{c.t}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const sel =
  "w-full rounded-xl border border-green-200 bg-white p-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-500";

/** একটা টব-দলের সারি: কয়টা, কত বড়, কোন মাটি, কত রোদ */
function GroupRow({
  g,
  letter,
  onChange,
  onRemove,
}: {
  g: Group;
  letter: string;
  onChange: (g: Group) => void;
  onRemove?: () => void;
}) {
  const set = (patch: Partial<Group>) => onChange({ ...g, ...patch });
  const planted = g.planted_on
    ? new Date(g.planted_on + "T00:00:00").toLocaleDateString("bn-BD", { day: "numeric", month: "short" })
    : null;
  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/40 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">{letter}</span>
        {g.current ? (
          <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
            এখন আছে: <b><CropIcon name={g.current} className="h-4 w-4" /> {g.current_bn}</b>
            {planted && <span className="text-gray-500"> · লাগানো {planted}</span>}
          </p>
        ) : (
          <p className="flex flex-1 items-center gap-1.5 text-sm font-medium text-gray-700">
            টব-দল {letter}
            <PotGuide value={g.pot} onPick={(v) => set({ pot: v })} />
          </p>
        )}
        {onRemove && (
          <button onClick={onRemove} aria-label={`টব-দল ${letter} সরান`} className="rounded-full px-2 text-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
            <GIcon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* ফোনে সংখ্যা ও মাটি পাশাপাশি, আকার ও রোদের লম্বা লেখা পুরো চওড়ায় */}
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <select value={g.count} onChange={(e) => set({ count: Number(e.target.value) })} disabled={!!g.current} className={sel} aria-label="টবের সংখ্যা">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {bn(n)}টি টব
            </option>
          ))}
        </select>
        <select value={g.soil} onChange={(e) => set({ soil: e.target.value })} className={sel} aria-label="মাটির ধরন">
          {SOILS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={g.pot} onChange={(e) => set({ pot: Number(e.target.value) })} className={`${sel} col-span-2 lg:col-span-1`} aria-label="টবের আকার">
          {POT_CHOICES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select value={g.sun} onChange={(e) => set({ sun: Number(e.target.value) })} className={`${sel} col-span-2 lg:col-span-1`} aria-label="দৈনিক রোদ">
          {SUN_CHOICES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PlanView() {
  const [groups, setGroups] = useState<Group[]>(() => [newGroup({ count: 3 })]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const loc = useGardenLocation();
  const total = groups.reduce((s, g) => s + g.count, 0);

  async function importGarden() {
    setError("");
    setInfo("");
    setImporting(true);
    try {
      const plants = await api<Plant[]>("/plants");
      if (!plants.length) {
        setInfo("আমার বাগানে এখনো কোনো গাছ নেই। নিচে নিজে টব-দল যোগ করুন, অথবা আগে আমার বাগানে গাছ যোগ করুন।");
        return;
      }
      // প্রতিটা গাছ একটা টব; আকার আর রোদ সবচেয়ে কাছের বাছাইয়ে, মাটি জানা না থাকলে দোআঁশ
      const imported = plants.slice(0, MAX_POTS).map((p) =>
        newGroup({
          pot: nearest(p.pot_liters, POT_CHOICES),
          soil: p.soil_type || "Loamy",
          sun: p.sunlight_hours == null ? 6 : nearest(p.sunlight_hours, SUN_CHOICES),
          current: p.name,
          current_bn: p.nickname || p.name_bn || p.name,
          planted_on: p.planted_on,
        }),
      );
      setGroups(imported);
      setInfo(
        `আমার বাগান থেকে ${bn(imported.length)}টি টব আনা হয়েছে।` +
          (plants.length > MAX_POTS ? ` (সর্বোচ্চ ${bn(MAX_POTS)}টি)` : "") +
          " খালি টব থাকলে নিচে আরেকটা টব-দল যোগ করুন।",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setImporting(false);
    }
  }

  async function generate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/plan/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: groups.map((g) => ({
            count: g.count,
            pot_liters: g.pot,
            soil_type: g.soil,
            sunlight_hours: g.sun,
            current: g.current,
            current_bn: g.current_bn,
            planted_on: g.planted_on || undefined,
          })),
          lat: loc.lat,
          lon: loc.lon,
        }),
      });
      if (!res.ok) throw new Error("ইনপুট ঠিক নেই");
      setPlan(await res.json());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "পরিকল্পনা তৈরি করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  const harvestMonths = plan ? plan.months.filter((m) => m.harvest.length).length : 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader
        icon="calendar"
        title="১ বছরের বাগান পরিকল্পনা"
        subtitle="মাসে মাসে কী লাগাবেন, কী তুলবেন"
      />

      {/* টব-দল */}
      <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-800"><GIcon name="pin" className="mr-1 h-4 w-4" />{areaLabel(loc)}</span>
          <InfoTip label="কীভাবে হিসাব হয়" hint="২০ বছরের আবহাওয়া ধরে">এই এলাকার গত ২০ বছরের আবহাওয়া আর ফসলের সূত্রসহ লাগানোর মাস ধরে পরিকল্পনা হয়।</InfoTip>
          <Link href="/weather" className="text-green-700 underline">
            বদলান
          </Link>
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-green-900">
            আপনার টবগুলো <span className="text-sm font-normal text-gray-500">(মোট {bn(total)}টি)</span>{" "}
            <InfoTip label="টব-দল" hint="একই রকম টব এক দলে">একই রকম টবগুলো এক দলে রাখুন; আকার, মাটি বা রোদ আলাদা হলে আলাদা দল বানান।</InfoTip>
          </h2>
          <button
            onClick={importGarden}
            disabled={importing}
            className="rounded-full border border-green-600 px-4 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-50"
          >
            {importing ? "আনা হচ্ছে..." : <IconText icon="pot" iconClass="h-4 w-4">আমার বাগান থেকে আনুন</IconText>}
          </button>
        </div>
        {info && <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900">{info}</p>}

        <div className="mt-3 space-y-3">
          {groups.map((g, i) => (
            <GroupRow
              key={g.id}
              g={g}
              letter={LETTERS[i]}
              onChange={(ng) => setGroups(groups.map((x) => (x.id === g.id ? ng : x)))}
              onRemove={groups.length > 1 ? () => setGroups(groups.filter((x) => x.id !== g.id)) : undefined}
            />
          ))}
        </div>
        <button
          onClick={() => setGroups([...groups, newGroup()])}
          disabled={total >= MAX_POTS || groups.length >= LETTERS.length}
          className="mt-3 w-full rounded-2xl border-2 border-dashed border-green-200 py-2.5 text-sm font-medium text-green-700 transition hover:border-green-400 hover:bg-green-50 disabled:opacity-50"
        >
          ＋ আরেক ধরনের টব যোগ করুন
        </button>
        {total > MAX_POTS && (
          <p className="mt-2 text-sm text-red-700">সব মিলিয়ে সর্বোচ্চ {bn(MAX_POTS)}টা টব রাখা যায়।</p>
        )}

        <button
          onClick={generate}
          disabled={loading || total > MAX_POTS}
          className="mt-5 w-full rounded-full bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "পরিকল্পনা তৈরি হচ্ছে..." : "আমার পরিকল্পনা বানান"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}

      {plan && (
        <>
          {/* সারাংশ */}
          <section className="mt-6 rounded-3xl border border-green-100 bg-gradient-to-br from-white to-green-50 p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold text-green-900"><IconText icon="leaf">এই বছর আপনার বাগানে</IconText></h2>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "টব", value: `${bn(total)}টি` },
                { label: "নতুন ফসল", value: `${bn(plan.crops.length)}টি` },
                { label: "ফসল তোলার মাস", value: `${bn(harvestMonths)}টি` },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-2xl font-bold text-green-800">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            {plan.current_crops.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="shrink-0">এখন আছে:</span>
                <Chips items={plan.current_crops} cls="bg-amber-50 text-amber-900" />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {plan.crops.length ? (
                <>
                  <span className="shrink-0">নতুন লাগাবেন:</span>
                  <Chips items={plan.crops} cls="bg-white text-green-900 shadow-sm" />
                </>
              ) : (
                <p>এই টব বা রোদে নতুন করে লাগানোর মতো ফসল পাওয়া যায়নি। বড় টব বা বেশি রোদ বেছে দেখুন।</p>
              )}
            </div>
          </section>

          {plan.crops.length + plan.current_crops.length > 0 && <YearCalendar plan={plan} />}

          <h2 className="mt-10 text-xl font-bold text-green-900">
            মাসওয়ারি কাজ{" "}
            {groups.length > 1 && <InfoTip label="টবের অক্ষর" hint="অক্ষর মানে টব-দল">&quot;টব&quot; ঘরের অক্ষর (ক, খ...) বলে দেয় ফসলটা কোন টব-দলে যাবে।</InfoTip>}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {plan.months.map((m) => (
              <MonthCard key={m.index} m={m} />
            ))}
          </div>

          <MoreInfo items={plan.notes} />
        </>
      )}
    </main>
  );
}

export default function PlanPage() {
  return (
    <LoginGate next="/plan" why="আপনার এলাকার আবহাওয়া ধরে ১ বছরের বাগান পরিকল্পনা বানাতে লগইন লাগে।">
      <PlanView />
    </LoginGate>
  );
}
