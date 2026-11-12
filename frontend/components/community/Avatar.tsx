import { avatarName, avatarSrc, bgCss } from "@/lib/community";

const SIZES = { xs: "h-8 w-8 p-1", sm: "h-10 w-10 p-1.5", md: "h-14 w-14 p-2", lg: "h-24 w-24 p-3", xl: "h-32 w-32 p-4" };

/** গোল অবতার: পটভূমির রঙের ওপর বাছাই করা সবজি/ফল/ফুলের ছবি */
export default function Avatar({
  avatar,
  background,
  size = "sm",
  ring = false,
}: {
  avatar: string;
  background: string;
  size?: keyof typeof SIZES;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ${SIZES[size]} ${ring ? "ring-4 ring-white" : ""}`}
      style={{ background: bgCss(background) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ছোট static অবতার */}
      <img src={avatarSrc(avatar)} alt={avatarName(avatar)} className="h-full w-full object-contain drop-shadow" />
    </span>
  );
}
