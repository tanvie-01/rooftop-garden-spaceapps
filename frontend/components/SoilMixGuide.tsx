// ছাদের টবে অনেকে খাঁটি মাটি নয়, তৈরি মিশ্রণ ব্যবহার করে। উপাদান চেনা, প্রচলিত অনুপাত, আর আমাদের পরামর্শে
// কীভাবে বেছে নেবেন। উৎস: প্রথম আলোর দুটো ছাদবাগান লেখা (নার্সারি মালিক ও কৃষিবিদের পরামর্শ)। বিশেষজ্ঞ যাচাই নয়।
import Link from "next/link";
import { GIcon } from "@/components/garden-icons";
import { InfoTip } from "@/components/InfoTip";

const SRC = {
  pa1: { title: "প্রথম আলো: ছাদবাগানের জন্য ভালো মাটি কোথায় পাবেন", url: "https://www.prothomalo.com/lifestyle/xevhmdanoe" },
  pa2: { title: "প্রথম আলো: শীতে ছাদবাগানের জন্য এখন থেকেই প্রস্তুতি", url: "https://www.prothomalo.com/lifestyle/qprwvn0l0n" },
};

// প্রতিটা উপাদানের রং ও দানা SVG-তে আঁকা, যেন দেখে মেলানো যায়
const PARTS: { name: string; look: string; base: string; dot: string; fiber?: boolean; grain?: "fine" | "big" | "crumb" }[] = [
  { name: "দোআঁশ মাটি", look: "বাদামি, ঝুরঝুরে; মুঠোয় চাপলে হালকা গোল্লা হয়ে আবার ভেঙে যায়", base: "#92400e", dot: "#b45309", grain: "fine" },
  { name: "পচা গোবর / কম্পোস্ট", look: "গাঢ় কালচে বাদামি, দুর্গন্ধ নেই, হাতে লেগে থাকে না", base: "#3f2a14", dot: "#6b4423", grain: "crumb" },
  { name: "ভার্মিকম্পোস্ট", look: "প্রায় কালো, চায়ের পাতার মতো ছোট দানা; ভেজা মাটির গন্ধ", base: "#1c1917", dot: "#44403c", grain: "big" },
  { name: "কোকোপিট", look: "হালকা লালচে-বাদামি আঁশ, খুব হালকা; পানি দিলে ফুলে ওঠে", base: "#b9774a", dot: "#d9a27a", fiber: true },
  { name: "বালু / ধানের তুষ", look: "বালু কিরকিরে, তুষ সোনালি খোসা; পানি দ্রুত বের করে দেয়", base: "#d6b77a", dot: "#f5deb3", grain: "fine" },
];

function Swatch({ p, i }: { p: (typeof PARTS)[number]; i: number }) {
  const dots = Array.from({ length: p.grain === "big" ? 14 : 22 }, (_, k) => {
    const a = (k * 137.5 + i * 31) % 360, r = 6 + ((k * 7) % 15);
    return [24 + r * Math.cos((a * Math.PI) / 180), 24 + r * Math.sin((a * Math.PI) / 180)];
  });
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14 shrink-0 drop-shadow-sm" aria-hidden>
      <circle cx="24" cy="24" r="22" fill={p.base} />
      {p.fiber
        ? dots.map(([x, y], k) => <path key={k} d={`M${x - 3} ${y}q3 ${k % 2 ? -2 : 2} 6 0`} stroke={p.dot} strokeWidth="1.2" fill="none" strokeLinecap="round" />)
        : dots.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={p.grain === "big" ? 2.2 : p.grain === "crumb" ? 1.6 : 0.9} fill={p.dot} />)}
      <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" />
    </svg>
  );
}

const RECIPES = [
  { name: "সাধারণ মিশ্রণ", parts: [[50, "দোআঁশ মাটি", "#92400e"], [30, "পচা গোবর / ভার্মিকম্পোস্ট", "#3f2a14"], [20, "কোকোপিট", "#b9774a"]] },
  { name: "পানি দ্রুত বের হবে এমন", parts: [[40, "দোআঁশ মাটি", "#92400e"], [30, "জৈব সার", "#3f2a14"], [20, "কোকোপিট", "#b9774a"], [10, "বালু / তুষ", "#d6b77a"]] },
] as const;

