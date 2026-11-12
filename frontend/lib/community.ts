// কমিউনিটি: অবতার, পটভূমি, ধরন আর API সহায়ক। id-গুলো backend/community_catalog.py-র সাথে মেলে (টেস্ট দেখে)।
// অবতারের ছবি: Microsoft Fluent Emoji (MIT লাইসেন্স), public/avatars/-এ।
import { API } from "@/lib/location";
import type { GIconName } from "@/components/garden-icons";

export type Profile = { id: number; user_id: number; avatar: string; background: string; name: string; created_at: string };
export type PostImage = { feed: string; full: string; width: number; height: number };
export type Reaction = "like" | "love" | "care";
export type Post = {
  id: number;
  author: Profile | null;
  is_mine: boolean;
  caption: string;
  created_at: string;
  images: PostImage[];
  reactions: Record<Reaction, number>;
  reaction_total: number;
  my_reaction: Reaction | null;
  comment_count: number;
  share_count: number;
  saved: boolean;
  shared: boolean;
  at?: string;
};
export type Comment = { id: number; text: string; created_at: string; author: Profile | null; can_delete: boolean };
export type Page = { posts: Post[]; next_before: number | null };

export const AVATAR_GROUPS: { id: string; label: string; items: string[] }[] = [
  { id: "veg", label: "সবজি", items: ["tomato", "potato", "carrot", "eggplant", "pumpkin", "cabbage", "broccoli", "chili", "capsicum", "cucumber", "corn", "onion", "garlic", "ginger", "peas", "mushroom"] },
  { id: "fruit", label: "ফল", items: ["strawberry", "watermelon", "mango", "banana", "lemon", "cherries", "grapes", "pineapple", "peach", "apple", "coconut", "avocado", "kiwi"] },
  { id: "flower", label: "ফুল", items: ["sunflower", "rose", "hibiscus", "tulip", "blossom", "sakura", "lotus", "bouquet"] },
  { id: "garden", label: "বাগান ও প্রকৃতি", items: ["seedling", "herb", "pot", "cactus", "clover", "tree", "leaf", "ladybug", "bee", "butterfly", "snail", "rice"] },
];

// প্রতিটা অবতারের বাংলা নাম আর মানানসই পটভূমি
export const AVATARS: Record<string, { bn: string; bg: string }> = {
  tomato: { bn: "টমেটো", bg: "terracotta" },
  potato: { bn: "আলু", bg: "terracotta" },
  carrot: { bn: "গাজর", bg: "sunrise" },
  eggplant: { bn: "বেগুন", bg: "lavender" },
  pumpkin: { bn: "কুমড়া", bg: "sunrise" },
  cabbage: { bn: "বাঁধাকপি", bg: "mint" },
  broccoli: { bn: "ব্রকলি", bg: "forest" },
  chili: { bn: "মরিচ", bg: "terracotta" },
  capsicum: { bn: "ক্যাপসিকাম", bg: "meadow" },
  cucumber: { bn: "শসা", bg: "mint" },
  corn: { bn: "ভুট্টা", bg: "lemon" },
  onion: { bn: "পেঁয়াজ", bg: "lavender" },
  garlic: { bn: "রসুন", bg: "dots" },
  ginger: { bn: "আদা", bg: "lemon" },
  peas: { bn: "মটরশুঁটি", bg: "meadow" },
  mushroom: { bn: "মাশরুম", bg: "forest" },
  strawberry: { bn: "স্ট্রবেরি", bg: "petals" },
  watermelon: { bn: "তরমুজ", bg: "mint" },
  mango: { bn: "আম", bg: "sunrise" },
  banana: { bn: "কলা", bg: "lemon" },
  lemon: { bn: "লেবু", bg: "lemon" },
  cherries: { bn: "চেরি", bg: "petals" },
  grapes: { bn: "আঙুর", bg: "lavender" },
  pineapple: { bn: "আনারস", bg: "sunrise" },
  peach: { bn: "পিচ", bg: "petals" },
  apple: { bn: "আপেল", bg: "meadow" },
  coconut: { bn: "নারকেল", bg: "waves" },
  avocado: { bn: "অ্যাভোকাডো", bg: "forest" },
  kiwi: { bn: "কিউই", bg: "mint" },
  sunflower: { bn: "সূর্যমুখী", bg: "sky" },
  rose: { bn: "গোলাপ", bg: "petals" },
  hibiscus: { bn: "জবা", bg: "petals" },
  tulip: { bn: "টিউলিপ", bg: "lavender" },
  blossom: { bn: "ফুল", bg: "lemon" },
  sakura: { bn: "সাকুরা", bg: "petals" },
  lotus: { bn: "পদ্ম", bg: "waves" },
  bouquet: { bn: "ফুলের তোড়া", bg: "petals" },
  seedling: { bn: "চারা", bg: "meadow" },
  herb: { bn: "পাতা", bg: "leaves" },
  pot: { bn: "টবের গাছ", bg: "terracotta" },
  cactus: { bn: "ক্যাকটাস", bg: "sunrise" },
  clover: { bn: "চার পাতার ক্লোভার", bg: "leaves" },
  tree: { bn: "গাছ", bg: "forest" },
  leaf: { bn: "ঝরা পাতা", bg: "sunrise" },
  ladybug: { bn: "লেডিবাগ", bg: "leaves" },
  bee: { bn: "মৌমাছি", bg: "lemon" },
  butterfly: { bn: "প্রজাপতি", bg: "sky" },
  snail: { bn: "শামুক", bg: "dots" },
  rice: { bn: "ধানের শীষ", bg: "lemon" },
};

