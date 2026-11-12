"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ACTION_BN,
  CONTAINERS,
  HEALTH_OPTIONS,
  HEALTH_STYLE,
  SOIL_OPTIONS,
  SOIL_TYPES,
  STAGES,
  SYMPTOMS,
  TASK_OPTIONS,
  api,
  dueText,
  errorText,
  whenText,
  type PlantDetail,
  type Reminder,
  type SoilStatus,
  type TaskType,
} from "@/lib/garden";
import { confirmBox, notify } from "@/lib/notify";
import { ACTION_ICON, bnDate, bnDigits, taskIcon } from "@/lib/garden";
import { CropIcon } from "@/components/crop-icons";
import { GIcon, IconText } from "@/components/garden-icons";

const input =
  "mt-1 w-full rounded-xl border border-green-200 bg-white p-2.5 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200";
const label = "block text-sm font-medium text-gray-700";
const card = "rounded-3xl border border-green-100 bg-white p-5 shadow-sm";

export default function PlantView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    api<PlantDetail>(`/plants/${id}`)
      .then((p) => alive && setPlant(p))
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [id, version]);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) notify(ok);
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      notify.error(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!plant) return;
    const ok = await confirmBox({
      title: `"${plant.nickname || plant.name}" পুরোপুরি মুছে ফেলবেন?`,
      text: "এর সব ইতিহাসও মুছে যাবে। শুধু সরিয়ে রাখতে চাইলে আর্কাইভ করুন।",
      ok: "হ্যাঁ, মুছে ফেলুন",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/plants/${plant.id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (e) {
      notify.error(errorText(e));
      setBusy(false);
    }
  }

  if (error)
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <p className="rounded-2xl bg-red-50 p-4 text-red-800">{error}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-green-700 underline">
          ← আমার বাগানে ফিরুন
        </Link>
      </main>
    );
  if (!plant)
    return (
      <main className="mx-auto max-w-4xl animate-pulse space-y-4 px-5 py-10">
        <div className="h-32 rounded-3xl bg-green-100" />
        <div className="h-64 rounded-3xl bg-green-100" />
      </main>
    );

  const h = HEALTH_STYLE[plant.health.status];
  const archived = plant.status === "archived";

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-green-700 underline">
        ← আমার বাগান
      </Link>

      <header className="mt-3 rounded-3xl bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/90">
            <CropIcon name={plant.name} className="h-10 w-10" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">{plant.nickname || plant.name_bn || plant.name}</h1>
            <p className="text-green-50">
              {plant.name_bn ? `${plant.name_bn} · ` : ""}
              {plant.name}
              {plant.planted_on && ` · লাগানো ${bnDate(plant.planted_on)}`}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${h.cls}`}>
            <IconText icon={h.icon} iconClass="h-4 w-4">{plant.health.status_bn}</IconText>
          </span>
        </div>
        {archived && <p className="mt-3 rounded-xl bg-white/20 p-2 text-sm"><GIcon name="box" className="mr-1.5 h-4 w-4" />এই গাছটা আর্কাইভ করা। রিমাইন্ডার ড্যাশবোর্ডে আসবে না।</p>}
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* প্রোফাইল */}
        <section className={card} aria-labelledby="profile-title">
          <div className="flex items-center justify-between">
            <h2 id="profile-title" className="text-lg font-bold text-green-900">
              <IconText icon="pot">গাছের তথ্য</IconText>
            </h2>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-sm text-green-700 underline">
                <IconText icon="pencil" iconClass="h-4 w-4">বদলান</IconText>
              </button>
            )}
          </div>
          {editing ? (
            <ProfileForm
              plant={plant}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={async (body) => {
                if (await act(() => api(`/plants/${plant.id}`, { method: "PATCH", body }), "তথ্য সেভ হয়েছে")) setEditing(false);
              }}
            />
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["টব", `${bnDigits(plant.pot_liters)} লিটার${plant.container ? `, ${CONTAINERS.find((c) => c.value === plant.container)?.label ?? plant.container}` : ""}`],
                ["জায়গা", plant.zone || "–"],
                ["মাটি", SOIL_TYPES.find((s) => s.value === plant.soil_type)?.label ?? "জানা নেই"],
                ["রোদ", plant.sunlight_hours === null ? "জানা নেই" : `${plant.sunlight_hours} ঘণ্টা`],
                ["পর্যায়", STAGES.find((s) => s.value === plant.stage)?.label ?? "জানা নেই"],
                ["শেষ পানি", whenText(plant.last_watered)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
              {plant.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500">নোট</dt>
                  <dd className="whitespace-pre-line">{plant.notes}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-green-50 pt-4">
            {archived ? (
              <button
                disabled={busy}
                onClick={() => act(() => api(`/plants/${plant.id}/restore`, { body: {} }), "আবার সক্রিয় হলো")}
                className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                <IconText icon="refresh" iconClass="h-4 w-4">আবার সক্রিয় করুন</IconText>
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => act(() => api(`/plants/${plant.id}/archive`, { body: {} }), "আর্কাইভ হয়েছে, ইতিহাস রাখা আছে")}
                className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                <IconText icon="box" iconClass="h-4 w-4">আর্কাইভ করুন</IconText>
              </button>
            )}
            <button disabled={busy} onClick={remove} className="rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              <IconText icon="trash" iconClass="h-4 w-4">মুছে ফেলুন</IconText>
            </button>
          </div>
        </section>

        {/* আজকের পর্যবেক্ষণ */}
        <ObservationForm
          busy={busy}
          soil={plant.soil}
          onSubmit={(body) =>
            act(() => api(`/plants/${plant.id}/observations`, { body }), body.soil_status === "dry" ? "লেখা হলো। মাটি শুকনো, আজই পানি দিন।" : "পর্যবেক্ষণ লেখা হলো")
          }
        />
      </div>

      {/* রিমাইন্ডার */}
      <Reminders
        plantId={plant.id}
        reminders={plant.all_reminders}
        busy={busy}
        act={act}
      />

      {/* ইতিহাস */}
      <section className={`${card} mt-6`} aria-labelledby="history-title">
        <h2 id="history-title" className="text-lg font-bold text-green-900">
          <IconText icon="clock">ইতিহাস</IconText>
        </h2>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">মাটি ও স্বাস্থ্যের পর্যবেক্ষণ</h3>
            {plant.observations.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">এখনো কিছু লেখা হয়নি।</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {plant.observations.map((o) => (
                  <li key={o.id} className="rounded-xl bg-green-50 p-3">
                    <p className="text-xs text-gray-500">
                      {whenText(o.observed_at)} · {o.source === "sensor" ? "সেন্সর" : "নিজে দেখা"}
                    </p>
                    {o.soil_bn && <p>মাটি: {o.soil_bn}</p>}
                    {o.health_bn && <p>স্বাস্থ্য: {o.health_bn}</p>}
                    {o.symptoms_bn.length > 0 && <p>লক্ষণ: {o.symptoms_bn.join(", ")}</p>}
                    {o.notes && <p className="text-gray-600">{o.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">কাজের ইতিহাস</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {plant.history.map((l) => (
                <li key={l.id} className="border-b border-green-50 pb-2 last:border-0">
                  <span className="font-medium"><IconText icon={ACTION_ICON[l.action] ?? "pin"} iconClass="h-4 w-4 text-green-700">{ACTION_BN[l.action] ?? l.action}</IconText></span>
                  {l.detail && <span className="text-gray-600"> · {l.detail}</span>}
                  <span className="block text-xs text-gray-400">{whenText(l.logged_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

type ProfileBody = {
  name: string;
  nickname: string;
  pot_liters: number;
  container: string;
  zone: string;
  soil_type: string;
  sunlight_hours: number | null;
  stage: string;
  planted_on: string | null;
  notes: string;
};

function ProfileForm({
  plant,
  busy,
  onCancel,
  onSave,
}: {
  plant: PlantDetail;
  busy: boolean;
  onCancel: () => void;
  onSave: (b: ProfileBody) => void;
}) {
  const [f, setF] = useState({
    name: plant.name,
    nickname: plant.nickname,
    pot_liters: String(plant.pot_liters),
    container: plant.container,
    zone: plant.zone,
    soil_type: plant.soil_type,
    sunlight_hours: plant.sunlight_hours === null ? "" : String(plant.sunlight_hours),
    stage: plant.stage,
    planted_on: plant.planted_on ?? "",
    notes: plant.notes,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="mt-3 grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...f,
          name: f.name.trim(),
          pot_liters: Number(f.pot_liters),
          sunlight_hours: f.sunlight_hours === "" ? null : Number(f.sunlight_hours),
          planted_on: f.planted_on || null,
        });
      }}
    >
      <label className={label}>
        নাম
        <input required value={f.name} onChange={set("name")} className={input} />
      </label>
      <label className={label}>
        ডাকনাম
        <input value={f.nickname} onChange={set("nickname")} className={input} />
      </label>
      <label className={label}>
        টব (লিটার)
        <input type="number" min={1} value={f.pot_liters} onChange={set("pot_liters")} className={input} />
      </label>
      <label className={label}>
        কিসে লাগানো
        <select value={f.container} onChange={set("container")} className={input}>
          {CONTAINERS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} col-span-2`}>
        জায়গা
        <input value={f.zone} onChange={set("zone")} className={input} />
      </label>
      <label className={label}>
        মাটি
        <select value={f.soil_type} onChange={set("soil_type")} className={input}>
          {SOIL_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        রোদ (ঘণ্টা)
        <input type="number" min={0} max={14} value={f.sunlight_hours} onChange={set("sunlight_hours")} className={input} />
      </label>
      <label className={label}>
        পর্যায়
        <select value={f.stage} onChange={set("stage")} className={input}>
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        লাগানোর তারিখ
        <input type="date" value={f.planted_on} onChange={set("planted_on")} className={input} />
      </label>
      <label className={`${label} col-span-2`}>
        নোট
        <textarea rows={2} value={f.notes} onChange={set("notes")} className={input} />
      </label>
      <div className="col-span-2 flex gap-2">
        <button disabled={busy} className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          সেভ করুন
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
          বাতিল
        </button>
      </div>
    </form>
  );
}

