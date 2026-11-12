import { API } from "@/lib/location";
import type { GIconName } from "@/components/garden-icons";

export type TaskType = "water" | "fertilize" | "prune" | "inspect" | "repot" | "other";
export type SoilStatus = "dry" | "slightly_moist" | "moist" | "wet";
export type HealthStatus = "healthy" | "monitor" | "attention" | "unknown";

export type Reminder = {
  id: number;
  plant_id: number;
  task: TaskType;
  task_bn: string;
  icon: string;
  label: string;
  every_days: number;
  last_done: string | null;
  next_due: string;
  days_left: number;
  is_due: boolean;
  is_overdue: boolean;
  enabled: boolean;
};
export type TaskRow = Reminder & {
  plant: string;
  plant_name: string;
  weather_note?: string;
  check_sooner?: boolean;
};

export type Plant = {
  id: number;
  name: string;
  name_bn: string;
  nickname: string;
  category: string;
  pot_liters: number;
  container: string;
  zone: string;
  soil_type: string;
  sunlight_hours: number | null;
  stage: string;
  planted_on: string | null;
  notes: string;
  status: "active" | "archived";
  reminders: Reminder[];
  next_task: Reminder | null;
  last_watered: string | null;
  soil: {
    status: SoilStatus | null;
    status_bn: string;
    source: "user" | "sensor" | "unknown";
    observed_at: string | null;
    stale: boolean;
  };
  health: {
    status: HealthStatus;
    status_bn: string;
    observed_at: string | null;
    symptoms_bn: string[];
  };
  needs_water?: boolean;
  needs_attention?: boolean;
  alert_types?: string[];
};

export type Observation = {
  id: number;
  observed_at: string;
  soil_status: SoilStatus | null;
  soil_bn: string | null;
  health_status: HealthStatus | null;
  health_bn: string | null;
  symptoms: string[];
  symptoms_bn: string[];
  notes: string;
  source: string;
};
export type LogItem = {
  id: number;
  plant_id: number;
  plant: string;
  action: string;
  detail: string;
  logged_at: string;
};
export type PlantDetail = Plant & {
  all_reminders: Reminder[];
  observations: Observation[];
  history: LogItem[];
};

export type GardenAlert = {
  id: string;
  type: "drying" | "rain" | "heavy_rain" | "wind" | "fungus";
  severity: "info" | "warning" | "serious";
  title: string;
  message: string;
  reason: string;
  date: string;
  plant_ids: number[];
  plants: string[];
  basis: "estimated";
  source: string;
  fetched_at: string;
};
export type ForecastDay = {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  rain_mm: number | null;
  rain_prob: number | null;
  wind_gust: number | null;
};
export type Dashboard = {
  generated_at: string;
  today: string;
  area: { upazila: string; district_bn: string; division_bn: string } | null;
  summary: {
    plants: number;
    archived: number;
    tasks_today: number;
    overdue: number;
    water_due: number;
    attention: number;
  };
  tasks: { overdue: TaskRow[]; today: TaskRow[]; upcoming: TaskRow[] };
  plants: Plant[];
  alerts: GardenAlert[];
  weather:
    | { status: "ok"; fetched_at: string; source: string; days: ForecastDay[] }
    | { status: "unavailable" };
  recent_activity: LogItem[];
};

export type CatalogItem = { name: string; name_bn: string; category: string; prune: boolean };

/** backend-এ request; ব্যর্থ হলে backend-এর বাংলা বার্তাসহ Error */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    credentials: "include", // লগইনের cookie
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : "সার্ভার থেকে উত্তর পাওয়া যায়নি, একটু পরে আবার চেষ্টা করুন");
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "কিছু একটা সমস্যা হয়েছে");

