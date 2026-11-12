"use client";
import { useSyncExternalStore } from "react";
import { API } from "@/lib/location";

/** লগইন করা ইউজার। লগইনের তথ্য থাকে backend-এর httpOnly cookie-তে; এখানে শুধু কে লগইন আছে। */
export type User = { id: number; email: string; name: string; picture: string };
export type AuthState = { status: "loading" } | { status: "out" } | { status: "in"; user: User };

let state: AuthState = { status: "loading" };
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshAuth() {
  try {
    const res = await fetch(`${API}/api/auth/session`, { credentials: "include" });
    const user: User | null = res.ok ? (await res.json()).user : null;
    set(user ? { status: "in", user } : { status: "out" });
  } catch {
    set({ status: "out" });
  }
}

export async function logout() {
  await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  set({ status: "out" });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!started) {
    started = true;
    refreshAuth();
  }
  return () => listeners.delete(onChange);
}

const LOADING: AuthState = { status: "loading" };

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
