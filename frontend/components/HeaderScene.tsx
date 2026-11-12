"use client";
// পাতার সবুজ panel-এর ডান পাশের ছোট animated দৃশ্য। শুধু SVG + CSS (transform/opacity), কোনো library নয়।
// পর্দার বাইরে গেলে বা ট্যাব লুকালে থামে; "কম animation" সেটিং-এ থেমে থাকে (globals.css)।
import { useEffect, useRef, useState } from "react";

export type Scene =
  | "sun" | "cloud" | "rain" | "storm"
  | "garden" | "soil" | "crops" | "rotation" | "disease" | "plan" | "community" | "chat" | "radar";

const W = "rgba(255,255,255,0.95)";
const SOFT = "rgba(255,255,255,0.35)";

function Cloud({ x, y, s = 1, cls = "", fill = W }: { x: number; y: number; s?: number; cls?: string; fill?: string }) {
  return (
    <g className={cls}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M10 30a12 12 0 0 1 2-24 16 16 0 0 1 30 2 11 11 0 0 1 4 22z" fill={fill} />
      </g>
    </g>
  );
}

function Pot({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-22" y="0" width="44" height="7" rx="3" fill="#fde68a" />
      <path d="M-18 7h36l-5 26h-26z" fill="#f59e0b" />
      <path d="M-18 7h36l-1 5h-34z" fill="#d97706" opacity="0.6" />
    </g>
  );
}

function Sprout({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="sc-grow" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 0V-26" stroke={W} strokeWidth="3" strokeLinecap="round" />
        <path className="sc-leaf-l" d="M0 -14C-10 -14 -16 -20 -16 -28C-6 -28 0 -22 0 -14Z" fill="#bbf7d0" />
        <path className="sc-leaf-r" d="M0 -20C0 -30 7 -36 16 -36C16 -26 9 -20 0 -20Z" fill={W} />
      </g>
    </g>
  );
}