export const AVATAR_STYLES = [
  { id: "3d", label: "৩D" },
  { id: "flat", label: "ফ্ল্যাট" },
] as const;

export function avatarSrc(avatar: string) {
  const [name, style] = avatar.split(/-(?=[^-]+$)/);
  return `/avatars/${name}-${style}.${style === "3d" ? "webp" : "svg"}`;
}
export const avatarName = (avatar: string) => AVATARS[avatar.split(/-(?=[^-]+$)/)[0]]?.bn ?? "";

// পটভূমি: রঙের গ্রেডিয়েন্ট, কয়েকটায় ছোট নকশা (SVG)
const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const LEAF = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><path d='M10 30c0-10 8-18 18-18 0 10-8 18-18 18z' fill='%23fff' fill-opacity='.22'/><path d='M34 44c0-6 5-11 11-11 0 6-5 11-11 11z' fill='%23fff' fill-opacity='.16'/></svg>`.replace(/%23/g, "#"),
);
const DOTS = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='3' cy='3' r='2' fill='#fff' fill-opacity='.35'/></svg>`);
const WAVES = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='24' viewBox='0 0 60 24'><path d='M0 12c10-8 20-8 30 0s20 8 30 0' fill='none' stroke='#fff' stroke-opacity='.3' stroke-width='2'/></svg>`,
);
const PETALS = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g fill='#fff' fill-opacity='.28'><ellipse cx='14' cy='10' rx='3' ry='6'/><ellipse cx='14' cy='18' rx='3' ry='6'/><ellipse cx='10' cy='14' rx='6' ry='3'/><ellipse cx='18' cy='14' rx='6' ry='3'/></g><circle cx='42' cy='42' r='3' fill='#fff' fill-opacity='.3'/></svg>`,
);

