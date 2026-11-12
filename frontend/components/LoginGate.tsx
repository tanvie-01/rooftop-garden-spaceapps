"use client";
import Link from "next/link";
import { GIcon } from "@/components/garden-icons";
import { useAuth } from "@/lib/auth";

/** লগইন ছাড়া children দেখায় না; তার বদলে লগইনের আমন্ত্রণ। */
export default function LoginGate({
  children,
  next,
  why,
}: {
  children: React.ReactNode;
  next: string;
  why: string;
}) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <main className="mx-auto max-w-4xl animate-pulse space-y-4 px-5 py-10" aria-busy="true">
        <div className="h-32 rounded-3xl bg-green-100" />
        <div className="h-64 rounded-3xl bg-green-50" />
      </main>
    );
  }

  if (auth.status === "out") {
    return (
      <main className="relative isolate mx-auto max-w-lg px-5 py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-0 top-6 h-56 w-56 rounded-full bg-emerald-200/50 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-lime-200/40 blur-3xl" />
        </div>
        <div className="glass-in rounded-[2rem] border border-white bg-white/80 p-9 text-center shadow-2xl shadow-green-900/10 backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-50 to-emerald-100 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG logo */}
            <img src="/icon.svg" alt="" width={56} height={56} className="h-14 w-14 drop-shadow" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-green-950">আগে লগইন করুন</h1>
          <p className="mt-2 text-lg text-gray-600">{why}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-emerald-500 to-green-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-600/30 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <GIcon name="lock" className="h-5 w-5" /> Gmail দিয়ে লগইন
            </Link>
            <Link
              href="/crops"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-green-200 bg-white px-6 py-3.5 text-base font-semibold text-green-800 transition hover:border-green-400 hover:bg-green-50"
            >
              <GIcon name="leaf" className="h-5 w-5" /> ফসল পরামর্শ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
