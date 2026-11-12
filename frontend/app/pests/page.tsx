"use client";
// পোকা চিনুন: বাগানের ক্ষতিকর পোকা (আর মাকড়, শামুক)। ছবি, বৈজ্ঞানিক ও স্থানীয় নাম, কোন ফসলে কী ক্ষতি,
// কোন রোগ ছড়ায় (রোগ ডায়েরির লিংক), রাসায়নিক ছাড়া দমন। প্রতিটা লাইনের উৎস ⓘ-এ।
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FadeImg from "@/components/FadeImg";
import { GIcon, IconText } from "@/components/garden-icons";
import { MoreInfo } from "@/components/InfoTip";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import FilterBar from "@/components/FilterBar";
import ProtectionTabs from "@/components/ProtectionTabs";
import { Gallery, Lines, SourceList, SourceTip, bn, thumbOf, type Img, type Line, type Source } from "@/components/guides/Sourced";
import { api, errorText } from "@/lib/garden";

type DiseaseLink = Line & { id: string; crop_id: string; crop_bn: string; bn: string; is_pest: boolean };
type Pest = {
  id: string;
  bn: string;
  local: string[];
  local_src: string[];
  en: string;
  sci: string;
  sci_src: string[];
  order: string;
  group: string;
  crops: { id: string; bn: string }[];
  crops_src: string[];
  identify: Line[];
  damage: Line[];
  season: Line[];
  diseases: DiseaseLink[];
  prevent: Line[];
  control: Line[];
  doctor: Line[];
  remedies: { id: string; bn: string }[];
  images: Img[];
  sources: Source[];
};
type Guide = { groups: string[]; pests: Pest[]; doctor_note: string; verified: boolean };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

