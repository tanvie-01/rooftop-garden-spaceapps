"use client";
import { SOIL_OPTIONS, type SoilStatus } from "@/lib/garden";

/** আঙুল দিয়ে মাটি দেখে ৪টার একটা বেছে নেওয়া */
export default function SoilCheck({
  onPick,
  disabled,
}: {
  onPick: (s: SoilStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl bg-amber-50 p-3">
      <p className="text-xs text-amber-900">টবের মাটিতে ২-৩ সেমি আঙুল ঢুকিয়ে দেখুন, কেমন লাগছে?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {SOIL_OPTIONS.map((o) => (
          <button
            key={o.value}
            disabled={disabled}
            onClick={() => onPick(o.value)}
            className="rounded-xl border border-amber-200 bg-white px-2 py-2 text-left text-sm hover:border-amber-400 disabled:opacity-50"
          >
            <span className="font-semibold text-gray-800">{o.label}</span>
            <span className="block text-[11px] leading-tight text-gray-500">{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
