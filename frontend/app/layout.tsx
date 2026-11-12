import type { Metadata } from "next";
import { Baloo_Da_2, Fredoka, Hind_Siliguri } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Toaster from "@/components/Toaster";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";

const font = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
});

// লোগো আর ইউজারের নামের জন্য গোলগাল ইংরেজি ফন্ট; বাংলা অক্ষর Hind Siliguri-তেই থাকে
// শিরোনাম: Fredoka-র সাথে মানানসই গোলগাল বাংলা (Baloo Da 2); সাধারণ লেখা পড়ার সুবিধায় Hind Siliguri-তেই
const head = Baloo_Da_2({ subsets: ["bengali", "latin"], weight: ["500", "600", "700", "800"], variable: "--font-head" });
const brand = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-brand" });

// Hind Siliguri-র "১" ছোট একটা বাঁকা দাগের মতো, "১৪" পড়লে "\৪" মনে হয়। তাই শুধু বাংলা অঙ্ক ০-৯ (U+09E6-09EF)
// Noto Sans Bengali (OFL) থেকে কেটে নেওয়া ছোট ফাইলে; বাকি সব অক্ষর আগের মতোই Hind Siliguri-তে।
const digits = localFont({
  src: [
    { path: "./fonts/bn-digits-400.woff2", weight: "400" },
    { path: "./fonts/bn-digits-500.woff2", weight: "500" },
    { path: "./fonts/bn-digits-600.woff2", weight: "600" },
    { path: "./fonts/bn-digits-700.woff2", weight: "700" },
  ],
  display: "swap",
  fallback: [],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Rooftop Garden | ছাদবাগানের স্মার্ট সহকারী",
  description:
    "NASA ডেটা ও AI দিয়ে ছাদবাগানের ফসল, আবহাওয়া, মাটি ও রোগ নিয়ে পরামর্শ।",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" className={`${font.variable} ${brand.variable} ${head.variable}`}>
      <body className="antialiased" style={{ fontFamily: `${digits.style.fontFamily}, ${font.style.fontFamily}` }}>
        <Navbar />
        <Toaster />
        <Reveal />
        {children}
        <Footer />
      </body>
    </html>
  );
}