type Bg = { id: string; label: string; css: string };
const bg = (id: string, label: string, css: string): Bg => ({ id, label, css });
export const BACKGROUNDS: Bg[] = [
  bg("meadow", "সবুজ মাঠ", "linear-gradient(135deg,#86efac,#22c55e 55%,#15803d)"),
  bg("sunrise", "ভোরের আলো", "linear-gradient(135deg,#fde68a,#fb923c 60%,#f43f5e)"),
  bg("mint", "পুদিনা", "linear-gradient(135deg,#ccfbf1,#5eead4 50%,#14b8a6)"),
  bg("lavender", "ল্যাভেন্ডার", "linear-gradient(135deg,#e9d5ff,#c084fc 55%,#7c3aed)"),
  bg("forest", "বন", "linear-gradient(135deg,#166534,#14532d 60%,#052e16)"),
  bg("sky", "নীল আকাশ", "linear-gradient(180deg,#bae6fd,#7dd3fc 45%,#fef9c3)"),
  bg("terracotta", "মাটির টব", "linear-gradient(135deg,#fed7aa,#ea580c 60%,#9a3412)"),
  bg("lemon", "লেবু রোদ", "linear-gradient(135deg,#fef9c3,#facc15 55%,#84cc16)"),
  bg("leaves", "পাতার নকশা", `${LEAF}, linear-gradient(135deg,#4ade80,#16a34a)`),
  bg("dots", "শিশির বিন্দু", `${DOTS}, linear-gradient(135deg,#a7f3d0,#34d399 50%,#059669)`),
  bg("waves", "জলের ঢেউ", `${WAVES}, linear-gradient(135deg,#a5f3fc,#38bdf8 55%,#0ea5e9)`),
  bg("petals", "ফুলের পাপড়ি", `${PETALS}, linear-gradient(135deg,#fbcfe8,#f472b6 55%,#db2777)`),
];
export const bgCss = (id: string) => BACKGROUNDS.find((b) => b.id === id)?.css ?? BACKGROUNDS[0].css;

export const REACTIONS: { id: Reaction; label: string; icon: GIconName; color: string }[] = [
  { id: "like", label: "লাইক", icon: "thumb", color: "text-sky-600" },
  { id: "love", label: "ভালোবাসা", icon: "heart", color: "text-rose-600" },
  { id: "care", label: "যত্ন", icon: "sprout", color: "text-green-600" },
];

/** লোকাল storage-এ ছবির ঠিকানা "/api/..." আসে, Supabase-এ পুরো https ঠিকানা */
export const mediaUrl = (u: string) => (u.startsWith("/api/") ? `${API}${u}` : u);

/** "৫ মিনিট আগে" ধরনের সময় */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const n = (x: number) => Math.max(1, Math.floor(x)).toLocaleString("bn-BD");
  if (s < 60) return "এইমাত্র";
  if (s < 3600) return `${n(s / 60)} মিনিট আগে`;
  if (s < 86400) return `${n(s / 3600)} ঘণ্টা আগে`;
  if (s < 7 * 86400) return `${n(s / 86400)} দিন আগে`;
  return new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
}

/** এক শব্দের নাম (backend-এর নিয়মের মতো): অক্ষর, কার-চিহ্ন, সংখ্যা, _ - . */
export function nameError(name: string) {
  const n = name.trim().normalize("NFC");
  if (!n) return "একটা নাম দিন";
  if (n.length > 24) return "নাম সর্বোচ্চ ২৪ অক্ষর";
  if (/\s/.test(n)) return "নাম একটাই শব্দ হবে, ফাঁকা জায়গা দেবেন না";
  if (!/^[\p{L}\p{M}\p{N}_.-]+$/u.test(n)) return "শুধু অক্ষর আর সংখ্যা দিন (চিহ্ন নয়)";
  return "";
}

/** ছবিসহ পোস্ট পাঠায়, আপলোডের অগ্রগতি জানায় (fetch এটা দেয় না, তাই XMLHttpRequest) */
export function uploadPost(files: Blob[], caption: string, onProgress: (pct: number) => void): Promise<Post> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f, i) => form.append("images", f, `photo-${i + 1}.${f.type === "image/webp" ? "webp" : "jpg"}`));
    form.append("caption", caption);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/community/posts`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { detail?: unknown } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as unknown as Post);
      else if (xhr.status === 413) reject(new Error("ছবিগুলো একসাথে অনেক বড়; কম ছবি দিন"));
      else reject(new Error(typeof data?.detail === "string" ? data.detail : "পোস্ট করা যায়নি, আবার চেষ্টা করুন"));
    };
    xhr.onerror = () => reject(new Error("সার্ভারে পৌঁছানো যায়নি, ইন্টারনেট দেখুন"));
    xhr.send(form);
  });
}
