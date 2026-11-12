import Link from "next/link";
import { CropIcon } from "@/components/crop-icons";
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { Satellite } from "@/components/HeroSatellite";
import RooftopScene from "@/components/RooftopScene";

// প্রতিটা কার্ডের আইকন TINTS থেকে আলাদা রঙ পায়
const features: { icon: GIconName; title: string; href: string }[] = [
  { icon: "soil", title: "মাটি পরীক্ষা", href: "/soil" },
  { icon: "leaf", title: "স্মার্ট ফসল সাজেশন", href: "/crops" },
  { icon: "cloudSun", title: "আবহাওয়া ও সতর্কতা", href: "/weather" },
  { icon: "home", title: "আমার বাগান", href: "/dashboard" },
  { icon: "book", title: "সুস্থ বাগান: রোগ ও পোকা", href: "/disease" },
  { icon: "robot", title: "AI বাগান সহকারী", href: "/chat" },
  { icon: "refresh", title: "পরের ফসল কী লাগাবো", href: "/rotation" },
  { icon: "calendar", title: "১ বছরের বাগান পরিকল্পনা", href: "/plan" },
];

// প্রতিটা কার্ডের নিজস্ব রং: উজ্জ্বল gradient আইকন, একই রঙের নরম আভা আর কোণে বড় ফিকে আইকন
const TINTS = [
  { icon: "from-amber-400 to-orange-500 shadow-orange-500/30", soft: "text-orange-500", arrow: "bg-orange-50 text-orange-600" },
  { icon: "from-emerald-400 to-green-600 shadow-green-600/30", soft: "text-green-600", arrow: "bg-green-50 text-green-700" },
  { icon: "from-sky-400 to-blue-500 shadow-sky-500/30", soft: "text-sky-500", arrow: "bg-sky-50 text-sky-700" },
  { icon: "from-lime-400 to-green-500 shadow-lime-500/30", soft: "text-lime-600", arrow: "bg-lime-50 text-lime-700" },
  { icon: "from-rose-400 to-pink-500 shadow-rose-500/30", soft: "text-rose-500", arrow: "bg-rose-50 text-rose-600" },
  { icon: "from-violet-400 to-indigo-500 shadow-indigo-500/30", soft: "text-indigo-500", arrow: "bg-indigo-50 text-indigo-600" },
  { icon: "from-teal-400 to-emerald-500 shadow-teal-500/30", soft: "text-teal-500", arrow: "bg-teal-50 text-teal-700" },
  { icon: "from-yellow-400 to-amber-500 shadow-amber-500/30", soft: "text-amber-500", arrow: "bg-amber-50 text-amber-700" },
];

