"use client";
// ছবি ধপ করে না এসে নরমভাবে ফুটে ওঠে: লোড হওয়া পর্যন্ত হালকা চকচকে placeholder, তারপর fade-in।
import { useEffect, useRef, useState } from "react";

export default function FadeImg({ className = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // cache থেকে আসা ছবি hydration-এর আগেই লোড হয়ে যায়, তখন onLoad আর আসে না
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) setLoaded(true);
  }, [props.src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- ছোট static ছবি; alt props-এ আসে
    <img
      ref={ref}
      {...props}
      decoding="async"
      onLoad={(e) => {
        setLoaded(true);
        props.onLoad?.(e);
      }}
      className={`${className} transition-[opacity,transform,filter] duration-700 ease-out ${
        loaded ? "opacity-100 blur-0" : "img-shimmer opacity-0 blur-sm"
      }`}
    />
  );
}
