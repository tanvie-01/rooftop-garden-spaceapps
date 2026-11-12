# ব্রাউজার টেস্ট (Playwright)

আসল ব্রাউজারে (headless Chromium) অ্যাপ চালিয়ে দেখে। আসল `garden.db`-তে কিছু লেখে না:
ব্রাউজারের `localhost:8000`-এর request গুলো টেস্টের backend (`localhost:8001`)-এ পাঠানো হয়,
যেটা `garden.db`-র একটা কপি নিয়ে চলে।

```
cd e2e
npm install
npx playwright install chromium

:: আরেকটা terminal-এ, garden.db-র কপি রাখা একটা খালি ফোল্ডার থেকে।
:: DATABASE_URL অবশ্যই দেবে: নইলে backend/.env-এর Supabase-এ টেস্টের ইউজার ঢুকে যাবে!
set DATABASE_URL=sqlite:///./garden.db
set DEV_LOGIN=1
<project>\backend\venv\Scripts\python -m uvicorn main:app --app-dir <project>\backend --port 8001

:: frontend (npm run dev, port 3000) চালু থাকতে হবে
npm run pages          (সব পেজ, মানচিত্র, ড্যাশবোর্ড, ফর্ম)
npm run login-chat     (লগইন, মাটির রিপোর্ট, চ্যাটবট; আসল Gemini ডাকে, প্রায় ৭টা প্রশ্ন)
```

স্ক্রিনশট `shots/` আর `shots2/`-তে জমা হয় (git-এ যায় না)।
দুটো স্ক্রিপ্টই টেস্টের backend-এর dev login দিয়ে লগইন করে নেয়।
