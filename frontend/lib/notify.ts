// সারা সাইটের notification (glass card) আর নিশ্চিতকরণ বক্স। browser-এর alert/confirm আর
// প্রতিটা পেজের আলাদা কালো বার-এর বদলে এক জায়গা থেকে; দেখায় components/Toaster.tsx।
import { useSyncExternalStore } from "react";

export type NoteKind = "success" | "error" | "info";
export type Note = { id: number; text: string; kind: NoteKind };
export type Ask = {
  title: string;
  text: string;
  ok: string;
  cancel: string;
  danger: boolean;
  resolve: (yes: boolean) => void;
};

let notes: Note[] = [];
let ask: Ask | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const LIFETIME: Record<NoteKind, number> = { success: 3500, info: 4500, error: 7000 };
const MAX_SHOWN = 3;

export function dismiss(id: number) {
  notes = notes.filter((n) => n.id !== id);
  emit();
}

/** ছোট glass notification; কয়েক সেকেন্ড পর নিজে চলে যায়। */
export function notify(text: string, kind: NoteKind = "success") {
  if (!text) return;
  const id = nextId++;
  notes = [...notes.filter((n) => n.text !== text), { id, text, kind }].slice(-MAX_SHOWN);
  emit();
  setTimeout(() => dismiss(id), LIFETIME[kind]);
}
notify.error = (text: string) => notify(text, "error");
notify.info = (text: string) => notify(text, "info");

/** browser-এর confirm()-এর বদলে glass বক্স। হ্যাঁ চাপলে true। */
export function confirmBox(opts: { title: string; text?: string; ok?: string; cancel?: string; danger?: boolean }): Promise<boolean> {
  ask?.resolve(false); // আগের খোলা বক্স থাকলে সেটা "না" ধরে বন্ধ
  return new Promise((resolve) => {
    ask = {
      title: opts.title,
      text: opts.text ?? "",
      ok: opts.ok ?? "হ্যাঁ",
      cancel: opts.cancel ?? "না, থাক",
      danger: opts.danger ?? false,
      resolve: (yes) => {
        ask = null;
        emit();
        resolve(yes);
      },
    };
    emit();
  });
}

const noNotes: Note[] = [];
export const useNotes = () => useSyncExternalStore(subscribe, () => notes, () => noNotes);
export const useAsk = () => useSyncExternalStore(subscribe, () => ask, () => null);
