// ফসলের icon (Rooftop Garden icon pack-এর অংশ): একই ধাঁচে আঁকা ছোট রঙিন ছবি, emoji-র বদলে।
// প্রতিটা ফসল = একটা আকার (গোল, লম্বা, শুঁটি, মূল, শাক, ফুল...) + নিজের রং; সবার উপরে বাগানের সবুজ বোঁটা/পাতা।
// নাম দেওয়া যায় ইংরেজি ফসলের নাম ("Tomato", "Papaya (dwarf)") বা রোগ ডায়েরির id ("redamaranth")।

const G = "#3f9d4a"; // পাতা/বোঁটার সবুজ
const GD = "#2a6e33";

type Paint = { fill: string; edge: string };
type Shape = (p: Paint) => React.ReactNode;

const stem = (
  <>
    <path d="M12 7.5c-1.6-1-3.4-1-4.6-.2 1.2 1.3 3 1.5 4.6.2zm0 0c1.6-1 3.4-1 4.6-.2-1.2 1.3-3 1.5-4.6.2z" fill={G} stroke={GD} />
    <path d="M12 7.5V4.5" stroke={GD} />
  </>
);

const SHAPES: Record<string, Shape> = {
  round: ({ fill, edge }) => (
    <>
      <path d="M12 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" fill={fill} stroke={edge} />
      <path d="M8.5 12.5a3.5 3.5 0 0 1 2.5-2.5" stroke="#fff" strokeOpacity={0.7} />
      {stem}
    </>
  ),
  small: ({ fill, edge }) => (
    <>
      <path d="M8 19.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6zM16 19.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z" fill={fill} stroke={edge} />
      <path d="M8 13c.5-3 2.5-5.5 4-7 1.5 1.5 3.5 4 4 7" stroke={GD} />
      <path d="M12 6c1.3-1.4 3.3-1.8 4.8-1.2-1 1.6-3 2-4.8 1.2z" fill={G} stroke={GD} />
    </>
  ),
  oval: ({ fill, edge }) => (
    <>
      <path d="M12 21.5c-3.5 0-5.5-3.5-5.5-7S8.5 7.5 12 7.5s5.5 3.5 5.5 7-2 7-5.5 7z" fill={fill} stroke={edge} />
      <path d="M9 13.5c0-1.5.8-2.8 2-3.3" stroke="#fff" strokeOpacity={0.7} />
      {stem}
    </>
  ),
  long: ({ fill, edge }) => (
    <>
      <path d="M9.5 8.5c-2 3-2.5 8 0 11.5 1.5 2 5 1.5 5.8-1.5 1-4-1-8-3.3-10.5z" fill={fill} stroke={edge} />
      <path d="M8.3 7.7c1.2-1.7 3.5-2 4.7-.6-.8 1.6-3 2-4.7.6z" fill={G} stroke={GD} />
      <path d="M10.6 7.2 10 3.8" stroke={GD} />
    </>
  ),
  chili: ({ fill, edge }) => (
    <>
      <path d="M8 7.5c-1 5 1.5 11 9.5 13.5-1-2.5-3-5.5-4-8.5-.6-1.8-.6-3.5-1-5z" fill={fill} stroke={edge} />
      <path d="M6.8 7.6c1.6-1.4 4-1.3 5.6 0-1.6 1.2-4 1.3-5.6 0z" fill={G} stroke={GD} />
      <path d="M9.6 6.8C9.5 5 10.5 3.5 12 3" stroke={GD} />
    </>
  ),
  pod: ({ fill, edge }) => (
    <>
      <path d="M10 6.5c-1 4-1 9.5 1.5 14 .3.5 1 .5 1.2 0 2.3-4.5 2.3-10 1.3-14z" fill={fill} stroke={edge} />
      <path d="M12 7.5v11.5" stroke={edge} strokeOpacity={0.6} />
      <path d="M10 6.5c.7-1.3 3.3-1.3 4 0" fill={G} stroke={GD} />
      <path d="M12 6V3.5" stroke={GD} />
    </>
  ),
  gourd: ({ fill, edge }) => (
    <>
      <path d="M11 6c-1.5 1-1.5 4-1 6.5-2.5 2-2.8 6-.5 7.8 2 1.6 5.2.8 5.8-2 .5-2.4-.6-4.4-2.3-5.8.3-2.5.8-5.5-2-6.5z" fill={fill} stroke={edge} />
      <path d="M10.8 6.2c-.2-1.4.6-2.6 1.8-3" stroke={GD} />
      <path d="M12.2 4.5c1.3-1 3-1 4.2-.2-1.2 1.2-3 1.2-4.2.2z" fill={G} stroke={GD} />
    </>
  ),
  banana: ({ fill, edge }) => (
    <>
      <path d="M5 8c.5 7 6 11.5 13.5 11 .8 0 1-.8.3-1.2C12.5 15.5 9 12 8 6.5z" fill={fill} stroke={edge} />
      <path d="M8 6.5 7.6 4.5" stroke={GD} />
      <path d="M17.8 17.8 19.5 18.5" stroke={edge} />
    </>
  ),
  root: ({ fill, edge }) => (
    <>
      <path d="M8 9.5h8c0 4.5-2 9-4 12-2-3-4-7.5-4-12z" fill={fill} stroke={edge} />
      <path d="M10 13h1.5M11.5 16h1.5" stroke={edge} strokeOpacity={0.6} />
      <path d="M12 9.5c-1.5-2.5-4-3.5-5.5-3 .8 2 3 3 5.5 3zm0 0c0-3 1-5.5 2-6.5 1 1.5.5 4.5-2 6.5zm0 0c1.5-2 4-2.5 5.5-1.8-1 1.6-3.3 2.2-5.5 1.8z" fill={G} stroke={GD} />
    </>
  ),
  bulb: ({ fill, edge }) => (
    <>
      <path d="M12 8c-3 2-6 4.5-6 8a5 5 0 0 0 5 4.5h2A5 5 0 0 0 18 16c0-3.5-3-6-6-8z" fill={fill} stroke={edge} />
      <path d="M12 8.5c-1 2.5-1 7 0 12M12 8.5c1 2.5 1 7 0 12" stroke={edge} strokeOpacity={0.5} />
      <path d="M12 8V3.5M10.5 7.5 9.5 4M13.5 7.5l1-3.5" stroke={GD} />
    </>
  ),
  knob: ({ fill, edge }) => (
    <>
      <path d="M4.5 15.5c0-2 1.5-3 3-2.5.5-2.5 3-3 4.5-1.5 1-2 4-2 4.8.3 2-.3 3.2 1.5 2.5 3.5-.5 2-2.5 2.5-4 1.8-1 1.5-3.5 1.6-4.5.2-1.5 1.2-4 .6-4.8-1z" fill={fill} stroke={edge} />
      <path d="M12 11.5c0-3 1-5.5 2.5-7" stroke={GD} />
      <path d="M14.5 4.5c1.3-.9 3-.8 4 .2-1.2 1-3 1-4-.2z" fill={G} stroke={GD} />
    </>
  ),
  leafy: ({ fill, edge }) => (
    <>
      <path d="M12 21c-4.5-1-7-5-6.5-10.5 3.5.5 6 3 6.5 6.5" fill={fill} stroke={edge} />
      <path d="M12 21c4.5-1 7-5 6.5-10.5-3.5.5-6 3-6.5 6.5" fill={fill} stroke={edge} />
      <path d="M12 21c-2.5-4-2.5-11 0-17 2.5 6 2.5 13 0 17z" fill={fill} stroke={edge} />
      <path d="M12 20V7" stroke={edge} strokeOpacity={0.55} />
    </>
  ),
  head: ({ fill, edge }) => (
    <>
      <path d="M12 20.5a7.5 6.5 0 1 0 0-13 7.5 6.5 0 0 0 0 13z" fill={fill} stroke={edge} />
      <path d="M12 7.5c-2.5 2-3.5 5-3 8M12 7.5c2.5 2 3.5 5 3 8M5.5 13c2.5-.5 4.5.3 6.5 2.5 2-2.2 4-3 6.5-2.5" stroke={edge} strokeOpacity={0.6} />
    </>
  ),
  floret: ({ fill, edge }) => (
    <>
      <path d="M4.5 13c-.5 4 3 7.5 7.5 7.5s8-3.5 7.5-7.5c-2 2-4 2.5-7.5 2.5S6.5 15 4.5 13z" fill={G} stroke={GD} />
      <path d="M7 13a2.5 2.5 0 0 1 .5-5 3 3 0 0 1 4.5-2 3 3 0 0 1 4.5 2 2.5 2.5 0 0 1 .5 5c-1.5 1.2-3 1.5-5 1.5s-3.5-.3-5-1.5z" fill={fill} stroke={edge} />
    </>
  ),
  herb: ({ fill, edge }) => (
    <>
      <path d="M12 21v-9M12 14l-4-3M12 13l4-3.5" stroke={GD} />
      <path d="M12 12c-2-.5-3-2-2.5-4 1-.3 1.8 0 2.5 1 .7-1 1.5-1.3 2.5-1 .5 2-.5 3.5-2.5 4z" fill={fill} stroke={edge} />
      <path d="M8 11c-2 .3-3.5-.7-3.8-2.5 1.5-.8 3-.5 3.8.8.5-1.2 1.7-1.8 3-1.3" fill={fill} stroke={edge} />
      <path d="M16 9.5c1.5.8 3.2.3 4-1.3-1.2-1-2.7-1-3.8 0-.3-1.3-1.5-2-2.8-1.6" fill={fill} stroke={edge} />
    </>
  ),
  berry: ({ fill, edge }) => (
    <>
      <path d="M12 21c-3-1.5-6.5-5-6.5-9 0-2 1.5-3 3.5-3h6c2 0 3.5 1 3.5 3 0 4-3.5 7.5-6.5 9z" fill={fill} stroke={edge} />
      <path d="M9 13h.01M12 12h.01M15 13h.01M10.5 16h.01M13.5 16h.01M12 18.5h.01" stroke="#fde68a" strokeWidth={1.6} />
      <path d="M12 9c-1.5-1.5-3.5-1.8-4.8-1 1 1.5 3 1.8 4.8 1zm0 0c1.5-1.5 3.5-1.8 4.8-1-1 1.5-3 1.8-4.8 1zm0 0V4.5" fill={G} stroke={GD} />
    </>
  ),
  flower: ({ fill, edge }) => (
    <>
      <path d="M12 14v7.5M12 18c-1.5-1.5-3.5-1.8-4.5-1 1 1.5 3 1.8 4.5 1z" stroke={GD} fill={G} />
      <path
        d="M12 9.2c-1-2.7-.5-5.2 0-5.2s1 2.5 0 5.2zm2.4 1.4c1.8-2.2 4.2-3 4.5-2.6.3.5-1.7 2.2-4.5 2.6zm0 2.8c2.8.4 4.8 2.1 4.5 2.6-.3.4-2.7-.4-4.5-2.6zM9.6 13.4c-1.8 2.2-4.2 3-4.5 2.6-.3-.5 1.7-2.2 4.5-2.6zm0-2.8C6.8 10.2 4.8 8.5 5.1 8c.3-.4 2.7.4 4.5 2.6z"
        fill={fill}
        stroke={edge}
      />
      <path d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="#facc15" stroke="#a16207" />
    </>
  ),
  pompom: ({ fill, edge }) => (
    <>
      <path d="M12 15v6.5M12 18.5c1.5-1.5 3.5-1.8 4.5-1-1 1.5-3 1.8-4.5 1z" stroke={GD} fill={G} />
      <path d="M12 15.5a3 3 0 0 1-3-1 3 3 0 0 1-2.5-3.5A3 3 0 0 1 8 7.5a3 3 0 0 1 4-2.5 3 3 0 0 1 4 2.5 3 3 0 0 1 1.5 3.5 3 3 0 0 1-2.5 3.5 3 3 0 0 1-3 1z" fill={fill} stroke={edge} />
      <path d="M12 8.5c-1.5 0-2.5 1-2.5 2.2M12 8.5c1.5 0 2.5 1 2.5 2.2M12 11v2" stroke={edge} strokeOpacity={0.55} />
    </>
  ),
  rose: ({ fill, edge }) => (
    <>
      <path d="M12 15v6.5M12 18c1.5-1.5 3.5-1.8 4.5-1-1 1.5-3 1.8-4.5 1z" stroke={GD} fill={G} />
      <path d="M12 15.5c-3.5 0-5.5-2.5-5.5-5.5 1-.5 2-.3 2.5.3 0-2 1.5-4 3-4.8 1.5.8 3 2.8 3 4.8.5-.6 1.5-.8 2.5-.3 0 3-2 5.5-5.5 5.5z" fill={fill} stroke={edge} />
      <path d="M10 10c.5 1.5 3.5 1.5 4 0M10.5 12.5c1 .8 2 .8 3 0" stroke={edge} strokeOpacity={0.6} />
    </>
  ),
  hibiscus: ({ fill, edge }) => (
    <>
      <path d="M12 12c-2-3.5-1.5-8.5 0-8.5s2 5 0 8.5zm0 0c3-2.5 8-2 8.5-.5.5 1.4-4.5 3.5-8.5.5zm0 0c3.5 1.5 5.5 6.5 4.5 7.5-1 1-5-2.5-4.5-7.5zm0 0c-.5 5-4.5 8.5-5.5 7.5S8.5 13.5 12 12zm0 0c-4 3-9 1-8.5-.5S9 9.5 12 12z" fill={fill} stroke={edge} />
      <path d="M12 12l4.5-4.5" stroke="#facc15" strokeWidth={1.6} />
      <path d="M16.5 7.5h.01M17.5 6.5h.01" stroke="#a16207" strokeWidth={2} />
    </>
  ),
  star: ({ fill, edge }) => (
    <>
      <path d="M12 15v6.5M12 18.5c1.5-1.5 3.5-1.8 4.5-1-1 1.5-3 1.8-4.5 1z" stroke={GD} fill={G} />
      <path d="M12 4c1 2 1.2 3.5.8 5.3 1.8-1 3.5-1.2 5.7-.3-1.2 2-2.6 2.8-4.6 3 1.5 1.3 2.2 2.8 2 5-2.2-.5-3.4-1.6-3.9-3.5-.5 1.9-1.7 3-3.9 3.5-.2-2.2.5-3.7 2-5-2-.2-3.4-1-4.6-3 2.2-.9 3.9-.7 5.7.3C10.8 7.5 11 6 12 4z" fill={fill} stroke={edge} />
      <path d="M12 10.5h.01" stroke="#a16207" strokeWidth={2.4} />
    </>
  ),
  palm: ({ fill, edge }) => (
    <>
      <path d="M12 21V9" stroke="#8b6b3d" strokeWidth={2} />
      <path d="M12 9c-2-2.5-5-3-7.5-2 2 1.5 5 2.5 7.5 2zm0 0c2-2.5 5-3 7.5-2-2 1.5-5 2.5-7.5 2zm0 0c-1-3-.5-5 1-6.5 1 2 .5 4.5-1 6.5z" fill={G} stroke={GD} />
      <path d="M10 13a1.8 2.3 0 1 0 0-.1zM14 13a1.8 2.3 0 1 0 0-.1z" fill={fill} stroke={edge} />
    </>
  ),
  tree: ({ fill, edge }) => (
    <>
      <path d="M12 21v-6" stroke="#8b6b3d" strokeWidth={2} />
      <path d="M12 15.5c-4.5 0-7-2.5-7-5.5s3-6.5 7-6.5 7 3.5 7 6.5-2.5 5.5-7 5.5z" fill={G} stroke={GD} />
      <path d="M9 10a1.6 1.6 0 1 0 0-.1zM14.5 8.5a1.6 1.6 0 1 0 0-.1zM13.5 12.5a1.6 1.6 0 1 0 0-.1z" fill={fill} stroke={edge} />
    </>
  ),
  sprout: () => (
    <>
      <path d="M12 21v-8" stroke={GD} />
      <path d="M12 13c0-3.5-2.5-6-7-6 0 4 3 6 7 6zm0-2c0-3.5 2.5-6 7-6 0 4-3 6-7 6z" fill={G} stroke={GD} />
      <path d="M7 21h10" stroke="#8b6b3d" />
    </>
  ),
};

