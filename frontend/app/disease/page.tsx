"use client";
import { useEffect, useMemo, useState } from "react";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import FilterBar from "@/components/FilterBar";
import ProtectionTabs from "@/components/ProtectionTabs";
import { CropIcon } from "@/components/crop-icons";
import FadeImg from "@/components/FadeImg";

// কার্ডের ছোট ছবি: public/diary/thumb/*.webp (৪৮০px, ~২০KB); বড় ছবি শুধু বিস্তারিত পাতায়
const thumbOf = (file: string) => file.replace(/^\/diary\/(.+)\.\w+$/, "/diary/thumb/$1.webp");
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { MoreInfo } from "@/components/InfoTip";
import { api, errorText } from "@/lib/garden";

type Line = { text: string; src: string[] };
type Img = {
  file: string;
  title: string;
  page: string;
  license: string;
  license_url: string;
  artist: string;
  shown_on: string | null;
  site: string;
};
type Disease = {
  id: string;
  bn: string;
  en: string;
  kind: string;
  kind_bn: string;
  symptoms: Line[];
  conditions: Line[];
  care: Line[];
  medicine: Line[];
  photo: string | null;
  image: Img | null;
};
type Source = { key: string; title: string; url: string };
type Crop = {
  id: string;
  bn: string;
  en: string;
  sci: string;
  group: string;
  emoji: string;
  diseases: Disease[];
  questions?: string[];
  tips?: Line[];
  sources: Source[];
};
type Diary = { groups: string[]; crops: Crop[]; medicine_note: string; verified: boolean };

const KIND_STYLE: Record<string, string> = {
  fungus: "bg-amber-50 text-amber-800",
  oomycete: "bg-orange-50 text-orange-800",
  bacteria: "bg-rose-50 text-rose-800",
  virus: "bg-purple-50 text-purple-800",
  insect: "bg-sky-50 text-sky-800",
  phytoplasma: "bg-fuchsia-50 text-fuchsia-800",
  disorder: "bg-teal-50 text-teal-800",
};
const bn = (n: number) => n.toLocaleString("bn-BD");
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

