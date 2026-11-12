"use client";
// ঘরোয়া পদ্ধতি: নিম, সাবান-পানি, ফাঁদ ইত্যাদি কম ঝুঁকির উপায়। শুধু সেগুলোই যেগুলোর রেসিপি বিশ্ববিদ্যালয়/সরকারি
// উৎসে আছে; প্রতিটার সাথে গাছ ও মানুষের নিরাপত্তা আর প্রমাণ কতটা শক্ত। প্রতিটা লাইনের উৎস ⓘ-এ।
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FadeImg from "@/components/FadeImg";
import { GIcon } from "@/components/garden-icons";
import { MoreInfo } from "@/components/InfoTip";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import ProtectionTabs from "@/components/ProtectionTabs";
import { Gallery, Lines, SourceList, thumbOf, type Img, type Line, type Source } from "@/components/guides/Sourced";
import { api, errorText } from "@/lib/garden";

type Remedy = {
  id: string;
  bn: string;
  en: string;
  kind: string;
  for_pests: { id: string; bn: string }[];
  for_diseases: { id: string; crop_id: string; crop_bn: string; bn: string }[];
  what: Line[];
  materials: Line[];
  steps: Line[];
  use: Line[];
  safety: Line[];
  not_for: Line[];
  evidence: Line[];
  images: Img[];
  sources: Source[];
};
type Guide = { kinds: string[]; general: Line[]; general_sources: Source[]; remedies: Remedy[]; doctor_note: string; verified: boolean };

function RemedyGuide() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    api<Guide>("/disease/remedies")
      .then((g) => {
        setGuide(g);
        const h = decodeURIComponent(location.hash.slice(1));
        if (g.remedies.some((r) => r.id === h)) {
          setOpenId(h);
          requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: "start" }));
        }
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  function toggle(id: string) {
    const next = openId === id ? "" : id;
    history.replaceState(null, "", next ? `#${next}` : location.pathname);
    setOpenId(next);
  }

  const shown = useMemo(() => (guide ? guide.remedies.filter((r) => !kind || r.kind === kind) : []), [guide, kind]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <PageHeader icon="hand" scene="disease" title="সুস্থ বাগান" subtitle="ঘরোয়া পদ্ধতি: যাচাই করা, গাছের জন্য নিরাপদ উপায়" />
      <ProtectionTabs active="/remedies" />

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {!guide && !error && <div className="h-64 animate-pulse rounded-3xl bg-green-50" />}

      {guide && (
        <>
          {guide.general.length > 0 && (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <Lines title="শুরু করার আগে" icon="warning" lines={guide.general} sources={guide.general_sources} />
            </section>
          )}

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="কীসের জন্য">
            {["", ...guide.kinds].map((k) => (
              <button
                key={k || "all"}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
                  kind === k ? "bg-green-600 text-white" : "border border-green-100 bg-white text-green-900 hover:bg-green-50"
                }`}
              >
                {k || "সব পদ্ধতি"}
              </button>
            ))}
          </div>

          {shown.length === 0 && (
            <p className="mt-6 rounded-2xl bg-white p-6 text-center text-gray-600">
              {guide.remedies.length ? "এই ধরনের কোনো পদ্ধতি নেই।" : "তালিকা তৈরি হচ্ছে, শিগগিরই আসবে।"}
            </p>
          )}

          <div className="mt-3 space-y-3">
            {shown.map((r) => {
              const isOpen = openId === r.id;
              return (
                <section key={r.id} id={r.id} className="scroll-mt-40 overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
                  <h3>
                    <button onClick={() => toggle(r.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left hover:bg-green-50/50 sm:p-5">
                      {r.images[0] ? (
                        <FadeImg src={thumbOf(r.images[0].file)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                          <GIcon name="hand" className="h-7 w-7" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold text-green-950">{r.bn}</span>
                        <span className="block text-xs text-gray-500">
                          {r.en} · {r.kind}
                        </span>
                      </span>
                      <span aria-hidden className={`text-green-700 transition ${isOpen ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>
                  </h3>

                  {isOpen && (
                    <div className="border-t border-green-50 p-4 sm:p-5">
                      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-4">
                          <Lines title="এটা কী, কীভাবে কাজ করে" icon="bulb" lines={r.what} sources={r.sources} />
                          {(r.for_pests.length > 0 || r.for_diseases.length > 0) && (
                            <section>
                              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
                                <GIcon name="bug" className="h-4 w-4 text-green-700" /> কাজে লাগে
                              </h4>
                              <ul className="mt-1.5 flex flex-wrap gap-2">
                                {r.for_pests.map((p) => (
                                  <li key={p.id}>
                                    <Link href={`/pests#${p.id}`} className="inline-block rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sm text-sky-900 hover:bg-sky-100">
                                      {p.bn}
                                    </Link>
                                  </li>
                                ))}
                                {r.for_diseases.map((d) => (
                                  <li key={d.id}>
                                    <Link href={`/disease#${d.crop_id}`} className="inline-block rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-sm text-amber-900 hover:bg-amber-100">
                                      {d.crop_bn}: {d.bn}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )}
                          <Lines title="যা লাগবে" icon="basket" lines={r.materials} sources={r.sources} />
                        </div>
                        {r.images.length > 0 && <Gallery images={r.images} alt={r.bn} />}
                      </div>
                      <div className="mt-4 space-y-4">
                        <Lines title="বানানো ও দেওয়ার ধাপ" icon="clipboard" lines={r.steps} sources={r.sources} numbered />
                        <Lines title="কখন, কতদিন পরপর" icon="clock" lines={r.use} sources={r.sources} />
                        <div className="space-y-3 rounded-2xl bg-amber-50 p-3">
                          <Lines title="গাছ যেন ক্ষতি না হয়: সাবধানতা" icon="warning" lines={r.safety} sources={r.sources} />
                          <Lines title="যেখানে দেবেন না" icon="ban" lines={r.not_for} sources={r.sources} />
                        </div>
                        <Lines title="কতটা কাজ করে (প্রমাণ)" icon="chart" lines={r.evidence} sources={r.sources} />
                      </div>
                      <SourceList sources={r.sources} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <SourceList sources={guide.general_sources} />
          <div className="mt-8">
            <MoreInfo
              title="সতর্কতা"
              items={[
                "শুধু সেই ঘরোয়া পদ্ধতিগুলোই রাখা হয়েছে যেগুলোর নিয়ম বিশ্ববিদ্যালয় বা সরকারি কৃষি উৎসে আছে। লোকমুখে শোনা যেসব টোটকা গাছ বা মানুষের ক্ষতি করতে পারে, সেগুলো রাখা হয়নি।",
                guide.doctor_note,
                ...(!guide.verified ? ["এই গাইড এখনো কৃষি বিশেষজ্ঞ দিয়ে যাচাই করা হয়নি।"] : []),
              ]}
            />
          </div>
        </>
      )}
    </main>
  );
}

export default function RemediesPage() {
  return (
    <LoginGate next="/remedies" why="ঘরোয়া পদ্ধতি দেখতে লগইন লাগে।">
      <RemedyGuide />
    </LoginGate>
  );
}
