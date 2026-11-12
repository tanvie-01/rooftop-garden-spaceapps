"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import SoilMixGuide from "@/components/SoilMixGuide";
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { InfoTip, MoreInfo } from "@/components/InfoTip";
import { api, whenText } from "@/lib/garden";

type GoodCrop = { name: string; name_bn: string; category: string; min_pot: number; min_sun: number };
type Report = {
  id: number | null;
  created_at?: string;
  soil_type: string;
  name_bn: string;
  summary: string;
  traits: [string, string][];
  ph_range: [number, number];
  ph_range_label: string;
  ph_note: string;
  ideal_ph: [number, number];
  tips: string[];
  watch_out: string;
  good_crops: GoodCrop[];
  disclaimer: string;
  verified: boolean;
  is_mock: boolean;
  method: "feel" | "jar" | "photo";
  method_bn: string;
  texture: string | null;
  texture_bn: string | null;
  fractions: [number, number, number] | null;
  why?: string;
  saved?: boolean;
};

type Ribbon = "none" | "short" | "medium" | "long";
type Grit = "gritty" | "smooth" | "neither";

const CAT_BN: Record<string, string> = { vegetables: "সবজি", fruits: "ফল", flowers: "ফুল" };
const PH_MIN = 4;
const PH_MAX = 9;
const at = (ph: number) => `${((ph - PH_MIN) / (PH_MAX - PH_MIN)) * 100}%`;
const bn = (n: number) => n.toLocaleString("bn-BD");
// বালি, পলি, কাদা: বোতলে নিচ থেকে উপরে যে ক্রমে জমে
const LAYERS = [
  { key: "sand", label: "বালি", hint: "সবার নিচে, ১ মিনিটে জমে", color: "bg-amber-300" },
  { key: "silt", label: "পলি", hint: "মাঝে, ২ ঘণ্টায় জমে", color: "bg-amber-600" },
  { key: "clay", label: "কাদা", hint: "সবার উপরে, ১–২ দিনে জমে", color: "bg-stone-700" },
] as const;

// পরীক্ষার আগে চোখে দেখে চেনার জন্য তিন ধরনের মাটি আর টবের মিশ্রণ (ছবি ওয়েব থেকে, শিক্ষামূলক ব্যবহার; উৎসের link সহ)
const SOIL_LOOKS = [
  {
    key: "sandy",
    name: "বেলে মাটি",
    look: "হালকা বাদামি, কিরকিরে দানা দেখা যায়। মুঠো খুললেই ঝরে পড়ে।",
    src: "https://hellogravel.com/guides/sandy-soil-definition-characteristics-uses-cost-guide/",
    site: "hellogravel.com",
    more: [
      { file: "sandy-2", credit: "Yesa050907, CC0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Sandy_soil_surface.jpg" },
      { file: "sandy-3", credit: "Ready Street, CC BY-SA 4.0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Sandy_Soil_Image.jpg" },
    ],
  },
  {
    key: "loamy",
    name: "দোআঁশ মাটি",
    look: "গাঢ় বাদামি, ঝুরঝুরে। চাপলে দলা হয়, আঙুল ছোঁয়ালেই ভেঙে যায়।",
    src: "https://www.freepik.com/premium-photo/loam-soil-cultivation-hands-men_29897830.htm",
    site: "freepik.com",
    more: [
      { file: "loamy-2", credit: "M Tullottes, Public domain, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:HandsInSoil.jpg" },
      { file: "loamy-3", credit: "Peter Van den Bossche, CC BY-SA 2.0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Loam_soil_of_Hesbaye.jpg" },
    ],
  },
  {
    key: "clay",
    name: "এঁটেল মাটি",
    look: "মসৃণ আর আঠালো। চাপলে শক্ত দলা হয়ে আকার ধরে রাখে, হাতে লেগে থাকে।",
    src: "https://www.junglemusic.net/palmadvice/palms-landscape1.htm",
    site: "junglemusic.net",
    more: [
      { file: "clay-2", credit: "Cmoffroad, CC0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Red-clay-sticky-plastic-when-wet.jpg" },
      { file: "clay-3", credit: "Anne Burgess, CC BY-SA 2.0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Mud_Cracks_-_geograph.org.uk_-_8353751.jpg" },
    ],
  },
  {
    // ছাদে কালো মাটির চেয়ে কম্পোস্ট/তৈরি মিশ্রণই বেশি ব্যবহার হয়, তাই চতুর্থ কার্ড এটা
    key: "compost",
    name: "কম্পোস্ট / টবের মিশ্রণ",
    look: "গাঢ় কালচে, হালকা আর ঝুরঝুরে; ভেতরে কোকোপিটের আঁশ বা ভার্মিকম্পোস্টের দানা। ভেজা মাটির গন্ধ।",
    src: "https://commons.wikimedia.org/wiki/File:Pro-Mix_Potting_Soil.jpg",
    site: "Public domain, Wikimedia Commons",
    more: [
      { file: "compost-2", credit: "ভার্মিকম্পোস্ট: Red58bill, CC BY 3.0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Worm.casts.jpg" },
      { file: "compost-3", credit: "কোকোপিট: Vegilandcoir, CC BY-SA 4.0, Wikimedia Commons", src: "https://commons.wikimedia.org/wiki/File:Cocopeat-peat2.jpg" },
    ],
  },
] as const;

