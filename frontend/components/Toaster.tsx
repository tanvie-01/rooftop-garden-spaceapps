"use client";
import { useEffect, useRef } from "react";
import { dismiss, useAsk, useNotes, type NoteKind } from "@/lib/notify";
import { GIcon, type GIconName } from "@/components/garden-icons";

const GLASS =
  "border border-white/70 bg-gradient-to-br from-white/85 to-white/55 backdrop-blur-xl " +
  "shadow-[0_12px_40px_-12px_rgba(20,83,45,0.35),inset_0_1px_0_rgba(255,255,255,0.9)]";

const KIND: Record<NoteKind, { icon: GIconName; dot: string }> = {
  success: { icon: "tick", dot: "from-emerald-400 to-green-600" },
  info: { icon: "info", dot: "from-sky-400 to-blue-600" },
  error: { icon: "warning", dot: "from-rose-400 to-red-600" },
};

function Notes() {
  const notes = useNotes();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-36 sm:items-end"
    >
      {notes.map((n) => (
        <div
          key={n.id}
          role={n.kind === "error" ? "alert" : "status"}
          className={`glass-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm text-gray-800 ${GLASS}`}
        >
          <span
            aria-hidden
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow ${KIND[n.kind].dot}`}
          >
            <GIcon name={KIND[n.kind].icon} className="h-3.5 w-3.5" />
          </span>
          <p className="flex-1 leading-relaxed">{n.text}</p>
          <button onClick={() => dismiss(n.id)} aria-label="বন্ধ করুন" className="-mr-1 rounded-full px-1.5 text-gray-400 hover:text-gray-700">
            <GIcon name="x" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmBox() {
  const ask = useAsk();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ask) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && ask.resolve(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ask]);

  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-green-950/20 p-4 backdrop-blur-sm" onClick={() => ask.resolve(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className={`glass-in w-full max-w-sm rounded-3xl p-6 ${GLASS}`}
      >
        <p id="confirm-title" className="text-lg font-bold text-gray-900">
          {ask.title}
        </p>
        {ask.text && <p className="mt-2 text-sm leading-relaxed text-gray-600">{ask.text}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => ask.resolve(false)}
            className="rounded-full border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
          >
            {ask.cancel}
          </button>
          <button
            ref={okRef}
            onClick={() => ask.resolve(true)}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${
              ask.danger ? "bg-red-600 shadow-red-600/30 hover:bg-red-700" : "bg-green-600 shadow-green-600/30 hover:bg-green-700"
            }`}
          >
            {ask.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Toaster() {
  return (
    <>
      <Notes />
      <ConfirmBox />
    </>
  );
}