function SceneArt({ scene }: { scene: Scene }) {
  switch (scene) {
    case "sun":
      return (
        <>
          <g className="sc-spin" style={{ transformOrigin: "80px 60px" }}>
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x="78" y="14" width="4" height="14" rx="2" fill="#fde68a" transform={`rotate(${i * 30} 80 60)`} />
            ))}
          </g>
          <circle className="sc-pulse" cx="80" cy="60" r="24" fill="#fcd34d" />
          <circle cx="72" cy="52" r="7" fill="#fef9c3" opacity="0.8" />
          <Cloud x={100} y={78} s={0.9} cls="sc-drift" />
        </>
      );
    case "cloud":
      return (
        <>
          <circle cx="110" cy="44" r="18" fill="#fcd34d" opacity="0.85" />
          <Cloud x={40} y={40} s={1.3} cls="sc-drift" />
          <Cloud x={95} y={70} s={1} cls="sc-drift-slow" fill="rgba(255,255,255,0.75)" />
          <Cloud x={10} y={88} s={0.7} cls="sc-drift" fill={SOFT} />
        </>
      );
    case "rain":
    case "storm":
      return (
        <>
          <Cloud x={35} y={22} s={1.6} fill={scene === "storm" ? "#e2e8f0" : W} cls="sc-bob" />
          {scene === "storm" && <path className="sc-flash" d="M84 64l-12 22h10l-6 20 18-28h-10l8-14z" fill="#fde047" />}
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              className="sc-drop"
              x={48 + i * 9}
              y={68}
              width="2.5"
              height="11"
              rx="1.25"
              fill="#dbeafe"
              style={{ animationDelay: `${(i * 0.37) % 1.1}s` }}
            />
          ))}
        </>
      );
    case "garden":
      return (
        <>
          <ellipse cx="80" cy="128" rx="46" ry="5" fill={SOFT} />
          <Sprout x={80} y={92} s={1.3} />
          <Pot x={80} y={92} s={1.1} />
          <circle className="sc-pulse" cx="128" cy="26" r="10" fill="#fcd34d" />
        </>
      );
    case "soil":
      // মাটির কাটা অংশ: স্তর, কম্পোস্টের দানা, নুড়ি; উপরে পানি পড়ে নিচে ভিজে যায়, চারার শিকড় নামে, কেঁচো চলে
      return (
        <>
          <defs>
            <clipPath id="sc-soil-clip">
              <rect x="12" y="72" width="136" height="64" rx="12" />
            </clipPath>
            <linearGradient id="sc-soak-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38bdf8" stopOpacity="0.75" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle className="sc-pulse" cx="134" cy="22" r="9" fill="#fcd34d" />
          <g clipPath="url(#sc-soil-clip)">
            <rect x="12" y="72" width="136" height="64" fill="#a16207" />
            <path d="M12 98q20-5 40 0t40 0t40 0t16 1V136H12z" fill="#854d0e" />
            <path d="M12 118q22-4 44 0t44 0t48 0V136H12z" fill="#713f12" />
            <rect x="12" y="72" width="136" height="7" fill="#4d2c10" />
            {[[24, 88], [44, 84], [66, 92], [104, 86], [126, 90], [138, 82], [34, 108], [88, 106], [118, 110]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} fill="#fde68a" opacity="0.55" />
            ))}
            {[[28, 126, 4], [58, 129, 3], [96, 125, 5], [132, 128, 3.5]].map(([x, y, r]) => (
              <ellipse key={x} cx={x} cy={y} rx={r} ry={r * 0.7} fill="#d6d3d1" opacity="0.8" />
            ))}
            <rect className="sc-soak" x="12" y="79" width="136" height="50" fill="url(#sc-soak-g)" />
            <path
              className="sc-root"
              pathLength={1}
              d="M80 79v14M80 90q-6 5-12 14M80 90q7 4 10 15M80 97v14M68 104q-4 4-5 9M90 105q4 4 4 10"
              stroke="#fef3c7"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            <g className="sc-worm">
              <path className="sc-wig" d="M40 116q4-4 8 0t8 0t8 0" stroke="#fda4af" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            </g>
          </g>
          <rect x="12" y="72" width="136" height="64" rx="12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          {[66, 80, 94].map((x, i) => (
            <path key={x} className="sc-drop" d={`M${x} 30q3 5 0 8q-3-3 0-8z`} fill="#bae6fd" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
          <Cloud x={56} y={2} s={0.85} cls="sc-bob" />
          <Sprout x={80} y={74} s={0.85} />
        </>
      );
    case "crops":
      return (
        <>
          <path d="M0 112h160v26H0z" fill={SOFT} />
          <Sprout x={40} y={112} s={1} />
          <Sprout x={80} y={112} s={1.25} delay={0.5} />
          <Sprout x={120} y={112} s={0.95} delay={1} />
        </>
      );
    case "rotation":
      return (
        <>
          <g className="sc-spin-slow" style={{ transformOrigin: "80px 70px" }}>
            <path d="M80 26a44 44 0 0 1 41 28" stroke={W} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M126 46l-3 14-12-6z" fill={W} />
            <path d="M80 114a44 44 0 0 1-41-28" stroke={W} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M34 94l3-14 12 6z" fill={W} />
          </g>
          <Sprout x={80} y={74} s={0.8} />
          <Pot x={80} y={74} s={0.7} />
        </>
      );
    case "disease":
      return (
        <>
          <path d="M30 100C30 50 70 22 132 22C132 84 92 112 30 100Z" fill="#bbf7d0" />
          <path d="M30 100L120 32" stroke="#16a34a" strokeWidth="2.5" />
          {[[70, 64], [96, 46], [58, 84]].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="4" fill="#a16207" opacity="0.7" />
          ))}
          <g className="sc-scan">
            <circle cx="70" cy="64" r="16" fill="rgba(255,255,255,0.25)" stroke={W} strokeWidth="4" />
            <path d="M82 76l14 14" stroke={W} strokeWidth="6" strokeLinecap="round" />
          </g>
        </>
      );
    case "plan":
      return (
        <>
          <rect x="34" y="26" width="92" height="88" rx="12" fill={W} />
          <rect x="34" y="26" width="92" height="22" rx="10" fill="#fca5a5" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              className="sc-tick"
              x={46 + (i % 3) * 26}
              y={58 + Math.floor(i / 3) * 18}
              width="16"
              height="10"
              rx="3"
              fill="#22c55e"
              style={{ animationDelay: `${i * 0.35}s` }}
            />
          ))}
          <rect className="sc-flip" x="34" y="26" width="92" height="22" rx="10" fill="#f87171" />
        </>
      );
    case "community":
      return (
        <>
          <circle cx="58" cy="78" r="16" fill={W} />
          <path d="M30 124a28 28 0 0 1 56 0z" fill={W} />
          <circle cx="106" cy="84" r="13" fill="rgba(255,255,255,0.75)" />
          <path d="M84 124a22 22 0 0 1 44 0z" fill="rgba(255,255,255,0.75)" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${70 + i * 18} 50)`}>
              <path
                className="sc-float"
                d="M0 4a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 5-7 9-7 9s-7-4-7-9z"
                fill="#fda4af"
                style={{ animationDelay: `${i * 0.9}s` }}
              />
            </g>
          ))}
        </>
      );
    case "radar":
      // আবহাওয়া পাতা: স্যাটেলাইট-রাডার, ঘুরন্ত আলো আর জ্বলে ওঠা বিন্দু (আজকের কার্ডে আলাদা সূর্য/মেঘ থাকে)
      return (
        <>
          {[44, 30, 16].map((r) => (
            <circle key={r} cx="80" cy="72" r={r} fill="none" stroke={W} strokeOpacity="0.55" strokeWidth="1.6" />
          ))}
          <path d="M80 28V116M36 72H124" stroke={W} strokeOpacity="0.3" strokeWidth="1.2" />
          <g className="sc-spin-slow" style={{ transformOrigin: "80px 72px" }}>
            <path d="M80 72L80 28A44 44 0 0 1 118 50Z" fill="rgba(255,255,255,0.35)" />
            <path d="M80 72L118 50" stroke={W} strokeWidth="2" strokeLinecap="round" />
          </g>
          {[[98, 54, 0], [62, 88, 0.8], [104, 92, 1.6]].map(([x, y, d]) => (
            <circle key={x} className="sc-tick" cx={x} cy={y} r="4" fill="#fde68a" style={{ animationDelay: `${d}s` }} />
          ))}
          <circle cx="80" cy="72" r="4" fill={W} />
          <g className="sc-bob">
            <rect x="122" y="10" width="14" height="10" rx="2" fill="#fcd34d" />
            <rect x="108" y="12" width="12" height="6" rx="1.5" fill="#bfdbfe" />
            <rect x="138" y="12" width="12" height="6" rx="1.5" fill="#bfdbfe" />
          </g>
        </>
      );
    case "chat":
      return (
        <>
          <path d="M28 34h86a14 14 0 0 1 14 14v34a14 14 0 0 1-14 14H64l-20 16v-16H28a14 14 0 0 1-14-14V48a14 14 0 0 1 14-14z" fill={W} className="sc-bob" />
          {[0, 1, 2].map((i) => (
            <circle key={i} className="sc-dot" cx={52 + i * 20} cy="65" r="6" fill="#22c55e" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </>
      );
  }
}

export default function HeaderScene({ scene }: { scene: Scene }) {
  const ref = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState(true);

  // পর্দার বাইরে থাকলে animation থামিয়ে রাখা (CPU/ব্যাটারি বাঁচে)
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      key={scene}
      aria-hidden
      viewBox="0 0 160 140"
      className={`scene pointer-events-none absolute -right-2 bottom-0 h-full max-h-32 w-auto opacity-40 sm:max-h-40 sm:right-6 sm:opacity-90 ${on ? "" : "scene-paused"}`}
    >
      <SceneArt scene={scene} />
    </svg>
  );
}
