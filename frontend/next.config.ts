import type { NextConfig } from "next";

// Content-Security-Policy: কোনো XSS bug থেকে গেলেও বাইরের অচেনা সাইট থেকে script চালানো বা ডেটা পাঠানো আটকায়।
// Next.js পেজে নিজের inline script বসায় (nonce ছাড়া static পেজে), তাই script-এ 'unsafe-inline' রাখতে হচ্ছে;
// তবু বাইরের script শুধু Google লগইন থেকে, আর plugin/base/form অন্যত্র যাওয়া বন্ধ।
const isDev = process.env.NODE_ENV !== "production";
const api = process.env.NEXT_PUBLIC_API_URL ?? (isDev ? "http://localhost:8000" : "");
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co"; // কমিউনিটির ছবি
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  // মানচিত্রের টাইল, Google প্রোফাইল ছবি, কমিউনিটির ছবি, ছবি আপলোডের preview (blob:)
  `img-src 'self' data: blob: https://tile.openstreetmap.org https://*.googleusercontent.com ${supabase} ${api}`.trim(),
  `connect-src 'self' https://accounts.google.com/gsi/ ${api}${isDev ? " ws://localhost:*" : ""}`.trim(),
  "frame-src https://accounts.google.com/gsi/",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // অন্য সাইট যেন আমাদের পেজ iframe-এ বসিয়ে ক্লিক চুরি করতে না পারে
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Google লগইনের popup চলার জন্য "allow-popups" লাগে
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // অবস্থান (আবহাওয়ার GPS বোতাম) শুধু নিজের সাইট চাইতে পারে
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