function DiseaseDiary() {
  const [diary, setDiary] = useState<Diary | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [cropId, setCropId] = useState("");

  useEffect(() => {
    api<Diary>("/disease/diary").then(setDiary).catch((e) => setError(errorText(e)));
    // #tomato দিয়ে সরাসরি একটা ফসলে আসা যায়, আর ব্রাউজারের back বোতাম কাজ করে
    const read = () => setCropId(decodeURIComponent(location.hash.slice(1)));
    read();
    addEventListener("popstate", read);
    return () => removeEventListener("popstate", read);
  }, []);

  function open(id: string) {
    history.pushState(null, "", id ? `#${id}` : location.pathname);
    setCropId(id);
    scrollTo({ top: 0, behavior: "smooth" });
  }

  const q = norm(query.trim());
  const shown = useMemo(() => {
    if (!diary) return [];
    return diary.crops.filter((c) => {
      if (group && c.group !== group) return false;
      if (!q) return true;
      const hay = norm([c.bn, c.en, c.sci, ...c.diseases.flatMap((d) => [d.bn, d.en, ...d.symptoms.map((s) => s.text)])].join(" "));
      return hay.includes(q);
    });
  }, [diary, group, q]);

  // প্রতিটা ফসলের কার্ডের ছবি; পাশাপাশি দুই ফসলে একই ছবি না আসে (বাঁধাকপি/ফুলকপি)
  const thumbs = useMemo(() => {
    const used = new Set<string>();
    return new Map(
      shown.map((c) => {
        const imgs = c.diseases.flatMap((d) => (d.image ? [d.image] : []));
        const t = imgs.find((im) => !used.has(im.file)) ?? imgs[0];
        if (t) used.add(t.file);
        return [c.id, t] as const;
      }),
    );
  }, [shown]);

  const crop = diary?.crops.find((c) => c.id === cropId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <PageHeader icon="book" title="সুস্থ বাগান" subtitle="রোগ ডায়েরি: লক্ষণ দেখে রোগ চিনুন, কী করবেন জানুন" />
      <ProtectionTabs active="/disease" />

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {!diary && !error && <div className="h-64 animate-pulse rounded-3xl bg-green-50" />}

      {diary && crop && <CropView crop={crop} note={diary.medicine_note} onBack={() => open("")} />}

      {diary && !crop && (
        <>
          <FilterBar
            query={query}
            onQuery={setQuery}
            placeholder="ফসল বা রোগের নাম লিখুন: টমেটো, পাউডারি, ভাইরাস, tomato..."
            searchLabel="ফসল বা রোগ খুঁজুন"
            groups={diary.groups}
            group={group}
            onGroup={setGroup}
            allLabel="সব ফসল"
            groupsLabel="ফসলের ধরন"
          />

          <p className="mt-2 text-sm text-gray-500">
            {bn(shown.length)}টা ফসল · {bn(shown.reduce((n, c) => n + c.diseases.length, 0))}টা রোগ ও পোকা
          </p>

          {shown.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white p-6 text-center text-gray-600">কিছু পাওয়া যায়নি। অন্য নামে খুঁজুন।</p>
          ) : (
            <ul className="stagger mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((c) => {
                const thumb = thumbs.get(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => open(c.id)}
                      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-green-100 to-emerald-200 text-left shadow-sm ring-1 ring-green-100 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-900/15"
                    >
                      {thumb ? (
                        <FadeImg src={thumbOf(thumb.file)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover group-hover:scale-110" />
                      ) : (
                        <CropIcon name={c.id} className="absolute inset-0 m-auto h-16 w-16 opacity-60" />
                      )}
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-3">
                        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow backdrop-blur">
                          <CropIcon name={c.id} className="h-7 w-7" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-lg font-bold leading-tight text-white drop-shadow">{c.bn}</span>
                          <span className="mt-0.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                            {bn(c.diseases.length)}টা রোগ ও পোকা
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Footer verified={diary.verified} />
        </>
      )}
    </main>
  );
}

function Cite({ src, order }: { src: string[]; order: Map<string, number> }) {
  if (!src.length) return null;
  return (
    <sup className="ml-0.5 whitespace-nowrap text-[10px]">
      {src.map((k) => (
        <a
          key={k}
          href={`#src-${k}`}
          onClick={(e) => {
            // hash বদলালে পাতা সেটাকে ফসলের নাম ভাবে আর তালিকায় ফিরে যায়, তাই hash না বদলে নিজে নিয়ে যাই
            e.preventDefault();
            const d = document.getElementById("diary-sources") as HTMLDetailsElement | null;
            if (d) d.open = true;
            const t = document.getElementById(`src-${k}`);
            if (!t) return;
            t.scrollIntoView({ behavior: "smooth", block: "center" });
            t.animate([{ backgroundColor: "#fef9c3" }, { backgroundColor: "transparent" }], { duration: 1800, easing: "ease-out" });
          }}
          className="mx-px text-green-700 hover:underline"
          title="উৎস দেখুন"
        >
          [{bn(order.get(k) ?? 0)}]
        </a>
      ))}
    </sup>
  );
}

function Lines({ title, icon, lines, order }: { title: string; icon: GIconName; lines: Line[]; order: Map<string, number> }) {
  return (
    <section>
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
        <GIcon name={icon} className="h-4 w-4 text-green-700" /> {title}
      </h4>
      <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-gray-700">
        {lines.map((l) => (
          <li key={l.text} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            <span>
              {l.text}
              <Cite src={l.src} order={order} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CropView({ crop, note, onBack }: { crop: Crop; note: string; onBack: () => void }) {
  const order = new Map(crop.sources.map((s, i) => [s.key, i + 1]));
  const [openId, setOpenId] = useState(crop.diseases[0]?.id ?? "");

  return (
    <article aria-labelledby="crop-title">
      <button onClick={onBack} className="mb-4 rounded-full border border-green-100 bg-white px-4 py-1.5 text-sm text-green-800 hover:bg-green-50">
        ← সব ফসল
      </button>
      <header className="flex items-center gap-4 rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-green-50">
          <CropIcon name={crop.id} className="h-11 w-11" />
        </span>
        <div className="min-w-0">
          <h2 id="crop-title" className="text-2xl font-bold text-green-950">
            {crop.bn} <span className="text-base font-medium text-gray-500">{crop.en}</span>
          </h2>
          <p className="text-sm italic text-gray-500">{crop.sci}</p>
          <p className="mt-1 text-sm text-gray-600">
            {crop.group} · {bn(crop.diseases.length)}টা প্রধান রোগ বা পোকা
          </p>
        </div>
      </header>

      {crop.questions && (
        <section className="mt-4 rounded-3xl border border-sky-100 bg-sky-50/60 p-5">
          <h3 className="font-bold text-sky-950"><IconText icon="question">রোগ চেনার আগে নিজেকে প্রশ্ন করুন</IconText></h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-sky-950">
            {crop.questions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-4 space-y-3">
        {crop.diseases.map((d) => {
          const isOpen = openId === d.id;
          const photoSrc = d.photo ? crop.sources.find((s) => s.key === d.photo) : null;
          return (
            <section key={d.id} className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
              <h3>
                <button
                  onClick={() => setOpenId(isOpen ? "" : d.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-green-50/50 sm:p-5"
                >
                  {d.image ? (
                    <FadeImg src={thumbOf(d.image.file)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                      <GIcon name="leaf" className="h-7 w-7" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-green-950">{d.bn}</span>
                    <span className="block text-xs text-gray-500">{d.en}</span>
                  </span>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${KIND_STYLE[d.kind]}`}>{d.kind_bn}</span>
                  <span aria-hidden className={`text-green-700 transition ${isOpen ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>
              </h3>

              {isOpen && (
                <div className="grid gap-5 border-t border-green-50 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="space-y-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold sm:hidden ${KIND_STYLE[d.kind]}`}>কারণ: {d.kind_bn}</span>
                    <Lines title="লক্ষণ" icon="search" lines={d.symptoms} order={order} />
                    <Lines title="কখন বাড়ে" icon="cloudSun" lines={d.conditions} order={order} />
                    <Lines title="কী করবেন" icon="glove" lines={d.care} order={order} />
                    <section className="rounded-2xl bg-amber-50 p-3">
                      <Lines title="ওষুধের ধরন" icon="flask" lines={d.medicine} order={order} />
                      <p className="mt-2 text-xs text-amber-900"><GIcon name="warning" className="mr-1 h-3.5 w-3.5" />{note}</p>
                    </section>
                  </div>

                  <figure className="md:order-none">
                    {d.image ? (
                      <>
                        <a href={d.image.page} target="_blank" rel="noopener noreferrer">
                          <FadeImg src={d.image.file} alt={`${crop.bn}: ${d.bn}`} loading="lazy" className="w-full rounded-2xl bg-green-50 object-cover" />
                        </a>
                        <figcaption className="mt-1.5 text-[11px] leading-snug text-gray-500">
                          {d.image.shown_on && <span className="block font-semibold text-gray-600">ছবিতে একই রোগ, {d.image.shown_on} গাছে</span>}
                          {d.image.artist ? (
                            <>
                              ছবি: {d.image.artist},{" "}
                              {d.image.license_url ? (
                                <a href={d.image.license_url} target="_blank" rel="noopener noreferrer" className="underline">
                                  {d.image.license}
                                </a>
                              ) : (
                                d.image.license
                              )}
                              , {d.image.site}
                            </>
                          ) : (
                            <>
                              ছবির উৎস:{" "}
                              <a href={d.image.page} target="_blank" rel="noopener noreferrer" className="underline">
                                {d.image.site}
                              </a>{" "}
                              (শিক্ষামূলক ব্যবহারের জন্য)
                            </>
                          )}
                        </figcaption>
                      </>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center rounded-2xl bg-green-50 text-center text-sm text-gray-500">
                        <GIcon name="image" className="mb-1 h-9 w-9 text-green-600" />
                        ছবি পাওয়া যায়নি
                      </div>
                    )}
                    {photoSrc && (
                      <a
                        href={photoSrc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1 rounded-full border border-green-200 px-3 py-1.5 text-sm text-green-800 hover:bg-green-50"
                      >
                        আরও ছবি দেখুন ↗
                      </a>
                    )}
                  </figure>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {crop.tips && (
        <section className="mt-4 rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
          <Lines title="ফলন বাড়াতে পরিচর্যা" icon="sprout" lines={crop.tips} order={order} />
        </section>
      )}

      {/* ভাঁজ করা উৎস; লেখার ভেতরের [n] চাপলে নিজে খোলে আর সেই উৎসে যায় */}
      <details id="diary-sources" className="group mt-4 rounded-2xl bg-green-50/70 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-green-800">
          <IconText icon="books">উৎস ও বিস্তারিত ({bn(crop.sources.length)}টি)</IconText>
          <span className="ml-auto text-gray-400 transition group-open:rotate-180">▾</span>
        </summary>
        <ol className="mt-3 space-y-1.5 text-sm">
          {crop.sources.map((s, i) => (
            <li key={s.key} id={`src-${s.key}`} className="flex scroll-mt-48 gap-2 target:rounded-xl target:bg-yellow-50">
              <span className="w-7 shrink-0 text-right text-gray-400">[{bn(i + 1)}]</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-green-800 hover:underline">
                {s.title} ↗
              </a>
            </li>
          ))}
        </ol>
      </details>
      <Footer verified={false} />
    </article>
  );
}

function Footer({ verified }: { verified: boolean }) {
  return (
    <div className="mt-8">
      <MoreInfo
        title="সতর্কতা"
        items={[
          "লক্ষণ দেখে রোগ সবসময় নিশ্চিত বলা যায় না, অনেক রোগ দেখতে এক রকম। ক্ষতি বেশি হলে আক্রান্ত পাতা বা গাছ নিয়ে উপজেলা কৃষি অফিসে যান।",
          ...(!verified ? ["এই ডায়েরি এখনো কৃষি বিশেষজ্ঞ দিয়ে যাচাই করা হয়নি।"] : []),
          "বেশির ভাগ উৎস বিদেশি বিশ্ববিদ্যালয়ের, তাই বাংলাদেশের মাঠে কিছুটা ভিন্ন হতে পারে।",
        ]}
      />
    </div>
  );
}

export default function DiseasePage() {
  return (
    <LoginGate next="/disease" why="রোগ ডায়েরি দেখতে লগইন লাগে।">
      <DiseaseDiary />
    </LoginGate>
  );
}
