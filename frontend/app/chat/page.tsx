"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";
import { GIcon, IconText } from "@/components/garden-icons";
import PageHeader from "@/components/PageHeader";
import { CropIcon } from "@/components/crop-icons";
import { loadLocation } from "@/lib/location";
import { api, bnDigits, errorText, whenText, type Plant, type TaskType } from "@/lib/garden";

type Source = { id: string; title: string; publisher: string; url: string; page: number | null; section: string };
type CropPick = { name: string; name_bn: string; suitability: "High" | "Medium" | "Low"; reasons: string[] };
type Tool =
  | { name: "weather"; label_bn: string; status: string; source: string; data: { fetched_at: string; days: { date: string; temp_min: number; temp_max: number; rain_mm: number; rain_prob: number | null }[] } | null }
  | { name: "crops"; label_bn: string; status: string; source: string; data: { inputs: string; picks: Record<string, CropPick[]> } | null }
  | { name: "soil"; label_bn: string; status: string; source: string; data: { soil_type: string; name_bn: string; method_bn: string; texture_bn: string | null; is_mock: boolean; created_at: string; ph_range: [number, number] } | null }
  | { name: "disease"; label_bn: string; status: string; source: string; data: { status: string; prediction?: string; confidence: number | null; is_mock: boolean; message?: string } | null };

type Reply = {
  kind: "answer" | "refusal";
  mode: "ai" | "guide" | "guard" | "learned";
  session_id: number;
  message_id?: number;
  answer: string;
  steps: string[];
  why: string;
  caution: string;
  sources: Source[];
  grounded: boolean;
  coverage: "found" | "limited" | "none";
  needs_more_info: boolean;
  follow_up_question: string;
  proposed_reminder: {
    plant_id: number;
    plant: string;
    task: TaskType;
    task_bn: string;
    every_days: number;
    label: string;
    reason: string;
  } | null;
  tools: Tool[];
  context_used: { plant?: string | null; weather_fetched_at?: string | null; area?: string | null };
  usage?: { remaining_today: number };
};
type Msg =
  | { role: "user"; content: string; image?: string }
  | { role: "assistant"; content: string; reply?: Reply; question?: string; plantId?: number | null; error?: boolean };
type SessionRow = { id: number; title: string; updated_at: string; messages: number };
type Pending = { text: string; image: string | null };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "আসসালামু আলাইকুম! আমি আপনার বাগান সহকারী। গাছের যত্ন, পানি, সার, রোপণ, মাটি, কী লাগাবেন বা রোগ-পোকা নিয়ে প্রশ্ন করুন। পাতার ছবিও দিতে পারেন।",
};

const SUGGESTIONS = ["আজ পানি দেব কি?", "এখন ছাদে কী লাগাব?", "আমার মাটিতে কী ভালো হবে?", "পাতায় দাগ কেন?", "বৃষ্টি হলে কী করব?"];
const MAX_IMAGE = 5 * 1024 * 1024;
const SUIT_BN = { High: "খুব উপযোগী", Medium: "মোটামুটি", Low: "কম উপযোগী" };
const CAT_BN: Record<string, string> = { vegetables: "সবজি", fruits: "ফল", flowers: "ফুল" };

function replyText(r: Reply) {
  return [r.answer, ...r.steps.map((s, i) => `${i + 1}. ${s}`), r.caution].filter(Boolean).join("\n");
}

export default function ChatPage() {
  return (
    <LoginGate next="/chat" why="আপনার গাছ আর মাটির তথ্য মিলিয়ে উত্তর দিতে, আর কথোপকথন আপনার জন্য সেভ রাখতে লগইন লাগে।">
      <Chat />
    </LoginGate>
  );
}

