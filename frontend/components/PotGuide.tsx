"use client";
// "টব কত লিটার?" চেনার গাইড: সব পাত্র একই স্কেলে আঁকা (পাশে ১ লিটারের বোতল), চেনা জিনিসের সাথে তুলনা,
// আর ফিতা দিয়ে মেপে লিটার বের করার ছোট হিসাব। ছবিগুলো নিজেদের আঁকা SVG, তাই কপিরাইটের ঝামেলা নেই
// আর সব পাত্র একই মাপে তুলনা করা যায় (আলাদা ছবিতে দূরত্ব ভিন্ন থাকে, মাপ বোঝা যায় না)।
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GIcon } from "@/components/garden-icons";
import { POT_CHOICES, bnDigits } from "@/lib/garden";

type Shape = "pot" | "bucket" | "bag" | "drum";
// d = মুখের চওড়া, h = উচ্চতা (ইঞ্চি); value মিলবে POT_CHOICES-এর সাথে
const POTS: { value: number; shape: Shape; d: number; h: number; name: string; like: string; fits: string }[] = [
  { value: 2, shape: "pot", d: 6, h: 5, name: "৫-৬ ইঞ্চি ছোট টব", like: "চায়ের বড় মগের চেয়ে একটু বড়; দুই লিটারের কোকের বোতল সমান মাটি", fits: "শুধু চারা তোলা বা ছোট সাকুলেন্ট; তালিকার ফসলে অন্তত ৩-৫ লিটার লাগে" },
  { value: 5, shape: "pot", d: 9, h: 8, name: "৮-৯ ইঞ্চি টব", like: "মুখ মোটামুটি এক বিঘত (হাতের আঙুল ছড়িয়ে); ৫ লিটারের তেলের বোতল সমান মাটি", fits: "শাক, ধনেপাতা, গাঁদা, জিনিয়া" },
  { value: 10, shape: "pot", d: 12, h: 10, name: "১২ ইঞ্চি টব", like: "মুখ এক ফুট, একটা স্কেলের সমান; ছোট রঙের বালতির মতো", fits: "মরিচ, মুলা, পুঁইশাক" },
  { value: 15, shape: "bucket", d: 12, h: 13, name: "১৪ ইঞ্চি টব / রঙের বড় বালতি", like: "১৫-২০ লিটারের রঙের বালতি (নিচে ছিদ্র করে)", fits: "টমেটো, ঢেঁড়স, গোলাপ, জবা" },
  { value: 30, shape: "bag", d: 14, h: 12, name: "বড় টব / গ্রো ব্যাগ ১৪×১২", like: "প্যাকেটে লেখা থাকে ১৪×১২ ইঞ্চি বা ১৫×১২", fits: "বেগুন, লেবু, বড় মরিচ গাছ" },
  { value: 60, shape: "bag", d: 18, h: 15, name: "বড় গ্রো ব্যাগ ১৮×১৫ / ছোট ড্রাম", like: "প্যাকেটে লেখা ১৮×১৫ বা ২০×১৫; বা ১০০ লিটার ড্রামের অর্ধেক", fits: "পেঁপে, পেয়ারা, কলা" },
  { value: 100, shape: "drum", d: 23, h: 17, name: "হাফ ড্রাম", like: "২০০ লিটারের নীল প্লাস্টিক বা লোহার ড্রাম মাঝখান দিয়ে কেটে অর্ধেক", fits: "পেয়ারা, কলা, পেঁপে, লেবু" },
];

const PX = 3.2; // প্রতি ইঞ্চিতে কত px, সব ছবিতে একই (হাফ ড্রামও ১০৪px বাক্সে ধরে)
const BOX_H = 17 * PX + 10;

