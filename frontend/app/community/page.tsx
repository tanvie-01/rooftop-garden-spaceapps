"use client";
import { useState } from "react";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";
import Avatar from "@/components/community/Avatar";
import { GIcon, type GIconName } from "@/components/garden-icons";
import Composer from "@/components/community/Composer";
import Feed from "@/components/community/Feed";
import ProfileSetup from "@/components/community/ProfileSetup";
import { bgCss, type Post } from "@/lib/community";
import { useCommunityMe } from "@/lib/useCommunityMe";

const IDEAS: [GIconName, string][] = [
  ["pot", "আপনার ছাদবাগান"],
  ["flower", "নতুন ফোটা ফুল"],
  ["harvest", "আজকের ফসল"],
  ["sprout", "চারা থেকে গাছ: আগে-পরে"],
  ["bulb", "যে কৌশলে কাজ হয়েছে"],
];

function Community() {
  const { me, error, setProfile } = useCommunityMe();
  const [mine, setMine] = useState<Post[]>([]);

  if (error) return <p className="mx-auto max-w-xl rounded-2xl bg-red-50 p-4 text-red-800">{error}</p>;
  if (!me) return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-3xl bg-green-50" />;

  if (!me.profile) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <GIcon name="flower" className="mx-auto h-14 w-14 text-green-600" />
          <h1 className="mt-2 text-3xl font-bold text-green-950">বাগান কমিউনিটিতে স্বাগতম</h1>
          <p className="mt-2 text-gray-600">তিনটা ছোট ধাপে আপনার প্রোফাইল তৈরি করুন: একটা অবতার, একটা পটভূমি আর একটা নাম।</p>
        </div>
        <ProfileSetup onSaved={setProfile} />
      </div>
    );
  }

  const p = me.profile;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_300px]">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <Composer me={p} ready={me.uploads_ready} onPosted={(post) => setMine((x) => [post, ...x])} />
        <Feed
          query="view=feed"
          me={p}
          prepend={mine}
          empty={
            <div className="rounded-3xl border border-dashed border-green-200 bg-white p-10 text-center">
              <GIcon name="sprout" className="mx-auto h-12 w-12 text-green-600" />
              <p className="mt-2 font-semibold text-green-900">এখনো কোনো পোস্ট নেই</p>
              <p className="text-sm text-gray-500">আপনার বাগানের একটা ছবি দিয়ে প্রথম পোস্টটা করুন!</p>
            </div>
          }
        />
      </div>

      <aside className="order-first space-y-4 lg:order-none">
        <div className="sticky top-[calc(var(--hdr-h,8rem)+1rem)] space-y-4">
          <Link href={`/community/profile?id=${p.id}`} className="block overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm transition hover:shadow-md">
            <div className="h-20" style={{ background: bgCss(p.background) }} />
            <div className="-mt-9 flex items-end gap-3 px-4 pb-4">
              <Avatar avatar={p.avatar} background={p.background} size="lg" ring />
              <div className="min-w-0 pb-1">
                <p className="truncate text-lg font-bold text-green-950">{p.name}</p>
                <p className="text-sm text-green-700">আমার ড্যাশবোর্ড →</p>
              </div>
            </div>
          </Link>
          <div className="hidden rounded-3xl border border-white bg-white/80 p-5 shadow-sm backdrop-blur lg:block">
            <p className="flex items-center gap-2 text-base font-bold text-green-950">
              <GIcon name="bulb" className="h-5 w-5 text-amber-500" /> কী নিয়ে পোস্ট করবেন?
            </p>
            <ul className="mt-3 space-y-2">
              {IDEAS.map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3 rounded-2xl bg-green-50/70 px-3 py-2.5 text-[15px] font-medium text-green-900">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-green-600 shadow-sm">
                    <GIcon name={icon} className="h-[18px] w-[18px]" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <LoginGate next="/community" why="বাগান কমিউনিটি শুধু নিবন্ধিত সদস্যদের জন্য।">
      <main className="px-4 py-8 sm:px-5">
        <Community />
      </main>
    </LoginGate>
  );
}
