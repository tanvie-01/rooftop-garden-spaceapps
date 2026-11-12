import { GIcon, type GIconName } from "@/components/garden-icons";
import HeaderScene, { type Scene } from "@/components/HeaderScene";

// কোন পাতায় কোন দৃশ্য (আবহাওয়া পাতা নিজে আজকের পূর্বাভাস দেখে scene পাঠায়)
const SCENE_FOR: Partial<Record<GIconName, Scene>> = {
  home: "garden",
  cloudSun: "sun",
  soil: "soil",
  leaf: "crops",
  refresh: "rotation",
  book: "disease",
  calendar: "plan",
  robot: "chat",
};

export default function PageHeader({
  icon,
  title,
  subtitle,
  scene,
}: {
  icon: GIconName;
  title: string;
  subtitle: string;
  scene?: Scene;
}) {
  const s = scene ?? SCENE_FOR[icon];
  return (
    <div className="page-header-in panel-flow relative mb-8 overflow-hidden rounded-3xl p-8 text-white shadow-lg">
      {s && <HeaderScene scene={s} />}
      <div className="relative max-w-[70%] sm:max-w-none">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/40 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur">
          <GIcon name={icon} className="h-8 w-8 text-white" />
        </span>
        <h1 className="mt-3 text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-green-50">{subtitle}</p>
      </div>
    </div>
  );
}