export const TASK_OPTIONS: { value: TaskType; label: string; icon: GIconName }[] = [
  { value: "water", label: "পানি (মাটি দেখে)", icon: "water" },
  { value: "fertilize", label: "সার দেওয়া", icon: "leaf" },
  { value: "prune", label: "ডাল ছাঁটা", icon: "scissors" },
  { value: "inspect", label: "পোকা-রোগ পরীক্ষা", icon: "search" },
  { value: "repot", label: "টব বদল / শিকড় দেখা", icon: "pot" },
  { value: "other", label: "অন্য কাজ", icon: "pin" },
];
// backend-এর কাজের ধরন (task) থেকে icon; backend-এর পাঠানো emoji ব্যবহার হয় না
export const taskIcon = (task: string): GIconName => TASK_OPTIONS.find((o) => o.value === task)?.icon ?? "pin";

export const SOIL_OPTIONS: { value: SoilStatus; label: string; hint: string }[] = [
  { value: "dry", label: "শুকনো", hint: "আঙুলে মাটি লাগে না, ঝুরঝুরে" },
  { value: "slightly_moist", label: "হালকা ভেজা", hint: "উপরটা শুকনো, ভেতরে একটু ভেজা" },
  { value: "moist", label: "ভেজা", hint: "আঙুলে মাটি লেগে থাকে" },
  { value: "wet", label: "খুব ভেজা", hint: "কাদা কাদা, পানি জমে আছে" },
];

export const HEALTH_OPTIONS: { value: Exclude<HealthStatus, "unknown">; label: string }[] = [
  { value: "healthy", label: "ভালো আছে" },
  { value: "monitor", label: "নজরে রাখতে হবে" },
  { value: "attention", label: "সমস্যা আছে" },
];

export const SYMPTOMS: { value: string; label: string }[] = [
  { value: "yellow_leaves", label: "পাতা হলুদ" },
  { value: "spots", label: "পাতায় দাগ" },
  { value: "wilting", label: "নেতিয়ে পড়া" },
  { value: "curling", label: "পাতা কোঁকড়ানো" },
  { value: "insects", label: "পোকা দেখা যাচ্ছে" },
  { value: "stem_damage", label: "কাণ্ডে ক্ষত" },
  { value: "slow_growth", label: "বাড়ছে না" },
  { value: "white_powder", label: "সাদা গুঁড়া" },
];

export const STAGES = [
  { value: "", label: "জানা নেই" },
  { value: "seedling", label: "চারা" },
  { value: "growing", label: "বাড়ছে" },
  { value: "flowering", label: "ফুল এসেছে" },
  { value: "fruiting", label: "ফল ধরেছে" },
  { value: "mature", label: "পরিণত / বহুবর্ষী" },
];

export const CONTAINERS = [
  { value: "", label: "জানা নেই" },
  { value: "pot", label: "মাটি/প্লাস্টিকের টব" },
  { value: "tub", label: "ড্রাম / বড় টব" },
  { value: "grow_bag", label: "গ্রো ব্যাগ" },
  { value: "bed", label: "ছাদের বেড" },
  { value: "other", label: "অন্য কিছু" },
];

export const SOIL_TYPES = [
  { value: "", label: "জানা নেই" },
  { value: "Loamy", label: "দোআঁশ (Loamy)" },
  { value: "Sandy", label: "বেলে (Sandy)" },
  { value: "Clay", label: "এঁটেল (Clay)" },
  { value: "Black", label: "কালো মাটি (Black)" },
  { value: "Mix", label: "টবের মিশ্রণ (মাটি+গোবর+কোকোপিট)" },
];

