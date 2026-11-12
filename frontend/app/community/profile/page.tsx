"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LoginGate from "@/components/LoginGate";
import Avatar from "@/components/community/Avatar";
import { IconText } from "@/components/garden-icons";
import Feed from "@/components/community/Feed";
import ProfileSetup from "@/components/community/ProfileSetup";
import { api, errorText } from "@/lib/garden";
import { ago, bgCss, type Profile } from "@/lib/community";
import { useCommunityMe } from "@/lib/useCommunityMe";

type Stats = { posts: number; reactions: number; comments: number; saved_by_others: number; shares: number; my_saved?: number; my_shared?: number };
type Data = { profile: Profile; stats: Stats; is_me: boolean };
const bn = (n = 0) => n.toLocaleString("bn-BD");

function ProfileView() {
  const id = Number(useSearchParams().get("id"));
  const { me, setProfile } = useCommunityMe();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"posts" | "saved" | "shared">("posts");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Data>(`/community/profiles/${id}`).then(setData).catch((e) => setError(errorText(e)));
  }, [id]);

  if (error || !id) return <p className="mx-auto max-w-xl rounded-2xl bg-red-50 p-4 text-red-800">{error || "প্রোফাইল পাওয়া যায়নি"}</p>;
  if (!data) return <div className="mx-auto h-72 max-w-3xl animate-pulse rounded-3xl bg-green-50" />;

  const p = data.profile;
  const s = data.stats;
  if (editing) {
    return (
      <div className="mx-auto max-w-4xl">
        <ProfileSetup
          initial={p}
          onCancel={() => setEditing(false)}
          onSaved={(np) => {
            setProfile(np);
            setData({ ...data, profile: np });
            setEditing(false);
          }}
        />
      </div>
    );
  }

  const tabs = [
    { id: "posts" as const, label: data.is_me ? "আমার পোস্ট" : "পোস্ট", n: s.posts },
    ...(data.is_me
      ? [
          { id: "saved" as const, label: "সেভ করা", n: s.my_saved },
          { id: "shared" as const, label: "শেয়ার করা", n: s.my_shared },
        ]
      : []),
  ];
  const query = tab === "posts" ? `author=${p.id}` : `view=${tab}`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/community" className="mb-4 inline-block rounded-full border border-green-100 bg-white px-4 py-1.5 text-sm text-green-800 hover:bg-green-50">
        ← কমিউনিটি
      </Link>
      <section className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm">
        <div className="relative h-36 sm:h-44" style={{ background: bgCss(p.background) }}>
          {data.is_me && (
            <button onClick={() => setEditing(true)} className="absolute right-3 top-3 rounded-full bg-white/90 px-4 py-1.5 text-sm text-green-800 shadow hover:bg-white">
              <IconText icon="pencil">প্রোফাইল বদলান</IconText>
            </button>
          )}
        </div>
        <div className="-mt-14 flex items-end gap-4 px-5">
          <Avatar avatar={p.avatar} background={p.background} size="xl" ring />
          <div className="min-w-0 flex-1 pb-2">
            <h1 className="truncate text-2xl font-bold text-green-950">{p.name}</h1>
            <p className="text-sm text-gray-500">সদস্য হয়েছে {ago(p.created_at)}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-4 border-t border-green-50 text-center">
          {[
            ["পোস্ট", s.posts],
            ["রিঅ্যাকশন", s.reactions],
            ["মন্তব্য", s.comments],
            ["শেয়ার", s.shares],
          ].map(([k, v]) => (
            <div key={k as string} className="py-3">
              <dd className="text-xl font-bold text-green-900 tabular-nums">{bn(v as number)}</dd>
              <dt className="text-xs text-gray-500">{k}</dt>
            </div>
          ))}
        </dl>
      </section>

      {tabs.length > 1 && (
        <div role="tablist" className="mt-5 flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-green-600 text-white" : "border border-green-100 bg-white text-green-900 hover:bg-green-50"}`}
            >
              {t.label} <span className="opacity-75">{bn(t.n)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Feed
          key={query}
          query={query}
          me={me?.profile ?? null}
          noteFor={tab === "shared" ? (x) => `আপনি শেয়ার করেছেন · ${x.at ? ago(x.at) : ""}` : tab === "saved" ? (x) => `সেভ করেছেন · ${x.at ? ago(x.at) : ""}` : undefined}
          empty={
            <p className="rounded-3xl border border-dashed border-green-200 bg-white p-8 text-center text-gray-500">
              {tab === "saved" ? "কোনো পোস্ট সেভ করা নেই। দরকারি পোস্ট সেভ করলে এখানে জমা হবে।" : tab === "shared" ? "এখনো কিছু শেয়ার করোনি।" : "এখনো কোনো পোস্ট নেই।"}
            </p>
          }
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <LoginGate next="/community" why="বাগান কমিউনিটি শুধু নিবন্ধিত সদস্যদের জন্য।">
      <main className="px-4 py-8 sm:px-5">
        <Suspense fallback={<div className="mx-auto h-72 max-w-3xl animate-pulse rounded-3xl bg-green-50" />}>
          <ProfileView />
        </Suspense>
      </main>
    </LoginGate>
  );
}