const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

export default function SoilMixGuide() {
  return (
    <section id="mix" aria-labelledby="mix-title" className="mt-8 scroll-mt-24 rounded-3xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-800 text-white shadow-sm" aria-hidden>
          <GIcon name="soil" className="h-6 w-6" />
        </span>
        <div>
          <h2 id="mix-title" className="flex items-center gap-1 text-xl font-bold text-green-900">
            টবের তৈরি মিশ্রণ
            <InfoTip label="উৎস" peek={false} sources={Object.values(SRC)}>
              প্রথম আলোর দুটো ছাদবাগান লেখা থেকে, যেখানে নার্সারি মালিক ও কৃষিবিদের পরামর্শ আছে। বিশেষজ্ঞ দিয়ে যাচাই করা নয়।
            </InfoTip>
          </h2>
          <p className="text-sm text-gray-500">ছাদে বেশির ভাগ মানুষ খাঁটি মাটি নয়, মিশ্রণ ব্যবহার করে</p>
        </div>
      </div>

      <h3 className="mt-5 font-bold text-gray-800">কী কী থাকে, দেখে চিনুন</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {PARTS.map((p, i) => (
          <li key={p.name} className="flex items-center gap-3 rounded-2xl bg-stone-50 p-2.5">
            <Swatch p={p} i={i} />
            <span>
              <span className="block font-semibold text-gray-900">{p.name}</span>
              <span className="block text-sm text-gray-600">{p.look}</span>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 font-bold text-gray-800">প্রচলিত অনুপাত</h3>
      <div className="mt-2 space-y-3">
        {RECIPES.map((r) => (
          <div key={r.name}>
            <p className="text-sm font-semibold text-gray-700">{r.name}</p>
            <div className="mt-1 flex h-9 overflow-hidden rounded-xl text-xs font-semibold text-white">
              {r.parts.map(([pct, name, color]) => (
                <span key={name} style={{ width: `${pct}%`, background: color }} className="flex items-center justify-center" title={name}>
                  {bn(pct)}%
                </span>
              ))}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
              {r.parts.map(([pct, name, color]) => (
                <span key={name} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {name} {bn(pct)}%
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {[
          { icon: "basket", t: "নার্সারির রেডি মিক্স", d: "প্যাকেটের মাটিতে এগুলোই মেশানো থাকে; সরাসরি টবে দেওয়া যায়" },
          { icon: "sprout", t: "মান যাচাই", d: "অল্প মাটিতে সরিষা বা মেথি বুনুন; ৩-৫ দিনে গজালে মাটি ভালো" },
          { icon: "sun", t: "পুরোনো মাটি", d: "বস্তার মাটি ৭-১০ দিন কড়া রোদে; ভেজা মাটি স্বচ্ছ পলিথিনে ঢেকে ২-৪ সপ্তাহ রোদে। বছরে একবার নতুন কম্পোস্ট মেশান" },
        ].map((x) => (
          <div key={x.t} className="rounded-2xl bg-green-50/70 p-3">
            <p className="flex items-center gap-1.5 font-semibold text-green-900">
              <GIcon name={x.icon as "sun"} className="h-4 w-4" /> {x.t}
            </p>
            <p className="mt-0.5 text-sm text-gray-600">{x.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 p-4 text-white shadow-sm">
        <p className="font-bold">এমন মিশ্রণ ব্যবহার করলে পরামর্শ পাবেন কীভাবে?</p>
        <p className="mt-1 text-sm text-white/90">ফসল পরামর্শ, পরিকল্পনা আর পরের ফসলে মাটির ঘরে “টবের মিশ্রণ” বেছে নিন। আমাদের হিসাবে এই মিশ্রণে দোআঁশ মাটির গুণ আর জৈব সার দুটোই থাকে, তাই তালিকার সব ফসল মানানসই ধরা হয়।</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/crops" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50">ফসল পরামর্শ</Link>
          <Link href="/plan" className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-white/60 hover:bg-white/30">১ বছরের পরিকল্পনা</Link>
        </div>
      </div>

    </section>
  );
}