function PestGuide() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [crop, setCrop] = useState("");
  const [pestId, setPestId] = useState("");

  useEffect(() => {
    api<Guide>("/disease/pests").then(setGuide).catch((e) => setError(errorText(e)));
    // #whitefly দিয়ে সরাসরি একটা পোকায়; back বোতাম কাজ করে
    const read = () => setPestId(decodeURIComponent(location.hash.slice(1)));
    read();
    addEventListener("popstate", read);
    return () => removeEventListener("popstate", read);
  }, []);

  function open(id: string) {
    history.pushState(null, "", id ? `#${id}` : location.pathname);
    setPestId(id);
    scrollTo({ top: 0, behavior: "smooth" });
  }

  const crops = useMemo(() => {
    const m = new Map<string, string>();
    guide?.pests.forEach((p) => p.crops.forEach((c) => m.set(c.id, c.bn)));
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "bn"));
  }, [guide]);

  const q = norm(query.trim());
  const shown = useMemo(() => {
    if (!guide) return [];
    return guide.pests.filter((p) => {
      if (group && p.group !== group) return false;
      if (crop && !p.crops.some((c) => c.id === crop)) return false;
      if (!q) return true;
      const hay = norm([p.bn, ...p.local, p.en, p.sci, ...p.crops.map((c) => c.bn), ...p.identify.map((l) => l.text)].join(" "));
      return hay.includes(q);
    });
  }, [guide, group, crop, q]);

  const pest = guide?.pests.find((p) => p.id === pestId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <PageHeader icon="bug" scene="disease" title="সুস্থ বাগান" subtitle="কোন পোকা কী ক্ষতি করে, রাসায়নিক ছাড়া কীভাবে সামলাবেন" />
      <ProtectionTabs active="/pests" />

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {!guide && !error && <div className="h-64 animate-pulse rounded-3xl bg-green-50" />}

      {guide && pest && <PestView pest={pest} note={guide.doctor_note} onBack={() => open("")} />}

      {guide && !pest && (
        <>
          <NoChemical note={guide.doctor_note} />
          <div className="mt-4" />
          <FilterBar
            query={query}
            onQuery={setQuery}
            placeholder="পোকার নাম বা লক্ষণ: সাদা মাছি, জাব, পাতায় সুড়ঙ্গ..."
            searchLabel="পোকা বা ফসল খুঁজুন"
            groups={guide.groups}
            group={group}
            onGroup={setGroup}
            allLabel="সব পোকা"
            groupsLabel="পোকার ধরন"
            extra={
              <label className="block">
                <span className="sr-only">কোন ফসলের পোকা</span>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full truncate rounded-full border border-green-100 bg-white/90 px-4 py-2.5 text-sm text-green-900 shadow-sm outline-none focus:border-green-400"
                >
                  <option value="">সব ফসল</option>
                  {crops.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            }
          />

          <p className="mt-2 text-sm text-gray-500">{bn(shown.length)}টা পোকা ও প্রাণী</p>

          {shown.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white p-6 text-center text-gray-600">
              {guide.pests.length ? "কিছু পাওয়া যায়নি। অন্য নামে খুঁজুন।" : "তালিকা তৈরি হচ্ছে, শিগগিরই আসবে।"}
            </p>
          ) : (
            <ul className="stagger mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => open(p.id)}
                    className="group relative block aspect-[4/3] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-green-100 to-emerald-200 text-left shadow-sm ring-1 ring-green-100 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-900/15"
                  >
                    {p.images[0] ? (
                      <FadeImg src={thumbOf(p.images[0].file)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover group-hover:scale-110" />
                    ) : (
                      <GIcon name="bug" className="absolute inset-0 m-auto h-16 w-16 text-green-700 opacity-60" />
                    )}
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-3">
                      <span className="block truncate text-lg font-bold leading-tight text-white drop-shadow">{p.bn}</span>
                      <span className="block truncate text-xs italic text-white/85">{p.sci}</span>
                      <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                        {bn(p.crops.length)}টা ফসলে
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Footer verified={guide.verified} />
        </>
      )}
    </main>
  );
}

function NoChemical({ note }: { note: string }) {
  return (
    <div className="flex gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <GIcon name="ban" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <p>
        {note}{" "}
        <a href="tel:16123" className="font-bold text-amber-900 underline">
          ১৬১২৩-এ ফোন করুন
        </a>
      </p>
    </div>
  );
}

function PestView({ pest, note, onBack }: { pest: Pest; note: string; onBack: () => void }) {
  const s = pest.sources;
  return (
    <article aria-labelledby="pest-title">
      <button onClick={onBack} className="mb-4 rounded-full border border-green-100 bg-white px-4 py-1.5 text-sm text-green-800 hover:bg-green-50">
        ← সব পোকা
      </button>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <header className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <span className="inline-block rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800">{pest.group}</span>
            <h2 id="pest-title" className="mt-2 text-2xl font-bold text-green-950">
              {pest.bn} <span className="text-base font-medium text-gray-500">{pest.en}</span>
            </h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-gray-500">বৈজ্ঞানিক নাম:</dt>
                <dd>
                  <i className="text-gray-800">{pest.sci}</i>
                  {pest.order && <span className="text-gray-500"> ({pest.order})</span>}
                  <SourceTip src={pest.sci_src} sources={s} />
                </dd>
              </div>
              {pest.local.length > 0 && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-gray-500">স্থানীয় নাম:</dt>
                  <dd className="text-gray-800">
                    {pest.local.join(", ")}
                    <SourceTip src={pest.local_src} sources={s} />
                  </dd>
                </div>
              )}
            </dl>
          </header>

          <section className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
              <GIcon name="leaf" className="h-4 w-4 text-green-700" /> যেসব ফসলের ক্ষতি করে
              <SourceTip src={pest.crops_src} sources={s} />
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {pest.crops.map((c) => (
                <li key={c.id}>
                  <Link href={`/disease#${c.id}`} className="inline-block rounded-full border border-green-100 bg-green-50 px-3 py-1 text-sm text-green-900 hover:bg-green-100">
                    {c.bn}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <Gallery images={pest.images} alt={pest.bn} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <Lines title="কীভাবে চিনবেন" icon="search" lines={pest.identify} sources={s} />
        </Card>
        <Card>
          <Lines title="কী ক্ষতি করে" icon="warning" lines={pest.damage} sources={s} />
        </Card>
        {pest.season.length > 0 && (
          <Card>
            <Lines title="কখন বেশি হয়" icon="cloudSun" lines={pest.season} sources={s} />
          </Card>
        )}
        {pest.diseases.length > 0 && (
          <Card>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
              <GIcon name="book" className="h-4 w-4 text-green-700" /> রোগ ডায়েরির সাথে যোগ
            </h4>
            <ul className="mt-1.5 space-y-2 text-sm text-gray-700">
              {pest.diseases.map((d) => (
                <li key={d.id}>
                  <Link href={`/disease#${d.crop_id}`} className="font-semibold text-green-800 underline-offset-2 hover:underline">
                    {d.crop_bn}: {d.bn} →
                  </Link>
                  <span className="block">
                    {d.text}
                    <SourceTip src={d.src} sources={s} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <section className="mt-4 rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
        <h3 className="font-bold text-green-950">
          <IconText icon="glove">আমাদের পরামর্শ</IconText>
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Lines title="আগে থেকে ঠেকান" icon="check" lines={pest.prevent} sources={s} />
          <Lines title="রাসায়নিক ছাড়া দমন" icon="hand" lines={pest.control} sources={s} />
        </div>
        {pest.remedies.length > 0 && (
          <div className="mt-4 border-t border-green-200/70 pt-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
              <GIcon name="hand" className="h-4 w-4 text-green-700" /> ঘরোয়া পদ্ধতি (বানানোর নিয়ম ও সাবধানতা দেখুন)
            </h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {pest.remedies.map((r) => (
                <li key={r.id}>
                  <Link href={`/remedies#${r.id}`} className="inline-block rounded-full border border-green-200 bg-white px-3 py-1 text-sm text-green-900 hover:bg-green-100">
                    {r.bn} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <Lines title="কখন কৃষি অফিসে যাবে" icon="warning" lines={pest.doctor} sources={s} />
        <p className="mt-2 text-sm text-amber-900">
          {note}{" "}
          <a href="tel:16123" className="font-bold underline">
            ১৬১২৩
          </a>
        </p>
      </section>

      <SourceList sources={s} />
      <Footer verified={false} />
    </article>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">{children}</div>;
}

function Footer({ verified }: { verified: boolean }) {
  return (
    <div className="mt-8">
      <MoreInfo
        title="সতর্কতা"
        items={[
          "অনেক পোকা দেখতে কাছাকাছি। নিশ্চিত না হলে পোকা বা আক্রান্ত পাতা একটা প্যাকেটে নিয়ে উপজেলা কৃষি অফিসে দেখান।",
          ...(!verified ? ["এই তালিকা এখনো কৃষি বিশেষজ্ঞ দিয়ে যাচাই করা হয়নি।"] : []),
          "প্রতিটা তথ্যের পাশে ⓘ চাপলে দেখবেন কোন উৎস থেকে, উৎসের কোন অংশ থেকে, কীভাবে নেওয়া।",
        ]}
      />
    </div>
  );
}

export default function PestsPage() {
  return (
    <LoginGate next="/pests" why="পোকা চিনুন দেখতে লগইন লাগে।">
      <PestGuide />
    </LoginGate>
  );
}
