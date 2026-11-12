import Link from "next/link";
import { GIcon } from "@/components/garden-icons";

// মেনুর মতোই হালকা glass কার্ড, পাতার কিনারা থেকে একটু ভেতরে ভেসে থাকে
export default function Footer() {
  return (
    <footer className="mt-24 px-4 pb-6 sm:px-5">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-white/90 via-green-50/80 to-emerald-50/70 shadow-[0_20px_50px_-24px_rgba(20,83,45,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-200/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />

        <div className="relative flex flex-col items-center gap-6 px-6 py-8 text-center md:flex-row md:justify-between md:text-left">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG logo */}
            <img src="/icon.svg" alt="" width={44} height={44} className="h-11 w-11 drop-shadow-[0_4px_8px_rgba(22,163,74,0.3)]" />
            <span>
              <span className="font-brand block text-xl font-extrabold">
                <span className="text-green-900">Rooftop</span> <span className="brand-gradient">Garden</span>
              </span>
              <span className="block text-sm text-green-700/80">ছাদবাগানের স্মার্ট সহকারী</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/guide"
            className="grad-border inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-green-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <GIcon name="book" className="h-4 w-4" /> কীভাবে ব্যবহার করবেন
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-emerald-500 to-green-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-green-600/25">
            <GIcon name="sprout" className="h-4 w-4" />
            <span className="font-brand">NASA Space Apps Challenge</span>
          </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