// ফসল পরামর্শ ও ১ বছরের পরিকল্পনার বাছাই (মান লিটার ও ঘণ্টায়, backend যেমন চায়)
// ইঞ্চি = টবের মুখের ব্যাস; সাধারণ মাটির/প্লাস্টিকের টবে আনুমানিক আয়তন (মোটামুটি ৮" ≈ ৪-৫, ১০" ≈ ৭-৮,
// ১২" ≈ ১০-১২, ১৪" ≈ ১৫-১৮ লিটার; ২০০ লিটারের ড্রাম কাটা হাফ ড্রাম ≈ ১০০ লিটার)
export const POT_CHOICES = [
  { value: 2, label: "৫-৬ ইঞ্চি ছোট টব (~২ লিটার)" },
  { value: 5, label: "৮-৯ ইঞ্চি টব (~৫ লিটার)" },
  { value: 10, label: "১২ ইঞ্চি টব (~১০ লিটার)" },
  { value: 15, label: "১৪ ইঞ্চি টব (~১৫ লিটার)" },
  { value: 30, label: "বড় টব / গ্রো ব্যাগ (~৩০ লিটার)" },
  { value: 60, label: "ছোট ড্রাম / বড় গ্রো ব্যাগ (~৬০ লিটার)" },
  { value: 100, label: "হাফ ড্রাম (~১০০ লিটার)" },
];
export const SUN_CHOICES = [
  { value: 3, label: "৩-৪ ঘণ্টা (আংশিক ছায়া)" },
  { value: 5, label: "প্রায় ৫ ঘণ্টা" },
  { value: 6, label: "৬-৭ ঘণ্টা (ভালো রোদ)" },
  { value: 8, label: "৮ ঘণ্টা বা বেশি (সারাদিন রোদ)" },
];

// ফসলের icon: components/crop-icons.tsx-এর <CropIcon name=... />

export const HEALTH_STYLE: Record<HealthStatus, { icon: GIconName; cls: string }> = {
  healthy: { icon: "check", cls: "bg-green-100 text-green-800" },
  monitor: { icon: "eye", cls: "bg-amber-100 text-amber-900" },
  attention: { icon: "warning", cls: "bg-red-100 text-red-800" },
  unknown: { icon: "question", cls: "bg-gray-100 text-gray-600" },
};

export const ACTION_BN: Record<string, string> = {
  added: "যোগ",
  watered: "পানি",
  done: "সম্পন্ন",
  snoozed: "পেছানো",
  rescheduled: "নতুন তারিখ",
  observation: "পর্যবেক্ষণ",
  edited: "সম্পাদনা",
  archived: "আর্কাইভ",
  restored: "ফেরত",
  reminder_added: "নতুন কাজ",
};
export const ACTION_ICON: Record<string, GIconName> = {
  added: "sprout", watered: "water", done: "check", snoozed: "clock", rescheduled: "calendar",
  observation: "note", edited: "pencil", archived: "box", restored: "refresh", reminder_added: "plus",
};

/** ইংরেজি অঙ্ক বাংলায় (৩.৫, ১০ ইত্যাদি); বাকি লেখা যেমন আছে */
export const bnDigits = (v: number | string | null | undefined) =>
  v == null ? "" : String(v).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

/** "2026-11-07" → "৭ নভেম্বর" (এই বছর হলে সাল ছাড়া) */
export function bnDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return bnDigits(iso);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("bn-BD", opts);
}

export function dueText(days: number) {
  if (days < -1) return `${bnDigits(-days)} দিন দেরি`;
  if (days === -1) return "গতকাল ছিল";
  if (days === 0) return "আজ";
  if (days === 1) return "আগামীকাল";
  return `${bnDigits(days)} দিন পরে`;
}

// "AM/PM" নয়: "সকাল ৯:০৫", "রাত ১১:৪২"
export function bnClock(d: Date) {
  const h = d.getHours();
  const part = h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকেল" : h < 20 ? "সন্ধ্যা" : "রাত";
  return `${part} ${bnDigits(h % 12 || 12)}:${bnDigits(String(d.getMinutes()).padStart(2, "0"))}`;
}

export function whenText(iso: string | null) {
  if (!iso) return "এখনো লেখা হয়নি";
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  const time = iso.includes("T") ? ` ${bnClock(d)}` : "";
  if (days === 0) return `আজ${time}`;
  if (days === 1) return `গতকাল${time}`;
  return `${bnDigits(days)} দিন আগে`;
}