// এখনকার ব্যবস্থার চার ধাপ: তথ্য → NASA/আবহাওয়া মিলিয়ে হিসাব → ফসল ও পরিকল্পনা → প্রতিদিনের যত্ন ও সাহায্য
const steps: { n: string; icon: GIconName; title: string; line: string; tint: string }[] = [
  { n: "১", icon: "pin", title: "এলাকা আর টব দিন", line: "উপজেলা, টবের মাপ, মাটি আর রোদের ঘণ্টা", tint: "from-sky-400 to-blue-500 shadow-sky-500/30" },
  { n: "২", icon: "satellite", title: "NASA ডেটায় হিসাব", line: "২০ বছরের আবহাওয়া, পূর্বাভাস আর মাটি মিলিয়ে", tint: "from-violet-400 to-indigo-500 shadow-indigo-500/30" },
  { n: "৩", icon: "leaf", title: "ফসল ও পরিকল্পনা পান", line: "কী লাগাবেন, কবে, আর পুরো বছরের ছক", tint: "from-emerald-400 to-green-600 shadow-green-600/30" },
  { n: "৪", icon: "water", title: "প্রতিদিনের যত্ন", line: "পানি-সারের রিমাইন্ডার, রোগ-পোকা চেনা আর AI সহকারী", tint: "from-amber-400 to-orange-500 shadow-orange-500/30" },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-green-50">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-lime-200/60 blur-3xl" />
        {/* পেছনে আঁকা ছাদবাগান, নিচের দিকে; লেখা যেন পড়া যায় তাই হালকা */}
        <RooftopScene className="absolute inset-x-0 bottom-0 h-44 w-full opacity-70 sm:h-56 md:h-64" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-40 pt-16 sm:pb-48 md:grid-cols-2 md:pb-56 md:pt-24">
          <div>
            <span className="sat-badge inline-block rounded-full bg-white px-4 py-1 text-sm font-medium text-green-700 shadow-sm">
              <IconText icon="satellite">NASA ডেটা + AI</IconText>
            </span>
            {/* স্যাটেলাইট এই অংশটা উপর থেকে নিচে স্ক্যান করে, তারপর উপরের ব্যাজে মিশে যায় */}
            <div className="sat-stage relative">
              <div className="sat-zone">
                <h1 className="mt-5 text-[2rem] font-bold leading-tight text-green-900 sm:text-4xl md:text-[2.75rem] md:leading-[1.2]">
                  প্রকৃতির সৌন্দর্য আর আধুনিকতার মেলবন্ধন হোক
                  <span className="text-green-600"> আপনার ছাদে।</span>
                </h1>
                <p className="mt-4 max-w-md text-lg text-gray-600">
                  কোন ফসল লাগাবেন, কখন পানি দেবেন, কীভাবে গাছ বাঁচাবেন। আবহাওয়া ও
                  মাটি দেখে স্মার্ট পরামর্শ পান এক জায়গায়।
                </p>
              </div>
              <span className="sat-scan" aria-hidden />
              <Satellite />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/crops"
                className="rounded-full bg-green-600 px-6 py-3 font-semibold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700"
              >
                ফসল সাজেশন নিন
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-green-600 bg-white px-6 py-3 font-semibold text-green-700 transition hover:bg-green-50"
              >
                আমার বাগান দেখুন
              </Link>
              <Link
                href="/guide"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-teal-500 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg shadow-teal-600/30 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <GIcon name="book" className="h-5 w-5" /> কীভাবে ব্যবহার করবেন
              </Link>
            </div>
          </div>

          {/* ডেমো কার্ড */}
          <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-gray-500"><IconText icon="clipboard">আজকের কাজ (উদাহরণ)</IconText></p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between rounded-xl bg-yellow-50 p-3">
                <span className="inline-flex items-center gap-1.5"><CropIcon name="Tomato" className="h-5 w-5" /> টমেটো: পানি দেওয়া</span>
                <span className="text-yellow-700">আজ</span>
              </li>
              <li className="flex justify-between rounded-xl bg-green-50 p-3">
                <span className="inline-flex items-center gap-1.5"><CropIcon name="Chili" className="h-5 w-5" /> মরিচ: সার দেওয়া</span>
                <span className="text-green-700">৩ দিন পরে</span>
              </li>
            </ul>
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <GIcon name="heat" className="mr-1 h-4 w-4" />অতিরিক্ত গরম আসছে। সকাল বা সন্ধ্যায় পানি দিন।
            </div>
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
              <GIcon name="rain" className="mr-1 h-4 w-4" />আগামী ৩ দিনে বৃষ্টির সম্ভাবনা আছে।
            </div>
          </div>
        </div>
      </section>

      {/* Features: হালকা রঙিন পটভূমি আর ভাসমান আভা */}
      <section className="feat-bg relative overflow-hidden bg-gradient-to-b from-green-50 via-cyan-50/70 to-amber-50/60">
        <div className="feat-blob pointer-events-none absolute -left-16 top-10 rounded-full opacity-60 blur-3xl h-72 w-72 bg-emerald-200" aria-hidden />
        <div className="feat-blob pointer-events-none absolute right-0 top-1/3 rounded-full opacity-60 blur-3xl h-80 w-80 bg-sky-200" style={{ animationDelay: "-5s" }} aria-hidden />
        <div className="feat-blob pointer-events-none absolute bottom-0 left-1/3 rounded-full opacity-60 blur-3xl h-64 w-64 bg-amber-100" style={{ animationDelay: "-9s" }} aria-hidden />
      <div className="relative mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-bold text-green-900">
          যা যা পাচ্ছেন
        </h2>

        <div className="stagger mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {features.map((f, i) => {
            const tint = TINTS[i % TINTS.length];
            const card = (
              <div
                className={`group relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-3xl bg-white/90 p-5 shadow-[0_10px_30px_-18px_rgba(20,83,45,0.45)] ring-1 ring-black/[0.04] backdrop-blur transition duration-300 ${
                  f.href ? "hover:-translate-y-1.5 hover:shadow-[0_22px_40px_-20px_rgba(20,83,45,0.5)]" : "opacity-70"
                }`}
              >
                {/* কোণে বড় ফিকে আইকন: গভীরতা দেয়, লেখার সাথে লড়ে না */}
                <GIcon
                  name={f.icon}
                  className={`pointer-events-none absolute -bottom-5 -right-5 h-28 w-28 opacity-[0.08] transition duration-500 group-hover:-rotate-6 group-hover:scale-110 ${tint.soft}`}
                />
                <span
                  className={`feat-icon flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tint.icon}`}
                  style={{ animationDelay: `${(i % 4) * 0.5}s` }}
                >
                  <GIcon name={f.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-4 pr-8 text-base font-bold leading-snug text-gray-900 sm:text-lg">{f.title}</h3>
                {f.href && (
                  <span
                    aria-hidden
                    className={`absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-base font-bold transition duration-300 group-hover:translate-x-1 ${tint.arrow}`}
                  >
                    →
                  </span>
                )}
              </div>
            );
            return f.href ? (
              <Link key={f.title} href={f.href}>
                {card}
              </Link>
            ) : (
              <div key={f.title}>{card}</div>
            );
          })}
        </div>
      </div>
      </section>

      {/* How it works */}
      <section className="bg-gradient-to-b from-white to-emerald-50/60 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl font-bold">
            <span className="bg-gradient-to-r from-green-700 via-emerald-500 to-lime-500 bg-clip-text text-transparent">কীভাবে কাজ করে</span>
          </h2>
          {/* ধাপগুলো একটা চলমান রেখায় জোড়া: বড় পর্দায় পাশাপাশি, ফোনে উপর-নিচে */}
          <ol className="stagger relative mt-12 grid gap-5 md:grid-cols-4 md:gap-4">
            <span aria-hidden className="steps-line pointer-events-none absolute left-[2.1rem] top-6 bottom-6 w-0.5 md:left-[12.5%] md:right-[12.5%] md:top-[2.1rem] md:bottom-auto md:h-0.5 md:w-auto" />
            {steps.map((s, i) => (
              <li key={s.n} className="relative flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <span className="relative z-10 shrink-0">
                  <span
                    className={`feat-icon flex h-[4.2rem] w-[4.2rem] items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-lg ${s.tint}`}
                    style={{ animationDelay: `${i * 0.5}s` }}
                  >
                    <GIcon name={s.icon} className="h-8 w-8" />
                  </span>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-green-800 shadow ring-1 ring-green-100">
                    {s.n}
                  </span>
                </span>
                <span className="pt-1 md:pt-4">
                  <span className="block text-lg font-bold text-gray-900">{s.title}</span>
                  <span className="mt-1 block text-[15px] leading-snug text-gray-600">{s.line}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 pt-16">
        <div className="rounded-3xl bg-green-700 px-8 py-12 text-center text-white">
          <h2 className="text-3xl font-bold">আজই শুরু করুন আপনার ছাদবাগান</h2>
          <p className="mt-2 text-green-100">
            প্রথম গাছটা যোগ করুন আর রিমাইন্ডার পাওয়া শুরু করুন।
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-white px-7 py-3 font-semibold text-green-800 transition hover:bg-green-50"
          >
            শুরু করুন →
          </Link>
        </div>
      </section>
    </main>
  );
}