/** একটা পাত্র, স্কেলে আঁকা; পাশে ছাই রঙের ১ লিটারের বোতল */
function Container({ shape, d, h, withBottle = true }: { shape: Shape; d: number; h: number; withBottle?: boolean }) {
  const w = d * PX, H = h * PX;
  const bw = 3.2 * PX, bh = 11 * PX; // ১ লিটারের বোতল ≈ ৩.২×১১ ইঞ্চি
  const gap = withBottle ? bw + 8 : 0;
  const W = w + gap + 4;
  const y0 = BOX_H - 2; // মাটির রেখা
  const x = 2;
  let body: React.ReactNode;
  if (shape === "pot") {
    const b = w * 0.74;
    body = (
      <>
        <path d={`M${x + (w - b) / 2} ${y0} L${x + w * 0.04} ${y0 - H + 6} L${x + w * 0.96} ${y0 - H + 6} L${x + (w + b) / 2} ${y0} Z`} fill="url(#pg-clay)" />
        <rect x={x} y={y0 - H} width={w} height={7} rx={2.5} fill="#b45309" />
        <ellipse cx={x + w / 2} cy={y0 - H + 2} rx={w / 2 - 3} ry={2} fill="#5b3a1e" />
      </>
    );
  } else if (shape === "bucket") {
    const b = w * 0.84;
    body = (
      <>
        <path d={`M${x + w * 0.2} ${y0 - H + 2} Q${x + w / 2} ${y0 - H - 16} ${x + w * 0.8} ${y0 - H + 2}`} fill="none" stroke="#64748b" strokeWidth={1.6} />
        <path d={`M${x + (w - b) / 2} ${y0} L${x} ${y0 - H} L${x + w} ${y0 - H} L${x + (w + b) / 2} ${y0} Z`} fill="url(#pg-blue)" />
        <rect x={x - 1} y={y0 - H} width={w + 2} height={4} rx={2} fill="#1d4ed8" />
        <rect x={x + w * 0.15} y={y0 - H * 0.6} width={w * 0.7} height={H * 0.22} rx={2} fill="#fff" opacity={0.35} />
      </>
    );
  } else if (shape === "bag") {
    body = (
      <>
        <path d={`M${x + 2} ${y0} Q${x} ${y0 - H / 2} ${x + 2} ${y0 - H} L${x + w - 2} ${y0 - H} Q${x + w} ${y0 - H / 2} ${x + w - 2} ${y0} Z`} fill="url(#pg-bag)" />
        <rect x={x + 6} y={y0 - H + 6} width={6} height={10} rx={2} fill="none" stroke="#14532d" strokeWidth={1.4} />
        <rect x={x + w - 12} y={y0 - H + 6} width={6} height={10} rx={2} fill="none" stroke="#14532d" strokeWidth={1.4} />
        <path d={`M${x + 4} ${y0 - H * 0.35} H${x + w - 4}`} stroke="#14532d" strokeOpacity={0.25} strokeDasharray="3 3" />
      </>
    );
  } else {
    body = (
      <>
        <rect x={x} y={y0 - H} width={w} height={H} rx={4} fill="url(#pg-drum)" />
        {[0.3, 0.68].map((f) => (
          <rect key={f} x={x - 1} y={y0 - H * f - 2} width={w + 2} height={4} rx={2} fill="#1e3a8a" opacity={0.55} />
        ))}
        <rect x={x} y={y0 - H} width={w} height={5} rx={2} fill="#1e40af" />
      </>
    );
  }
  return (
    <svg width={W} height={BOX_H} viewBox={`0 0 ${W} ${BOX_H}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id="pg-clay" x1="0" x2="1">
          <stop offset="0" stopColor="#c2410c" /><stop offset=".55" stopColor="#ea8a4a" /><stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="pg-blue" x1="0" x2="1">
          <stop offset="0" stopColor="#2563eb" /><stop offset=".55" stopColor="#60a5fa" /><stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="pg-bag" x1="0" x2="1">
          <stop offset="0" stopColor="#15803d" /><stop offset=".5" stopColor="#4ade80" /><stop offset="1" stopColor="#166534" />
        </linearGradient>
        <linearGradient id="pg-drum" x1="0" x2="1">
          <stop offset="0" stopColor="#1e40af" /><stop offset=".5" stopColor="#3b82f6" /><stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      {body}
      {withBottle && (
        <g transform={`translate(${x + w + 8} 0)`} opacity={0.55}>
          <rect x={bw * 0.32} y={y0 - bh} width={bw * 0.36} height={6} rx={1.5} fill="#94a3b8" />
          <path d={`M${bw * 0.3} ${y0 - bh + 6} Q0 ${y0 - bh + 20} 0 ${y0 - bh + 30} V${y0 - 2} Q0 ${y0} 2 ${y0} H${bw - 2} Q${bw} ${y0} ${bw} ${y0 - 2} V${y0 - bh + 30} Q${bw} ${y0 - bh + 20} ${bw * 0.7} ${y0 - bh + 6} Z`} fill="#cbd5e1" />
        </g>
      )}
    </svg>
  );
}

const LITER_PER_CUIN = 0.016387;

/** মুখ, তলা আর উচ্চতা থেকে লিটার; উপরের ১ ইঞ্চি খালি থাকে ধরে */
function liters(shape: "round" | "straight" | "box", a: number, b: number, h: number) {
  const fill = Math.max(h - 1, 0);
  if (shape === "box") return a * b * fill * LITER_PER_CUIN;
  const top = a / 2, bot = shape === "round" ? (a * 0.75) / 2 : top;
  return ((Math.PI * fill) / 3) * (top * top + top * bot + bot * bot) * LITER_PER_CUIN;
}

function nearestChoice(l: number) {
  return POT_CHOICES.reduce((best, c) => (Math.abs(Math.log(c.value / l)) < Math.abs(Math.log(best.value / l)) ? c : best));
}

function Calculator({ onPick }: { onPick?: (v: number) => void }) {
  const [shape, setShape] = useState<"round" | "straight" | "box">("round");
  const [a, setA] = useState("12");
  const [b, setB] = useState("12");
  const [h, setH] = useState("10");
  const n = (s: string) => Math.min(60, Math.max(0, Number(s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))) || 0));
  const l = liters(shape, n(a), n(b), n(h));
  const pick = l > 0.3 ? nearestChoice(l) : null;
  const field = "w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-center text-base font-semibold text-gray-900 focus:border-green-500 focus:outline-none";
  const shapes = [
    { v: "round", t: "গোল টব", s: "নিচে সরু" },
    { v: "straight", t: "সোজা", s: "বালতি, ড্রাম, গ্রো ব্যাগ" },
    { v: "box", t: "চারকোনা", s: "টব বা বেড" },
  ] as const;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50/60 p-4 ring-1 ring-green-100">
      <p className="flex items-center gap-2 font-bold text-green-900">
        <GIcon name="ruler" className="h-5 w-5" /> ফিতা দিয়ে মেপে দেখুন
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="টবের গড়ন">
        {shapes.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={shape === o.v}
            onClick={() => setShape(o.v)}
            className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
              shape === o.v ? "bg-gradient-to-b from-emerald-500 to-green-600 text-white shadow-sm" : "bg-white text-green-900 ring-1 ring-green-100 hover:bg-green-50"
            }`}
          >
            {o.t}
            <span className={`block text-[11px] font-normal ${shape === o.v ? "text-white/85" : "text-gray-500"}`}>{o.s}</span>
          </button>
        ))}
      </div>
      <div className={`mt-3 grid gap-2 ${shape === "box" ? "grid-cols-3" : "grid-cols-2"}`}>
        <label className="text-xs font-medium text-gray-600">
          {shape === "box" ? "লম্বা (ইঞ্চি)" : "মুখের চওড়া (ইঞ্চি)"}
          <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} className={`${field} mt-1`} />
        </label>
        {shape === "box" && (
          <label className="text-xs font-medium text-gray-600">
            চওড়া (ইঞ্চি)
            <input inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} className={`${field} mt-1`} />
          </label>
        )}
        <label className="text-xs font-medium text-gray-600">
          উচ্চতা (ইঞ্চি)
          <input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-green-100">
        <p className="text-gray-700">
          প্রায় <b className="text-2xl text-green-700">{bnDigits(l < 10 ? l.toFixed(1) : Math.round(l))}</b> লিটার
          {pick && <span className="block text-sm text-gray-500">তালিকায় বেছে নিন: <b className="text-gray-800">{pick.label}</b></span>}
        </p>
        {pick && onPick && (
          <button type="button" onClick={() => onPick(pick.value)} className="ml-auto rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700">
            এটাই নিন
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">মুখের এক কিনারা থেকে উল্টো কিনারা পর্যন্ত মাপুন। ফিতা না থাকলে: হাতের বিঘত প্রায় ৮-৯ ইঞ্চি, A4 কাগজের লম্বা দিক প্রায় ১২ ইঞ্চি।</p>
    </div>
  );
}

