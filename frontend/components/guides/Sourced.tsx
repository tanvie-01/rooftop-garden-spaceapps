"use client";
// পোকা চিনুন আর জৈব সার পাতার সাধারণ অংশ: উৎসসহ লাইন, ⓘ-এ উৎসের বিবরণ, ছবি আর credit।
// নিয়ম: প্রতিটা লাইনের পাশে ⓘ; চাপলে কোন উৎস, কোথায় পাওয়া, কীভাবে নেওয়া (how) আর link দেখায়,
// যেন যে কেউ নিজে মিলিয়ে দেখতে পারে কিছু বানানো নয়।
import { useState } from "react";
import FadeImg from "@/components/FadeImg";
import { GIcon, IconText, type GIconName } from "@/components/garden-icons";
import { InfoTip } from "@/components/InfoTip";

export type Line = { text: string; src: string[] };
export type Source = { key: string; title: string; publisher?: string; url: string; lang?: string; how: string };
export type Img = {
  file: string;
  caption?: string;
  title: string;
  page: string;
  license: string;
  license_url?: string;
  artist: string;
  site: string;
  checked?: string;
};

export const bn = (n: number) => n.toLocaleString("bn-BD");
export const thumbOf = (file: string) => file.replace(/^\/(\w+)\/(.+)\.\w+$/, "/$1/thumb/$2.webp");

/** এক লাইনের উৎসগুলো: [১][২] নম্বর আর ⓘ, চাপলে বিস্তারিত */
export function SourceTip({ src, sources }: { src: string[]; sources: Source[] }) {
  const used = src.map((k) => ({ s: sources.find((x) => x.key === k), n: sources.findIndex((x) => x.key === k) + 1 })).filter((x) => x.s);
  if (!used.length) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 align-baseline">
      <sup className="text-[10px] text-green-700">{used.map((u) => `[${bn(u.n)}]`).join("")}</sup>
      <InfoTip label="এই তথ্য কোথা থেকে" peek={false}>
        <span className="block space-y-2">
          {used.map(({ s, n }) => (
            <span key={s!.key} className="block">
              <span className="block font-semibold text-gray-800">
                [{bn(n)}] {s!.title}
              </span>
              {s!.publisher && <span className="block text-gray-500">{s!.publisher}</span>}
              <span className="mt-0.5 block text-gray-700">{s!.how}</span>
              <a href={s!.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block break-all text-green-700 underline">
                উৎস খুলে দেখুন ↗
              </a>
            </span>
          ))}
        </span>
      </InfoTip>
    </span>
  );
}

export function Lines({
  title,
  icon,
  lines,
  sources,
  numbered = false,
  tone = "",
}: {
  title: string;
  icon: GIconName;
  lines: Line[];
  sources: Source[];
  numbered?: boolean;
  tone?: string;
}) {
  if (!lines?.length) return null;
  const Tag = numbered ? "ol" : "ul";
  return (
    <section className={tone}>
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-900">
        <GIcon name={icon} className="h-4 w-4 text-green-700" /> {title}
      </h4>
      <Tag className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-gray-700">
        {lines.map((l, i) => (
          <li key={l.text} className="flex gap-2">
            {numbered ? (
              <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-800">
                {bn(i + 1)}
              </span>
            ) : (
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            )}
            <span>
              {l.text}
              <SourceTip src={l.src} sources={sources} />
            </span>
          </li>
        ))}
      </Tag>
    </section>
  );
}

/** ১-৩টা ছবি: বড় একটা, নিচে ছোটগুলো বদলানো যায়; প্রতিটার credit আর "কীভাবে মেলানো" */
export function Gallery({ images, alt }: { images: Img[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!images.length) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-2xl bg-green-50 text-center text-sm text-gray-500">
        <GIcon name="image" className="mb-1 h-9 w-9 text-green-600" />
        ছবি পাওয়া যায়নি
      </div>
    );
  }
  const im = images[Math.min(i, images.length - 1)];
  return (
    <figure>
      <a href={im.page} target="_blank" rel="noopener noreferrer">
        <FadeImg key={im.file} src={im.file} alt={`${alt}: ${im.caption ?? ""}`} loading="lazy" className="aspect-[4/3] w-full rounded-2xl bg-green-50 object-cover" />
      </a>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2" role="group" aria-label="আরও ছবি">
          {images.map((x, j) => (
            <button
              key={x.file}
              onClick={() => setI(j)}
              aria-pressed={j === i}
              aria-label={x.caption || `ছবি ${bn(j + 1)}`}
              className={`overflow-hidden rounded-xl ring-2 transition ${j === i ? "ring-green-500" : "ring-transparent opacity-70 hover:opacity-100"}`}
            >
              <FadeImg src={thumbOf(x.file)} alt="" className="h-14 w-14 object-cover" />
            </button>
          ))}
        </div>
      )}
      {/* ছবির নাম দেখা যায়; কার ছবি, লাইসেন্স আর উৎস ⓘ-এর ভেতরে (পাতা পরিষ্কার রাখার নিয়ম) */}
      <figcaption className="mt-1.5 flex items-start gap-1 text-sm leading-snug text-gray-700">
        {im.caption && <span className="font-medium">{im.caption}</span>}
        <InfoTip
          label="ছবি কোথা থেকে"
          peek={false}
          sources={[{ title: im.title, url: im.page }, ...(im.license_url ? [{ title: `লাইসেন্স: ${im.license}`, url: im.license_url }] : [])]}
        >
          <span className="block">
            ছবি: {im.artist}। খোলা লাইসেন্সের ছবি ({im.license}), {im.site} থেকে নেওয়া।
            {im.checked && <span className="mt-1 block">যাচাই: {im.checked}</span>}
          </span>
        </InfoTip>
      </figcaption>
    </figure>
  );
}

/** পাতার নিচে সব উৎসের তালিকা, প্রতিটার পাশে কীভাবে নেওয়া। ভাঁজ করা থাকে (পাতা পরিষ্কার রাখার নিয়ম), চাপলে খোলে। */
export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <details className="group mt-4 rounded-2xl bg-green-50/70 px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-green-800">
        <IconText icon="books">উৎস ও বিস্তারিত ({bn(sources.length)}টি)</IconText>
        <span className="ml-auto text-gray-400 transition group-open:rotate-180">▾</span>
      </summary>
      <ol className="mt-3 space-y-2.5 text-sm">
        {sources.map((s, i) => (
          <li key={s.key} className="flex gap-2">
            <span className="w-7 shrink-0 text-right text-gray-400">[{bn(i + 1)}]</span>
            <span className="min-w-0">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-green-800 hover:underline">
                {s.title} ↗
              </a>
              {s.publisher && <span className="block text-xs text-gray-500">{s.publisher}</span>}
              <span className="block text-xs text-gray-600">{s.how}</span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
