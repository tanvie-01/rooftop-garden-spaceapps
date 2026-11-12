"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/lib/garden";
import type { Profile } from "@/lib/community";

type Me = { profile: Profile | null; uploads_ready: boolean };

/** নিজের কমিউনিটি প্রোফাইল (না থাকলে null) */
export function useCommunityMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    api<Me>("/community/me").then(setMe).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(reload, [reload]);
  const setProfile = (profile: Profile) => setMe((m) => ({ uploads_ready: m?.uploads_ready ?? true, profile }));
  return { me, error, setProfile };
}