function ObservationForm({
  busy,
  soil,
  onSubmit,
}: {
  busy: boolean;
  soil: PlantDetail["soil"];
  onSubmit: (b: { soil_status: SoilStatus | null; health_status: string | null; symptoms: string[]; notes: string }) => Promise<boolean>;
}) {
  const [soilStatus, setSoilStatus] = useState<SoilStatus | null>(null);
  const [health, setHealth] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const empty = !soilStatus && !health && symptoms.length === 0 && !notes.trim();
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ring-1 ${on ? "bg-green-600 text-white ring-green-600" : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"}`;

  return (
    <section className={card} aria-labelledby="obs-title">
      <h2 id="obs-title" className="text-lg font-bold text-green-900">
        <IconText icon="note">আজ কী দেখলে</IconText>
      </h2>
      <p className="text-xs text-gray-500">
        শেষ মাটি পরীক্ষা: {soil.status_bn}
        {soil.observed_at && ` · ${whenText(soil.observed_at)}`}
      </p>

      <fieldset className="mt-3">
        <legend className={label}>মাটি কেমন</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {SOIL_OPTIONS.map((o) => (
            <button key={o.value} type="button" title={o.hint} aria-pressed={soilStatus === o.value} onClick={() => setSoilStatus(soilStatus === o.value ? null : o.value)} className={pill(soilStatus === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className={label}>গাছ কেমন আছে</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {HEALTH_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={health === o.value} onClick={() => setHealth(health === o.value ? null : o.value)} className={pill(health === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className={label}>কোনো লক্ষণ</legend>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {SYMPTOMS.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-green-600"
                checked={symptoms.includes(s.value)}
                onChange={(e) => setSymptoms(e.target.checked ? [...symptoms, s.value] : symptoms.filter((x) => x !== s.value))}
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={`${label} mt-3`}>
        নোট
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="যেমন নিচের পাতায় হলুদ দাগ, পাতার নিচে সাদা পোকা" className={input} />
      </label>

      <button
        disabled={busy || empty}
        onClick={async () => {
          if (await onSubmit({ soil_status: soilStatus, health_status: health, symptoms, notes })) {
            setSoilStatus(null);
            setHealth(null);
            setSymptoms([]);
            setNotes("");
          }
        }}
        className="mt-4 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
      >
        লিখে রাখুন
      </button>
      <p className="mt-3 text-sm text-gray-600">
        লক্ষণ মিলিয়ে দেখতে{" "}
        <Link href="/disease" className="font-semibold text-green-700 underline">
          সুস্থ বাগান
        </Link>{" "}
        খুলুন। ছড়াতে পারে মনে হলে গাছ আলাদা রাখুন; ওষুধের আগে কৃষি অফিসে জেনে নিন।
      </p>
    </section>
  );
}

function Reminders({
  plantId,
  reminders,
  busy,
  act,
}: {
  plantId: number;
  reminders: Reminder[];
  busy: boolean;
  act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
}) {
  const [task, setTask] = useState<TaskType>("fertilize");
  const [labelText, setLabelText] = useState("");
  const [every, setEvery] = useState("14");
  const [first, setFirst] = useState("");

  return (
    <section className={`${card} mt-6`} aria-labelledby="rem-title">
      <h2 id="rem-title" className="text-lg font-bold text-green-900">
        <IconText icon="clock">রিমাইন্ডার</IconText>
      </h2>
      <p className="text-xs text-gray-500">দিনের সংখ্যা বদলে ঘরের বাইরে ক্লিক করলে সেভ হয়। ০ দিন মানে একবারের কাজ।</p>
      {reminders.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">কোনো রিমাইন্ডার নেই।</p>
      ) : (
        <ul className="mt-3 divide-y divide-green-50">
          {reminders.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${r.enabled ? "" : "opacity-50"}`}>
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  <IconText icon={taskIcon(r.task)} iconClass="h-5 w-5 text-green-700">{r.task_bn}</IconText>
                </p>
                <p className="text-xs text-gray-500">
                  {r.enabled ? `পরের বার: ${bnDate(r.next_due)} (${dueText(r.days_left)})` : "বন্ধ"}
                  {r.last_done && ` · শেষ করা ${bnDate(r.last_done)}`}
                </p>
              </div>
              <label className="flex items-center gap-1 text-sm text-gray-600">
                <input
                  type="number"
                  min={0}
                  max={365}
                  defaultValue={r.every_days}
                  aria-label={`${r.task_bn}: কত দিন পরপর`}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== r.every_days && v >= 0) act(() => api(`/reminders/${r.id}`, { method: "PATCH", body: { every_days: v } }), "সেভ হয়েছে");
                  }}
                  className="w-16 rounded-xl border border-green-200 p-1.5 text-center"
                />
                দিন পরপর
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green-600"
                  checked={r.enabled}
                  disabled={busy}
                  onChange={(e) => act(() => api(`/reminders/${r.id}`, { method: "PATCH", body: { enabled: e.target.checked } }))}
                />
                চালু
              </label>
              <button
                disabled={busy}
                onClick={() => act(() => api(`/reminders/${r.id}`, { method: "DELETE" }), "রিমাইন্ডার মুছে ফেলা হলো")}
                className="text-sm text-red-600 hover:underline"
                aria-label={`${r.task_bn} মুছে ফেলুন`}
              >
                মুছুন
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 grid gap-3 rounded-2xl bg-green-50 p-4 sm:grid-cols-[1fr_1fr_90px_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(
            () =>
              api(`/plants/${plantId}/reminders`, {
                body: { task, label: labelText, every_days: Number(every), due_on: first || null },
              }),
            "নতুন রিমাইন্ডার যোগ হলো",
          );
          if (ok) setLabelText("");
        }}
      >
        <label className={label}>
          কাজ
          <select value={task} onChange={(e) => setTask(e.target.value as TaskType)} className={input}>
            {TASK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          নাম {task === "other" ? <span className="text-red-600">*</span> : "(ঐচ্ছিক)"}
          <input value={labelText} onChange={(e) => setLabelText(e.target.value)} required={task === "other"} placeholder="যেমন খুঁটি দেওয়া" className={input} />
        </label>
        <label className={label}>
          কত দিন পরপর
          <input type="number" min={0} max={365} value={every} onChange={(e) => setEvery(e.target.value)} className={input} />
        </label>
        <label className={label}>
          প্রথম তারিখ
          <input type="date" value={first} onChange={(e) => setFirst(e.target.value)} className={input} />
        </label>
        <button disabled={busy} className="rounded-full bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          ＋ যোগ করুন
        </button>
      </form>
    </section>
  );
}