const P = (fill: string, edge: string): Paint => ({ fill, edge });
const RED = P("#ef4444", "#b91c1c");
const GREENV = P("#86c46a", "#3f7d2c");

// ফসল -> [আকার, রং]। key: নাম ছোট হাতের অক্ষরে, শুধু a-z (যেমন "papayadwarf" → "papaya")।
const CROPS: Record<string, [string, Paint]> = {
  tomato: ["round", RED],
  chili: ["chili", RED],
  brinjal: ["long", P("#7c3aed", "#4c1d95")],
  okra: ["pod", GREENV],
  bean: ["pod", P("#a3d17c", "#4d7c2a")],
  cucumber: ["pod", P("#4ade80", "#166534")],
  bittergourd: ["pod", P("#22c55e", "#14532d")],
  ridgegourd: ["pod", P("#84cc16", "#3f6212")],
  snakegourd: ["pod", P("#bef264", "#4d7c0f")],
  bottlegourd: ["gourd", P("#bbf7d0", "#15803d")],
  pumpkin: ["round", P("#fb923c", "#c2410c")],
  watermelon: ["round", P("#22c55e", "#14532d")],
  potato: ["oval", P("#d6a76c", "#8a5a2b")],
  spinach: ["leafy", P("#4ade80", "#15803d")],
  redamaranth: ["leafy", P("#e11d48", "#881337")],
  malabarspinach: ["leafy", P("#22c55e", "#166534")],
  basella: ["leafy", P("#22c55e", "#166534")],
  coriander: ["herb", P("#6ee7b7", "#047857")],
  cabbage: ["head", P("#bbf7d0", "#15803d")],
  cauliflower: ["floret", P("#fefce8", "#a3a38a")],
  radish: ["root", P("#fdf2f8", "#be185d")],
  carrot: ["root", P("#fb923c", "#c2410c")],
  onion: ["bulb", P("#c084fc", "#7e22ce")],
  garlic: ["bulb", P("#fafaf9", "#a8a29e")],
  ginger: ["knob", P("#e7c08a", "#92602b")],
  strawberry: ["berry", RED],
  papaya: ["oval", P("#fb923c", "#c2410c")],
  mango: ["oval", P("#fbbf24", "#c2410c")],
  lemon: ["oval", P("#fde047", "#a16207")],
  guava: ["round", P("#a3e635", "#4d7c0f")],
  litchi: ["small", P("#f43f5e", "#9f1239")],
  banana: ["banana", P("#facc15", "#a16207")],
  marigold: ["pompom", P("#fb923c", "#c2410c")],
  zinnia: ["flower", P("#f472b6", "#be185d")],
  portulaca: ["flower", P("#d946ef", "#86198f")],
  hibiscus: ["hibiscus", P("#ef4444", "#991b1b")],
  rose: ["rose", P("#f43f5e", "#9f1239")],
  jasmine: ["star", P("#ffffff", "#a8a29e")],
};

function keyOf(name: string) {
  return name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");
}

export function hasCropIcon(name: string) {
  return keyOf(name) in CROPS;
}

export function CropIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const hit = CROPS[keyOf(name)];
  const shape = hit ? SHAPES[hit[0]] : SHAPES.sprout;
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`inline-block shrink-0 align-[-0.25em] ${className}`}>
      {shape(hit ? hit[1] : P(G, GD))}
    </svg>
  );
}
