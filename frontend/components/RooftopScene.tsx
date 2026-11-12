// হোমপেজের hero-র পেছনে নিজেদের আঁকা ছাদবাগান (ছবির কপিরাইটের ঝামেলা নেই, আর রং সাইটের সাথে মেলে)।
// পেছনে হালকা শহরের দালান, সামনে ছাদের রেলিং, টব, বেড, পানির ট্যাংক; গাছগুলো আলতো দোলে (.roof-sway)।
// লেখার পেছনে থাকে বলে রং হালকা রাখা; পাতার উপরের অংশ খালি, ছবি নিচের দিকে।

function Plant({ x, y, s = 1, leaf = "#22c55e", fruit, delay = 0 }: { x: number; y: number; s?: number; leaf?: string; fruit?: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="roof-sway" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 0V-34" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M0 -12C-12 -12 -18 -20 -18 -28C-6 -28 0 -21 0 -12Z" fill={leaf} />
        <path d="M0 -20C0 -30 8 -37 18 -37C18 -27 10 -20 0 -20Z" fill={leaf} opacity="0.85" />
        <path d="M0 -30C-8 -32 -12 -40 -10 -46C-2 -44 1 -38 0 -30Z" fill={leaf} opacity="0.9" />
        {fruit && (
          <>
            <circle cx="-8" cy="-20" r="3.4" fill={fruit} />
            <circle cx="9" cy="-28" r="3" fill={fruit} />
          </>
        )}
      </g>
    </g>
  );
}

function Pot({ x, y, w = 34, color = "#ea8a4a" }: { x: number; y: number; w?: number; color?: string }) {
  const h = w * 0.8;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M${-w / 2 + 3} 0H${w / 2 - 3}L${w / 2 - 3 - w * 0.1} ${h}H${-w / 2 + 3 + w * 0.1}Z`} fill={color} />
      <rect x={-w / 2} y={-5} width={w} height={7} rx="2.5" fill={color} opacity="0.85" />
    </g>
  );
}

export default function RooftopScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" aria-hidden className={`pointer-events-none ${className}`}>
      <defs>
        <linearGradient id="rf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecfdf5" stopOpacity="0" />
          <stop offset="1" stopColor="#d1fae5" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="rf-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6d3d1" />
          <stop offset="1" stopColor="#a8a29e" />
        </linearGradient>
      </defs>
      <rect width="1200" height="320" fill="url(#rf-sky)" />
      {/* দূরের দালান */}
      <g fill="#a7f3d0" opacity="0.55">
        {[[0, 120, 90], [80, 90, 70], [150, 140, 60], [600, 110, 80], [690, 70, 60], [760, 130, 90], [1040, 100, 80], [1120, 140, 80]].map(([x, h, w]) => (
          <rect key={x} x={x} y={250 - h} width={w} height={h + 70} rx="3" />
        ))}
      </g>
      <g fill="#ffffff" opacity="0.6">
        {[[20, 160], [44, 160], [20, 190], [96, 190], [620, 170], [644, 200], [780, 160], [804, 190], [1060, 180], [1140, 150]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="12" height="14" rx="1.5" />
        ))}
      </g>
      {/* ছাদের মেঝে আর রেলিং */}
      <rect x="0" y="262" width="1200" height="58" fill="url(#rf-roof)" opacity="0.85" />
      <rect x="0" y="256" width="1200" height="8" fill="#e7e5e4" />
      <g stroke="#78716c" strokeWidth="3" opacity="0.5">
        <path d="M0 214H1200" />
        {Array.from({ length: 25 }, (_, i) => (
          <path key={i} d={`M${i * 50 + 10} 214V258`} />
        ))}
      </g>
      {/* পানির ট্যাংক */}
      <g transform="translate(1030 170)" opacity="0.9">
        <rect x="0" y="0" width="74" height="86" rx="10" fill="#0ea5e9" opacity="0.75" />
        <rect x="6" y="-8" width="62" height="12" rx="6" fill="#0284c7" opacity="0.8" />
        <path d="M10 26H64M10 52H64" stroke="#e0f2fe" strokeWidth="2" opacity="0.7" />
      </g>
      {/* উঁচু বেড */}
      <g transform="translate(560 228)">
        <rect x="0" y="0" width="220" height="34" rx="6" fill="#92400e" opacity="0.85" />
        <rect x="0" y="0" width="220" height="8" rx="4" fill="#78350f" />
        <Plant x={30} y={2} s={1} delay={0.2} />
        <Plant x={80} y={2} s={1.15} fruit="#ef4444" delay={0.9} />
        <Plant x={135} y={2} s={0.95} delay={1.6} />
        <Plant x={185} y={2} s={1.1} fruit="#f97316" delay={0.5} />
      </g>
      {/* টবের সারি */}
      {[
        { x: 220, w: 40, c: "#ea8a4a", s: 1.15, f: "#ef4444", d: 0 },
        { x: 290, w: 30, c: "#f59e0b", s: 0.9, f: undefined, d: 1.1 },
        { x: 350, w: 44, c: "#16a34a", s: 1.25, f: "#facc15", d: 0.6 },
        { x: 430, w: 32, c: "#ea8a4a", s: 0.95, f: "#ec4899", d: 1.7 },
        { x: 860, w: 38, c: "#f59e0b", s: 1.1, f: "#ef4444", d: 0.3 },
        { x: 930, w: 30, c: "#ea8a4a", s: 0.9, f: "#a855f7", d: 1.3 },
      ].map((p) => (
        <g key={p.x}>
          <Plant x={p.x} y={232} s={p.s} fruit={p.f} delay={p.d} />
          <Pot x={p.x} y={234} w={p.w} color={p.c} />
        </g>
      ))}
    </svg>
  );
}
