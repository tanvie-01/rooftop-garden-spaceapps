"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LoginGate from "@/components/LoginGate";
import PostCard from "@/components/community/PostCard";
import { api, errorText } from "@/lib/garden";
import type { Post } from "@/lib/community";
import { useCommunityMe } from "@/lib/useCommunityMe";

/** শেয়ার করা লিংক: একটা পোস্ট */
function OnePost() {
  const id = Number(useSearchParams().get("id"));
  const { me } = useCommunityMe();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Post>(`/community/posts/${id}`).then(setPost).catch((e) => setError(errorText(e)));
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/community" className="mb-4 inline-block rounded-full border border-green-100 bg-white px-4 py-1.5 text-sm text-green-800 hover:bg-green-50">
        ← কমিউনিটি
      </Link>
      {(error || !id) && <p className="rounded-2xl bg-red-50 p-4 text-red-800">{error || "পোস্ট পাওয়া যায়নি"}</p>}
      {gone && <p className="rounded-2xl bg-green-50 p-4 text-green-800">পোস্টটা মুছে ফেলা হয়েছে।</p>}
      {!post && !error && !!id && <div className="h-96 animate-pulse rounded-3xl bg-green-50" />}
      {post && !gone && <PostCard post={post} me={me?.profile ?? null} onDeleted={() => setGone(true)} />}
    </div>
  );
}

export default function PostPage() {
  return (
    <LoginGate next="/community" why="বাগান কমিউনিটি শুধু নিবন্ধিত সদস্যদের জন্য।">
      <main className="px-4 py-8 sm:px-5">
        <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse rounded-3xl bg-green-50" />}>
          <OnePost />
        </Suspense>
      </main>
    </LoginGate>
  );
}
