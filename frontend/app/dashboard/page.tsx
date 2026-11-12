"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import { CropIcon } from "@/components/crop-icons";
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { InfoTip } from "@/components/InfoTip";
import AddPlantWizard from "@/components/garden/AddPlantWizard";
import SoilCheck from "@/components/garden/SoilCheck";
import { areaLabel, useGardenLocation } from "@/lib/location";
import {
  ACTION_BN,
  HEALTH_STYLE,
  api,
  dueText,
  errorText,
  whenText,
  type Dashboard,
  type GardenAlert,
  type Plant,
  type SoilStatus,
  type TaskRow,
} from "@/lib/garden";
import { notify } from "@/lib/notify";
import { ACTION_ICON, bnDigits, taskIcon } from "@/lib/garden";

type Filter = "all" | "water" | "attention" | "alert" | "archived";
type TaskTab = "today" | "upcoming";

const FILTERS: { value: Filter; label: string; icon?: GIconName }[] = [
  { value: "all", label: "সব" },
  { value: "water", label: "পানি/মাটি দেখা দরকার", icon: "water" },
  { value: "attention", label: "নজর দরকার", icon: "warning" },
  { value: "alert", label: "আবহাওয়া সতর্কতা", icon: "cloudSun" },
  { value: "archived", label: "আর্কাইভ", icon: "box" },
];

