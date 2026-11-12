"use client";
// সাইটের সব কার্ড একসাথে ধপ করে না এসে, পর্দায় আসার সময় একটার পর একটা নরমভাবে উঠে আসে।
// পাতায় কোনো বদল লাগে না: <main>-এর ভেতরের কার্ড-ধাঁচের জিনিস (গোল কোণা + বর্ডার/ছায়া) নিজেই খুঁজে নেয়,
// পরে ডেটা এসে নতুন কার্ড যোগ হলে সেগুলোও। Web Animations API দিয়ে চলে, তাই DOM-এ কোনো class/attribute
// যোগ হয় না (React-এর hydration-এ গোলমাল হয় না)। শুধু transform/opacity, প্রতিটা কার্ডে একবারই।
import { useEffect } from "react";

const CARD = 'main :is(div,section,article,li,a,details)[class*="rounded-"]:is([class*="border"],[class*="shadow"])';
const FRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(18px) scale(0.985)" },
  { opacity: 1, transform: "none" },
];

export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined" || !Element.prototype.animate) return;

    const seen = new WeakSet<Element>();
    const tracked = new WeakSet<Element>();
    let batch = 0;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          // একই সাথে পর্দায় আসা কার্ডগুলো ৭০ms ফাঁকে ফাঁকে
          e.target.animate(FRAMES, {
            duration: 600,
            delay: Math.min(batch++, 8) * 70,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "backwards",
          });
        }
        clearTimeout(batchTimer);
        batchTimer = setTimeout(() => (batch = 0), 200);
      },
      { rootMargin: "0px 0px -6% 0px" },
    );

    const insideTracked = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (tracked.has(p)) return true;
      return false;
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>(CARD).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        // কার্ডের ভেতরের কার্ড, নিজস্ব animation আছে এমন সারি/panel, আর ভাসমান/স্থির জিনিস বাদ
        if (el.matches(".stagger *, .page-header-in, .page-header-in *") || insideTracked(el)) return;
        const pos = getComputedStyle(el).position;
        if (pos === "fixed" || pos === "sticky") return;
        tracked.add(el);
        io.observe(el);
      });
    };

    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    });
    scan();
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(batchTimer);
    };
  }, []);

  return null;
}
