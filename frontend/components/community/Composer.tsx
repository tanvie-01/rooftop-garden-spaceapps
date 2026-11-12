"use client";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/community/Avatar";
import { GIcon } from "@/components/garden-icons";
import { uploadPost, type Post, type Profile } from "@/lib/community";
import { compressImage } from "@/lib/imageCompress";

const MAX = 4;
const MAX_TOTAL = 4 * 1024 * 1024; // Vercel একবারে ~৪.৫MB নেয়

type Item = { file: File; url: string; blob?: Blob };

/** নতুন পোস্ট: ১-৪টা ছবি বাধ্যতামূলক, লেখা ঐচ্ছিক। ছবি আগে ব্রাউজারেই ছোট হয়, তারপর আপলোডের অগ্রগতি দেখায়। */
export default function Composer({ me, ready, onPosted }: { me: Profile; ready: boolean; onPosted: (p: Post) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<"" | "prep" | "upload">("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // পেজ ছেড়ে গেলে প্রিভিউর blob: মেমরি ফেরত (ছবি সরালে বা পোস্ট হলে সাথে সাথেই)
  const live = useRef<Item[]>([]);
  useEffect(() => {
    live.current = items;
  }, [items]);
  useEffect(() => () => live.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  function add(files: FileList | null) {
    setError("");
    const list = Array.from(files ?? []);
    const bad = list.find((f) => !/^image\/(jpeg|png|webp)$/.test(f.type));
    if (bad) setError("শুধু ছবি দেওয়া যাবে (JPG, PNG বা WEBP), ভিডিও বা অডিও নয়।");
    const ok = list.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    const room = MAX - items.length;
    if (ok.length > room) setError(`একটা পোস্টে সর্বোচ্চ ${MAX.toLocaleString("bn-BD")}টা ছবি।`);
    setItems([...items, ...ok.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (input.current) input.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return setError("অন্তত একটা ছবি দিন, শুধু লেখার পোস্ট হয় না।");
    setError("");
    setStage("prep");
    try {
      const blobs = await Promise.all(items.map((i) => compressImage(i.file)));
      if (blobs.reduce((n, b) => n + b.size, 0) > MAX_TOTAL) throw new Error("ছবিগুলো একসাথে অনেক বড়; একটা-দুটো কম দিন।");
      setStage("upload");
      setPct(0);
      const post = await uploadPost(blobs, caption, setPct);
      items.forEach((i) => URL.revokeObjectURL(i.url));
      setItems([]);
      setCaption("");
      onPosted(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "পোস্ট করা যায়নি");
    } finally {
      setStage("");
    }
  }

  const busy = stage !== "";
  return (
    <form onSubmit={submit} className="rounded-3xl border border-green-100 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <Avatar avatar={me.avatar} background={me.background} size="sm" />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2000}
          rows={items.length ? 3 : 2}
          placeholder={`${me.name}, আপনার বাগানে আজ কী হলো? ছবি দিয়ে শেয়ার করুন`}
          aria-label="পোস্টের লেখা"
          className="flex-1 resize-none rounded-2xl bg-green-50/60 px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-green-200"
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {items.map((it, i) => (
            <li key={it.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: প্রিভিউ */}
              <img src={it.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              {!busy && (
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(it.url);
                    setItems(items.filter((_, j) => j !== i));
                  }}
                  aria-label="ছবি সরান"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <div className="mt-3" role="status">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{stage === "prep" ? "ছবি প্রস্তুত হচ্ছে (মান ঠিক রেখে ছোট করা)..." : pct < 100 ? "আপলোড হচ্ছে..." : "সার্ভারে সাজানো হচ্ছে..."}</span>
            {stage === "upload" && <span className="tabular-nums">{pct.toLocaleString("bn-BD")}%</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-green-100">
            <div className={`h-full rounded-full bg-green-600 transition-all ${stage === "prep" ? "w-1/4 animate-pulse" : ""}`} style={stage === "upload" ? { width: `${Math.max(5, pct)}%` } : undefined} />
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-sm text-red-800">{error}</p>}
      {!ready && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900">ছবি রাখার জায়গা এখনো চালু হয়নি, তাই এখন পোস্ট করা যাবে না।</p>}

      <div className="mt-3 flex items-center gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy || items.length >= MAX}
          className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-40"
        >
          <GIcon name="image" className="h-5 w-5" /> ছবি দিন <span className="text-xs text-green-600">({items.length.toLocaleString("bn-BD")}/{MAX.toLocaleString("bn-BD")})</span>
        </button>
        <button disabled={busy || !items.length || !ready} className="ml-auto rounded-full bg-green-600 px-6 py-2 font-semibold text-white shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-40 disabled:shadow-none">
          {busy ? "পোস্ট হচ্ছে..." : "পোস্ট করুন"}
        </button>
      </div>
    </form>
  );
}
