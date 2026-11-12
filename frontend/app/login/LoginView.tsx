"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { refreshAuth, useAuth } from "@/lib/auth";
import { GIcon, type GIconName } from "@/components/garden-icons";
import { API } from "@/lib/location";

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, o: Record<string, string | number>) => void;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleId;
  }
}

type Config = { google_client_id: string; dev_login: boolean };

const FEATURES: { icon: GIconName; title: string }[] = [
  { icon: "sprout", title: "এই মাসে কী লাগাবেন" },
  { icon: "cloudSun", title: "আবহাওয়ার সতর্কতা" },
  { icon: "hand", title: "মাটি পরীক্ষা" },
  { icon: "chat", title: "বাংলায় AI সহকারী" },
];
const GSI_SRC = "https://accounts.google.com/gsi/client";

// শুধু নিজের সাইটের ভেতরের পথে ফেরত পাঠানো হয় ("//evil.com" নয়)
function safeNext(n: string | null) {
  // শুধু নিজের সাইটের পথ। "//evil.com" বা "/\evil.com" ব্রাউজার অন্য সাইট হিসেবে পড়ে।
  return n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") && !/[\u0000-\u001f]/.test(n)
    ? n
    : "/dashboard";
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}/api/auth/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "লগইন করা যায়নি");
}

export default function LoginView() {
  const auth = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/auth/config`)
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("সার্ভারে পৌঁছানো যাচ্ছে না। ইন্টারনেট সংযোগ দেখে পেজটা আবার খুলুন।"));
  }, []);

  useEffect(() => {
    if (auth.status === "in") router.replace(next);
  }, [auth.status, next, router]);

  useEffect(() => {
    const clientId = config?.google_client_id;
    if (!clientId) return;

    async function onCredential(r: { credential: string }) {
      setBusy(true);
      setError("");
      try {
        await post("google", { credential: r.credential });
        await refreshAuth();
      } catch (e) {
        setError(e instanceof Error ? e.message : "লগইন করা যায়নি");
      } finally {
        setBusy(false);
      }
    }

    function render() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId!, callback: onCredential });
      buttonRef.current.innerHTML = "";
      // ছোট ফোনে ৩০০px-এর বোতাম জায়গা পায় না, তখন Google বোতামই আঁকে না
      const room = buttonRef.current.parentElement?.clientWidth ?? 300;
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "bn",
        width: Math.max(200, Math.min(300, room)),
      });
    }

    if (window.google) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    const s = script;
    return () => s.removeEventListener("load", render);
  }, [config]);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("dev", { email: devEmail.trim() });
      await refreshAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "লগইন করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate overflow-hidden px-4 py-10 sm:px-5 md:py-16">
      {/* পেছনের নরম রঙের আভা */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute -right-24 top-40 h-96 w-96 rounded-full bg-lime-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-teal-100/60 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        {/* লগইন করলে কী পাওয়া যায় */}
        <section className="order-last md:order-none">
          <h2 className="text-3xl font-bold leading-tight text-green-950 md:text-5xl">
            আপনার ছাদ,
            <br />
            <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">সবুজ বাগান</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-gray-600">কী লাগাবেন, কখন পানি দেবেন, মাটি কেমন: সব এক জায়গায়।</p>
          <ul className="mt-6 grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-3 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-emerald-50 text-green-700">
                  <GIcon name={f.icon} className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold leading-snug text-gray-900">{f.title}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* লগইন কার্ড; ফোনে আগে */}
        <section className="order-first rounded-[2rem] border border-white bg-white/85 p-6 text-center shadow-2xl shadow-green-900/10 backdrop-blur-xl sm:p-9 md:order-none">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-50 to-emerald-100 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG logo */}
            <img src="/icon.svg" alt="" width={56} height={56} className="h-14 w-14 drop-shadow" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-green-950 sm:text-3xl">স্বাগতম <GIcon name="hello" className="h-7 w-7 text-green-600" /></h1>
          <p className="mt-2 text-lg text-gray-600">Gmail দিয়ে এক ক্লিকে ঢুকুন</p>

          <div className="mt-7 flex min-h-11 justify-center">
            {config?.google_client_id ? (
              <div ref={buttonRef} aria-label="Google দিয়ে লগইন" />
            ) : config ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">লগইন এই মুহূর্তে বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।</p>
            ) : error ? null : (
              <span className="h-11 w-full max-w-[300px] animate-pulse rounded-full bg-gray-100" />
            )}
          </div>

          {busy && <p className="mt-3 text-sm text-gray-500">লগইন হচ্ছে...</p>}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

          <Link
            href="/crops"
            className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-semibold text-green-700 transition hover:bg-green-50"
          >
            <GIcon name="leaf" className="h-5 w-5" /> লগইন ছাড়াই ফসল পরামর্শ দেখুন <span aria-hidden>→</span>
          </Link>

          {config?.dev_login && (
            <details className="mt-5 text-left">
              <summary className="cursor-pointer text-xs text-gray-400">ডেভেলপার লগইন</summary>
              <form onSubmit={devLogin} className="mt-2 flex gap-2">
                <input
                  id="dev-email"
                  type="email"
                  required
                  aria-label="টেস্ট ইমেইল"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  placeholder="test@gmail.com"
                  className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-green-500"
                />
                <button disabled={busy} className="rounded-full bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50">
                  ঢুকুন
                </button>
              </form>
            </details>
          )}

        </section>
      </div>
    </main>
  );
}
