"use client";
import { useState } from "react";
import Avatar from "@/components/community/Avatar";
import { GIcon } from "@/components/garden-icons";
import { api, errorText } from "@/lib/garden";
import { AVATAR_GROUPS, AVATAR_STYLES, AVATARS, BACKGROUNDS, avatarSrc, bgCss, nameError, type Profile } from "@/lib/community";

const STEPS = ["অবতার", "পটভূমি", "নাম"];

/** প্রথমবার (বা সম্পাদনায়): অবতার -> পটভূমি -> এক শব্দের নাম, সবসময় পাশে প্রিভিউ */
export default function ProfileSetup({ initial, onSaved, onCancel }: { initial?: Profile; onSaved: (p: Profile) => void; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<"3d" | "flat">((initial?.avatar.endsWith("-flat") ? "flat" : "3d"));
  const [group, setGroup] = useState(AVATAR_GROUPS[0].id);
  const [avatar, setAvatar] = useState(initial?.avatar ?? "");
  const [background, setBackground] = useState(initial?.background ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const base = avatar.split(/-(?=[^-]+$)/)[0];
  const bgShown = background || (base ? AVATARS[base].bg : "meadow");
  const err = nameError(name);

  function pick(a: string) {
    setAvatar(`${a}-${style}`);
    if (!initial && !background) setBackground(AVATARS[a].bg); // মানানসই পটভূমি আগে থেকে বাছা থাকে
  }

  async function save() {
    if (err) return setError(err);
    setBusy(true);
    setError("");
    try {
      onSaved(await api<Profile>("/community/me", { method: "PUT", body: { avatar, background: bgShown, name: name.trim() } }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const items = AVATAR_GROUPS.find((g) => g.id === group)!.items;
  return (
    <section className="overflow-hidden rounded-[2rem] border border-green-100 bg-white shadow-xl shadow-green-900/5">
      <div className="grid md:grid-cols-[280px_1fr]">
        {/* প্রিভিউ */}
        <aside
          className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-white transition-[background] duration-500"
          style={{ background: avatar ? bgCss(bgShown) : "linear-gradient(135deg,#dcfce7,#bbf7d0)" }}
        >
          {avatar ? (
            <>
              <Avatar avatar={avatar} background={bgShown} size="xl" ring />
              <p className="max-w-full truncate rounded-full bg-black/30 px-4 py-1 text-lg font-bold backdrop-blur">{name.trim() || "আপনার নাম"}</p>
            </>
          ) : (
            <div className="text-center text-green-900">
              <GIcon name="sprout" className="mx-auto h-14 w-14 text-green-600" />
              <p className="mt-2 font-semibold">একটা অবতার বেছে নিন</p>
              <p className="text-sm text-green-700">নিজের ছবি লাগবে না</p>
            </div>
          )}
        </aside>

        <div className="p-5 sm:p-7">
          <ol className="flex gap-2 text-sm" aria-label="ধাপ">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <button
                  onClick={() => (i === 0 || avatar) && (i < 2 || avatar) && setStep(i)}
                  aria-current={step === i ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${step === i ? "bg-green-600 text-white" : i < step ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}
                >
                  <span className="font-bold">{(i + 1).toLocaleString("bn-BD")}</span> {s}
                </button>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="mt-5">
              <h2 className="text-xl font-bold text-green-950">আপনার অবতার বাছুন</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {AVATAR_GROUPS.map((g) => (
                  <button key={g.id} onClick={() => setGroup(g.id)} aria-pressed={group === g.id} className={`rounded-full px-3 py-1 text-sm ${group === g.id ? "bg-green-600 text-white" : "border border-green-100 text-green-900 hover:bg-green-50"}`}>
                    {g.label}
                  </button>
                ))}
                <span className="ml-auto flex overflow-hidden rounded-full border border-green-200 text-xs" role="group" aria-label="স্টাইল">
                  {AVATAR_STYLES.map((s) => (
                    <button
                      key={s.id}
                      aria-pressed={style === s.id}
                      onClick={() => {
                        setStyle(s.id);
                        if (avatar) setAvatar(`${base}-${s.id}`);
                      }}
                      className={`px-3 py-1 ${style === s.id ? "bg-green-600 text-white" : "text-green-800"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </span>
              </div>
              <ul className="mt-4 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-8">
                {items.map((a) => {
                  const id = `${a}-${style}`;
                  return (
                    <li key={a}>
                      <button
                        onClick={() => pick(a)}
                        aria-pressed={avatar === id}
                        title={AVATARS[a].bn}
                        className={`flex w-full flex-col items-center rounded-2xl border-2 p-2 transition hover:-translate-y-0.5 ${avatar === id ? "border-green-600 bg-green-50" : "border-transparent hover:bg-green-50/60"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- ছোট static অবতার */}
                        <img src={avatarSrc(id)} alt="" loading="lazy" className="h-12 w-12 object-contain" />
                        <span className="mt-1 line-clamp-1 text-[11px] text-gray-600">{AVATARS[a].bn}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="mt-5">
              <h2 className="text-xl font-bold text-green-950">পটভূমি বাছুন</h2>
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {BACKGROUNDS.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => setBackground(b.id)} aria-pressed={bgShown === b.id} className={`w-full rounded-2xl border-2 p-1 ${bgShown === b.id ? "border-green-600" : "border-transparent"}`}>
                      <span className="flex h-16 items-center justify-center rounded-xl" style={{ background: b.css }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- ছোট static অবতার */}
                        <img src={avatarSrc(avatar)} alt="" className="h-9 w-9 object-contain drop-shadow" />
                      </span>
                      <span className="mt-1 block text-xs text-gray-600">{b.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 2 && (
            <div className="mt-5">
              <h2 className="text-xl font-bold text-green-950">আপনার নাম</h2>
              <p className="text-sm text-gray-500">এক শব্দে, বাংলা বা ইংরেজিতে। অন্য কারও একই নাম থাকলেও সমস্যা নেই।</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                autoFocus
                placeholder="যেমন: ছাদবাগানী, Gardener"
                className="mt-3 w-full rounded-2xl border border-green-200 px-4 py-3 text-lg outline-none focus:border-green-500"
              />
              {name && err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
            </div>
          )}

          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

          <div className="mt-6 flex items-center gap-3">
            {onCancel && (
              <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                বাতিল
              </button>
            )}
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-full border border-green-200 px-5 py-2.5 text-green-800 hover:bg-green-50">
                ← আগে
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => setStep(step + 1)} disabled={!avatar} className="ml-auto rounded-full bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-40">
                পরের ধাপ →
              </button>
            ) : (
              <button onClick={save} disabled={busy || !!err} className="ml-auto rounded-full bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-40">
                {busy ? "সেভ হচ্ছে..." : initial ? "সেভ করুন" : "প্রোফাইল তৈরি করুন"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
