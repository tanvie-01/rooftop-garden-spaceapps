import { useMemo, useSyncExternalStore } from "react";
import type { FeatureCollection, MultiPolygon } from "geojson";

// Vercel-এ frontend আর backend একই ঠিকানায় (vercel.json-এ /api/* যায় backend-এ), তাই সেখানে
// "/api/..." সরাসরি ডাকা হয় আর লগইনের cookie একই সাইটের থাকে। নিজের কম্পিউটারে backend :8000-এ।
export const API =
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NEXT_PUBLIC_VERCEL_ENV ? "" : "http://localhost:8000");

// backend/data/bd-upazilas.geojson-এর প্রতিটা উপজেলার properties
export type UpazilaProps = {
  name: string;
  district: string;
  district_bn: string;
  division: string;
  division_bn: string;
  lat: number;
  lon: number;
};
export type Boundaries = FeatureCollection<MultiPolygon, UpazilaProps>;

// একই নামের উপজেলা আলাদা জেলায় থাকতে পারে (যেমন Kotwali), তাই জেলাসহ key
export const upazilaKey = (p: { name: string; district: string }) => `${p.name}|${p.district}`;

// বাগানের এলাকা: আবহাওয়া পেজের মানচিত্রে বেছে নেওয়া, ব্রাউজারে সেভ থাকে।
// লগইন এলে এটা ইউজারের প্রোফাইলে যাবে।
export type GardenLocation = {
  lat: number;
  lon: number;
  upazila: string | null;
  district: string | null;
  district_bn: string | null;
  division_bn: string | null;
};

export const DEFAULT_LOCATION: GardenLocation = {
  lat: 22.3569,
  lon: 91.7832,
  upazila: null, // ডিফল্ট: চট্টগ্রাম শহর
  district: null,
  district_bn: "চট্টগ্রাম",
  division_bn: "চট্টগ্রাম",
};

const KEY = "rooftop-garden:location";
const EVENT = "rooftop-garden:location-change";
// স্টোরেজ কাজ না করলেও এই ট্যাবে বাছাই করা এলাকা মনে থাকে
let memory: string | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory; // প্রাইভেট উইন্ডো বা স্টোরেজ বন্ধ
  }
}

function parse(raw: string | null): GardenLocation {
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (typeof v.lat === "number" && typeof v.lon === "number") return { ...DEFAULT_LOCATION, ...v };
    } catch {
      // ভাঙা ডেটা হলে ডিফল্ট
    }
  }
  return DEFAULT_LOCATION;
}

export function loadLocation(): GardenLocation {
  return parse(readRaw());
}

export function saveLocation(loc: GardenLocation) {
  memory = JSON.stringify(loc);
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    // সেভ না হলেও পেজ চলবে, শুধু পরের বার মনে থাকবে না
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // অন্য ট্যাবে বদলালে
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** সেভ করা বাগানের এলাকা। সার্ভারে রেন্ডারের সময় ডিফল্ট দেয়। */
export function useGardenLocation(): GardenLocation {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}

export function areaLabel(loc: GardenLocation) {
  if (!loc.district_bn) return "নির্বাচিত জায়গা";
  return loc.upazila
    ? `${loc.upazila}, ${loc.district_bn}`
    : `${loc.district_bn} (ডিফল্ট)`;
}
