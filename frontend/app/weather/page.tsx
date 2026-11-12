"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import TodayWeather, { TodayWeatherSkeleton, type Now } from "@/components/TodayWeather";
import { notify } from "@/lib/notify";
import type { Scene } from "@/components/HeaderScene";
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { InfoTip, MoreInfo } from "@/components/InfoTip";
import {
  API,
  areaLabel,
  saveLocation,
  upazilaKey,
  useGardenLocation,
  type Boundaries,
  type UpazilaProps,
} from "@/lib/location";

const BangladeshMap = dynamic(() => import("@/components/BangladeshMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-green-100 md:h-[520px]" />,
});

type Area = {
  upazila: string;
  district: string;
  district_bn: string;
  division: string;
  division_bn: string;
  approximate: boolean;
};
type Forecast = {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  rain_mm: number | null;
  rain_prob: number | null;
};
type Recent = {
  date: string;
  temp_avg: number | null;
  rain_mm: number | null;
  humidity: number | null;
  solar: number | null;
};
type Alert = {
  type: "heat" | "rain";
  level: string;
  title: string;
  date: string;
  message: string;
};
type Metric = {
  current: number | null;
  baseline: number | null;
  difference?: number;
  percent?: number | null;
  years_used: number;
  status: "ok" | "insufficient";
};
type WeatherData = {
  area: Area | null;
  sources: { recent: string; forecast: string; rain: string };
  units: Record<string, string>;
  freshness: {
    latest_observation: string | null;
    days_behind: number | null;
    status: "fresh" | "stale" | "unavailable";
  };
  forecast: Forecast[]; // [০] = আজ, বাকিগুলো আগামী দিন
  now: Now | null;
  nasa_recent: Recent[];
  alerts: Alert[];
  watering_suggestion: string;
  comparison: Record<string, Metric> | null;
  insights: string[];
  baseline_note: string | null;
  bmd_url: string;
  notes: string[];
};
type OutlookEvent = {
  key: string;
  icon: string;
  label: string;
  years: number;
  out_of: number;
  percent: number;
  level: "often" | "common" | "sometimes" | "rare" | "never";
  level_bn: string;
  last_seen: number | null;
};
type Rec = { date: string; value: number } | null;
type HistoryData = {
  grid: { lat: number; lon: number; elevation: number };
  years: number;
  outlook: {
    from: string;
    to: string;
    years_used: number;
    events: OutlookEvent[];
    typical: { rain_total: number; rain_total_max: number; tmax: number; tmin: number };
    last_year: { year: number; rain_total: number; tmax: number; tmin: number } | null;
  } | null;
  last_12_months: {
    year: number;
    month: number;
    month_bn: string;
    rain: number | null;
    rain_normal: number | null;
    tmax: number | null;
    tmax_normal: number | null;
  }[];
  records: {
    since: string;
    until: string;
    all_time: { hottest: Rec; coldest: Rec; wettest: Rec };
    this_month: { month_bn: string; hottest: Rec; coldest: Rec; wettest: Rec };
  };
  source: string;
  notes: string[];
};
type Selection = { lat: number; lon: number; key: string | null; fly: boolean };
type Loaded<T> = { q: string; data?: T; error?: string; at?: number };

const MONTH_SHORT = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];

function dayName(date: string) {
  return new Date(date).toLocaleDateString("bn-BD", { weekday: "long" });
}

const show = (v: number | null | undefined, unit = "") =>
  v === null || v === undefined ? "ডেটা নেই" : bn(`${v}${unit}`);

