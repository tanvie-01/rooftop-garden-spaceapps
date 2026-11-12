// হোমপেজের স্যাটেলাইট: উড়ে এসে শিরোনাম আর লেখা স্ক্যান করে, তারপর ছোট হয়ে "NASA ডেটা + AI" ব্যাজে মিশে যায়।
// পুরো animation CSS-এ (globals.css-এর .sat-*), এখানে শুধু ছবি; প্রতিবার পাতা খুললে বা refresh করলে চলে।

export function Satellite() {
  return (
    <span className="sat-fly" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-[0_6px_10px_rgba(20,83,45,0.35)]">
        <defs>
          <linearGradient id="sat-panel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="sat-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <g transform="rotate(-28 32 32)">
          {/* সোলার প্যানেল */}
          {[2, 44].map((x) => (
            <g key={x}>
              <rect x={x} y="24" width="18" height="16" rx="2" fill="url(#sat-panel)" stroke="#1e3a8a" strokeWidth="1" />
              <path d={`M${x + 6} 24v16M${x + 12} 24v16M${x} 32h18`} stroke="#bfdbfe" strokeWidth="0.8" opacity="0.8" />
            </g>
          ))}
          <path d="M20 32h4M40 32h4" stroke="#94a3b8" strokeWidth="2" />
          {/* শরীর */}
          <rect x="24" y="22" width="16" height="20" rx="3" fill="url(#sat-body)" stroke="#92400e" strokeWidth="1" />
          <rect x="27" y="26" width="10" height="4" rx="1" fill="#fff" opacity="0.5" />
          {/* ডিশ আর অ্যান্টেনা */}
          <path d="M26 46q6 6 12 0z" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
          <path d="M32 42v4" stroke="#64748b" strokeWidth="1.5" />
          <path d="M32 22v-7" stroke="#64748b" strokeWidth="1.2" />
          <circle className="sat-blink" cx="32" cy="14" r="2.2" fill="#22c55e" />
        </g>
      </svg>
    </span>
  );
}
