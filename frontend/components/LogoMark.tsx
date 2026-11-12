"use client";
// মেনুর লোগো: 3D ধাঁচের টালি আর টব; পাতা খুললে টব থেকে চারাটা বেরিয়ে আসে, তারপর হালকা দোলে।
import { useId } from "react";

export default function LogoMark({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (n: string) => `${n}-${id}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={`logo-mark ${className}`}>
      <defs>
        <linearGradient id={g("tile")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.5" stopColor="#16a34a" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
        <linearGradient id={g("gloss")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g("pot")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#ecfdf5" />
          <stop offset="1" stopColor="#bbf7d0" />
        </linearGradient>
        <radialGradient id={g("sun")} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fef9c3" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <clipPath id={g("clip")}>
          <rect width="64" height="64" rx="15" />
        </clipPath>
      </defs>

      {/* টালি: নিচে গাঢ় কিনারা (গভীরতা), উপরে চকচকে আলো */}
      <rect y="2" width="64" height="62" rx="15" fill="#064e3b" />
      <rect width="64" height="61" rx="15" fill={`url(#${g("tile")})`} />
      <path d="M0 15A15 15 0 0 1 15 0h34a15 15 0 0 1 15 15v9C44 30 20 30 0 22z" fill={`url(#${g("gloss")})`} />

      <circle className="lm-sun" cx="50" cy="13" r="5.5" fill={`url(#${g("sun")})`} />

      {/* চারা: টবের ভেতর থেকে উঠে আসে */}
      <g className="lm-plant">
        <path d="M32 40V25" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        <path className="lm-leaf-l" d="M31.5 31C25.5 31.5 19.5 28 18.5 21C25.5 20.5 30.5 24 31.5 31Z" fill="#dcfce7" />
        <path className="lm-leaf-r" d="M32.5 27C32.5 19.5 38 14.5 45 14.5C45 22 39.5 27 32.5 27Z" fill="#fff" />
      </g>

      {/* টব: সামনের দিকে ছায়া দিয়ে 3D */}
      <g clipPath={`url(#${g("clip")})`}>
        <ellipse cx="32" cy="62" rx="22" ry="4" fill="#022c22" opacity="0.35" />
        <rect x="10" y="38" width="44" height="5" rx="2.5" fill="#fff" />
        <rect x="10" y="41.5" width="44" height="1.5" fill="#a7f3d0" />
        <path d="M14 43h36v22H14z" fill={`url(#${g("pot")})`} />
        <rect x="19" y="48" width="6" height="6" rx="1.2" fill="#15803d" />
        <rect x="29" y="48" width="6" height="6" rx="1.2" fill="#15803d" />
        <rect x="39" y="48" width="6" height="6" rx="1.2" fill="#15803d" />
      </g>
    </svg>
  );
}
