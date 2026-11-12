"use client";
// জৈব সার: ঘরে (ছাদে) কম্পোস্ট, কেঁচো সার, খৈল ইত্যাদি বানানো আর টবে দেওয়ার নিয়ম। প্রতিটা লাইনের উৎস ⓘ-এ।
import { useEffect, useState } from "react";
import FadeImg from "@/components/FadeImg";
import { GIcon, IconText } from "@/components/garden-icons";
import { MoreInfo } from "@/components/InfoTip";
import LoginGate from "@/components/LoginGate";
import PageHeader from "@/components/PageHeader";
import ProtectionTabs from "@/components/ProtectionTabs";
import { Gallery, Lines, SourceList, thumbOf, type Img, type Line, type Source } from "@/components/guides/Sourced";
import { api, errorText } from "@/lib/garden";

type Item = {
  id: string;
  bn: string;
  en: string;
  what: Line[];
  materials: Line[];
  steps: Line[];
  time: Line[];
  use: Line[];
  caution: Line[];
  images: Img[];
  sources: Source[];
};
type Guide = { general: Line[]; general_sources: Source[]; items: Item[]; verified: boolean };

function FertilizerGuide() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    api<Guide>("/disease/fertilizer")
      .then((g) => {
        setGuide(g);
        const h = decodeURIComponent(location.hash.slice(1));
        setOpenId(g.items.some((i) => i.id === h) ? h : "");
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  function toggle(id: string) {
    const next = openId === id ? "" : id;
    history.replaceState(null, "", next ? `#${next}` : location.pathname);
    setOpenId(next);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <PageHeader icon="sprout" scene="disease" title="সুস্থ বাগান" subtitle="রান্নাঘরের বর্জ্য আর ঘরের জিনিস দিয়ে জৈব সার বানান" />
      <ProtectionTabs active="/fertilizer" />

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {!guide && !error && <div className="h-64 animate-pulse rounded-3xl bg-green-50" />}

      {guide && (
        <>
          {guide.general.length > 0 && (
            <section className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
              <Lines title="টবে জৈব সার: আগে জেনে নিন" icon="bulb" lines={guide.general} sources={guide.general_sources} />
            </section>
          )}

          {guide.items.length === 0 && <p className="mt-6 rounded-2xl bg-white p-6 text-center text-gray-600">তালিকা তৈরি হচ্ছে, শিগগিরই আসবে।</p>}

          <div className="mt-4 space-y-3">
            {guide.items.map((f) => {
              const isOpen = openId === f.id;
              return (
                <section key={f.id} id={f.id} className="scroll-mt-40 overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
                  <h3>
                    <button onClick={() => toggle(f.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left hover:bg-green-50/50 sm:p-5">
                      {f.images[0] ? (
                        <FadeImg src={thumbOf(f.images[0].file)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                          <GIcon name="sprout" className="h-7 w-7" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold text-green-950">{f.bn}</span>
                        <span className="block text-xs text-gray-500">{f.en}</span>
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
                          <Lines title="এটা কী, কেন দেবেন" icon="bulb" lines={f.what} sources={f.sources} />
                          <Lines title="যা লাগবে" icon="basket" lines={f.materials} sources={f.sources} />
                        </div>
                        {f.images.length > 0 && <Gallery images={f.images} alt={f.bn} />}
                      </div>
                      <div className="mt-4 space-y-4">
                        <Lines title="বানানোর ধাপ" icon="clipboard" lines={f.steps} sources={f.sources} numbered />
                        <Lines title="কবে তৈরি হয়, কীভাবে বুঝবেন" icon="clock" lines={f.time} sources={f.sources} />
                        <Lines title="টবে কীভাবে দেবেন" icon="pot" lines={f.use} sources={f.sources} />
                        <Lines title="সাবধানতা" icon="warning" lines={f.caution} sources={f.sources} tone="rounded-2xl bg-amber-50 p-3" />
                      </div>
                      <SourceList sources={f.sources} />
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
                "এখানে শুধু জৈব সার; রাসায়নিক সার বা কীটনাশকের নিয়ম নেই। গাছে সমস্যা থাকলে উপজেলা কৃষি অফিস বা কৃষি কল সেন্টার ১৬১২৩-এ জিজ্ঞেস করুন।",
                ...(!guide.verified ? ["এই গাইড এখনো কৃষি বিশেষজ্ঞ দিয়ে যাচাই করা হয়নি।"] : []),
                <>
                  প্রতিটা তথ্যের পাশে ⓘ চাপলে দেখবেন কোন উৎস থেকে, কীভাবে নেওয়া।{" "}
                  <IconText icon="books">নিচে পুরো উৎস তালিকা আছে।</IconText>
                </>,
              ]}
            />
          </div>
        </>
      )}
    </main>
  );
}

export default function FertilizerPage() {
  return (
    <LoginGate next="/fertilizer" why="জৈব সার গাইড দেখতে লগইন লাগে।">
      <FertilizerGuide />
    </LoginGate>
  );
}
