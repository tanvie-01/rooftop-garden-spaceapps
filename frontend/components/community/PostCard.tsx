"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/community/Avatar";
import { GIcon, IconText } from "@/components/garden-icons";
import { api, errorText } from "@/lib/garden";
import { confirmBox, notify } from "@/lib/notify";
import { REACTIONS, ago, mediaUrl, type Comment, type Post, type Profile, type Reaction } from "@/lib/community";

const bn = (n: number) => n.toLocaleString("bn-BD");
type Summary = Pick<Post, "id" | "reactions" | "reaction_total" | "my_reaction" | "saved" | "shared" | "share_count">;

export default function PostCard({ post, me, onDeleted, note }: { post: Post; me: Profile | null; onDeleted?: (id: number) => void; note?: string }) {
  const [p, setP] = useState(post);
  const [picker, setPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (t: string) => notify.info(t);
  const merge = (s: Summary) => setP((x) => ({ ...x, ...s }));

  async function react(kind: Reaction | null) {
    setPicker(false);
    const prev = p;
    // সাথে সাথে দেখান, সার্ভার পরে ঠিক করে দেয়
    const reactions = { ...p.reactions };
    if (p.my_reaction) reactions[p.my_reaction]--;
    if (kind) reactions[kind]++;
    setP({ ...p, reactions, my_reaction: kind, reaction_total: Object.values(reactions).reduce((a, b) => a + b, 0) });
    try {
      merge(
        kind
          ? await api<Summary>(`/community/posts/${p.id}/reaction`, { method: "PUT", body: { kind } })
          : await api<Summary>(`/community/posts/${p.id}/reaction`, { method: "DELETE" }),
      );
    } catch (e) {
      setP(prev);
      flash(errorText(e));
    }
  }

  async function toggle(what: "save" | "share") {
    const on = what === "save" ? !p.saved : !p.shared;
    try {
      merge(await api<Summary>(`/community/posts/${p.id}/${what}`, { method: on ? "PUT" : "DELETE" }));
      flash(what === "save" ? (on ? "সেভ হয়েছে: ড্যাশবোর্ডের ‘সেভ করা’-তে পাবেন" : "সেভ থেকে সরানো হয়েছে") : on ? "শেয়ার হয়েছে: আপনার প্রোফাইলে দেখাবে" : "শেয়ার তুলে নেওয়া হয়েছে");
    } catch (e) {
      flash(errorText(e));
    }
  }

  async function copyLink() {
    const url = `${location.origin}/community/post?id=${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Rooftop Garden কমিউনিটি", url });
      else {
        await navigator.clipboard.writeText(url);
        flash("লিংক কপি হয়েছে");
      }
    } catch {}
  }

  async function remove() {
    const ok = await confirmBox({ title: "পোস্টটা মুছে ফেলবেন?", text: "ছবি, মন্তব্য, রিঅ্যাকশন সব মুছে যাবে।", ok: "হ্যাঁ, মুছে ফেলুন", danger: true });
    if (!ok) return;
    try {
      await api(`/community/posts/${p.id}`, { method: "DELETE" });
      onDeleted?.(p.id);
    } catch (e) {
      flash(errorText(e));
    }
  }

  const mine = REACTIONS.find((r) => r.id === p.my_reaction);
  const top = REACTIONS.filter((r) => p.reactions[r.id] > 0).sort((a, b) => p.reactions[b.id] - p.reactions[a.id]);
  const imgs = p.images;

  return (
    <article className="relative overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm transition hover:shadow-md">
      {note && <p className="border-b border-green-50 bg-green-50/60 px-4 py-2 text-xs text-green-800">{note}</p>}
      <header className="flex items-center gap-3 p-4">
        {p.author ? (
          <Link href={`/community/profile?id=${p.author.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar avatar={p.author.avatar} background={p.author.background} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900 hover:underline">{p.author.name}</span>
              <time dateTime={p.created_at} title={new Date(p.created_at).toLocaleString("bn-BD")} className="block text-xs text-gray-500">
                {ago(p.created_at)}
              </time>
            </span>
          </Link>
        ) : (
          <span className="text-sm text-gray-500">অজানা সদস্য</span>
        )}
        {p.is_mine && (
          <div className="relative ml-auto">
            <button onClick={() => setMenu(!menu)} aria-label="আরও" aria-expanded={menu} className="rounded-full px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100">
              ⋯
            </button>
            {menu && (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
                <button onClick={remove} className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">
                  <IconText icon="trash">পোস্ট মুছে ফেলুন</IconText>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {p.caption && <p className="whitespace-pre-line break-words px-4 pb-3 text-[15px] leading-relaxed text-gray-800">{p.caption}</p>}

      {/* ছবি: ১টা হলে পুরো, বেশি হলে গ্রিড */}
      <div className={`grid gap-0.5 bg-green-50 ${imgs.length > 1 ? "grid-cols-2" : ""}`}>
        {imgs.map((im, i) => (
          <button
            key={im.feed}
            onClick={() => setViewer(i)}
            className={`relative block overflow-hidden ${imgs.length === 3 && i === 0 ? "row-span-2" : ""}`}
            aria-label={`ছবি ${bn(i + 1)} বড় করে দেখুন`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- storage-এর WebP, আগেই ছোট করা */}
            <img
              src={mediaUrl(im.feed)}
              alt=""
              loading="lazy"
              decoding="async"
              width={im.width}
              height={im.height}
              className={`w-full bg-green-100 object-cover transition duration-300 hover:scale-[1.02] ${imgs.length === 1 ? "max-h-[640px]" : "h-full min-h-40 sm:min-h-56"}`}
              style={imgs.length === 1 ? { aspectRatio: `${im.width} / ${im.height}` } : undefined}
            />
          </button>
        ))}
      </div>

      {/* গণনা */}
      <div className="flex items-center gap-2 px-4 pt-3 text-sm text-gray-500">
        {p.reaction_total > 0 && (
          <span className="flex items-center gap-1">
            <span className="flex -space-x-1">
              {top.map((r) => (
                <span key={r.id} className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow-sm">
                  <GIcon name={r.icon} className={`h-3.5 w-3.5 ${r.color}`} />
                </span>
              ))}
            </span>
            {bn(p.reaction_total)}
          </span>
        )}
        <span className="ml-auto flex gap-3">
          {p.comment_count > 0 && (
            <button onClick={() => setShowComments(true)} className="hover:underline">
              {bn(p.comment_count)} মন্তব্য
            </button>
          )}
          {p.share_count > 0 && <span>{bn(p.share_count)} শেয়ার</span>}
        </span>
      </div>

      {/* বোতাম */}
      <div className="relative mx-2 mt-2 grid grid-cols-4 border-t border-green-50 py-1 text-sm">
        <div
          className="relative"
          onMouseEnter={() => (holdTimer.current = setTimeout(() => setPicker(true), 350))}
          onMouseLeave={() => {
            if (holdTimer.current) clearTimeout(holdTimer.current);
            setPicker(false);
          }}
        >
          {picker && (
            <div className="absolute -top-14 left-0 z-20 flex gap-1 rounded-full border border-gray-100 bg-white p-1.5 shadow-xl" role="menu">
              {REACTIONS.map((r) => (
                <button key={r.id} onClick={() => react(r.id)} title={r.label} aria-label={r.label} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition hover:-translate-y-1 hover:scale-125">
                  <GIcon name={r.icon} className={`h-7 w-7 ${r.color}`} />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => (p.my_reaction ? react(null) : react("like"))}
            onContextMenu={(e) => {
              e.preventDefault();
              setPicker(true);
            }}
            aria-label={mine ? `${mine.label} দিয়েছেন; সরাতে চাপুন` : "লাইক"}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 font-medium hover:bg-green-50 ${mine ? mine.color : "text-gray-600"}`}
          >
            <GIcon name={mine ? mine.icon : "thumb"} className="h-5 w-5" />
            {mine ? mine.label : "লাইক"}
          </button>
          <button onClick={() => setPicker(!picker)} aria-label="অন্য রিঅ্যাকশন বাছুন" className="absolute -right-1 top-1/2 -translate-y-1/2 rounded-full px-1 text-xs text-gray-400 hover:text-gray-700 sm:hidden">
            ▾
          </button>
        </div>
        <button onClick={() => setShowComments(!showComments)} aria-label="মন্তব্য" aria-expanded={showComments} className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-gray-600 hover:bg-green-50">
          <GIcon name="chat" className="h-5 w-5" />
          <span className="hidden sm:inline">মন্তব্য</span>
        </button>
        <ShareButton shared={p.shared} onShare={() => toggle("share")} onLink={copyLink} />
        <button onClick={() => toggle("save")} aria-pressed={p.saved} aria-label={p.saved ? "সেভ করা" : "সেভ"} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-medium hover:bg-green-50 ${p.saved ? "text-green-700" : "text-gray-600"}`}>
          <GIcon name="bookmark" className={`h-5 w-5 ${p.saved ? "fill-green-600/30" : ""}`} />
          <span className="hidden sm:inline">{p.saved ? "সেভ করা" : "সেভ"}</span>
        </button>
      </div>

      {showComments && <Comments postId={p.id} me={me} onCount={(n) => setP((x) => ({ ...x, comment_count: n }))} />}

      {viewer !== null && <Viewer images={imgs.map((i) => mediaUrl(i.full))} start={viewer} onClose={() => setViewer(null)} />}
    </article>
  );
}

function ShareButton({ shared, onShare, onLink }: { shared: boolean; onShare: () => void; onLink: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={shared ? "শেয়ার করা" : "শেয়ার"} className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 font-medium hover:bg-green-50 ${shared ? "text-green-700" : "text-gray-600"}`}>
        <span className="text-lg">↗</span>
        <span className="hidden sm:inline">{shared ? "শেয়ার করা" : "শেয়ার"}</span>
      </button>
      {open && (
        <div className="absolute bottom-12 left-1/2 z-20 w-52 -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-1 shadow-xl">
          <button
            onClick={() => {
              setOpen(false);
              onShare();
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-green-50"
          >
            <IconText icon="share">{shared ? "শেয়ার তুলে নিন" : "আমার প্রোফাইলে শেয়ার করুন"}</IconText>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLink();
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-green-50"
          >
            <IconText icon="link">লিংক কপি / পাঠান</IconText>
          </button>
        </div>
      )}
    </div>
  );
}

function Comments({ postId, me, onCount }: { postId: number; me: Profile | null; onCount: (n: number) => void }) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Comment[]>(`/community/posts/${postId}/comments`).then(setItems).catch((e) => setError(errorText(e)));
  }, [postId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const c = await api<Comment>(`/community/posts/${postId}/comments`, { method: "POST", body: { text } });
      const next = [...(items ?? []), c];
      setItems(next);
      onCount(next.length);
      setText("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function del(id: number) {
    try {
      await api(`/community/comments/${id}`, { method: "DELETE" });
      const next = (items ?? []).filter((c) => c.id !== id);
      setItems(next);
      onCount(next.length);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section className="border-t border-green-50 bg-green-50/30 px-4 py-3" aria-label="মন্তব্য">
      {items === null && !error && <p className="text-sm text-gray-400">মন্তব্য আসছে...</p>}
      {items?.length === 0 && <p className="text-sm text-gray-500">এখনো কেউ মন্তব্য করেনি। প্রথম মন্তব্যটা আপনিই করুন!</p>}
      <ul className="space-y-3">
        {items?.map((c) => (
          <li key={c.id} className="flex gap-2">
            {c.author && <Avatar avatar={c.author.avatar} background={c.author.background} size="xs" />}
            <div className="min-w-0 flex-1">
              <div className="inline-block max-w-full rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">{c.author?.name ?? "অজানা"}</p>
                <p className="whitespace-pre-line break-words text-sm text-gray-800">{c.text}</p>
              </div>
              <p className="mt-0.5 flex gap-3 px-2 text-xs text-gray-500">
                <span>{ago(c.created_at)}</span>
                {c.can_delete && (
                  <button onClick={() => del(c.id)} className="hover:text-red-600">
                    মুছুন
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {me && (
        <form onSubmit={send} className="mt-3 flex items-end gap-2">
          <Avatar avatar={me.avatar} background={me.background} size="xs" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="মন্তব্য লিখুন..."
            aria-label="মন্তব্য লিখুন"
            className="min-h-10 flex-1 resize-none rounded-2xl border border-green-100 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
          />
          <button disabled={busy || !text.trim()} className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            পাঠান
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function Viewer({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(images.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [images.length, onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="ছবি" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- বড় ছবি */}
      <img src={images[i]} alt="" className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-2xl text-white hover:bg-white/25">
        ×
      </button>
      {images.length > 1 && (
        <>
          <button onClick={(e) => (e.stopPropagation(), setI(Math.max(0, i - 1)))} disabled={i === 0} aria-label="আগের ছবি" className="absolute left-3 rounded-full bg-white/15 px-3 py-2 text-2xl text-white disabled:opacity-30">
            ‹
          </button>
          <button onClick={(e) => (e.stopPropagation(), setI(Math.min(images.length - 1, i + 1)))} disabled={i === images.length - 1} aria-label="পরের ছবি" className="absolute right-3 rounded-full bg-white/15 px-3 py-2 text-2xl text-white disabled:opacity-30">
            ›
          </button>
          <p className="absolute bottom-4 text-sm text-white/80">
            {bn(i + 1)} / {bn(images.length)}
          </p>
        </>
      )}
    </div>
  );
}
