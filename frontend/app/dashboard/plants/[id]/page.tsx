import { Suspense } from "react";
import LoginGate from "@/components/LoginGate";
import PlantView from "./PlantView";

// cacheComponents চালু থাকায় useParams() পড়া অংশটা Suspense-এর ভেতরে থাকতে হয়
export default function PlantPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl animate-pulse space-y-4 px-5 py-10">
          <div className="h-32 rounded-3xl bg-green-100" />
          <div className="h-64 rounded-3xl bg-green-100" />
        </main>
      }
    >
      <LoginGate next="/dashboard" why="গাছের তথ্য শুধু তার মালিক দেখতে পারে।">
        <PlantView />
      </LoginGate>
    </Suspense>
  );
}