function WeatherView() {
  const loc = useGardenLocation();
  const [fly, setFly] = useState(false);
  const [boundaries, setBoundaries] = useState<Boundaries | null>(null);
  const [mapError, setMapError] = useState("");
  const [pickMsg, setPickMsg] = useState("");
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);

  // ফলাফল কোন এলাকার জন্য, সেটাসহ রাখা হয়; এলাকা বদলালে পুরোনোটা আর দেখানো হয় না
  const q = `lat=${loc.lat}&lon=${loc.lon}`;
  const [weather, setWeather] = useState<Loaded<WeatherData> | null>(null);
  const [history, setHistory] = useState<Loaded<HistoryData> | null>(null);
  const current = (r: Loaded<unknown> | null) => (r && r.q === q ? r : null);
  const data = (current(weather)?.data as WeatherData | undefined) ?? null;
  // panel-এ রাডার দৃশ্য; আসল আবহাওয়ার সূর্য/মেঘ/বৃষ্টি নিচের "আজকের অবস্থা" কার্ডে, তাই দুটো একরকম দেখায় না
  const scene: Scene = "radar";
  const error = current(weather)?.error ?? "";
  const hist = (current(history)?.data as HistoryData | undefined) ?? null;

  // আজকের কার্ড তাজা রাখা: পাতা খোলা আর দেখা যাচ্ছে এমন সময় ৫ মিনিট পরপর, আর ট্যাবে ফিরলে,
  // হালকা /api/weather/now থেকে নতুন অবস্থা (হঠাৎ বৃষ্টি যেন দেরিতে না আসে)
  const [live, setLive] = useState<{ q: string; now: Now | null; today: Forecast | null; at: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  // কার্ডে এখন যে মাপটা দেখানো হচ্ছে তার সময়; ⟳ চাপলে নতুন মাপ এল কিনা বলতে লাগে
  const shownTime = useRef<string | null>(null);
  const refreshNow = useCallback(async (manual = false) => {
    setRefreshing(true);
    try {
      // স্পিনার অন্তত একটু ঘুরুক, নইলে চাপ দেওয়া হয়েছে বোঝা যায় না
      const [res] = await Promise.all([
        fetch(`${API}/api/weather/now?${q}`, { credentials: "include", cache: "no-store" }),
        new Promise((ok) => setTimeout(ok, 600)),
      ]);
      if (res.ok) {
        const body = await res.json();
        const before = shownTime.current;
        setLive({ q, now: body.now, today: body.today, at: Date.now() });
        if (manual) {
          const t: string | null = body.now?.time ?? null;
          if (t && before && t === before) notify(`আবহাওয়া হালনাগাদ করা হয়েছে। এটাই সর্বশেষ মাপ; নতুন মাপ আসে ১৫ মিনিট পরপর (পরেরটা ${nextSlot(t)}-এ)।`, "info");
          else notify("আবহাওয়া হালনাগাদ হয়েছে");
        }
      } else if (manual) notify("এখনকার আবহাওয়া আনা যায়নি। একটু পরে আবার চেষ্টা করুন।", "error");
    } catch {
      if (manual) notify("এখনকার আবহাওয়া আনা যায়নি। ইন্টারনেট সংযোগ দেখুন।", "error");
    } finally {
      setRefreshing(false);
      setTick(Date.now());
    }
  }, [q]);
  useEffect(() => {
    const every = setInterval(() => {
      setTick(Date.now());
      if (document.visibilityState === "visible") refreshNow();
    }, 5 * 60 * 1000);
    const minute = setInterval(() => setTick(Date.now()), 30 * 1000);
    const onShow = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(every);
      clearInterval(minute);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refreshNow]);
  const liveHere = live && live.q === q ? live : null;
  const loadedAt = current(weather)?.at;
  const shownNowTime = (liveHere?.now ?? data?.now)?.time ?? null;
  useEffect(() => {
    shownTime.current = shownNowTime;
  }, [shownNowTime]);
  const histError = current(history)?.error ?? "";

  const sel = useMemo<Selection>(
    () => ({
      lat: loc.lat,
      lon: loc.lon,
      key: loc.upazila && loc.district ? upazilaKey({ name: loc.upazila, district: loc.district }) : null,
      fly,
    }),
    [loc, fly],
  );

  useEffect(() => {
    fetch(`${API}/api/location/boundaries`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setBoundaries)
      .catch(() => setMapError("মানচিত্রের সীমানা আনা যায়নি, একটু পরে আবার চেষ্টা করুন"));
  }, []);

  // এলাকা বদলালে আবহাওয়া ও আগের রেকর্ড নতুন করে আনা
  useEffect(() => {
    const ctrl = new AbortController();
    const load = <T,>(path: string, set: (r: Loaded<T>) => void, fallback: string) =>
      fetch(`${API}${path}?${q}`, { credentials: "include", signal: ctrl.signal })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : "");
          set({ q, data: body, at: Date.now() });
        })
        .catch((e) => {
          if (e.name !== "AbortError") set({ q, error: e.message || fallback });
        });

    load<WeatherData>("/api/weather", setWeather, "Weather ডেটা আনা যায়নি, একটু পরে আবার চেষ্টা করুন");
    load<HistoryData>("/api/weather/history", setHistory, "আগের রেকর্ড আনা যায়নি");
    return () => ctrl.abort();
  }, [q]);

  function choose(lat: number, lon: number, p: Pick<UpazilaProps, "name" | "district" | "district_bn" | "division_bn">, flyTo: boolean) {
    setFly(flyTo);
    saveLocation({
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      upazila: p.name,
      district: p.district,
      district_bn: p.district_bn,
      division_bn: p.division_bn,
    });
  }

  async function pick(lat: number, lon: number, fly = false) {
    setPickMsg("");
    try {
      const res = await fetch(`${API}/api/location/lookup?lat=${lat}&lon=${lon}`, { credentials: "include" });
      const body = await res.json();
      if (res.status === 404) {
        setPickMsg("এই জায়গা বাংলাদেশের কোনো উপজেলার ভেতরে পড়েনি। মানচিত্রে দেশের ভেতরে ক্লিক করুন।");
        return;
      }
      if (!res.ok) throw new Error();
      choose(lat, lon, { name: body.upazila, district: body.district, district_bn: body.district_bn, division_bn: body.division_bn }, fly);
      if (body.approximate) setPickMsg("জায়গাটা সীমানার একদম কাছে, তাই সবচেয়ে কাছের উপজেলা ধরা হয়েছে।");
    } catch {
      setPickMsg("এলাকা চেনা যায়নি, একটু পরে আবার চেষ্টা করুন।");
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setPickMsg("এই ব্রাউজারে অবস্থান জানার সুবিধা নেই।");
      return;
    }
    setLocating(true);
    setPickMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick(pos.coords.latitude, pos.coords.longitude, true);
      },
      (err) => {
        setLocating(false);
        setPickMsg(
          err.code === err.PERMISSION_DENIED
            ? "অবস্থান জানার অনুমতি দেওয়া হয়নি। মানচিত্রে ক্লিক করে বা নাম লিখে এলাকা বেছে নিন।"
            : "অবস্থান পাওয়া যায়নি। একটু পরে আবার চেষ্টা করুন।",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!boundaries || q.length < 2) return [];
    return boundaries.features
      .map((f) => f.properties)
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.district.toLowerCase().includes(q) ||
          p.district_bn.includes(q),
      )
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [query, boundaries]);

  const alertStyle = (a: Alert) =>
    a.type === "heat"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-blue-200 bg-blue-50 text-blue-900";


  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader
        icon="cloudSun"
        scene={scene}
        title="আবহাওয়া ও সতর্কতা"
        subtitle="পূর্বাভাস, সতর্কতা আর ২০ বছরের রেকর্ড"
      />

      {/* শুরুতেই আজকের অবস্থা, আসল আবহাওয়া অনুযায়ী animated */}
      {data ? (
        <TodayWeather
          now={liveHere?.now ?? data.now}
          today={liveHere?.today ?? data.forecast[0]}
          place={areaLabel(loc)}
          updatedAt={liveHere?.at ?? loadedAt}
          clock={tick}
          refreshing={refreshing}
          onRefresh={() => refreshNow(true)}
        />
      ) : (
        !error && <TodayWeatherSkeleton />
      )}

      {/* এলাকা বাছাই */}
      <section className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div>
          {mapError ? (
            <p className="rounded-2xl bg-red-50 p-4 text-red-800">{mapError}</p>
          ) : boundaries ? (
            <BangladeshMap boundaries={boundaries} selected={sel} onPick={(la, lo) => pick(la, lo)} />
          ) : (
            <div className="h-[420px] animate-pulse rounded-2xl bg-green-100 md:h-[520px]" />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1 text-sm font-semibold text-green-700">
              <IconText icon="pin">আপনার বাগানের এলাকা</IconText>
              <InfoTip label="এলাকা কীভাবে কাজ করে" hint="এলাকা ব্রাউজারে মনে থাকে">
                মানচিত্রে যেকোনো জায়গায় চাপলে সেই উপজেলা বাছা হয়। এলাকাটা এই ব্রাউজারে মনে থাকে; চ্যাট সহকারী আর ১ বছরের পরিকল্পনাও এটা ধরে চলে।
                {hist && (
                  <span className="mt-1.5 block">
                    আবহাওয়ার হিসাব হয় আশপাশের প্রায় ১০-২৫ কিমি গ্রিড ধরে (কেন্দ্র {hist.grid.lat.toFixed(2)}, {hist.grid.lon.toFixed(2)}), তাই পাশের উপজেলায় প্রায় একই সংখ্যা আসে।
                  </span>
                )}
              </InfoTip>
            </p>
            <p className="mt-1 text-xl font-bold text-green-900">{loc.upazila ?? "চট্টগ্রাম শহর"}</p>
            <p className="text-sm text-gray-600">
              {loc.upazila ? `${loc.district_bn} জেলা, ${loc.division_bn} বিভাগ` : "ডিফল্ট এলাকা, এখনো বেছে নেওয়া হয়নি"}
            </p>
          </div>

          <button
            onClick={useMyLocation}
            disabled={locating}
            className="w-full rounded-full bg-green-600 px-5 py-3 font-semibold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700 disabled:opacity-60"
          >
            {locating ? "অবস্থান খোঁজা হচ্ছে..." : <IconText icon="satellite">আমার অবস্থান ব্যবহার করুন</IconText>}
          </button>

          <div className="relative">
            <label className="text-sm font-medium text-gray-700" htmlFor="area-search">
              উপজেলা বা জেলার নাম লিখুন
            </label>
            <input
              id="area-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="যেমন Manoharganj, কুমিল্লা"
              className="mt-1 w-full rounded-xl border border-green-200 bg-white p-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className="absolute z-[1100] mt-1 max-h-72 w-full overflow-auto rounded-xl border border-green-100 bg-white shadow-lg">
                {matches.map((p) => (
                  <li key={upazilaKey(p)}>
                    <button
                      onClick={() => {
                        setQuery("");
                        setPickMsg("");
                        choose(p.lat, p.lon, p, true);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-green-50"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-500"> · {p.district_bn}, {p.division_bn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && matches.length === 0 && boundaries && (
              <p className="mt-1 text-xs text-gray-500">
                এই নামে কিছু পাওয়া যায়নি। ইংরেজি বানানে লিখুন (যেমন Manoharganj), অথবা মানচিত্রে ক্লিক করুন।
              </p>
            )}
          </div>

          {pickMsg && <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">{pickMsg}</p>}

        </div>
      </section>

      <h2 className="mt-10 border-b border-green-100 pb-2 text-2xl font-bold text-green-900">
        {areaLabel(loc)}: আজকের পরামর্শ ও সতর্কতা
      </h2>

      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">{error}</p>}
      {!data && !error && (
        <div className="mt-4 animate-pulse space-y-4">
          <div className="h-16 rounded-2xl bg-green-100" />
          <div className="h-32 rounded-2xl bg-green-100" />
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
            <p className="text-sm font-semibold text-green-700"><IconText icon="water">আজকের পানি দেওয়ার পরামর্শ</IconText></p>
            <p className="mt-1 text-lg font-medium">{bn(data.watering_suggestion)}</p>
          </div>

          {/* সতর্কতা */}
          <section className="mt-6">
            <h3 className="flex items-center gap-1 text-xl font-bold text-green-900">
              সতর্কতা
              <InfoTip label="এই সতর্কতা কী" hint="নিজস্ব হিসাব, সরকারি নয়" sources={[{ title: "বাংলাদেশ আবহাওয়া অধিদপ্তর (BMD): সরকারি সতর্কতা", url: data.bmd_url }]}>
                পূর্বাভাস দেখে এই প্রকল্পের নিজস্ব হিসাব, সরকারি সতর্কতা নয়। সরকারি সতর্কতার জন্য আবহাওয়া অধিদপ্তরের পাতা দেখুন।
              </InfoTip>
            </h3>
            {data.alerts.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-green-50 p-4 text-green-900">
                আগামী ৩ দিনে গরম বা ভারী বৃষ্টির কোনো সতর্কতা নেই।
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {data.alerts.map((a, i) => (
                  <div key={i} className={`rounded-2xl border p-4 ${alertStyle(a)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        <IconText icon={a.type === "heat" ? "heat" : "rain"}>{a.title}</IconText>
                      </p>
                      <span className="text-xs">{a.date}</span>
                    </div>
                    <p className="mt-1 text-sm">{bn(a.message)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* পূর্বাভাস */}
          <section className="mt-10">
            <h3 className="flex items-center gap-1 text-xl font-bold text-green-900">
              আগামী ৪ দিনের পূর্বাভাস
              <InfoTip label="উৎস" sources={[{ title: data.sources.forecast }]} />
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              {data.forecast.slice(1, 5).map((d, i) => (
                <div
                  key={d.date}
                  className="rounded-2xl border border-green-100 bg-white p-4 text-center shadow-sm"
                >
                  <p className="font-semibold text-green-900">{dayName(d.date)}</p>
                  <p className="text-xs text-gray-500">{i === 0 ? "আগামীকাল · " : ""}{bnDate(d.date, false)}</p>
                  <p className="mt-3 text-2xl font-bold text-orange-500">{show(d.temp_max, "°")}</p>
                  <p className="text-sm text-gray-500">সর্বনিম্ন {show(d.temp_min, "°")}</p>
                  <p className="mt-2 text-sm text-blue-600"><GIcon name="rain" className="mr-1 h-4 w-4" />{show(d.rain_mm, " মিমি")}</p>
                  <p className="text-xs text-gray-500">
                    সম্ভাবনা {d.rain_prob === null ? "তথ্য নেই" : bn(`${d.rain_prob}%`)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* আগের রেকর্ড */}
      <h2 className="mt-14 border-b border-green-100 pb-2 text-2xl font-bold text-green-900">
        {areaLabel(loc)}: আগের রেকর্ড
      </h2>
      {histError && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">{histError}</p>}
      {!hist && !histError && (
        <div className="mt-4 animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-green-100" />
          <div className="h-56 rounded-2xl bg-green-100" />
        </div>
      )}
      {hist && <HistorySections hist={hist} />}

      {/* NASA: গত ৭ দিন বনাম ৫ বছর, ও গত কয়েক দিনের অবস্থা */}
      {data && (
        <>
          <CompareCard data={data} />
          <RecentCard data={data} />
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- ছোট সাহায্যকারী
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bn = (v: number | string) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
const num = (v: number | null | undefined, unit = "", digits = 2) =>
  v === null || v === undefined ? null : `${bn(Number(v.toFixed(digits)))}${unit}`;
const bnDate = (iso: string, year = true, month: "short" | "long" = "short") =>
  new Date(iso + "T00:00:00").toLocaleDateString("bn-BD", { day: "numeric", month, ...(year && { year: "numeric" }) });
const SOLAR_UNIT = " kWh/m²";

/** লম্বা উৎস ও সতর্কতার লেখা ভাঁজ করে রাখা, যেন পেজে লেখা কম থাকে */
function InfoNotes({ items }: { items: string[] }) {
  return <MoreInfo items={items.map((t) => bn(t))} />;
}

function IconTile({ icon, tint }: { icon: GIconName; tint: string }) {
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-green-800 sm:h-14 sm:w-14 ${tint}`} aria-hidden>
      <GIcon name={icon} className="h-7 w-7 sm:h-8 sm:w-8" />
    </span>
  );
}

// ---------------------------------------------------------------- এই সপ্তাহের আবহাওয়া (২০ বছরের হার)
// backend-এর পাঠানো emoji নয়, ঘটনার key থেকে icon
const EVENT_ICON: Record<string, GIconName> = { rain: "rain", heavy_rain: "storm", dry: "sun", heat: "thermo", hot: "heat", cold: "cold" };
const EVENT_STYLE: Record<string, { tint: string; bar: string; text: string }> = {
  rain: { tint: "bg-sky-50", bar: "from-green-500 to-green-600", text: "text-green-700" },
  heavy_rain: { tint: "bg-sky-50", bar: "from-sky-400 to-sky-600", text: "text-sky-700" },
  dry: { tint: "bg-amber-50", bar: "from-amber-300 to-amber-500", text: "text-amber-700" },
  heat: { tint: "bg-orange-50", bar: "from-orange-300 to-orange-500", text: "text-orange-700" },
  hot: { tint: "bg-red-50", bar: "from-red-400 to-red-600", text: "text-red-700" },
  cold: { tint: "bg-sky-50", bar: "from-sky-300 to-sky-500", text: "text-sky-700" },
};
// লেবেল "এক দিনে ভারী বৃষ্টি (৪৪ মিমি বা বেশি)" → শিরোনাম আর বন্ধনীর ভেতরের ব্যাখ্যা আলাদা
const splitLabel = (label: string) => {
  const m = label.match(/^(.*?)\s*\((.*)\)$/);
  return m ? { title: m[1], detail: m[2] } : { title: label, detail: "" };
};
const LIKELY_PCT = 30;

function WeekOutlook({ o, years }: { o: NonNullable<HistoryData["outlook"]>; years: number }) {
  const likely = o.events.filter((e) => e.percent >= LIKELY_PCT);
  const rare = o.events.filter((e) => e.percent < LIKELY_PCT);
  const seen = (e: OutlookEvent) =>
    e.years ? `গত ${bn(e.out_of)} বছরে ${bn(e.years)} বছর` : `গত ${bn(e.out_of)} বছরে এই সময়ে হয়নি`;

  return (
    <section className="mt-6 space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-green-100 bg-gradient-to-br from-white to-green-50 p-6 shadow-sm">
        <GIcon name="leaf" className="pointer-events-none absolute -bottom-4 -right-2 h-32 w-32 text-green-700 opacity-15" />
        <p className="text-sm font-semibold text-green-700"><IconText icon="sprout">সাপ্তাহিক প্রবণতা</IconText></p>
        <h3 className="mt-1 flex items-center gap-1 text-2xl font-bold text-green-900 sm:text-3xl">
          এই সপ্তাহের আবহাওয়া
          <InfoTip label="এটা কী" hint="প্রবণতা, ভবিষ্যদ্বাণী নয়">গত {bn(years)} বছরের রেকর্ডে এই সময়ে যা বেশি হয়েছে, সেই সাধারণ প্রবণতা। ভবিষ্যদ্বাণী নয়।</InfoTip>
        </h3>
        <p className="mt-2 text-gray-700">
          <GIcon name="calendar" className="mr-1.5 h-4 w-4 text-green-700" />{bnDate(o.from, false, "long")} – {bnDate(o.to, true, "long")}
        </p>
      </div>

      {likely.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
          <h4 className="flex items-center gap-3 bg-green-50 px-5 py-3 text-lg font-bold text-green-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white"><GIcon name="tick" className="h-4 w-4" /></span>
            এই সপ্তাহে বেশি দেখা যায়
          </h4>
          <ul className="divide-y divide-gray-100 px-5">
            {likely.map((e) => {
              const s = EVENT_STYLE[e.key] ?? EVENT_STYLE.rain;
              return (
                <li key={e.key} className="flex items-center gap-4 py-4">
                  <IconTile icon={EVENT_ICON[e.key] ?? "cloudSun"} tint={s.tint} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">{splitLabel(e.label).title}</p>
                        <p className="text-sm text-gray-500">{seen(e)}</p>
                      </div>
                      <span className={`text-2xl font-bold sm:text-3xl ${s.text}`}>{bn(e.percent)}%</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                      <div className={`h-full rounded-full bg-gradient-to-r ${s.bar}`} style={{ width: `${e.percent}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {rare.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-red-100 bg-white shadow-sm">
          <h4 className="flex items-center gap-3 bg-red-50 px-5 py-3 text-lg font-bold text-red-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white"><GIcon name="x" className="h-4 w-4" /></span>
            কম দেখা যায় এমন আবহাওয়া
          </h4>
          <ul className="divide-y divide-gray-100 px-5">
            {rare.map((e) => {
              const { title, detail } = splitLabel(e.label);
              return (
                <li key={e.key} className="flex items-center gap-4 py-4">
                  <IconTile icon={EVENT_ICON[e.key] ?? "cloudSun"} tint={(EVENT_STYLE[e.key] ?? EVENT_STYLE.rain).tint} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{title}</p>
                    {detail && <p className="text-sm text-gray-500">{bn(detail)}</p>}
                    <p className="text-xs text-gray-400">
                      {seen(e)}
                      {e.last_seen && ` · সর্বশেষ ${bn(e.last_seen)}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700">{bn(e.percent)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: "rain" as GIconName, label: "সাধারণ বৃষ্টি", value: `~${bn(o.typical.rain_total)} মিমি` },
          { icon: "sun" as GIconName, label: "দিনে গড়", value: `${bn(o.typical.tmax)}°C` },
          { icon: "moon" as GIconName, label: "রাতে গড়", value: `${bn(o.typical.tmin)}°C` },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border border-green-100 bg-white p-3 text-center shadow-sm">
            <p className="text-xs text-gray-500">
              <IconText icon={t.icon} iconClass="h-4 w-4">{t.label}</IconText>
            </p>
            <p className="mt-1 text-lg font-bold text-green-900">{t.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- আগের রেকর্ড
function HistorySections({ hist }: { hist: HistoryData }) {
  const o = hist.outlook;
  const notes = [
    `উৎস: ${hist.source}`,
    ...hist.notes,
    ...(o?.last_year
      ? [`গত বছর (${bn(o.last_year.year)}) এই সময়ে: মোট বৃষ্টি ${bn(o.last_year.rain_total)} মিমি, সর্বোচ্চ ${bn(o.last_year.tmax)}°C, সর্বনিম্ন ${bn(o.last_year.tmin)}°C।`]
      : []),
  ];

  return (
    <>
      {o ? (
        <WeekOutlook o={o} years={hist.years} />
      ) : (
        <p className="mt-6 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">এই সময়ের জন্য যথেষ্ট বছরের ডেটা পাওয়া যায়নি।</p>
      )}

      <RainChart months={hist.last_12_months} years={hist.years} />

      {/* রেকর্ড */}
      <section className="mt-10">
        <h3 className="text-xl font-bold text-green-900">রেকর্ড</h3>
        <p className="text-xs text-gray-500">
          {bnDate(hist.records.since)} থেকে {bnDate(hist.records.until)} পর্যন্ত
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {[
            { title: `${hist.records.this_month.month_bn} মাসের রেকর্ড`, r: hist.records.this_month },
            { title: "সব সময়ের রেকর্ড", r: hist.records.all_time },
          ].map(({ title, r }) => (
            <div key={title} className="rounded-3xl border border-green-100 bg-white p-4 shadow-sm">
              <p className="font-semibold text-green-900">{title}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <RecordCell icon="heat" label="সবচেয়ে গরম দিন" rec={r.hottest} unit="°C" />
                <RecordCell icon="cold" label="সবচেয়ে ঠান্ডা রাত" rec={r.coldest} unit="°C" />
                <RecordCell icon="rain" label="এক দিনে সর্বোচ্চ বৃষ্টি" rec={r.wettest} unit=" মিমি" />
              </dl>
            </div>
          ))}
        </div>
        <InfoNotes items={notes} />
      </section>
    </>
  );
}

function RecordCell({ icon, label, rec, unit }: { icon: GIconName; label: string; rec: Rec; unit: string }) {
  return (
    <div className="rounded-2xl bg-green-50 p-2 sm:p-3">
      <dt className="text-xs text-gray-600">
        <IconText icon={icon} iconClass="h-4 w-4 text-green-700">{label}</IconText>
      </dt>
      <dd className="mt-1 text-lg font-bold text-green-900 sm:text-xl">{rec ? num(rec.value, unit, 1) : "–"}</dd>
      {rec && <dd className="text-xs text-gray-500">{bnDate(rec.date)}</dd>}
    </div>
  );
}

// ---------------------------------------------------------------- গত ৭ দিন বনাম ৫ বছর (NASA POWER)
const COMPARE_ROWS = [
  { key: "temp", label: "গড় তাপমাত্রা", unit: "°C", icon: "thermo" as GIconName, tint: "bg-red-50" },
  { key: "tmax", label: "গড় সর্বোচ্চ তাপমাত্রা", unit: "°C", icon: "sun" as GIconName, tint: "bg-amber-50" },
  { key: "rain", label: "মোট বৃষ্টি (৭ দিন)", unit: " মিমি", icon: "rain" as GIconName, tint: "bg-sky-50" },
  { key: "humidity", label: "আর্দ্রতা", unit: "%", icon: "water" as GIconName, tint: "bg-sky-50" },
  { key: "solar", label: "সূর্যালোক", unit: SOLAR_UNIT, icon: "sun" as GIconName, tint: "bg-amber-50" },
];

function SectionHead({ icon, title, sub, note }: { icon: GIconName; title: string; sub?: string; note?: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700" aria-hidden>
        <GIcon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <h3 className="flex items-center gap-1 text-xl font-bold text-green-900 sm:text-2xl">
          {title}
          {sub && (
            <InfoTip label={note ? "এটা কী" : "উৎস"} hint={sub.length <= 28 ? sub : "উৎস"}>
              {note && <span className="mb-1.5 block">{note}</span>}
              {sub}
            </InfoTip>
          )}
        </h3>
      </div>
    </div>
  );
}

function DiffPill({ d, unit, className = "" }: { d: number; unit: string; className?: string }) {
  const cls = d > 0 ? "bg-green-50 text-green-700" : d < 0 ? "bg-sky-50 text-sky-700" : "bg-gray-50 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1 font-semibold ${cls} ${className}`}>
      {d > 0 ? "↑ +" : d < 0 ? "↓ " : ""}
      {num(d, unit)}
    </span>
  );
}

function CompareCard({ data }: { data: WeatherData }) {
  const rows = COMPARE_ROWS.filter((r) => data.comparison?.[r.key]);
  return (
    <section className="mt-12 rounded-3xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
      <SectionHead icon="chart" title="গত ৭ দিন বনাম গত ৫ বছরের একই সময়" sub="উৎস: NASA POWER"
        note="গত ৫ বছরের ভিত্তিতে সাম্প্রতিক তুলনা, আনুষ্ঠানিক ৩০ বছরের জলবায়ু গড় নয়।" />
      {data.baseline_note && <p className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-900"><GIcon name="warning" className="mr-1 h-4 w-4" />{data.baseline_note}</p>}
      {/* ফোনে টেবিলের বদলে প্রতিটা বিষয়ের ছোট কার্ড */}
      {rows.length > 0 && (
        <ul className="mt-4 space-y-3 sm:hidden">
          {rows.map((r) => {
            const m = data.comparison![r.key];
            const d = m.status === "ok" ? m.difference : undefined;
            return (
              <li key={r.key} className="rounded-2xl border border-green-100 p-3">
                <p className="flex items-center gap-2 font-medium text-gray-800">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-green-800 ${r.tint}`} aria-hidden>
                    <GIcon name={r.icon} className="h-5 w-5" />
                  </span>
                  {r.label}
                  {d !== undefined && <DiffPill d={d} unit={r.unit} className="ml-auto text-sm" />}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-green-50 p-2">
                    <p className="text-xs text-gray-500">গত ৭ দিন</p>
                    <p className="font-semibold text-gray-900">{num(m.current, r.unit) ?? "–"}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">৫ বছরের গড়</p>
                    <p className="font-semibold text-gray-700">{num(m.baseline, r.unit) ?? "অপর্যাপ্ত"}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-green-100 sm:block">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-green-50 text-green-900">
              <tr>
                <th className="p-3">বিষয়</th>
                <th className="p-3">গত ৭ দিন</th>
                <th className="p-3">৫ বছরের গড়</th>
                <th className="p-3">পার্থক্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {rows.map((r) => {
                const m = data.comparison![r.key];
                const d = m.status === "ok" ? m.difference : undefined;
                return (
                  <tr key={r.key}>
                    <td className="p-3">
                      <span className="flex items-center gap-3 font-medium text-gray-800">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-green-800 ${r.tint}`} aria-hidden>
                          <GIcon name={r.icon} className="h-5 w-5" />
                        </span>
                        {r.label}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">{num(m.current, r.unit) ?? "–"}</td>
                    <td className="p-3 text-gray-800">
                      {num(m.baseline, r.unit) ?? "অপর্যাপ্ত ডেটা"}
                      <span className="block text-xs text-gray-400">({bn(m.years_used)} বছর)</span>
                    </td>
                    <td className="p-3">{d === undefined ? "–" : <DiffPill d={d} unit={r.unit} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- গত কয়েক দিনের আবহাওয়া
function RecentCard({ data }: { data: WeatherData }) {
  const f = data.freshness;
  const notes = [
    ...data.notes,
    `তাপমাত্রা, আর্দ্রতা, সূর্যালোক: ${data.sources.recent}`,
    `বৃষ্টি: ${data.sources.rain}`,
    ...(f.latest_observation ? [`NASA-র সর্বশেষ ডেটা ${bnDate(f.latest_observation)}-এর (${bn(f.days_behind ?? 0)} দিন আগের)।`] : []),
  ];
  const missing = <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 sm:text-xs">ডেটা নেই</span>;

  return (
    <section className="mt-10 rounded-3xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
      <SectionHead icon="trend" title="গত কয়েক দিনের আবহাওয়া" sub="তাপমাত্রা, আর্দ্রতা ও সূর্যালোক: NASA POWER · বৃষ্টি: Open-Meteo" />
      {f.status !== "fresh" && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-900">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 font-bold text-white">!</span>
          {f.status === "unavailable"
            ? "NASA-র সাম্প্রতিক ডেটা এখন পাওয়া যাচ্ছে না।"
            : "NASA-র ডেটা স্বাভাবিকের চেয়ে পুরোনো। সাম্প্রতিক অবস্থা আলাদা হতে পারে।"}
        </p>
      )}
      {/* একক header-এ, তাই ফোনেও পাঁচটা কলাম এক স্ক্রিনে ধরে */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-green-100">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-green-50 text-green-900">
            <tr>
              {[
                ["calendar", "তারিখ", ""],
                ["thermo", "গড় তাপ", "°C"],
                ["rain", "বৃষ্টি", "মিমি"],
                ["water", "আর্দ্রতা", "%"],
                ["sun", "সূর্যালোক", "kWh/m²"],
              ].map(([icon, label, unit]) => (
                <th key={label} className="px-2 py-2 align-top sm:p-3">
                  <span className="block whitespace-nowrap">
                    <GIcon name={icon as GIconName} className="mr-1 hidden h-4 w-4 sm:inline-block" />
                    {label}
                  </span>
                  {unit && <span className="block text-[10px] font-normal text-green-700 sm:text-xs">{unit}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {data.nasa_recent.map((d) => (
              <tr key={d.date}>
                <td className="px-2 py-2 sm:p-3">
                  <span className="whitespace-nowrap rounded-xl bg-gray-50 px-2 py-1 font-medium text-gray-700">{bnDate(d.date, false)}</span>
                </td>
                <td className="px-2 py-2 sm:p-3">{num(d.temp_avg, "", 1) ?? missing}</td>
                <td className="px-2 py-2 sm:p-3">{num(d.rain_mm, "", 1) ?? missing}</td>
                <td className="px-2 py-2 sm:p-3">{num(d.humidity, "", 0) ?? missing}</td>
                <td className="px-2 py-2 sm:p-3">{num(d.solar, "") ?? missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InfoNotes items={notes} />
    </section>
  );
}

function RainChart({ months, years }: { months: HistoryData["last_12_months"]; years: number }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.rain ?? 0, m.rain_normal ?? 0]));
  const pct = (v: number) => `${(v / max) * 100}%`;
  // পর্দায় এলে তবেই আঁকা শুরু: বারগুলো একটার পর একটা নিচ থেকে ওঠে, তারপর গড়ের দাগ
  const chartRef = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return setGo(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting || e.boundingClientRect.top < 0) {
        setGo(true);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="mt-10">
      <h3 className="text-xl font-bold text-green-900">গত ১২ মাসের বৃষ্টি বনাম {bn(years)} বছরের গড়</h3>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" /> সেই মাসের মোট বৃষ্টি
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-gray-800" /> {bn(years)} বছরের গড়
        </span>
      </div>

      <div className="mt-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
        <div ref={chartRef} className={`chart ${go ? "chart-go" : ""} flex h-52 items-end gap-[2px] border-b border-gray-200`}>
          {months.map((m, i) => (
            <div
              key={`${m.year}-${m.month}`}
              tabIndex={0}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              {m.rain !== null && (
                <div
                  className="chart-bar w-3/4 max-w-8 rounded-t bg-gradient-to-t from-blue-600 to-sky-400 transition-colors group-hover:from-blue-700 group-focus:from-blue-700"
                  style={{ height: pct(m.rain), animationDelay: `${i * 90}ms` }}
                />
              )}
              {m.rain_normal !== null && (
                <div
                  className="chart-line absolute left-[8%] right-[8%] h-0.5 rounded-full bg-gray-800"
                  style={{ bottom: pct(m.rain_normal), animationDelay: `${months.length * 90 + i * 60}ms` }}
                />
              )}
              <div
                className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus:block ${
                  i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                }`}
              >
                <p className="font-semibold">
                  {m.month_bn} {bn(m.year)}
                </p>
                <p>বৃষ্টি: {show(m.rain, " মিমি")}</p>
                <p>গড়: {show(m.rain_normal, " মিমি")}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[2px]">
          {months.map((m) => (
            <span key={`${m.year}-${m.month}`} className="flex-1 text-center text-[10px] text-gray-500">
              {MONTH_SHORT[m.month - 1]}
            </span>
          ))}
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-green-700">টেবিল হিসেবে দেখুন</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-green-50 text-green-900">
                <tr>
                  <th className="p-2">মাস</th>
                  <th className="p-2">বৃষ্টি</th>
                  <th className="p-2">{bn(years)} বছরের গড়</th>
                  <th className="p-2">গড় সর্বোচ্চ তাপমাত্রা</th>
                  <th className="p-2">{bn(years)} বছরের গড়</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={`${m.year}-${m.month}`} className="border-t border-green-50">
                    <td className="p-2 font-medium">
                      {m.month_bn} {bn(m.year)}
                    </td>
                    <td className="p-2">{show(m.rain, " মিমি")}</td>
                    <td className="p-2">{show(m.rain_normal, " মিমি")}</td>
                    <td className="p-2">{show(m.tmax, "°C")}</td>
                    <td className="p-2">{show(m.tmax_normal, "°C")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}

export default function WeatherPage() {
  return (
    <LoginGate next="/weather" why="আপনার এলাকার আবহাওয়া, সতর্কতা আর গত ২০ বছরের রেকর্ড দেখতে লগইন লাগে।">
      <WeatherView />
    </LoginGate>
  );
}

/** Open-Meteo-র পরের ১৫-মিনিটের মাপের সময়, যেমন "রাত ১০:১৫" ("2026-11-11T22:00" থেকে) */
function nextSlot(t: string) {
  const h = Number(t.slice(11, 13)), m = Number(t.slice(14, 16));
  const total = (h * 60 + m + 15) % (24 * 60);
  const H = Math.floor(total / 60), M = total % 60;
  const part = H < 5 ? "রাত" : H < 12 ? "সকাল" : H < 15 ? "দুপুর" : H < 18 ? "বিকেল" : H < 20 ? "সন্ধ্যা" : "রাত";
  const bn = (x: number | string) => String(x).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
  return `${part} ${bn(H % 12 || 12)}:${bn(String(M).padStart(2, "0"))}`;
}
