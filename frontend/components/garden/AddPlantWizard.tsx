"use client";
import { useEffect, useMemo, useState } from "react";
import { GIcon, IconText } from "@/components/garden-icons";
import {
  CONTAINERS,
  SOIL_TYPES,
  STAGES,
  TASK_OPTIONS,
  api,
  errorText,
  type CatalogItem,
  type Plant,
  type TaskType,
} from "@/lib/garden";

type DraftReminder = { task: TaskType; every_days: number; on: boolean };

const STEPS = ["কোন গাছ", "টব ও জায়গা", "মাটি ও রোদ", "রিমাইন্ডার", "দেখে সেভ করুন"];

const input =
  "mt-1 w-full rounded-xl border border-green-200 bg-white p-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200";
const label = "block text-sm font-medium text-gray-700";

export default function AddPlantWizard({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (p: Plant) => void;
}) {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [pot, setPot] = useState(10);
  const [container, setContainer] = useState("");
  const [zone, setZone] = useState("");
  const [soil, setSoil] = useState("");
  const [sun, setSun] = useState("");
  const [stage, setStage] = useState("");
  const [plantedOn, setPlantedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState<DraftReminder[] | null>(null);
  const [suggestNote, setSuggestNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    api<CatalogItem[]>("/catalog").then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q) || c.name_bn.includes(name.trim()))
      .filter((c) => c.name.toLowerCase() !== q)
      .slice(0, 6);
  }, [name, catalog]);
  const known = catalog.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());

  // রিমাইন্ডার ধাপে ঢোকার সময় গাছ ও টব অনুযায়ী পরামর্শ আনা
  async function loadSuggestion() {
    try {
      const s = await api<{ reminders: { task: TaskType; every_days: number }[]; note: string }>(
        `/catalog/suggest?name=${encodeURIComponent(name.trim())}&pot_liters=${pot}`,
      );
      setReminders(s.reminders.map((r) => ({ ...r, on: true })));
      setSuggestNote(s.note);
    } catch (e) {
      setError(errorText(e));
    }
  }

  function go(next: number) {
    setError("");
    if (next > 0 && !name.trim()) {
      setError("গাছের নাম লিখুন");
      return;
    }
    if (next === 3 && reminders === null) loadSuggestion();
    setStep(next);
  }

  async function save(allowDuplicate = false) {
    if (!name.trim()) {
      setError("গাছের নাম লিখুন");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const plant = await api<Plant>("/plants", {
        body: {
          name: name.trim(),
          nickname: nickname.trim(),
          pot_liters: pot,
          container,
          zone,
          soil_type: soil,
          sunlight_hours: sun === "" ? null : Number(sun),
          stage,
          planted_on: plantedOn || null,
          notes,
          // রিমাইন্ডার ধাপ না দেখলে backend নিজেই পরামর্শের রিমাইন্ডার বসাবে
          reminders: reminders?.filter((r) => r.on).map(({ task, every_days }) => ({ task, every_days })),
          allow_duplicate: allowDuplicate,
        },
      });
      onSaved(plant);
    } catch (e) {
      const msg = errorText(e);
      setError(msg);
      setDuplicate(msg.includes("আগেই আছে"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="wizard-title" className="text-xl font-bold text-green-900">
            <IconText icon="sprout">নতুন গাছ যোগ করুন</IconText>
          </h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-xl text-gray-500 hover:bg-gray-100" aria-label="বন্ধ করুন">
            <GIcon name="x" className="h-5 w-5" />
          </button>
        </div>

        <ol className="mt-4 flex gap-1" aria-label="ধাপ">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-green-600" : "bg-gray-200"}`} />
              <p className={`mt-1 hidden text-[11px] sm:block ${i === step ? "font-semibold text-green-800" : "text-gray-500"}`}>
                {s}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-gray-600 sm:hidden">
          ধাপ {step + 1}/{STEPS.length}: {STEPS[step]}
        </p>

        <div className="mt-5 space-y-4">
          {step === 0 && (
            <>
              <div className="relative">
                <label className={label} htmlFor="plant-name">
                  গাছের নাম <span className="text-red-600">*</span>
                </label>
                <input
                  id="plant-name"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setReminders(null); // গাছ বদলালে পরামর্শও নতুন করে আসবে
                  }}
                  placeholder="যেমন Tomato বা টমেটো"
                  className={input}
                  autoComplete="off"
                />
                {matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-green-100 bg-white shadow-lg">
                    {matches.map((c) => (
                      <li key={c.name}>
                        <button
                          onClick={() => {
                            setName(c.name);
                            setReminders(null);
                          }}
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-green-50"
                        >
                          {c.name_bn} <span className="text-gray-500">· {c.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {known
                    ? `তালিকায় আছে: ${known.name_bn}`
                    : name.trim()
                      ? "তালিকায় নেই, নিজের দেওয়া নামেই যোগ হবে।"
                      : "তালিকা থেকে বেছে নিন, না পেলে নিজের মতো লিখুন।"}
                </p>
              </div>
              <div>
                <label className={label} htmlFor="plant-nick">
                  ডাকনাম (ঐচ্ছিক)
                </label>
                <input
                  id="plant-nick"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="যেমন বারান্দার টমেটো"
                  className={input}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className={label} htmlFor="pot">
                  টবের আকার (লিটার)
                </label>
                <input id="pot" type="number" min={1} value={pot} onChange={(e) => { setPot(Number(e.target.value)); setReminders(null); }} className={input} />
                <p className="mt-1 text-xs text-gray-500">মোটামুটি: ৮ ইঞ্চি টব ৪-৫, ১২ ইঞ্চি ১০-১২, ১৪ ইঞ্চি ১৫ লিটার; হাফ ড্রাম প্রায় ১০০ লিটার। ছোট টব তাড়াতাড়ি শুকায়।</p>
              </div>
              <div>
                <label className={label} htmlFor="container">
                  কিসে লাগানো
                </label>
                <select id="container" value={container} onChange={(e) => setContainer(e.target.value)} className={input}>
                  {CONTAINERS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="zone">
                  ছাদের কোথায় (ঐচ্ছিক)
                </label>
                <input id="zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="যেমন পূর্ব কোণ, পানির ট্যাংকের পাশে" className={input} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className={label} htmlFor="soil">
                  মাটির ধরন
                </label>
                <select id="soil" value={soil} onChange={(e) => setSoil(e.target.value)} className={input}>
                  {SOIL_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="sun">
                  দিনে কত ঘণ্টা সরাসরি রোদ পায়
                </label>
                <input id="sun" type="number" min={0} max={14} value={sun} onChange={(e) => setSun(e.target.value)} placeholder="জানা না থাকলে ফাঁকা রাখুন" className={input} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="stage">
                    এখন কোন পর্যায়ে
                  </label>
                  <select id="stage" value={stage} onChange={(e) => setStage(e.target.value)} className={input}>
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="planted">
                    কবে লাগানো
                  </label>
                  <input id="planted" type="date" value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} className={input} />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="notes">
                  নোট (ঐচ্ছিক)
                </label>
                <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-gray-700">কোন কাজের রিমাইন্ডার চান, আর কত দিন পরপর? নিজের মতো বদলে নিন।</p>
              {reminders === null ? (
                <div className="h-32 animate-pulse rounded-xl bg-green-50" />
              ) : (
                <ul className="space-y-2">
                  {reminders.map((r, i) => {
                    const opt = TASK_OPTIONS.find((o) => o.value === r.task)!;
                    return (
                      <li key={r.task} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                        <input
                          type="checkbox"
                          id={`rem-${r.task}`}
                          checked={r.on}
                          onChange={(e) =>
                            setReminders(reminders.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))
                          }
                          className="h-5 w-5 accent-green-600"
                        />
                        <label htmlFor={`rem-${r.task}`} className="flex-1 text-sm font-medium">
                          <IconText icon={opt.icon} iconClass="h-4 w-4 text-green-700">{opt.label}</IconText>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={r.every_days}
                          disabled={!r.on}
                          aria-label={`${opt.label}: কত দিন পরপর`}
                          onChange={(e) =>
                            setReminders(reminders.map((x, j) => (j === i ? { ...x, every_days: Number(e.target.value) } : x)))
                          }
                          className="w-16 rounded-xl border border-green-200 p-2 text-center text-sm disabled:opacity-40"
                        />
                        <span className="text-xs text-gray-500">দিন পরপর</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="rounded-xl bg-yellow-50 p-3 text-xs text-yellow-900">
                <GIcon name="water" className="mr-1 h-4 w-4" />পানির রিমাইন্ডার আসলে &quot;মাটি দেখুন&quot; রিমাইন্ডার: মাটি শুকনো হলে তবেই পানি দিন। ভেজা থাকলে ড্যাশবোর্ডে
                &quot;মাটি ভেজা&quot; চাপলে পরের তারিখ নিজে থেকে পিছিয়ে যাবে।
                {suggestNote && <span className="mt-1 block">{suggestNote}</span>}
              </p>
            </>
          )}

          {step === 4 && (
            <dl className="divide-y divide-green-50 rounded-xl border border-green-100 text-sm">
              {[
                ["গাছ", `${known ? `${known.name_bn} (${name})` : name}${nickname ? ` · ${nickname}` : ""}`],
                ["টব", `${pot} লিটার${container ? `, ${CONTAINERS.find((c) => c.value === container)?.label}` : ""}`],
                ["জায়গা", zone || "দেওয়া হয়নি"],
                ["মাটি", SOIL_TYPES.find((s) => s.value === soil)?.label],
                ["রোদ", sun === "" ? "জানা নেই" : `${sun} ঘণ্টা`],
                ["পর্যায়", STAGES.find((s) => s.value === stage)?.label],
                [
                  "রিমাইন্ডার",
                  reminders
                    ? reminders.filter((r) => r.on).map((r) => `${TASK_OPTIONS.find((o) => o.value === r.task)?.label ?? r.task}: ${r.every_days} দিন`).join(", ") || "কোনোটা না"
                    : "পরামর্শ অনুযায়ী",
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 p-3">
                  <dt className="w-20 shrink-0 text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
            {duplicate && (
              <button onClick={() => save(true)} className="ml-2 font-semibold underline">
                তবুও আরেকটা যোগ করুন
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => (step === 0 ? onClose() : go(step - 1))}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {step === 0 ? "বাতিল" : "← আগের ধাপ"}
          </button>
          <div className="flex flex-wrap gap-2">
            {step < 4 && (
              <button
                onClick={() => save()}
                disabled={saving || !name.trim()}
                className="rounded-full border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40"
              >
                এখনই সেভ করুন
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => go(step + 1)}
                className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                পরের ধাপ →
              </button>
            ) : (
              <button
                onClick={() => save()}
                disabled={saving}
                className="rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "সেভ হচ্ছে..." : <IconText icon="tick" iconClass="h-4 w-4">গাছ যোগ করুন</IconText>}
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">শুধু নাম দিলেই সেভ করা যায়, বাকি তথ্য পরে গাছের পেজ থেকে যোগ করতে পারবেন।</p>
      </div>
    </div>
  );
}