const ALERT_STYLE: Record<GardenAlert["severity"], string> = {
  serious: "border-red-300 bg-red-50 text-red-900",
  warning: "border-orange-200 bg-orange-50 text-orange-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};
const ALERT_ICON: Record<GardenAlert["type"], GIconName> = {
  drying: "thermo",
  rain: "rain",
  heavy_rain: "storm",
  wind: "wind",
  fungus: "fungus",
};

function dayName(date: string) {
  return new Date(date).toLocaleDateString("bn-BD", { weekday: "short" });
}

export default function DashboardPage() {
  return (
    <LoginGate next="/dashboard" why="আপনার বাগানের গাছ, রিমাইন্ডার আর সতর্কতা শুধু আপনার অ্যাকাউন্টে থাকে।">
      <Dashboard />
    </LoginGate>
  );
}

function Dashboard() {
  const loc = useGardenLocation();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [taskTab, setTaskTab] = useState<TaskTab>("today");
  const [archived, setArchived] = useState<Plant[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<Dashboard>(`/dashboard?lat=${loc.lat}&lon=${loc.lon}`)
      .then((d) => {
        if (!alive) return;
        setDash(d);
        setError("");
      })
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [loc.lat, loc.lon, version]);

  useEffect(() => {
    if (filter !== "archived") return;
    api<Plant[]>("/plants?status=archived")
      .then(setArchived)
      .catch((e) => notify.error(errorText(e)));
  }, [filter, version]);

  // প্রতিটা কাজের পর ড্যাশবোর্ড নতুন করে আনা হয়, যাতে সংখ্যা ও তালিকা সাথে সাথে বদলায়
  async function act(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) notify(ok);
      setVersion((v) => v + 1);
    } catch (e) {
      notify.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const done = (t: TaskRow) =>
    act(`task-${t.id}`, () => api(`/reminders/${t.id}/done`, { body: {} }), `${t.plant}: ${t.task_bn} সম্পন্ন`);
  const snooze = (t: TaskRow) =>
    act(`task-${t.id}`, () => api(`/reminders/${t.id}/snooze`, { body: { days: 1 } }), `${t.plant}: ১ দিন পেছানো হলো`);
  const reschedule = (t: TaskRow, date: string) =>
    act(`task-${t.id}`, () => api(`/reminders/${t.id}/reschedule`, { body: { due_on: date } }), `${t.plant}: নতুন তারিখ ${date}`);
  const water = (p: { id: number; nickname: string; name: string }) =>
    act(`plant-${p.id}`, () => api(`/plants/${p.id}/water`, { body: {} }), `${p.nickname || p.name}: পানি দেওয়া লেখা হলো`);
  const soilCheck = (id: number, s: SoilStatus) =>
    act(
      `plant-${id}`,
      () => api(`/plants/${id}/observations`, { body: { soil_status: s } }),
      s === "dry" ? "মাটি শুকনো: আজই পানি দিন" : "মাটির অবস্থা লেখা হলো, পানির তারিখ ঠিক করা হয়েছে",
    );
  const restore = (p: Plant) => act(`plant-${p.id}`, () => api(`/plants/${p.id}/restore`, { body: {} }), "গাছটা আবার সক্রিয় হলো");

  const shown = useMemo(() => {
    if (!dash) return [];
    const base = filter === "archived" ? archived ?? [] : dash.plants;
    const q = search.trim().toLowerCase();
    return base.filter((p) => {
      if (filter === "water" && !p.needs_water) return false;
      if (filter === "attention" && !p.needs_attention) return false;
      if (filter === "alert" && !p.alert_types?.length) return false;
      if (!q) return true;
      return [p.name, p.name_bn, p.nickname, p.zone].some((v) => v.toLowerCase().includes(q));
    });
  }, [dash, filter, archived, search]);

  function jump(f: Filter | null, anchor: string) {
    if (f) setFilter(f);
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const s = dash?.summary;
  const todayTasks = dash ? [...dash.tasks.overdue, ...dash.tasks.today] : [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <PageHeader icon="home" title="আমার বাগান" subtitle="আজকের কাজ, গাছ আর সতর্কতা" />

      {/* উপরের বার */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <GIcon name="pin" className="mr-1 h-4 w-4 text-green-700" /><b>{areaLabel(loc)}</b>{" "}
          <Link href="/weather" className="text-green-700 underline">
            এলাকা বদলান
          </Link>
        </p>
        <button
          onClick={() => setAdding(true)}
          className="rounded-full bg-green-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-green-600/30 hover:bg-green-700"
        >
          ＋ গাছ যোগ করুন
        </button>
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-red-800">{error}</p>}
      {!dash && !error && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-green-100" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-green-100" />
        </div>
      )}

      {dash && s && (
        <>
          {/* সারাংশ */}
          <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard value={s.plants} label="মোট গাছ" sub={s.archived ? `${bnDigits(s.archived)}টা আর্কাইভে` : undefined} onClick={() => jump("all", "plants")} />
            <SummaryCard
              value={s.tasks_today}
              label="আজকের কাজ"
              sub={s.overdue ? `${bnDigits(s.overdue)}টা দেরি হয়ে গেছে` : undefined}
              tone={s.overdue ? "warn" : undefined}
              onClick={() => {
                setTaskTab("today");
                jump(null, "tasks");
              }}
            />
            <SummaryCard value={s.water_due} label="পানি/মাটি দেখা দরকার" onClick={() => jump("water", "plants")} />
            <SummaryCard value={s.attention} label="নজর দরকার" tone={s.attention ? "warn" : undefined} onClick={() => jump("attention", "plants")} />
          </div>

          {dash.plants.length === 0 && filter !== "archived" ? (
            <EmptyGarden
              hasArea={!!loc.upazila}
              archived={s.archived}
              onAdd={() => setAdding(true)}
              onArchived={() => setFilter("archived")}
            />
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="min-w-0 space-y-10">
                {/* সতর্কতা */}
                {dash.alerts.length > 0 && (
                  <section aria-labelledby="alerts-title">
                    <h2 id="alerts-title" className="text-xl font-bold text-green-900">
                      <IconText icon="cloudSun">আপনার গাছের জন্য আবহাওয়া সতর্কতা</IconText>{" "}
                      <InfoTip label="এই সতর্কতা কী" hint="পূর্বাভাস দেখে অনুমান">পূর্বাভাস দেখে করা অনুমান; মাটি বা রোগ নিশ্চিত করে না। প্রতিটা সতর্কতার কারণ নিচে লেখা আছে।</InfoTip>
                    </h2>
                    <div className="mt-3 space-y-3">
                      {dash.alerts.map((a) => (
                        <div key={a.id} className={`rounded-2xl border p-4 ${ALERT_STYLE[a.severity]}`}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold">
                              <IconText icon={ALERT_ICON[a.type]}>{a.title}</IconText>
                            </p>
                            <span className="text-xs">{a.date}</span>
                          </div>
                          <p className="mt-1 text-sm">{bnDigits(a.message)}</p>
                          {/* কোন গাছ: ছোট চিপ; কেন এই সতর্কতা আর কোথা থেকে, ⓘ-এর ভেতরে */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {a.plants.map((n) => (
                              <span key={n} className="rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-medium ring-1 ring-current/10">
                                {n}
                              </span>
                            ))}
                            <InfoTip
                              label="কেন এই সতর্কতা"
                              peek={false}
                              tone="text-current"
                              sources={[{ title: `${a.source} (${whenText(a.fetched_at)} আনা)` }]}
                            >
                              {bnDigits(a.reason)}
                            </InfoTip>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* কাজ */}
                <section id="tasks" aria-labelledby="tasks-title" className="scroll-mt-40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="tasks-title" className="text-xl font-bold text-green-900">
                      <IconText icon="clipboard">কাজের তালিকা</IconText>
                    </h2>
                    <div className="flex rounded-full bg-green-50 p-1 text-sm" role="tablist">
                      {(
                        [
                          ["today", `আজ ও বাকি (${bnDigits(todayTasks.length)})`],
                          ["upcoming", `পরের ৭ দিন (${bnDigits(dash.tasks.upcoming.length)})`],
                        ] as const
                      ).map(([v, l]) => (
                        <button
                          key={v}
                          role="tab"
                          aria-selected={taskTab === v}
                          onClick={() => setTaskTab(v)}
                          className={`rounded-full px-3 py-1.5 font-medium ${taskTab === v ? "bg-white text-green-800 shadow-sm" : "text-gray-600"}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(taskTab === "today" ? todayTasks : dash.tasks.upcoming).length === 0 ? (
                    <p className="mt-3 rounded-2xl bg-green-50 p-4 text-green-900">
                      {taskTab === "today" ? "আজ কোনো কাজ বাকি নেই" : "আগামী ৭ দিনে কোনো কাজ নেই।"}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {(taskTab === "today" ? todayTasks : dash.tasks.upcoming).map((t) => (
                        <TaskItem
                          key={t.id}
                          t={t}
                          busy={busy === `task-${t.id}` || busy === `plant-${t.plant_id}`}
                          onDone={() => done(t)}
                          onSnooze={() => snooze(t)}
                          onReschedule={(d) => reschedule(t, d)}
                          onMoist={() => soilCheck(t.plant_id, "moist")}
                        />
                      ))}
                    </ul>
                  )}
                </section>

                {/* গাছ */}
                <section id="plants" aria-labelledby="plants-title" className="scroll-mt-40">
                  <h2 id="plants-title" className="text-xl font-bold text-green-900">
                    <IconText icon="sprout">আমার গাছগুলো</IconText>{" "}
                    <InfoTip label="মাটির অবস্থা" hint="মাটি আপনার নিজের দেখা">মাটির অবস্থা আপনার নিজের দেখা (&quot;নিজে দেখা&quot;)। সেন্সর লাগালে আলাদা করে &quot;মাপা&quot; লেখা থাকবে।</InfoTip>
                  </h2>
                  <div className="mt-3 flex flex-col gap-3">
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="নাম বা জায়গা দিয়ে খুঁজুন"
                      aria-label="গাছ খুঁজুন"
                      className="w-full rounded-xl border border-green-200 bg-white p-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                    />
                    <div className="flex flex-wrap gap-2">
                      {FILTERS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setFilter(f.value)}
                          aria-pressed={filter === f.value}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                            filter === f.value ? "bg-green-600 text-white" : "bg-white text-gray-700 ring-1 ring-green-200 hover:bg-green-50"
                          }`}
                        >
                          {f.icon ? <IconText icon={f.icon} iconClass="h-4 w-4">{f.label}</IconText> : f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {shown.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
                      {filter === "archived" ? "আর্কাইভে কোনো গাছ নেই।" : "এই ফিল্টারে কোনো গাছ নেই।"}
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {shown.map((p) =>
                        filter === "archived" ? (
                          <ArchivedCard key={p.id} p={p} busy={busy === `plant-${p.id}`} onRestore={() => restore(p)} />
                        ) : (
                          <PlantCard
                            key={p.id}
                            p={p}
                            busy={busy === `plant-${p.id}`}
                            onWater={() => water(p)}
                            onSoil={(st) => soilCheck(p.id, st)}
                          />
                        ),
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* পাশের অংশ */}
              <aside className="space-y-6">
                <WeatherCard dash={dash} label={areaLabel(loc)} />
                <section className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm" aria-labelledby="activity-title">
                  <h2 id="activity-title" className="font-semibold text-green-900">
                    <IconText icon="clock">সাম্প্রতিক কাজ</IconText>
                  </h2>
                  {dash.recent_activity.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">এখনো কিছু করা হয়নি।</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dash.recent_activity.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-green-50/60 px-3 py-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
                            <GIcon name={ACTION_ICON[a.action] ?? "pin"} className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-green-950">{ACTION_BN[a.action] ?? a.action}</span>
                            <span className="block truncate text-sm text-gray-600">{a.plant}</span>
                          </span>
                          <span className="shrink-0 text-xs font-medium text-gray-400">{whenText(a.logged_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </aside>
            </div>
          )}
        </>
      )}

      {adding && (
        <AddPlantWizard
          onClose={() => setAdding(false)}
          onSaved={(p) => {
            setAdding(false);
            setFilter("all");
            notify(`${p.nickname || p.name_bn || p.name} যোগ হয়েছে`);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </main>
  );
}

function SummaryCard({
  value,
  label,
  sub,
  tone,
  onClick,
}: {
  value: number;
  label: string;
  sub?: string;
  tone?: "warn";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${tone === "warn" ? "border-amber-200" : "border-green-100"}`}
    >
      <p className={`text-3xl font-bold ${tone === "warn" ? "text-amber-600" : "text-green-700"}`}>{bnDigits(value)}</p>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {sub && <p className="text-xs text-amber-700">{sub}</p>}
    </button>
  );
}

function TaskItem({
  t,
  busy,
  onDone,
  onSnooze,
  onReschedule,
  onMoist,
}: {
  t: TaskRow;
  busy: boolean;
  onDone: () => void;
  onSnooze: () => void;
  onReschedule: (d: string) => void;
  onMoist: () => void;
}) {
  // তারিখ বাছার ঘর খোলা থাকলে তার সবচেয়ে আগের তারিখ (আগামীকাল)
  const [pickMin, setPickMin] = useState<string | null>(null);
  const isWater = t.task === "water";
  const ghost =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-green-50 hover:text-green-800 hover:ring-green-300 disabled:opacity-50";
  const btn = ghost;
  const accent = t.is_overdue ? "before:bg-red-400" : t.is_due ? "before:bg-amber-400" : "before:bg-green-300";
  const due = t.is_overdue ? "bg-red-50 text-red-700" : t.is_due ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600";
  // "পানি দেওয়া (আগে মাটি দেখুন)" → শিরোনাম "পানি দেওয়া", বাকিটা গাছের নামের পাশে ছোট করে
  const m = t.task_bn.match(/^(.*?)\s*\((.+)\)\s*$/);
  const title = m ? m[1] : t.task_bn;
  const hint = m ? m[2] : "";

  // একটা পরিষ্কার সারি: বাঁয়ে গোল টিক (এক চাপে শেষ), মাঝে কাজ আর গাছ, ডানে কবে; নিচে ছোট বিকল্প
  return (
    <li className={`relative overflow-hidden rounded-2xl border border-green-100 bg-white p-4 pl-5 shadow-sm transition hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1.5 ${accent}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onDone}
          disabled={busy}
          aria-label={isWater ? "পানি দিয়েছি" : "হয়ে গেছে"}
          title={isWater ? "পানি দিয়েছি" : "হয়ে গেছে"}
          className="group mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-green-500 text-green-600 transition hover:bg-green-600 hover:text-white disabled:opacity-50"
        >
          <GIcon name={isWater ? "water" : "tick"} className="h-5 w-5 opacity-60 transition group-hover:opacity-100" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
              <GIcon name={taskIcon(t.task)} className="h-5 w-5 text-green-700" />
              {title}
            </p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${due}`}>
              <GIcon name="clock" className="h-3.5 w-3.5" />
              {dueText(t.days_left)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            <Link href={`/dashboard/plants/${t.plant_id}`} className="font-medium text-green-800 hover:underline">
              {t.plant}
            </Link>
            {hint && <span> · {hint}</span>}
          </p>
          {t.weather_note && (
            <p className="mt-1 text-sm text-orange-800">
              <GIcon name="cloudSun" className="mr-1 h-4 w-4" />
              {bnDigits(t.weather_note)}
            </p>
          )}
      <div className="mt-3 flex flex-wrap gap-2">
        {isWater && (
          <button onClick={onMoist} disabled={busy} className={btn}>
            <GIcon name="hand" className="h-4 w-4" /> মাটি ভেজা
          </button>
        )}
        <button onClick={onSnooze} disabled={busy} className={btn} title="১ দিন পরে">
          <GIcon name="clock" className="h-4 w-4" /> কাল
        </button>
        {pickMin ? (
          <input
            type="date"
            min={pickMin}
            autoFocus
            aria-label="নতুন তারিখ"
            onChange={(e) => {
              if (e.target.value) {
                setPickMin(null);
                onReschedule(e.target.value);
              }
            }}
            onBlur={() => setPickMin(null)}
            className="h-9 rounded-full border border-gray-300 px-3 text-sm"
          />
        ) : (
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setPickMin(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }}
            disabled={busy} className={btn}>
            <GIcon name="calendar" className="h-4 w-4" /> অন্য দিন
          </button>
        )}
      </div>
        </div>
      </div>
    </li>
  );
}

function PlantCard({
  p,
  busy,
  onWater,
  onSoil,
}: {
  p: Plant;
  busy: boolean;
  onWater: () => void;
  onSoil: (s: SoilStatus) => void;
}) {
  const [checking, setChecking] = useState(false);
  const h = HEALTH_STYLE[p.health.status];

  const stat = "rounded-xl bg-green-50/70 px-3 py-2";
  return (
    <article className="flex flex-col rounded-3xl border border-green-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100">
          <CropIcon name={p.name} className="h-9 w-9" />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/dashboard/plants/${p.id}`} className="block truncate text-lg font-bold text-green-950 hover:underline">
            {p.nickname || p.name_bn || p.name}
          </Link>
          <p className="truncate text-sm text-gray-500">
            {p.nickname && p.name_bn ? `${p.name_bn} · ` : ""}টব {bnDigits(p.pot_liters)} লি.{p.zone ? ` · ${p.zone}` : ""}
          </p>
        </div>
        {p.health.status !== "unknown" && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${h.cls}`}>
            <IconText icon={h.icon} iconClass="h-3.5 w-3.5">{p.health.status_bn}</IconText>
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className={stat}>
          <dt className="text-xs font-medium text-gray-500"><GIcon name="hand" className="mr-1 h-3.5 w-3.5" />মাটি</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">
            {p.soil.status_bn}
            {p.soil.status && p.soil.stale && <span className="ml-1 text-xs font-medium text-amber-700">পুরোনো</span>}
          </dd>
        </div>
        <div className={stat}>
          <dt className="text-xs font-medium text-gray-500"><GIcon name="water" className="mr-1 h-3.5 w-3.5" />শেষ পানি</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">{whenText(p.last_watered)}</dd>
        </div>
        {p.next_task && (
          <div className={`col-span-2 flex items-center justify-between gap-2 ${stat}`}>
            <dt className="sr-only">পরের কাজ</dt>
            <dd className="flex min-w-0 items-center gap-1.5 font-semibold text-gray-900">
              <GIcon name={taskIcon(p.next_task.task)} className="h-4 w-4 shrink-0 text-green-700" />
              <span className="truncate">{p.next_task.task_bn.replace(/\s*\(.*\)\s*$/, "")}</span>
            </dd>
            <dd className={`shrink-0 text-sm font-semibold ${p.next_task.is_overdue ? "text-red-700" : p.next_task.is_due ? "text-amber-700" : "text-gray-500"}`}>
              {dueText(p.next_task.days_left)}
            </dd>
          </div>
        )}
      </dl>

      {p.health.symptoms_bn.length > 0 && <p className="mt-3 text-sm text-amber-800">লক্ষণ: {p.health.symptoms_bn.join(", ")}</p>}
      {!!p.alert_types?.length && (
        <p className="mt-3 text-sm text-orange-800"><GIcon name="cloudSun" className="mr-1 h-4 w-4" />আবহাওয়া সতর্কতা আছে</p>
      )}

      {checking && (
        <div className="mt-3">
          <SoilCheck
            disabled={busy}
            onPick={(st) => {
              setChecking(false);
              onSoil(st);
            }}
          />
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <button onClick={onWater} disabled={busy} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-green-600 text-sm font-semibold text-white shadow-sm shadow-green-600/30 transition hover:shadow-md disabled:opacity-50">
          <GIcon name="water" className="h-4 w-4" /> পানি দিয়েছি
        </button>
        <button
          onClick={() => setChecking(!checking)}
          aria-expanded={checking}
          title="মাটি দেখুন"
          className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition ${checking ? "bg-green-50 text-green-800 ring-green-300" : "text-gray-700 ring-gray-200 hover:bg-green-50"}`}
        >
          <GIcon name="hand" className="h-4 w-4" /> মাটি
        </button>
        <Link
          href={`/dashboard/plants/${p.id}`}
          aria-label="বিস্তারিত / সমস্যা লিখুন"
          title="বিস্তারিত / সমস্যা লিখুন"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 ring-1 ring-gray-200 transition hover:bg-green-50 hover:text-green-800"
        >
          <GIcon name="note" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function ArchivedCard({ p, busy, onRestore }: { p: Plant; busy: boolean; onRestore: () => void }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <Link href={`/dashboard/plants/${p.id}`} className="text-lg font-bold text-gray-700 hover:underline">
        {p.nickname || p.name_bn || p.name}
      </Link>
      <p className="text-xs text-gray-500">আর্কাইভ করা, ইতিহাস রাখা আছে</p>
      <button onClick={onRestore} disabled={busy} className="mt-3 rounded-full bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-gray-300 hover:bg-gray-100 disabled:opacity-50">
        <IconText icon="refresh" iconClass="h-4 w-4">আবার সক্রিয় করুন</IconText>
      </button>
    </article>
  );
}

function WeatherCard({ dash, label }: { dash: Dashboard; label: string }) {
  const w = dash.weather;
  return (
    <section className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm" aria-labelledby="weather-title">
      <h2 id="weather-title" className="font-semibold text-green-900">
        <IconText icon="cloudSun">{label}</IconText>
      </h2>
      {w.status !== "ok" ? (
        <p className="mt-2 text-sm text-gray-500">পূর্বাভাস এখন পাওয়া যাচ্ছে না, তাই আবহাওয়া সতর্কতাও দেখানো যাচ্ছে না।</p>
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            {w.days.slice(0, 3).map((d, i) => (
              <li key={d.date} className="rounded-xl bg-green-50 p-2">
                <p className="text-xs font-semibold text-gray-700">{i === 0 ? "আজ" : dayName(d.date)}</p>
                <p className="mt-1 font-bold text-orange-600">{bnDigits(d.temp_max) || "–"}°</p>
                <p className="text-xs text-gray-500">{bnDigits(d.temp_min) || "–"}°</p>
                <p className="mt-1 text-xs text-blue-700"><GIcon name="rain" className="mr-0.5 h-3.5 w-3.5" />{bnDigits(d.rain_prob) || "–"}%</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <Link href="/weather" className="inline-flex items-center gap-1 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-100">
              বিস্তারিত আবহাওয়া <span aria-hidden>→</span>
            </Link>
            <InfoTip label="উৎস" peek={false} align="right" sources={[{ title: `${w.source} (${whenText(w.fetched_at)} আনা)` }]} />
          </div>
        </>
      )}
    </section>
  );
}

function EmptyGarden({
  hasArea,
  archived,
  onAdd,
  onArchived,
}: {
  hasArea: boolean;
  archived: number;
  onAdd: () => void;
  onArchived: () => void;
}) {
  const steps = [
    { done: hasArea, title: "বাগানের এলাকা বেছে নিন", desc: "আবহাওয়া পেজের মানচিত্রে ক্লিক করুন, সতর্কতা সেই এলাকা ধরে আসবে।", href: "/weather" },
    { done: false, title: "প্রথম গাছ যোগ করুন", desc: "শুধু নাম দিলেই হবে, বাকি তথ্য পরে দিতে পারবেন।" },
    { done: false, title: "রিমাইন্ডার দেখে নিন", desc: "পানি, সার, ছাঁটাই, পোকা দেখার কাজ নিজে থেকে তালিকায় আসবে।" },
  ];
  return (
    <section className="mt-8 rounded-3xl border border-green-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-green-900"><IconText icon="sprout">শুরু করা যাক</IconText></h2>
      <ol className="mt-4 space-y-3">
        {steps.map((st, i) => (
          <li key={st.title} className="flex gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${st.done ? "bg-green-600 text-white" : "bg-green-100 text-green-800"}`}>
              {st.done ? <GIcon name="tick" className="h-4 w-4" /> : i + 1}
            </span>
            <div>
              <p className="font-semibold">
                {st.href ? (
                  <Link href={st.href} className="underline">
                    {st.title}
                  </Link>
                ) : (
                  st.title
                )}
              </p>
              <p className="text-sm text-gray-600">{st.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <button onClick={onAdd} className="mt-6 rounded-full bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700">
        ＋ প্রথম গাছ যোগ করুন
      </button>
      {archived > 0 && (
        <button onClick={onArchived} className="ml-3 mt-6 text-sm text-green-700 underline">
          <GIcon name="box" className="mr-1 h-4 w-4" />আর্কাইভের {archived}টা গাছ দেখুন
        </button>
      )}
    </section>
  );
}
