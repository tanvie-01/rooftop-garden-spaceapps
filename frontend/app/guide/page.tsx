import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { GIcon, type GIconName } from "@/components/garden-icons";

// ব্যবহারের নির্দেশিকা: নতুন ইউজারকে ধাপে ধাপে দেখায় সাইটটা কীভাবে চালাতে হয়।
// লগইন ছাড়াই খোলা যায় (শুধু লেখা, কোনো ডেটা নয়)।
export const metadata: Metadata = {
  title: "ব্যবহারের নিয়ম | Rooftop Garden",
  description: "Rooftop Garden কীভাবে ব্যবহার করবেন: লগইন থেকে গাছ যোগ, প্রতিদিনের কাজ, মাটি পরীক্ষা, AI সহকারী, ধাপে ধাপে।",
};

const bnDigits = (n: number) => String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

// shot: সেই ধাপের আসল screenshot (demo অ্যাকাউন্ট, public/guide/*.webp); h: ছবির উচ্চতা (চওড়া ১০০০)
type Step = { icon: GIconName; title: string; href?: string; go?: string; points: string[]; shot?: string; h?: number };

const STEPS: Step[] = [
  {
    icon: "leaf",
    title: "কোন ফসল লাগাবেন জেনে নিন",
    shot: "6-crops",
    h: 494,
    href: "/crops",
    go: "ফসল পাতা",
    points: [
      "সবচেয়ে কাজের অংশ, লগইন ছাড়াই চলে। \"ফসল\" পাতায় মাস, মাটি, টবের আকার আর রোদ দিলে সবজি, ফল আর ফুলের সেরা ফসল দেখায়।",
      "টব কত লিটার বুঝতে না পারলে টবের ঘরের পাশের ⓘ চাপুন: ছবি মিলিয়ে বা ফিতা দিয়ে মেপে বের করুন।",
      "কোনো ফসলে চাপলে লাগানো থেকে তোলা পর্যন্ত পুরো নির্দেশিকা পাবেন।",
    ],
  },
  {
    icon: "lock",
    title: "লগইন করুন",
    shot: "1-login",
    h: 594,
    href: "/login",
    go: "লগইন পাতা",
    points: [
      "উপরে ডান কোণে \"লগইন\" চাপুন।",
      "\"Google দিয়ে চালিয়ে যান\" চাপে নিজের Gmail বাছুন। আলাদা পাসওয়ার্ড লাগে না।",
      "প্রথমবার লগইন করলেই আপনার অ্যাকাউন্ট তৈরি হয়ে যায়। আপনার বাগানের তথ্য শুধু আপনিই দেখুন।",
    ],
  },
  {
    icon: "pin",
    title: "আপনার এলাকা ঠিক করুন",
    shot: "2-area",
    h: 494,
    href: "/weather",
    go: "আবহাওয়া পাতা",
    points: [
      "\"আবহাওয়া\" পাতায় মানচিত্রে নিজের উপজেলায় চাপুন, অথবা নাম লিখে খুঁজুন।",
      "এলাকা একবার বাছলেই মনে থাকে। এর উপর পূর্বাভাস, গরম/বৃষ্টির সতর্কতা আর ফসল সাজেশন হয়।",
    ],
  },
  {
    icon: "plus",
    title: "প্রথম গাছ যোগ করুন",
    shot: "3-add",
    h: 494,
    href: "/dashboard",
    go: "আমার বাগান",
    points: [
      "\"আমার বাগান\" পাতায় \"গাছ যোগ করুন\" চাপুন।",
      "গাছ বাছুন (যেমন টমেটো), টবের আকার আর রোদের ঘণ্টা দিন। চাইলে ডাকনাম দিন (যেমন \"বারান্দার টমেটো\")।",
      "সেভ করলেই পানি, সার, ছাঁটাই আর পোকা দেখার রিমাইন্ডার নিজে থেকে তৈরি হয়।",
    ],
  },
  {
    icon: "clipboard",
    title: "প্রতিদিনের কাজ শেষ করুন",
    shot: "4-tasks",
    h: 494,
    href: "/dashboard",
    go: "কাজের তালিকা",
    points: [
      "\"আমার বাগান\"-এর \"কাজের তালিকা\"-য় আজকের কাজ থাকে। লাল দাগ মানে দেরি হয়ে গেছে।",
      "কাজ শেষ হলে বাঁয়ের গোল টিক চাপুন।",
      "আজ না পারলে \"কাল\" চাপুন, অথবা \"অন্য দিন\" চেপে তারিখ বাছুন।",
      "পানির কাজে আগে আঙুল দিয়ে মাটি দেখুন। ভেজা থাকলে \"মাটি ভেজা\" চাপুন, পানি দেবেন না।",
    ],
  },
  {
    icon: "hand",
    title: "মাটি পরীক্ষা করুন",
    shot: "5-soil",
    h: 494,
    href: "/soil",
    go: "মাটি পাতা",
    points: [
      "\"মাটি\" পাতায় আগে ছবি দেখে মিলিয়ে নিন আপনার মাটি কোনটার মতো।",
      "তারপর \"হাতের পরীক্ষা\" (৫ মিনিট) বা \"বোতল পরীক্ষা\" (১-২ দিন) ধাপে ধাপে করুন।",
      "ফলাফলে মাটির ধরন, কী ভালো হয় আর টবে কীভাবে ভালো রাখবেন তা পাবেন। লগইন থাকলে রিপোর্ট সেভ হয়।",
    ],
  },
  {
    icon: "refresh",
    title: "একই টবে পরের ফসল বাছুন",
    shot: "7-rotation",
    h: 494,
    href: "/rotation",
    go: "পরের ফসল",
    points: [
      "টবে আগে কী ছিল তা বাছুন। একই গোত্রের ফসল পরপর লাগালে রোগ-পোকা বাড়ে।",
      "সাইট অন্য গোত্রের ফসল সাজেশন দেয়, সাথে আপনার এলাকার NASA জলবায়ুর তথ্য।",
    ],
  },
  {
    icon: "bug",
    title: "রোগ বা পোকা চিনুন",
    shot: "8-disease",
    h: 494,
    href: "/disease",
    go: "রোগ ডায়েরি",
    points: [
      "\"রোগ ডায়েরি\"-তে ফসল বাছুন বা লক্ষণ লিখে খুঁজুন (যেমন \"পাতা হলুদ\")।",
      "ছবি মিলিয়ে দেখুন, তারপর কী করবেন তা ধাপে ধাপে পড়ুন। রাসায়নিক ওষুধের আগে কৃষি অফিসে জেনে নেবেন।",
    ],
  },
  {
    icon: "calendar",
    title: "পুরো বছরের পরিকল্পনা দেখুন",
    shot: "9-plan",
    h: 494,
    href: "/plan",
    go: "পরিকল্পনা",
    points: ["\"পরিকল্পনা\" পাতায় কোন মাসে কী লাগাবেন, কী যত্ন নেবেন আর কবে ফসল তুলবেন তা এক নজরে দেখুন।"],
  },
  {
    icon: "robot",
    title: "AI সহকারীকে প্রশ্ন করুন",
    shot: "10-chat",
    h: 494,
    href: "/chat",
    go: "AI সহকারী",
    points: [
      "বাংলা, ইংরেজি বা Banglish যেভাবে খুশি প্রশ্ন লিখুন। চাইলে পাতার ছবিও দিন।",
      "কোন গাছ নিয়ে প্রশ্ন তা বেছে দিলে আপনার গাছ আর আবহাওয়া মিলিয়ে উত্তর দেয়।",
      "উত্তর কাজে লাগলে নিচের লাইক বোতাম চাপুন। এতে পরের বার সবার জন্য উত্তর আরো ভালো হয়।",
    ],
  },
  {
    icon: "heart",
    title: "কমিউনিটিতে শেয়ার করুন",
    shot: "11-community",
    h: 494,
    href: "/community",
    go: "কমিউনিটি",
    points: [
      "প্রথমবার একটা অবতার, পটভূমি আর নাম বেছে প্রোফাইল বানান।",
      "নিজের বাগানের ছবি পোস্ট করুন, অন্যদের পোস্টে লাইক আর মন্তব্য দিন।",
    ],
  },
];