function Chat() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<Pending | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shown = useRef(1); // আগের বার কতগুলো বার্তা দেখানো ছিল
  const fileRef = useRef<HTMLInputElement>(null);

  function loadSessions() {
    api<SessionRow[]>("/chat/sessions").then(setSessions).catch(() => {});
  }

  useEffect(() => {
    api<Plant[]>("/plants").then(setPlants).catch(() => {});
    api<{ remaining_today: number }>("/chat/usage").then((u) => setRemaining(u.remaining_today)).catch(() => {});
    loadSessions();
  }, []);

  // শুধু বার্তার বাক্সের ভেতরে স্ক্রল (scrollIntoView পুরো পাতাও সরিয়ে দিত, তাই Enter চাপলে পাতা লাফাত)
  useEffect(() => {
    const box = listRef.current;
    if (!box) return;
    const added = messages.length - shown.current;
    shown.current = messages.length;
    const last = messages[messages.length - 1];
    if (loading || added > 2) {
      // প্রশ্ন পাঠানো হলো, বা আগের কথোপকথন খোলা হলো: একদম নিচে
      box.scrollTo({ top: box.scrollHeight, behavior: added > 2 ? "auto" : "smooth" });
    } else if (added > 0 && last?.role === "assistant") {
      // উত্তর এলো: উত্তরের শুরুটা দেখান, লম্বা উত্তরের শেষে নয়
      const el = box.children[messages.length - 1] as HTMLElement | undefined;
      if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: "smooth" });
    }
  }, [messages, loading]);

  function newChat() {
    setMessages([WELCOME]);
    setSessionId(null);
    setFailed(null);
    setShowHistory(false);
  }

  async function openSession(id: number) {
    setShowHistory(false);
    setFailed(null);
    try {
      const s = await api<{ id: number; plant_id: number | null; messages: { role: "user" | "assistant"; content: string; reply: Reply | null }[] }>(`/chat/sessions/${id}`);
      const msgs: Msg[] = [WELCOME];
      let lastQ = "";
      for (const m of s.messages) {
        if (m.role === "user") {
          lastQ = m.content;
          msgs.push({ role: "user", content: m.content });
        } else {
          msgs.push({ role: "assistant", content: m.content, reply: m.reply ?? undefined, question: lastQ, plantId: s.plant_id });
        }
      }
      setMessages(msgs);
      setSessionId(s.id);
      setPlantId(s.plant_id);
    } catch (e) {
      setMessages([WELCOME, { role: "assistant", content: errorText(e), error: true }]);
    }
  }

  async function deleteSession(id: number) {
    await api(`/chat/sessions/${id}`, { method: "DELETE" }).catch(() => {});
    if (id === sessionId) newChat();
    loadSessions();
  }

  function pickImage(file: File | undefined) {
    setImageError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("শুধু JPG, PNG বা WEBP ছবি দিন");
      return;
    }
    if (file.size > MAX_IMAGE) {
      setImageError("ছবি ৫MB-এর বেশি হতে পারবে না");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function send(text: string, img: string | null = image, retry = false) {
    const question = text.trim();
    if (!question || loading) return;

    // ব্যর্থ হওয়ার পর "আবার চেষ্টা" করলে প্রশ্নটা দ্বিতীয়বার দেখানো হয় না
    const base = retry ? messages.filter((m) => !(m.role === "assistant" && m.error)) : [...messages, { role: "user" as const, content: question, image: img ?? undefined }];
    setMessages(base);
    setInput("");
    setImage(null);
    setFailed(null);
    setLoading(true);

    try {
      const { lat, lon } = loadLocation();
      const reply = await api<Reply>("/chat", {
        body: { message: question, session_id: sessionId, lat, lon, plant_id: plantId, image_b64: img },
      });
      setMessages([...base, { role: "assistant", content: reply.answer, reply, question, plantId }]);
      setSessionId(reply.session_id);
      if (reply.usage) setRemaining(reply.usage.remaining_today);
      loadSessions();
    } catch (e) {
      setMessages([...base, { role: "assistant", content: errorText(e), error: true }]);
      setFailed({ text: question, image: img });
    } finally {
      setLoading(false);
    }
  }

  const selected = plants.find((p) => p.id === plantId);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader icon="robot" title="AI বাগান সহকারী" subtitle="আপনার গাছ ও আবহাওয়া দেখে উত্তর" />

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        {/* আগের কথোপকথন */}
        <aside className={`${showHistory ? "block" : "hidden"} rounded-3xl border border-green-100 bg-white p-3 shadow-sm lg:block`}>
          <button
            onClick={newChat}
            className="w-full rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            ＋ নতুন কথোপকথন
          </button>
          <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">আগের কথোপকথন</p>
          {sessions.length === 0 ? (
            <p className="px-2 py-3 text-sm text-gray-500">এখনো কিছু নেই।</p>
          ) : (
            <ul className="mt-1 max-h-[55vh] space-y-1 overflow-y-auto">
              {sessions.map((s) => (
                <li key={s.id} className={`group flex items-center rounded-xl ${s.id === sessionId ? "bg-green-50" : "hover:bg-gray-50"}`}>
                  <button onClick={() => openSession(s.id)} className="min-w-0 flex-1 px-2 py-2 text-left">
                    <span className="block truncate text-sm text-gray-800">{s.title || "কথোপকথন"}</span>
                    <span className="block text-xs text-gray-500">{whenText(s.updated_at)}</span>
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    aria-label={`"${s.title}" মুছে ফেলুন`}
                    className="px-2 text-gray-400 hover:text-red-600 focus:text-red-600"
                  >
                    <GIcon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="min-w-0 rounded-3xl border border-green-100 bg-white shadow-sm">
          {/* গাছ বাছাই */}
          <div className="flex flex-wrap items-center gap-2 border-b border-green-100 p-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="rounded-full border border-green-200 px-3 py-1.5 text-sm text-green-800 lg:hidden"
              aria-expanded={showHistory}
            >
              <IconText icon="clock">আগের কথোপকথন</IconText>
            </button>
            {/* কোন গাছ নিয়ে প্রশ্ন: চিপে চাপলে AI সেই গাছের তথ্য (বয়স, টব, মাটি, শেষ পানি) মিলিয়ে উত্তর দেয় */}
            <div role="radiogroup" aria-label="কোন গাছ নিয়ে প্রশ্ন" className="no-scrollbar flex min-w-0 flex-1 basis-full gap-1.5 overflow-x-auto py-0.5 sm:basis-0">
              {[{ id: null as number | null, label: "সাধারণ প্রশ্ন", name: "" }, ...plants.map((p) => ({ id: p.id as number | null, label: p.nickname || p.name_bn || p.name, name: p.name }))].map((c) => {
                const on = plantId === c.id;
                return (
                  <Fragment key={c.id ?? "all"}>
                  {/* প্রথম গাছের আগে ছোট চিহ্ন, যেন বোঝা যায় এগুলো নিজের বাগানের গাছ */}
                  {c.id !== null && c.id === plants[0]?.id && (
                    <span className="flex shrink-0 items-center gap-1 pl-1.5 pr-0.5 text-xs font-semibold text-green-700/70">
                      <span className="h-5 w-px bg-green-200" aria-hidden />
                      <span className="pl-1">আমার গাছ</span>
                    </span>
                  )}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPlantId(c.id)}
                    title={c.id === null ? "যেকোনো বিষয়ে প্রশ্ন" : `আপনার বাগানের এই গাছের টব, মাটি আর পানির তথ্য দেখে উত্তর দেবে`}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3.5 text-sm font-medium transition ${
                      on ? "bg-gradient-to-b from-emerald-500 to-green-600 text-white shadow-sm shadow-green-600/30" : "bg-green-50 text-green-900 hover:bg-green-100"
                    }`}
                  >
                    {c.name ? (
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? "bg-white/90" : "bg-white"}`}>
                        <CropIcon name={c.name} className="h-5 w-5" />
                      </span>
                    ) : (
                      <GIcon name="sprout" className="h-5 w-5" />
                    )}
                    {c.label}
                  </button>
                  </Fragment>
                );
              })}
              {plants.length === 0 && (
                <Link href="/dashboard" className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-green-300 px-3.5 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50">
                  <GIcon name="plus" className="h-4 w-4" /> নিজের গাছ যোগ করুন
                </Link>
              )}
            </div>
          </div>

          <div ref={listRef} className="relative h-[60vh] min-h-[380px] space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5" aria-live="polite">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex flex-col items-end gap-1">
                  {m.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- local data: preview
                    <img src={m.image} alt="আপনার দেওয়া ছবি" className="max-h-40 rounded-2xl border border-green-100" />
                  )}
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-green-600 px-4 py-2 text-sm leading-relaxed text-white">
                    {m.content}
                  </div>
                </div>
              ) : m.reply ? (
                <AnswerCard key={i} reply={m.reply} question={m.question ?? ""} plantId={m.plantId ?? null} />
              ) : (
                <div key={i} className="flex justify-start">
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm px-4 py-2 text-sm leading-relaxed ${
                      m.error ? "bg-red-50 text-red-800" : "bg-green-50 text-gray-800"
                    }`}
                  >
                    {m.content}
                    {m.error && failed && i === messages.length - 1 && (
                      <button
                        onClick={() => send(failed.text, failed.image, true)}
                        className="mt-2 block rounded-full bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800"
                      >
                        <IconText icon="refresh" iconClass="h-3.5 w-3.5">আবার চেষ্টা করুন</IconText>
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="animate-pulse rounded-2xl rounded-bl-sm bg-green-50 px-4 py-2 text-sm text-gray-500">
                  গাইড, আপনার বাগান আর আবহাওয়া দেখে উত্তর লিখছে...
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-green-100 px-4 pt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(selected ? `${selected.nickname || selected.name_bn || selected.name}: ${s}` : s)}
                disabled={loading}
                className="rounded-full border border-green-200 bg-white px-3 py-1 text-sm text-green-800 hover:bg-green-50 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {(image || imageError) && (
            <div className="flex items-center gap-3 px-4 pt-3">
              {image && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data: preview */}
                  <img src={image} alt="পাঠানোর জন্য বাছাই করা ছবি" className="h-16 w-16 rounded-xl object-cover" />
                  <button onClick={() => setImage(null)} className="text-sm text-gray-600 underline">
                    ছবি বাদ দিন
                  </button>
                </>
              )}
              {imageError && <p className="text-sm text-red-700">{imageError}</p>}
            </div>
          )}

          <form
            className="m-3 flex items-end gap-1.5 rounded-[1.75rem] border border-green-200 bg-white p-1.5 shadow-sm transition focus-within:border-green-400 focus-within:ring-4 focus-within:ring-green-100 sm:m-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={fileRef}
              id="chat-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="পাতার ছবি যোগ করুন"
              title="পাতার ছবি যোগ করুন"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-green-700 transition hover:bg-green-50"
            >
              <GIcon name="camera" className="h-5 w-5 text-green-700" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              aria-label="আপনার প্রশ্ন"
              placeholder={
                selected
                  ? `${selected.nickname || selected.name_bn || selected.name} নিয়ে প্রশ্ন লিখুন...`
                  : image
                    ? "ছবিটা নিয়ে কী জানতে চান লিখুন..."
                    : "আপনার প্রশ্ন লিখুন..."
              }
              maxLength={2000}
              className="no-scrollbar max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="পাঠান"
              className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-green-600 px-3 font-semibold text-white shadow-sm shadow-green-600/30 transition hover:shadow-md disabled:opacity-40 sm:px-5"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
              <span className="hidden sm:inline">পাঠান</span>
            </button>
          </form>
          {remaining !== null && (
            <p className="px-4 pb-3 text-right text-xs text-gray-500">আজ আর {bnDigits(remaining)}টা প্রশ্ন করতে পারবেন</p>
          )}
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-gray-500">
        <GIcon name="info" className="h-4 w-4 text-green-600" />
        AI ভুল করতে পারে, ওষুধের আগে কৃষি অফিসে জেনে নেবেন
      </p>
    </main>
  );
}

/** আমাদের সিস্টেমের আসল ফল (AI-এর পরামর্শ থেকে আলাদা করে দেখানো) */
function ToolResults({ tools }: { tools: Tool[] }) {
  const shown = tools.filter((t) => t.status === "ok" || t.status === "failed" || t.name === "soil");
  if (shown.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500"><IconText icon="wrench">সিস্টেমের ফল (AI-এর লেখা নয়)</IconText></p>
      {shown.map((t) => (
        <div key={t.name} className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700">
          <p className="font-semibold text-gray-900">
            {t.label_bn}
            {t.source && <span className="font-normal text-gray-500"> · {t.source}</span>}
          </p>
          {t.status === "failed" && <p className="mt-1 text-amber-800">এখন পাওয়া যায়নি, তাই এই তথ্য ছাড়াই উত্তর দেওয়া হয়েছে।</p>}
          {t.status === "empty" && t.name === "soil" && (
            <p className="mt-1">
              এখনো কোনো মাটির রিপোর্ট নেই।{" "}
              <Link href="/soil" className="text-green-700 underline">
                মাটি পরীক্ষা করে রিপোর্ট বানান
              </Link>
            </p>
          )}
          {t.status === "ok" && t.name === "weather" && t.data && (
            <ul className="mt-1 grid grid-cols-3 gap-2 tabular-nums">
              {t.data.days.map((d) => (
                <li key={d.date} className="rounded-xl bg-sky-50 p-2">
                  <span className="block text-gray-500">{d.date.slice(5)}</span>
                  {d.temp_min}–{d.temp_max}°C
                  <span className="block"><GIcon name="rain" className="h-3.5 w-3.5 text-sky-600" /> {d.rain_mm} মিমি{d.rain_prob !== null ? ` · ${d.rain_prob}%` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {t.status === "ok" && t.name === "crops" && t.data && (
            <>
              <div className="mt-1 space-y-1">
                {Object.entries(t.data.picks)
                  .filter(([, items]) => items.length)
                  .map(([cat, items]) => (
                    <p key={cat}>
                      <span className="font-medium">{CAT_BN[cat] ?? cat}: </span>
                      {items.map((c) => `${c.name_bn} (${SUIT_BN[c.suitability]})`).join(", ")}
                    </p>
                  ))}
              </div>
              <p className="mt-1 text-gray-500">ইনপুট: {t.data.inputs}</p>
            </>
          )}
          {t.status === "ok" && t.name === "soil" && t.data && (
            <p className="mt-1">
              {t.data.texture_bn ?? t.data.name_bn} · {t.data.method_bn} · সাধারণ pH{" "}
              {t.data.ph_range[0]}–{t.data.ph_range[1]} · {t.data.created_at}
              {t.data.is_mock && <MockBadge />}
            </p>
          )}
          {t.status === "ok" && t.name === "disease" && t.data && (
            <p className="mt-1">
              {t.data.status === "unavailable" ? (
                <>
                  {t.data.message}{" "}
                  <Link href="/disease" className="font-semibold text-green-700 underline">
                    রোগ ডায়েরি
                  </Link>
                </>
              ) : (
                <>
                  {t.data.status === "uncertain"
                    ? `নিশ্চিত নয় (নির্ভরযোগ্যতা ${Math.round((t.data.confidence ?? 0) * 100)}%)`
                    : `সম্ভাব্য: ${t.data.prediction} (নির্ভরযোগ্যতা ${Math.round((t.data.confidence ?? 0) * 100)}%)`}
                  {t.data.is_mock && <MockBadge />}
                </>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function MockBadge() {
  return (
    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
      নমুনা মডেল, আসল ফল নয়
    </span>
  );
}

function AnswerCard({ reply: r, question, plantId }: { reply: Reply; question: string; plantId: number | null }) {
  const [reminderState, setReminderState] = useState<"idle" | "saving" | "saved" | "dismissed">("idle");
  const [reminderError, setReminderError] = useState("");
  const [vote, setVote] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const c = r.context_used ?? {};

  if (r.kind === "refusal") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <GIcon name="sprout" className="mr-1 h-4 w-4 text-green-600" />{r.answer}
        </div>
      </div>
    );
  }

  async function addReminder() {
    if (!r.proposed_reminder) return;
    setReminderState("saving");
    setReminderError("");
    try {
      const p = r.proposed_reminder;
      await api(`/plants/${p.plant_id}/reminders`, { body: { task: p.task, label: p.label, every_days: p.every_days } });
      setReminderState("saved");
    } catch (e) {
      setReminderError(errorText(e));
      setReminderState("idle");
    }
  }

  async function sendFeedback(helpful: boolean, why = "") {
    setVote(helpful);
    try {
      await api("/chat/feedback", {
        // message_id থাকলে সার্ভার নিজের রাখা উত্তর থেকে শেখে (শেখার খাতা); পুরোনো উত্তরে লেখাটাই যায়
        body: { message_id: r.message_id ?? null, question, answer: replyText(r), helpful, reason: why, source_ids: r.sources.map((s) => s.id), plant_id: plantId },
      });
      if (helpful || why) setFeedbackSent(true);
    } catch {
      // ফিডব্যাক না গেলে চ্যাট থামানোর দরকার নেই
    }
  }

  const used = [
    c.plant && `${c.plant} গাছের তথ্য`,
    c.weather_fetched_at && `${c.area ?? "আপনার এলাকার"} আবহাওয়া (${whenText(c.weather_fetched_at)} আনা)`,
  ].filter(Boolean);

  return (
    <article className="max-w-[95%] rounded-2xl rounded-bl-sm border border-green-100 bg-green-50/60 p-4 text-sm leading-relaxed text-gray-800">
      {r.mode === "learned" && (
        <p className="mb-2 inline-block rounded-full bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-900">
          <GIcon name="spark" className="mr-1 h-3.5 w-3.5" />শেখার খাতা থেকে: আগে অন্যরা এই উত্তর কাজের বলেছে
        </p>
      )}
      {r.mode === "guide" && (
        <p className="mb-2 inline-block rounded-full bg-sky-100 px-3 py-0.5 text-xs font-semibold text-sky-900">
          <GIcon name="book" className="mr-1 h-3.5 w-3.5" />AI ছাড়া, আমাদের গাইড থেকে
        </p>
      )}
      <p className="text-base font-medium text-gray-900">{r.answer}</p>

      {r.steps.length > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-green-900">{r.mode === "guide" ? "যা পাওয়া গেছে" : "করণীয়"}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {r.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {r.why && (
        <p className="mt-3">
          <span className="font-semibold text-green-900">কেন: </span>
          {r.why}
        </p>
      )}

      {r.caution && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900"><GIcon name="warning" className="mr-1.5 h-4 w-4" />{r.caution}</p>}

      {r.needs_more_info && r.follow_up_question && (
        <p className="mt-3 rounded-xl bg-white p-3 text-gray-700">
          <span className="font-semibold"><GIcon name="question" className="mr-1 h-4 w-4 text-sky-600" />আরেকটু জানা দরকার: </span>
          {r.follow_up_question}
        </p>
      )}

      <ToolResults tools={r.tools ?? []} />

      {/* উৎস */}
      <div className="mt-3 border-t border-green-100 pt-3">
        {r.grounded ? (
          <>
            <p className="text-xs font-semibold text-green-900">
              <GIcon name="books" className="mr-1 h-3.5 w-3.5" />তথ্যের উৎস {r.coverage === "limited" && <span className="font-normal text-amber-700">(সীমিত মিল)</span>}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
              {r.sources.map((s) => (
                <li key={s.id}>
                  [{s.id}]{" "}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-green-700 underline">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                  {s.publisher && ` · ${s.publisher}`}
                  {s.page ? ` · পৃষ্ঠা ${s.page}` : s.section ? ` · ${s.section}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-amber-800">
            <GIcon name="warning" className="mr-1 h-3.5 w-3.5" />আমাদের গাইডে এই প্রশ্নের নির্ভরযোগ্য উৎস পাওয়া যায়নি। এটা সাধারণ পরামর্শ, যাচাই করে নেবেন।
          </p>
        )}
        {used.length > 0 && <p className="mt-1 text-xs text-gray-500">এই উত্তরে ব্যবহার হয়েছে: {used.join(" · ")}</p>}
      </div>

      {/* প্রস্তাবিত রিমাইন্ডার: ইউজার নিশ্চিত না করলে কিছু বদলায় না */}
      {r.proposed_reminder && reminderState !== "dismissed" && (
        <div className="mt-3 rounded-xl border border-green-200 bg-white p-3">
          {reminderState === "saved" ? (
            <p className="text-green-800">
              <GIcon name="tick" className="mr-1 h-4 w-4" />রিমাইন্ডার যোগ হয়েছে।{" "}
              <Link href={`/dashboard/plants/${r.proposed_reminder.plant_id}`} className="underline">
                গাছের পেজে দেখুন
              </Link>
            </p>
          ) : (
            <>
              <p>
                <GIcon name="clock" className="mr-1 h-4 w-4" /><b>{r.proposed_reminder.plant}</b>: {r.proposed_reminder.task_bn},{" "}
                {r.proposed_reminder.every_days > 0 ? `প্রতি ${r.proposed_reminder.every_days} দিনে` : "একবার"}। যোগ করব?
              </p>
              {reminderError && <p className="mt-1 text-xs text-red-700">{reminderError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={addReminder}
                  disabled={reminderState === "saving"}
                  className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {reminderState === "saving" ? "যোগ হচ্ছে..." : "হ্যাঁ, যোগ করুন"}
                </button>
                <button onClick={() => setReminderState("dismissed")} className="rounded-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                  না
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ফিডব্যাক */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {feedbackSent ? (
          <span>ধন্যবাদ! আপনার মত থেকে সহকারী শেখে, পরের উত্তর আরো ভালো হবে।</span>
        ) : (
          <>
            <span>উত্তরটা কাজে লেগেছে?</span>
            <button
              onClick={() => sendFeedback(true)}
              aria-pressed={vote === true}
              className={`rounded-full px-2 py-1 ring-1 ring-gray-200 hover:bg-white ${vote === true ? "bg-green-100" : ""}`}
            >
              <IconText icon="thumb" iconClass="h-4 w-4 text-green-700">হ্যাঁ</IconText>
            </button>
            <button
              onClick={() => setVote(false)}
              aria-pressed={vote === false}
              className={`rounded-full px-2 py-1 ring-1 ring-gray-200 hover:bg-white ${vote === false ? "bg-red-50" : ""}`}
            >
              <IconText icon="thumbDown" iconClass="h-4 w-4 text-red-600">না</IconText>
            </button>
          </>
        )}
      </div>
      {vote === false && !feedbackSent && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendFeedback(false, reason.trim() || "কারণ লেখা হয়নি");
          }}
        >
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="উত্তরে কী ভুল বা কী বাদ ছিল?"
            aria-label="উত্তরে কী ভুল ছিল"
            className="flex-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-green-500"
          />
          <button className="rounded-full bg-gray-800 px-3 py-1.5 text-xs text-white">পাঠান</button>
        </form>
      )}
    </article>
  );
}
