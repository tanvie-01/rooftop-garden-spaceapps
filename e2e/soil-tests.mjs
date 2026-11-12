// Login page look + soil feel/jar tests, against the test backend on :8001 (garden.db copy, DEV_LOGIN=1).
// Run: node soil-tests.mjs <out-dir>
import { chromium } from "playwright";

const OUT = (process.argv[2] ?? ".") + "/";
const BASE = "http://localhost:3000";
const log = (name, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);

const browser = await chromium.launch();
for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } });
  await ctx.route("http://localhost:8000/**", (r) => r.continue({ url: r.request().url().replace("localhost:8000", "localhost:8001") }));
  const errs = [];

  // 1. login page, the way the live site looks (Google configured, no dev login)
  const lp = await ctx.newPage();
  lp.on("pageerror", (e) => errs.push(e.message));
  await lp.route("**/api/auth/config", (r) => r.fulfill({ json: { google_client_id: "demo.apps.googleusercontent.com", dev_login: false } }));
  await lp.goto(BASE + "/login", { waitUntil: "networkidle" });
  await lp.waitForTimeout(1500);
  const text = await lp.locator("main").innerText();
  log(`${w} login: no system details`, !/backend|\.env|GOOGLE_CLIENT_ID|DEV_LOGIN|ইমেইল আর ছবি/.test(text));
  log(`${w} login: no horizontal scroll`, !(await lp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await lp.screenshot({ path: `${OUT}login_${w}.png`, fullPage: true });
  await lp.close();

  // 2. soil tests
  await ctx.request.post("http://localhost:8001/api/auth/dev", { data: { email: `soil-${w}-${Date.now()}@gmail.com` } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/soil", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "মাটি তৈরি, শুরু করুন" }).click();
  await p.getByRole("button", { name: /হ্যাঁ, গোল্লা থাকে/ }).click();
  await p.screenshot({ path: `${OUT}soil_feel_step_${w}.png` });
  await p.getByRole("button", { name: /২.৫–৫ সেমি/ }).click();
  await p.getByRole("button", { name: /মাঝামাঝি/ }).click();
  await p.locator("#report-title").waitFor();
  const feel = await p.locator("#report-title").innerText();
  log(`${w} feel test → এঁটেল দোআঁশ`, /এঁটেল দোআঁশ/.test(feel), feel);
  await p.screenshot({ path: `${OUT}soil_feel_report_${w}.png`, fullPage: true });

  await p.getByRole("tab", { name: /বোতল পরীক্ষা/ }).click();
  const inputs = p.locator('input[type="number"]');   // উপর থেকে: কাদা, পলি, বালি
  await inputs.nth(0).fill("20");
  await inputs.nth(1).fill("40");
  await inputs.nth(2).fill("40");
  await p.getByRole("button", { name: "মাটির ধরন বের করুন" }).click();
  await p.waitForFunction(() => /^দোআঁশ/.test(document.querySelector("#report-title")?.textContent ?? ""));
  const art = await p.locator("article").first().innerText();
  log(`${w} jar test → দোআঁশ with fractions`, /বালি ৪০%/.test(art) && /কাদা ২০%/.test(art), art.slice(0, 120).replace(/\s+/g, " "));
  log(`${w} history has 2 reports`, (await p.locator("#history-title + ul li").count()) === 2);
  log(`${w} soil: no horizontal scroll`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.locator('[role="tablist"]').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}soil_jar_${w}.png`, fullPage: true });
  log(`${w} no page errors`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await browser.close();
