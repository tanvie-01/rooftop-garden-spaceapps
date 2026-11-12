// Disease diary page, against the test backend on :8001 (DEV_LOGIN=1). Run: node disease-diary.mjs <out-dir>
import { chromium } from "playwright";

const OUT = (process.argv[2] ?? ".") + "/";
const BASE = "http://localhost:3000";
const log = (name, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);

const browser = await chromium.launch();
for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } });
  await ctx.route("http://localhost:8000/**", (r) => r.continue({ url: r.request().url().replace("localhost:8000", "localhost:8001") }));
  await ctx.request.post("http://localhost:8001/api/auth/dev", { data: { email: `diary-${w}-${Date.now()}@gmail.com` } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 150)));

  await p.goto(BASE + "/disease", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /টমেটো/ }).first().waitFor();
  // ফসলের সংখ্যা ডায়েরি থেকেই নেওয়া (নতুন ফসল যোগ হলে test বদলাতে হয় না); উপরের ট্যাবের li (link) বাদ
  const diary = await (await ctx.request.get("http://localhost:8001/api/disease/diary")).json();
  const total = diary.crops.length, flowers = diary.crops.filter((c) => c.group === "ফুল").length;
  const CARD = 'main ul li:not(details li):not(:has(a[href^="/"]))';
  const cards = await p.locator(CARD).count();
  log(`${w} grid shows all crops`, cards === total, `${cards} cards of ${total}`);
  await p.screenshot({ path: `${OUT}diary_grid_${w}.png` });

  await p.getByPlaceholder(/ফসল বা রোগের নাম/).fill("পাউডারি");
  const filtered = await p.locator(CARD).count();
  log(`${w} search filters`, filtered > 3 && filtered < total, `${filtered} for পাউডারি`);
  await p.getByPlaceholder(/ফসল বা রোগের নাম/).fill("");
  await p.getByRole("button", { name: "ফুল", exact: true }).click();
  log(`${w} group chip filters`, (await p.locator(CARD).count()) === flowers, `${flowers} flowers`);
  await p.getByRole("button", { name: "সব ফসল" }).click();

  await p.getByRole("button", { name: /টমেটো/ }).first().click();
  await p.locator("#crop-title").waitFor();
  const text = await p.locator("main").innerText();
  log(`${w} tomato page`, /আগাম ধসা/.test(text) && /লক্ষণ/.test(text) && /ওষুধের ধরন/.test(text) && /উৎস/.test(text));
  log(`${w} url hash`, p.url().endsWith("#tomato"));
  const img = p.locator("figure img").first();
  await img.scrollIntoViewIfNeeded();
  await p.waitForFunction((el) => el.complete && el.naturalWidth > 100, await img.elementHandle(), { timeout: 15000 }).catch(() => {});
  log(`${w} image loads`, await img.evaluate((el) => el.complete && el.naturalWidth > 100));
  log(`${w} no horizontal scroll`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.screenshot({ path: `${OUT}diary_tomato_${w}.png`, fullPage: true });

  await p.goBack();
  await p.getByRole("button", { name: /শসা/ }).first().waitFor();
  log(`${w} back button returns to grid`, (await p.locator("#crop-title").count()) === 0);
  await p.goto(BASE + "/disease#cucumber", { waitUntil: "networkidle" });
  await p.locator("#crop-title").waitFor();
  await p.getByRole("button", { name: /পাউডারি মিলডিউ/ }).click();
  const cap = await p.locator("figcaption").first().innerText();
  log(`${w} reused image says which plant`, /মিষ্টি কুমড়া/.test(cap), cap.slice(0, 80));
  log(`${w} no page errors`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await browser.close();
