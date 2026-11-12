"use client";
// "সুস্থ বাগান" প্যানেলের তিন পাতা: রোগ ডায়েরি, পোকা চিনুন, জৈব সার। প্রতিটা পাতার উপরে একই সারি।
import Link from "next/link";
import { GIcon, type GIconName } from "@/components/garden-icons";

export const PROTECTION_TABS: { href: string; label: string; sub: string; icon: GIconName }[] = [
  { href: "/disease", label: "রোগ ডায়েরি", sub: "লক্ষণ দেখে রোগ চিনুন", icon: "book" },
  { href: "/pests", label: "পোকা চিনুন", sub: "কোন পোকা কী ক্ষতি করে", icon: "bug" },
  { href: "/fertilizer", label: "জৈব সার", sub: "ঘরে সার বানান", icon: "sprout" },
  { href: "/remedies", label: "ঘরোয়া পদ্ধতি", sub: "নিম, সাবান-পানি, ফাঁদ", icon: "hand" },
];

export default function ProtectionTabs({ active }: { active: string }) {
  return (
    <nav aria-label="সুস্থ বাগান" className="-mt-4 mb-6">
      <ul className="grid grid-cols-4 gap-1.5 rounded-3xl border border-green-100 bg-white/80 p-1.5 shadow-sm backdrop-blur sm:gap-2">
        {PROTECTION_TABS.map((t) => {
          const on = t.href === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-full flex-col items-center gap-0.5 rounded-2xl px-2 py-2.5 text-center transition sm:flex-row sm:gap-2.5 sm:px-4 sm:text-left ${
                  on ? "bg-gradient-to-b from-emerald-500 to-green-600 text-white shadow-md shadow-green-700/25" : "text-green-900 hover:bg-green-50"
                }`}
              >
                <GIcon name={t.icon} className={`h-6 w-6 shrink-0 ${on ? "text-white" : "text-green-700"}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-tight sm:text-base">{t.label}</span>
                  <span className={`hidden text-xs sm:block ${on ? "text-green-50" : "text-gray-500"}`}>{t.sub}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