// প্রতিটা মাটির ২-৩টা ছবি: বড়টায় যেটা বাছা, নিচে ছোট ছবি চাপলে বদলায়; উৎস সবসময় সেই ছবির
function SoilLook({ s }: { s: (typeof SOIL_LOOKS)[number] }) {
  const photos = [{ file: s.key as string, credit: s.site as string, src: s.src as string }, ...s.more];
  const [i, setI] = useState(0);
  const cur = photos[i];
  return (
    <figure className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- static ছবি */}
        <img key={cur.file} src={`/soil/${cur.file}.jpg`} alt={s.name} loading="lazy" className="glass-in aspect-[4/3] w-full object-cover" />
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          {photos.map((p, j) => (
            <button
              key={p.file}
              type="button"
              onClick={() => setI(j)}
              aria-label={`${s.name}: ছবি ${j + 1}`}
              aria-pressed={i === j}
              className={`h-10 w-10 overflow-hidden rounded-xl ring-2 transition ${i === j ? "ring-white" : "opacity-75 ring-white/40 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static ছবি */}
              <img src={`/soil/${p.file}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
      <figcaption className="p-3">
        <span className="flex items-center gap-1 font-bold text-green-900">
          {s.name}
          <InfoTip label="ছবি কোথা থেকে" peek={false} sources={[{ title: cur.credit, url: cur.src }]} />
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-gray-600">{s.look}</span>
        {s.key === "compost" && (
          <a href="#mix" className="mt-1 inline-block text-sm font-semibold text-green-700 underline">
            কী দিয়ে বানায়, দেখুন
          </a>
        )}
      </figcaption>
    </figure>
  );
}

function SoilLooks() {
  return (
    <section aria-labelledby="looks-title" className="mb-6">
      <h2 id="looks-title" className="text-lg font-bold text-green-900">
        আগে চোখে দেখে চিনুন
      </h2>
      <p className="mt-0.5 text-sm text-gray-500">
        আপনার মাটি কোনটার মতো? তারপর নিচের পরীক্ষা দিয়ে নিশ্চিত হোন।{" "}
        <a href="#mix" className="font-semibold text-green-700 underline">কোকোপিট-গোবরের মিশ্রণ?</a>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SOIL_LOOKS.map((s) => (
          <SoilLook key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}

const RIBBONS: { v: Ribbon; label: string; hint: string; w: string }[] = [
  { v: "none", label: "ফিতা হয় না", hint: "চাপলেই ভেঙে যায়", w: "w-0" },
  { v: "short", label: "২.৫ সেমির কম", hint: "এক কড়ের চেয়ে ছোট", w: "w-1/4" },
  { v: "medium", label: "২.৫–৫ সেমি", hint: "প্রায় দুই কড়", w: "w-1/2" },
  { v: "long", label: "৫ সেমির বেশি", hint: "লম্বা, সহজে ভাঙে না", w: "w-full" },
];
const GRITS: { v: Grit; label: string; hint: string; icon: GIconName }[] = [
  { v: "gritty", label: "কিরকিরে", hint: "বালির দানা টের পাই", icon: "grains" },
  { v: "smooth", label: "মসৃণ", hint: "মাখন বা ময়দার মতো পিছলে যায়", icon: "smooth" },
  { v: "neither", label: "মাঝামাঝি", hint: "কোনোটাই বেশি না", icon: "hand" },
];

async function postTest(body: unknown): Promise<Report> {
  return api<Report>("/soil/test", { method: "POST", body });
}

function SoilView() {
  const [method, setMethod] = useState<"feel" | "jar">("feel");
  const [result, setResult] = useState<Report | null>(null);
  const [history, setHistory] = useState<Report[]>([]);

  useEffect(() => {
    api<Report[]>("/soil/reports").then(setHistory).catch(() => {});
  }, []);

  function done(r: Report) {
    setResult(r);
    setHistory((h) => [r, ...h]);
    requestAnimationFrame(() => document.getElementById("report-title")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function remove(id: number) {
    await api(`/soil/reports/${id}`, { method: "DELETE" }).catch(() => {});
    setHistory((h) => h.filter((r) => r.id !== id));
    if (result?.id === id) setResult(null);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <PageHeader icon="soil" title="মাটি পরীক্ষা" subtitle="ঘরে বসে মাটির ধরন জানুন" />

      <SoilLooks />

      <div role="tablist" aria-label="পরীক্ষার ধরন" className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { v: "feel", icon: "hand", title: "হাতের পরীক্ষা", meta: "৫ মিনিট · শুধু পানি লাগে" },
            { v: "jar", icon: "jar", title: "বোতল পরীক্ষা", meta: "১–২ দিন · বেশি নির্ভুল" },
          ] as const
        ).map((m) => (
          <button
            key={m.v}
            role="tab"
            aria-selected={method === m.v}
            onClick={() => setMethod(m.v)}
            className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
              method === m.v ? "border-green-600 bg-green-50 shadow-sm" : "border-gray-100 bg-white hover:border-green-200"
            }`}
          >
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
              <GIcon name={m.icon} className="h-7 w-7" />
            </span>
            <span>
              <span className="block font-bold text-green-900">{m.title}</span>
              <span className="block text-sm text-gray-500">{m.meta}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-3xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
        {method === "feel" ? <FeelTest onDone={done} /> : <JarTest onDone={done} />}
      </div>

      {result && <SoilReportCard r={result} />}

      <SoilMixGuide />

      {history.length > 0 && (
        <section className="mt-8" aria-labelledby="history-title">
          <h2 id="history-title" className="text-lg font-bold text-green-900">
            আগের রিপোর্ট
          </h2>
          <ul className="mt-2 divide-y divide-green-50 rounded-2xl border border-green-100 bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <button onClick={() => setResult(h)} className="min-w-0 flex-1 text-left">
                  <span className="font-semibold text-gray-900">{h.texture_bn ?? h.name_bn}</span>{" "}
                  <span className="text-gray-500">
                    · {h.method_bn} · {whenText(h.created_at ?? null)}
                  </span>
                  {h.is_mock && <span className="ml-2 text-xs text-amber-700">(নমুনা)</span>}
                </button>
                <button onClick={() => h.id && remove(h.id)} aria-label="রিপোর্ট মুছে ফেলুন" className="text-gray-400 hover:text-red-600">
                  <GIcon name="trash" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
        selected ? "border-green-600 bg-green-50" : "border-gray-100 hover:border-green-300 hover:bg-green-50/40"
      }`}
    >
      {children}
    </button>
  );
}

function FeelTest({ onDone }: { onDone: (r: Report) => void }) {
  const [step, setStep] = useState(0);
  const [ball, setBall] = useState<boolean | null>(null);
  const [ribbon, setRibbon] = useState<Ribbon | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function finish(b: boolean, r: Ribbon = "none", g: Grit = "neither") {
    setBusy(true);
    setError("");
    try {
      onDone(await postTest({ method: "feel", ball: b, ribbon: r, grit: g }));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "ফল বের করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep(0);
    setBall(null);
    setRibbon(null);
  }

  // গোল্লা না বাঁধলে বেলে, ফিতা না হলে দোআঁশ বেলে: বাকি প্রশ্ন লাগে না
  const total = 4;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <ol className="flex gap-1.5" aria-label={`ধাপ ${bn(step + 1)} / ${bn(total)}`}>
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-green-600" : "bg-green-100"}`} />
          ))}
        </ol>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="text-sm text-green-700 hover:underline">
            ← আগের ধাপ
          </button>
        )}
      </div>

      {step === 0 && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-green-900">প্রস্তুতি</h2>
          <ol className="mt-3 space-y-3">
            {[
              ["trowel", "টবের ৫–৭ সেমি নিচ থেকে এক মুঠো মাটি নিন। পাথর, শিকড় আর পাতা ফেলে দিন।"],
              ["water", "একটু একটু পানি দিয়ে মাখুন, যতক্ষণ না পুটির মতো নরম হয়। পানি যেন গড়িয়ে না পড়ে।"],
              ["hand", "হাতের তালুতে রাখুন। এবার ৩টা ছোট প্রশ্নের উত্তর দিন।"],
            ].map(([icon, text], i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-green-50/70 p-3">
                <GIcon name={icon as GIconName} className="h-6 w-6 text-green-700" />
                <span className="text-gray-700">{text}</span>
              </li>
            ))}
          </ol>
          <button
            onClick={() => setStep(1)}
            className="mt-5 w-full rounded-full bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/20 hover:bg-green-700"
          >
            মাটি তৈরি, শুরু করুন
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-green-900">১. মুঠোয় চাপ দিলে গোল্লা বাঁধে?</h2>
          <p className="mt-1 text-sm text-gray-500">ভেজা মাটি মুঠোয় জোরে চেপে হাত খুলুন।</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice selected={ball === true} onClick={() => { setBall(true); setStep(2); }}>
              <GIcon name="ball" className="h-8 w-8 text-amber-700" />
              <span className="mt-1 block font-semibold">হ্যাঁ, গোল্লা থাকে</span>
              <span className="text-sm text-gray-500">আকার ধরে রাখে</span>
            </Choice>
            <Choice selected={ball === false} onClick={() => { setBall(false); finish(false); }}>
              <GIcon name="grains" className="h-8 w-8 text-amber-700" />
              <span className="mt-1 block font-semibold">না, ঝরে পড়ে</span>
              <span className="text-sm text-gray-500">দানা দানা হয়ে ভেঙে যায়</span>
            </Choice>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-green-900">২. আঙুলে চেপে ফিতা বানান। কত লম্বা হয়?</h2>
          <p className="mt-1 text-sm text-gray-500">
            গোল্লাটা বুড়ো আঙুল আর তর্জনীর মাঝে রেখে বুড়ো আঙুল দিয়ে সামনে ঠেলে চ্যাপ্টা ফিতা বানান, যতক্ষণ না নিজের ভারে ভেঙে পড়ে।
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {RIBBONS.map((r) => (
              <Choice
                key={r.v}
                selected={ribbon === r.v}
                onClick={() => {
                  setRibbon(r.v);
                  if (r.v === "none") finish(true, "none");
                  else setStep(3);
                }}
              >
                <span className="block h-3 rounded-full bg-amber-100">
                  <span className={`block h-3 rounded-full bg-amber-700 ${r.w}`} />
                </span>
                <span className="mt-2 block font-semibold">{r.label}</span>
                <span className="text-sm text-gray-500">{r.hint}</span>
              </Choice>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-green-900">৩. এক চিমটি ভিজিয়ে আঙুলে ঘষুন। কেমন লাগে?</h2>
          <p className="mt-1 text-sm text-gray-500">তালুতে আরও একটু পানি দিয়ে তর্জনী দিয়ে ঘষে দেখুন।</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {GRITS.map((g) => (
              <Choice key={g.v} selected={false} onClick={() => finish(ball ?? true, ribbon ?? "short", g.v)}>
                <GIcon name={g.icon} className="h-8 w-8 text-amber-700" />
                <span className="mt-1 block font-semibold">{g.label}</span>
                <span className="text-sm text-gray-500">{g.hint}</span>
              </Choice>
            ))}
          </div>
        </div>
      )}

      {busy && <p className="mt-4 text-sm text-gray-500">ফল বের করা হচ্ছে...</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {step > 0 && !busy && (
        <button onClick={restart} className="mt-4 text-sm text-gray-500 hover:text-green-700">
          <IconText icon="refresh" iconClass="h-4 w-4">আবার শুরু করুন</IconText>
        </button>
      )}
      <p className="mt-4 flex items-center gap-1 text-xs text-gray-400">
        <InfoTip label="পদ্ধতি" hint="USDA পদ্ধতি" sources={[{ title: "USDA NRCS: Soil texture by feel (Thien, 1979)" }]}>হাতে মাটির দানা, গোল্লা আর ফিতা দেখে ধরন বের করার প্রচলিত পদ্ধতি।</InfoTip>
      </p>
    </div>
  );
}

function JarTest({ onDone }: { onDone: (r: Report) => void }) {
  const [mm, setMm] = useState({ sand: "", silt: "", clay: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nums = { sand: Number(mm.sand) || 0, silt: Number(mm.silt) || 0, clay: Number(mm.clay) || 0 };
  const total = nums.sand + nums.silt + nums.clay;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await postTest({ method: "jar", sand_mm: nums.sand, silt_mm: nums.silt, clay_mm: nums.clay }));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "ফল বের করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-green-900">বোতল পরীক্ষা কীভাবে করবেন</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ["jar", "একটা সোজা, স্বচ্ছ বোতল বা কাচের বয়ামের ১/৩ ভাগ মাটি দিন (পাথর, শিকড় বাদ)।"],
          ["water", "প্রায় ভর্তি করে পানি দিন, এক চা-চামচ গুঁড়া সাবান বা ডিটারজেন্ট মেশান (লবণ নয়, লবণে কাদা তাড়াতাড়ি পলির সাথে বসে যায়)।"],
          ["refresh", "ঢাকনা লাগিয়ে ৩–৫ মিনিট জোরে ঝাঁকান, তারপর নড়াচড়া ছাড়া রেখে দিন।"],
          ["ruler", "১–২ দিন পর পানি পরিষ্কার হলে স্কেল দিয়ে প্রতিটা স্তরের পুরুত্ব মিমি-তে মাপুন।"],
        ].map(([icon, text], i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-green-50/70 p-3 text-sm text-gray-700">
            <GIcon name={icon as GIconName} className="h-5 w-5 text-green-700" />
            <span>
              <span className="font-semibold text-green-800">{bn(i + 1)}.</span> {text}
            </span>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          {[...LAYERS].reverse().map((l) => (
            <label key={l.key} className="flex items-center gap-3">
              <span className={`h-9 w-2 shrink-0 rounded-full ${l.color}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-gray-800">{l.label}</span>
                <span className="block text-xs text-gray-500">{l.hint}</span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={500}
                  step="any"
                  required
                  value={mm[l.key]}
                  onChange={(e) => setMm({ ...mm, [l.key]: e.target.value })}
                  placeholder="০"
                  className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-right tabular-nums outline-none focus:border-green-500"
                />
                <span className="text-sm text-gray-500">মিমি</span>
              </span>
            </label>
          ))}
        </div>

        {/* বোতলের ছবি: মাপ দিলে স্তরগুলো আঁকা হয় */}
        <div className="flex items-end justify-center gap-4 sm:flex-col sm:items-center">
          <div
            role="img"
            aria-label={`বালি ${pct(nums.sand)}%, পলি ${pct(nums.silt)}%, কাদা ${pct(nums.clay)}%`}
            className="flex h-44 w-24 flex-col-reverse overflow-hidden rounded-b-3xl rounded-t-lg border-4 border-sky-200 bg-sky-50"
          >
            {LAYERS.map((l) => (
              <div key={l.key} className={`${l.color} transition-all`} style={{ height: `${total ? (pct(nums[l.key]) * 0.85) : 0}%` }} />
            ))}
          </div>
          <dl className="text-sm tabular-nums">
            {LAYERS.map((l) => (
              <div key={l.key} className="flex justify-between gap-3">
                <dt className="text-gray-500">{l.label}</dt>
                <dd className="font-semibold">{bn(pct(nums[l.key]))}%</dd>
              </div>
            ))}
          </dl>
        </div>

        <button
          disabled={busy || total < 5}
          className="rounded-full bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
        >
          {busy ? "হিসাব হচ্ছে..." : "মাটির ধরন বের করুন"}
        </button>
      </form>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="mt-4 flex items-center gap-1 text-xs text-gray-400">
        <InfoTip label="পদ্ধতি" hint="USDA পদ্ধতি" sources={[{ title: "USDA soil texture triangle" }]}>স্তর আয়তনে মাপা, ল্যাবের মতো ওজনে নয়, তাই ফল কাছাকাছি অনুমান। শ্রেণি বের হয় USDA texture triangle দিয়ে।</InfoTip>
      </p>
    </div>
  );
}

function SoilReportCard({ r }: { r: Report }) {
  const byCat = Object.entries(CAT_BN)
    .map(([cat, label]) => [label, r.good_crops.filter((c) => c.category === cat)] as const)
    .filter(([, list]) => list.length);

  return (
    <article className="mt-6 space-y-5 rounded-3xl border border-green-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="report-title">
      {r.is_mock && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <GIcon name="warning" className="mr-1 h-4 w-4" />এটা পুরোনো নমুনা রিপোর্ট: ছবির মডেল এলোমেলোভাবে ধরন বেছেছিল। নতুন করে হাতের বা বোতল পরীক্ষা করুন।
        </p>
      )}

      <header>
        <p className="flex flex-wrap items-center gap-2 text-sm text-green-700">
          <span>আপনার মাটি</span>
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">{r.method_bn}</span>
        </p>
        <h2 id="report-title" className="mt-1 text-3xl font-bold text-green-900">
          {r.texture_bn ?? r.name_bn}
          {r.texture && <span className="ml-2 text-lg font-medium text-gray-500">({r.texture})</span>}
        </h2>
        {r.texture_bn && r.texture_bn !== r.name_bn.replace(" মাটি", "") && (
          <p className="mt-1 text-sm text-gray-600">
            টবের যত্নে এটা <span className="font-semibold">{r.name_bn}</span>-র মতো
          </p>
        )}
        {r.why && !r.fractions && <p className="mt-2 text-sm text-gray-500">কেন: {r.why}</p>}
      </header>

      {r.fractions && (
        <div>
          <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label={`বালি ${r.fractions[0]}%, পলি ${r.fractions[1]}%, কাদা ${r.fractions[2]}%`}>
            {LAYERS.map((l, i) => (
              <div key={l.key} className={l.color} style={{ width: `${r.fractions![i]}%` }} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-gray-600 tabular-nums">
            {LAYERS.map((l, i) => (
              <span key={l.key} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${l.color}`} /> {l.label} {bn(r.fractions![i])}%
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-gray-700">{r.summary}</p>

      <dl className="grid gap-2 sm:grid-cols-2">
        {r.traits.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-green-50/70 px-3 py-2">
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className="text-sm font-medium text-gray-800">{v}</dd>
          </div>
        ))}
      </dl>

      {/* pH */}
      <section aria-labelledby="ph-title">
        <h3 id="ph-title" className="font-semibold text-green-900">
          সাধারণ pH: <span className="tabular-nums">{r.ph_range[0]}–{r.ph_range[1]}</span>{" "}
          <span className="font-normal text-gray-600">({r.ph_range_label})</span>
        </h3>
        <div className="relative mt-3 h-8" role="img" aria-label={`এই মাটির সাধারণ pH ${r.ph_range[0]} থেকে ${r.ph_range[1]}; বেশির ভাগ সবজির জন্য আদর্শ ${r.ideal_ph[0]} থেকে ${r.ideal_ph[1]}`}>
          <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-gradient-to-r from-orange-300 via-lime-300 to-sky-400 opacity-60" />
          <div
            className="absolute top-1.5 h-5 rounded-lg border-2 border-dashed border-green-700"
            style={{ left: at(r.ideal_ph[0]), width: `calc(${at(r.ideal_ph[1])} - ${at(r.ideal_ph[0])})` }}
          />
          <div
            className="absolute top-2.5 h-3 rounded-full bg-amber-800"
            style={{ left: at(r.ph_range[0]), width: `calc(${at(r.ph_range[1])} - ${at(r.ph_range[0])})` }}
          />
        </div>
        <div className="relative h-4 text-[11px] tabular-nums text-gray-500">
          {[4, 5, 6, 7, 8, 9].map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: at(v) }}>
              {v}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-5 rounded-full bg-amber-800" /> এই মাটিতে সাধারণত
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-5 rounded border-2 border-dashed border-green-700" /> বেশির ভাগ সবজির আদর্শ ({r.ideal_ph[0]}–{r.ideal_ph[1]})
          </span>
          <span>← অম্লীয় · ক্ষারীয় →</span>
        </div>
        <p className="mt-2 text-sm text-gray-700">{r.ph_note}</p>
      </section>

      {/* কী ভালো হয় */}
      <section aria-labelledby="crops-title">
        <h3 id="crops-title" className="font-semibold text-green-900">
          এই মাটিতে যা ভালো হয়
        </h3>
        <div className="mt-2 space-y-2">
          {byCat.map(([label, list]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-500">{label}</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {list.map((c) => (
                  <li key={c.name} className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-900">
                    {c.name_bn}
                    <span className="ml-1 text-xs text-gray-500">
                      · টব ≥{c.min_pot} লি. · রোদ ≥{c.min_sun} ঘ.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3">
          <Link href="/crops" className="inline-flex items-center gap-1 rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700">
            টব আর রোদ মিলিয়ে ফসল সাজেশন দেখুন →
          </Link>
        </p>
      </section>

      <section aria-labelledby="tips-title">
        <h3 id="tips-title" className="font-semibold text-green-900">
          ছাদের টবে এই মাটি ভালো রাখতে
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {r.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><GIcon name="warning" className="mr-1 h-4 w-4" />{r.watch_out}</p>
      </section>

      <footer className="space-y-1 border-t border-green-100 pt-4 text-xs text-gray-500">
        <MoreInfo title="সতর্কতা" items={[r.disclaimer, ...(!r.verified ? ["এই মাটির তথ্য এখনো কৃষি বিশেষজ্ঞ দিয়ে যাচাই করা হয়নি।"] : [])]} />
        {r.saved && <p className="text-green-700"><GIcon name="tick" className="mr-1 h-3.5 w-3.5" />রিপোর্ট সেভ হয়েছে। AI সহকারী এখন আপনার মাটি দেখে পরামর্শ দেবে।</p>}
      </footer>
    </article>
  );
}

export default function SoilPage() {
  return (
    <LoginGate next="/soil" why="মাটির পরীক্ষার ফল আপনার জন্য সেভ রাখতে, আর AI সহকারী যেন সেটা দেখে পরামর্শ দেয়, তাই লগইন লাগে।">
      <SoilView />
    </LoginGate>
  );
}