export default function PotGuide({ onPick, value }: { onPick?: (v: number) => void; value?: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (v: number) => {
    onPick?.(v);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        aria-label="কোন টব কত লিটার, চেনার গাইড"
        title="টব চিনবো কীভাবে?"
        className="relative inline-flex items-center rounded-full p-0.5 align-middle text-green-700 opacity-70 transition after:absolute after:-inset-2.5 hover:opacity-100"
      >
        <GIcon name="info" className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-green-950/40 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="কোন টব কত লিটার"
              onClick={(e) => e.stopPropagation()}
              className="glass-in max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm" aria-hidden>
                  <GIcon name="pot" className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-green-900">কোন টব কত লিটার?</h2>
                  <p className="text-sm text-gray-500">সব ছবি একই মাপে আঁকা। পাশের ছাই রঙেরটা ১ লিটারের পানির বোতল।</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
                  <GIcon name="x" className="h-5 w-5" />
                </button>
              </div>

              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {POTS.map((p) => {
                  const on = value === p.value;
                  return (
                    <li key={p.value} className={`flex gap-3 rounded-2xl border p-3 ${on ? "border-green-400 bg-green-50/70" : "border-green-100"}`}>
                      <div className="flex w-[104px] shrink-0 items-end justify-center overflow-hidden rounded-xl bg-gradient-to-b from-sky-50 to-green-50 px-1 pt-2">
                        <Container shape={p.shape} d={p.d} h={p.h} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900">
                          <span className="text-green-700">~{bnDigits(p.value)} লিটার</span> · {p.name}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-600">{p.like}</p>
                        <p className="mt-1 text-xs text-gray-500">{p.value < 3 ? p.fits : `যেমন: ${p.fits}`}</p>
                        {onPick && (
                          <button type="button" onClick={() => choose(p.value)} className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-green-600 text-white" : "bg-green-50 text-green-800 ring-1 ring-green-200 hover:bg-green-100"}`}>
                            {on ? "বেছে নেওয়া আছে" : "এটাই আমার টব"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4">
                <Calculator onPick={onPick ? choose : undefined} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
