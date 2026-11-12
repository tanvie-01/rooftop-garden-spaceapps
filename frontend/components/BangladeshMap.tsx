"use client";
// Leaflet শুধু ব্রাউজারে চলে, তাই এই কম্পোনেন্ট dynamic(..., { ssr: false }) দিয়ে আনতে হবে।
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { upazilaKey, type Boundaries, type UpazilaProps } from "@/lib/location";

const BASE: L.PathOptions = { color: "#15803d", weight: 0.6, opacity: 0.6, fillColor: "#22c55e", fillOpacity: 0.04 };
const HOVER: L.PathOptions = { weight: 1.5, opacity: 1, fillOpacity: 0.15 };
const SELECTED: L.PathOptions = { color: "#166534", weight: 2.5, opacity: 1, fillColor: "#16a34a", fillOpacity: 0.3 };

type Props = {
  boundaries: Boundaries;
  selected: { lat: number; lon: number; key: string | null; fly: boolean } | null;
  onPick: (lat: number, lon: number) => void;
};

export default function BangladeshMap({ boundaries, selected, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, L.Path>());
  const marker = useRef<L.CircleMarker | null>(null);
  const selectedKey = useRef<string | null>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { minZoom: 6, maxZoom: 13, zoomSnap: 0.5 });
    map.current = m;
    const paths = layers.current;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · সীমানা: geoBoundaries (BBS, OCHA), CC BY 3.0 IGO',
    }).addTo(m);

    const geo = L.geoJSON(boundaries, {
      style: () => BASE,
      onEachFeature: (f, layer) => {
        const p = f.properties as UpazilaProps;
        const key = upazilaKey(p);
        const path = layer as L.Path;
        paths.set(key, path);
        path.bindTooltip(`${p.name}, ${p.district_bn}`, { sticky: true, direction: "top" });
        path.on("mouseover", () => key !== selectedKey.current && path.setStyle(HOVER));
        path.on("mouseout", () => key !== selectedKey.current && path.setStyle(BASE));
        path.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stop(e);
          pick.current(e.latlng.lat, e.latlng.lng);
        });
      },
    }).addTo(m);

    // সীমানার বাইরে (সমুদ্র বা পাশের দেশ) ক্লিক করলেও জানানো হয়
    m.on("click", (e: L.LeafletMouseEvent) => pick.current(e.latlng.lat, e.latlng.lng));

    const bounds = geo.getBounds();
    m.fitBounds(bounds, { padding: [10, 10] });
    m.setMaxBounds(bounds.pad(0.3));

    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      paths.clear();
    };
  }, [boundaries]);

  useEffect(() => {
    const m = map.current;
    if (!m || !selected) return;

    const prev = selectedKey.current && layers.current.get(selectedKey.current);
    if (prev) prev.setStyle(BASE);
    selectedKey.current = selected.key;
    const cur = selected.key && layers.current.get(selected.key);
    if (cur) {
      cur.setStyle(SELECTED);
      cur.bringToFront();
    }

    const pt = L.latLng(selected.lat, selected.lon);
    if (!marker.current) {
      marker.current = L.circleMarker(pt, {
        radius: 7, color: "#ffffff", weight: 2, fillColor: "#dc2626", fillOpacity: 1,
      }).addTo(m);
    } else {
      marker.current.setLatLng(pt).bringToFront();
    }

    if (selected.fly) m.flyTo(pt, Math.max(m.getZoom(), 9), { duration: 0.8 });
    else if (!m.getBounds().contains(pt)) m.panTo(pt);
  }, [selected]);

  return (
    <div
      ref={box}
      className="isolate h-[420px] w-full overflow-hidden rounded-2xl border border-green-200 bg-green-50 md:h-[520px]"
      role="application"
      aria-label="বাংলাদেশের মানচিত্র, এলাকা বেছে নিতে ক্লিক করুন"
    />
  );
}