const ROUTINE: { icon: GIconName; when: string; items: string[] }[] = [
  { icon: "sun", when: "প্রতিদিন", items: ["কাজের তালিকা দেখে টিক দিন", "পানির আগে মাটি আঙুলে দেখুন", "আবহাওয়ার সতর্কতা দেখে নিন"] },
  { icon: "calendar", when: "প্রতি সপ্তাহে", items: ["পাতার নিচে পোকা খুঁজুন", "হলুদ বা শুকনো পাতা ছেঁটে ফেলুন", "নতুন সমস্যা হলে গাছের পাতায় লিখে রাখুন"] },
  { icon: "harvest", when: "প্রতি মাসে", items: ["সার দিন (রিমাইন্ডার মনে করিয়ে দেবে)", "পরিকল্পনা দেখে নতুন চারা ঠিক করুন", "ফসল শেষ হলে \"পরের ফসল\" দেখে নতুন ফসল বাছুন"] },
];

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader icon="book" scene="garden" title="ব্যবহারের নিয়ম" subtitle="শুরু থেকে শেষ, ধাপে ধাপে" />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* ধাপের তালিকা: বড় পর্দায় পাশে আটকে থাকে */}
        <nav aria-label="ধাপগুলো" className="hidden lg:block">
          <ol className="sticky top-[calc(var(--hdr-h,8rem)+1.5rem)] space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <a href={`#step-${i + 1}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-white hover:text-green-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800">{bnDigits(i + 1)}</span>
                  {s.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#routine" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-white hover:text-green-800">
                <GIcon name="clock" className="h-6 w-6 text-green-700" /> নিয়মিত যত্ন
              </a>
            </li>
          </ol>
        </nav>

        <div>
          {/* ধাপগুলো: বাঁয়ে নম্বরের দাগ বরাবর একটার পর একটা */}
          <ol className="relative space-y-5 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-green-300 before:to-emerald-100">
            {STEPS.map((s, i) => (
              <li key={s.title} id={`step-${i + 1}`} className="relative scroll-mt-40 pl-16">
                <span className="absolute left-0 top-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-500 to-green-600 text-lg font-bold text-white shadow-md shadow-green-600/30">
                  {bnDigits(i + 1)}
                </span>
                <article className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-green-950">
                    <GIcon name={s.icon} className="h-6 w-6 text-green-600" />
                    {s.title}
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[15px] leading-relaxed text-gray-700">
                        <GIcon name="tick" className="mt-1 h-4 w-4 shrink-0 text-green-600" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {s.shot && (
                    <figure className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-[0_12px_30px_-18px_rgba(20,83,45,0.45)]">
                      <div aria-hidden className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element -- ছোট static webp */}
                      <img
                        src={`/guide/${s.shot}.webp`}
                        alt={`${s.title}: পাতার ছবি`}
                        width={1000}
                        height={s.h ?? 494}
                        loading="lazy"
                        className="block h-auto w-full"
                      />
                    </figure>
                  )}
                  {s.href && (
                    <Link
                      href={s.href}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-100"
                    >
                      {s.go} খুলুন <span aria-hidden>→</span>
                    </Link>
                  )}
                </article>
              </li>
            ))}
          </ol>

          {/* নিয়মিত যত্ন */}
          <section id="routine" className="mt-12 scroll-mt-40">
            <h2 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-green-700 via-emerald-500 to-lime-500 bg-clip-text text-transparent">নিয়মিত যত্ন</span>
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {ROUTINE.map((r) => (
                <div key={r.when} className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
                  <p className="flex items-center gap-2 text-lg font-bold text-green-950">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 text-green-700">
                      <GIcon name={r.icon} className="h-5 w-5" />
                    </span>
                    {r.when}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {r.items.map((t) => (
                      <li key={t} className="flex gap-2 text-[15px] leading-relaxed text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-10 rounded-3xl bg-gradient-to-br from-green-600 to-emerald-500 p-6 text-center text-white shadow-lg">
            <p className="text-xl font-bold">কোথাও আটকে গেলে?</p>
            <p className="mt-1 text-green-50">AI সহকারীকে জিজ্ঞেস করুন, বাংলাতেই উত্তর পাবেন</p>
            <Link href="/chat" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-green-800 shadow transition hover:-translate-y-0.5">
              <GIcon name="robot" className="h-5 w-5" /> AI সহকারী খুলুন
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
