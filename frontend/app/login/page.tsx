import { Suspense } from "react";
import LoginView from "./LoginView";

// useSearchParams() Suspense-এর ভেতরে থাকতে হয় (cacheComponents)
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md animate-pulse px-5 py-16">
          <div className="h-80 rounded-3xl bg-green-50" />
        </main>
      }
    >
      <LoginView />
    </Suspense>
  );
}
