"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PostCard from "@/components/community/PostCard";
import { IconText } from "@/components/garden-icons";
import { api, errorText } from "@/lib/garden";
import type { Page, Post, Profile } from "@/lib/community";

/** পোস্টের তালিকা: নিচে নামলে নিজে থেকেই পরের পাতা আনে */
export default function Feed({
  query,
  me,
  prepend = [],
  empty,
  noteFor,
}: {
  query: string;
  me: Profile | null;
  prepend?: Post[];
  empty: React.ReactNode;
  noteFor?: (p: Post) => string | undefined;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (before: number | null) => {
      setLoading(true);
      setError("");
      try {
        const d = await api<Page>(`/community/posts?${query}${before ? `&before=${before}` : ""}`);
        setPosts((x) => (before ? [...x, ...d.posts] : d.posts));
        setNext(d.next_before);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  // প্রথম পাতা (query বদলালে কম্পোনেন্ট নতুন key-তে নতুন করে বসে)
  useEffect(() => {
    let alive = true;
    api<Page>(`/community/posts?${query}`)
      .then((d) => {
        if (!alive) return;
        setPosts(d.posts);
        setNext(d.next_before);
      })
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && !loading && load(next), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, loading, load]);

  const shown = [...prepend.filter((p) => !posts.some((x) => x.id === p.id)), ...posts];
  const drop = (id: number) => setPosts((x) => x.filter((p) => p.id !== id));

  return (
    <div className="space-y-5">
      {shown.map((p) => (
        <PostCard key={p.id} post={p} me={me} onDeleted={drop} note={noteFor?.(p)} />
      ))}
      {loading && (
        <div className="space-y-5" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-3xl border border-green-100 bg-white p-4">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100" />
                <div className="h-4 w-32 self-center rounded bg-green-100" />
              </div>
              <div className="mt-4 h-64 rounded-2xl bg-green-50" />
            </div>
          ))}
        </div>
      )}
      {!loading && !error && shown.length === 0 && empty}
      {error && (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          {error}{" "}
          <button onClick={() => load(null)} className="underline">
            আবার চেষ্টা করুন
          </button>
        </p>
      )}
      <div ref={sentinel} />
      {!loading && next === null && shown.length > 3 && <p className="py-4 text-center text-sm text-gray-400"><IconText icon="leaf">সব পোস্ট দেখা শেষ</IconText></p>}
    </div>
  );
}
