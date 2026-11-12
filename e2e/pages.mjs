// Browser test: frontend :3000, API served by the test backend on :8001 (a garden.db copy, DEV_LOGIN=1)
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];

const results = [];
const log = (name, ok, info = "") => {
  results.push({ name, ok, info });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`);
};

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    deviceScaleFactor: 1,
    geolocation: { latitude: 23.1622, longitude: 91.1194 }, // Manoharganj area
    permissions: ["geolocation"],
    locale: "bn-BD",
  });
  // fetch from the test backend ourselves and hand the response over (keeps CORS + login cookie intact)
  await ctx.route("http://localhost:8000/**", async (route) => {
    const resp = await route.fetch({ url: route.request().url().replace("localhost:8000", "localhost:8001"), timeout: 150000 });
    await route.fulfill({ response: resp });
  });
  // every test runs logged in (the test backend has DEV_LOGIN=1)
  await ctx.request.post("http://localhost:8001/api/auth/dev", { data: { email: "pages-test@gmail.com" } });
  const page = await ctx.newPage();
  page.problems = [];
  page.on("pageerror", (e) => page.problems.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") page.problems.push("console: " + m.text().slice(0, 200));
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) page.problems.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.includes("_rsc") && !u.includes("tile.openstreetmap") && r.failure()?.errorText !== "net::ERR_ABORTED") page.problems.push(`failed ${r.failure()?.errorText} ${u.slice(0, 120)}`);
  });
  return page;
}

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function smoke(browser) {
  for (const mobile of [false, true]) {
    for (const path of ["/", "/weather", "/dashboard", "/chat", "/plan", "/crops", "/soil", "/disease"]) {
      const page = await newPage(browser, { mobile });
      const tag = `${mobile ? "mobile" : "desktop"} ${path}`;
      try {
        await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(1500);
        const ox = await overflowX(page);
        await page.screenshot({ path: `${OUT}${mobile ? "m" : "d"}${path.replace(/\//g, "_") || "_home"}.png`, fullPage: true });
        const probs = page.problems.filter((p) => !p.includes("Download the React DevTools"));
        log(`smoke ${tag}`, probs.length === 0 && ox <= 1, [ox > 1 ? `horizontal overflow ${ox}px` : "", ...probs].filter(Boolean).join(" | "));
      } catch (e) {
        log(`smoke ${tag}`, false, e.message.split("\n")[0]);
      }
      await page.context().close();
    }
  }
}

async function weather(browser) {
  const page = await newPage(browser);
  await page.goto(BASE + "/weather", { waitUntil: "networkidle", timeout: 60000 });
  const paths = page.locator("path.leaflet-interactive");
  await paths.first().waitFor({ timeout: 30000 });
  log("weather: map draws upazilas", (await paths.count()) > 500, `${await paths.count()} shapes`);

  // click on the map near Dhaka
  const box = await page.locator(".leaflet-container").boundingBox();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.waitForTimeout(4000);
  let body = await page.locator("main:visible").last().innerText();
  const clicked = body.match(/উপজেলা|থানা|জেলা/);
  log("weather: clicking map selects an area", !!clicked);
  await page.screenshot({ path: OUT + "w_click.png", fullPage: true });

  // search
  const search = page.getByPlaceholder("যেমন Manoharganj, কুমিল্লা");
  await search.fill("Manoharganj");
  await page.waitForTimeout(800);
  const opt = page.getByRole("button", { name: /Manoharganj/ }).first();
  const hasOpt = (await opt.count()) > 0;
  log("weather: search finds Manoharganj", hasOpt);
  if (hasOpt) {
    await opt.click();
    await page.waitForTimeout(6000);
    body = await page.locator("main:visible").last().innerText();
    log("weather: area card shows Manoharganj", /Manoharganj/.test(body));
    log("weather: history / records section", /রেকর্ড|গত ১২ মাস|২০ বছর/.test(body));
    log("weather: what may happen section", /হতে পারে|সম্ভাবনা/.test(body));
  }
  const saved = await page.evaluate(() => localStorage.getItem("rooftop-garden:location"));
  log("weather: location saved for other pages", !!saved && saved.includes("Manoharganj"), saved?.slice(0, 80));
  await page.screenshot({ path: OUT + "w_search.png", fullPage: true });

  // GPS
  await page.getByRole("button", { name: /আমার অবস্থান/ }).click();
  await page.waitForTimeout(6000);
  body = await page.locator("main:visible").last().innerText();
  log("weather: GPS button picks area", /Manoharganj|Laksam|Comilla|কুমিল্লা/.test(body));
  log("weather: no browser errors", page.problems.length === 0, page.problems.join(" | "));
  await page.context().close();
}

async function dashboard(browser) {
  const page = await newPage(browser);
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const startCards = await page.locator("#plants a[href^='/dashboard/plants/']").count();

  const addBtn = page.getByRole("button", { name: /গাছ যোগ করুন/ }).first();
  await addBtn.click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const uniq = "টেস্ট " + Date.now().toString().slice(-5);
  await dlg.locator("#plant-name").fill("Tomato");
  await page.waitForTimeout(400);
  log("wizard: suggests from catalog", /তালিকায় আছে/.test(await dlg.innerText()));
  await dlg.locator("#plant-nick").fill(uniq);
  await dlg.getByRole("button", { name: "পরের ধাপ →" }).click();
  await dlg.locator("#pot").fill("8");
  await dlg.getByRole("button", { name: "পরের ধাপ →" }).click();
  await dlg.locator("#sun").fill("7");
  await dlg.getByRole("button", { name: "পরের ধাপ →" }).click();
  await page.waitForTimeout(1500);
  const rems = await dlg.locator("input[type=checkbox]").count();
  log("wizard: reminder suggestions load", rems > 0, `${rems} reminders`);
  await dlg.getByRole("button", { name: "পরের ধাপ →" }).click();
  await dlg.getByRole("button", { name: /গাছ যোগ করুন/ }).click();
  await page.waitForTimeout(2500);
  const dupErr = (await dlg.count()) > 0 ? await dlg.innerText() : "";
  if (/আগেই আছে/.test(dupErr)) {
    log("wizard: duplicate warning shown", true);
    await dlg.getByRole("button", { name: "তবুও আরেকটা যোগ করুন" }).click();
    await page.waitForTimeout(2500);
  }
  log("wizard: closes after save", (await page.getByRole("dialog").count()) === 0);
  const card = page.locator("#plants a", { hasText: uniq }).first();
  log("dashboard: new plant card appears", (await card.count()) > 0, `cards ${startCards} → ${await page.locator("#plants a[href^='/dashboard/plants/']").count()}`);
  await page.screenshot({ path: OUT + "dash_after_add.png", fullPage: true });

  // second add with same name → duplicate path
  await addBtn.click();
  await dlg.locator("#plant-name").fill("Tomato");
  await dlg.locator("#plant-nick").fill(uniq);
  await dlg.getByRole("button", { name: "এখনই সেভ করুন" }).click();
  await page.waitForTimeout(2000);
  log("wizard: same plant twice → duplicate warning", /আগেই আছে/.test(await dlg.innerText()));
  page.problems = page.problems.filter((p) => !/409/.test(p)); // expected
  await dlg.getByRole("button", { name: "বন্ধ করুন" }).click();

  // task buttons
  const tasks = page.locator("#tasks");
  const tabs = await tasks.getByRole("button").allInnerTexts();
  log("dashboard: task tabs", tabs.length > 0, tabs.slice(0, 4).join(" / ").replace(/\n/g, " "));
  for (const t of await tasks.getByRole("button").all()) {
    if (/আসছে|সামনে/.test(await t.innerText())) { await t.click(); break; }
  }
  await page.waitForTimeout(500);
  const snooze = page.getByRole("button", { name: /^কাল$|১ দিন পরে/ }).first();
  if (await snooze.count()) {
    await snooze.click();
    await page.waitForTimeout(2000);
    log("dashboard: snooze 1 day works", page.problems.length === 0, page.problems.join(" | "));
  } else log("dashboard: snooze 1 day works", false, "no snooze button visible");

  const watered = page.locator("#plants").getByRole("button", { name: /পানি দিয়েছি/ }).first();
  if (await watered.count()) {
    await watered.click();
    await page.waitForTimeout(2000);
    const act = await page.locator("[aria-labelledby=activity-title]").innerText();
    log("dashboard: 'watered' shows in recent activity", /পানি/.test(act), act.split("\n").slice(1, 3).join(" · "));
  } else log("dashboard: 'watered' button", false, "not found");

  // search filter
  await page.getByPlaceholder("নাম বা জায়গা দিয়ে খুঁজুন").fill(uniq);
  await page.waitForTimeout(500);
  const shown = await page.locator("#plants a[href^='/dashboard/plants/']").count();
  log("dashboard: search filters plants", shown >= 1 && shown <= 2, `${shown} shown`);

  // plant detail
  await page.locator("#plants a", { hasText: uniq }).first().click();
  await page.waitForURL(/\/dashboard\/plants\/\d+/, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const detail = await page.locator("main:visible").last().innerText();
  log("plant page: opens with name", detail.includes(uniq));
  await page.screenshot({ path: OUT + "plant_detail.png", fullPage: true });
  const obsBtns = await page.getByRole("button").allInnerTexts();
  fs.writeFileSync(OUT + "plant_buttons.txt", obsBtns.join("\n"));
  const dry = page.getByRole("button", { name: /শুকনো/ }).first();
  if (await dry.count()) {
    await dry.click();
    const symptoms = page.getByPlaceholder(/হলুদ দাগ/);
    if (await symptoms.count()) await symptoms.fill("নিচের পাতায় হলুদ দাগ");
    const save = page.getByRole("button", { name: /সেভ|লিখে রাখুন|যোগ করুন/ }).first();
    await save.click();
    await page.waitForTimeout(2500);
    const after = await page.locator("main:visible").last().innerText();
    log("plant page: observation saved", /হলুদ দাগ|শুকনো/.test(after), page.problems.join(" | ") + " :: " + after.slice(0, 400).split("\n").join(" / "));
  } else log("plant page: observation form", false, "no soil 'dry' button");
  log("dashboard+plant: no browser errors", page.problems.length === 0, page.problems.join(" | "));
  await page.context().close();
}

async function chat(browser) {
  const page = await newPage(browser);
  await page.goto(BASE + "/chat", { waitUntil: "networkidle", timeout: 60000 });
  const box = page.getByLabel("আপনার প্রশ্ন");
  for (const [q, lang] of [["টমেটো গাছের পাতা হলুদ হয়ে যাচ্ছে কেন?", "bn"], ["How often should I water chili in summer?", "en"]]) {
    const before = await page.locator("main:visible").last().innerText();
    await box.fill(q);
    await page.getByRole("button", { name: "পাঠান" }).click();
    const t0 = Date.now();
    await page.waitForFunction((b) => document.querySelector("main").innerText.length > b.length + 150, before, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const after = (await page.locator("main:visible").last().innerText()).slice(before.length - 50);
    const latin = (after.match(/[A-Za-z]/g) || []).length, bangla = (after.match(/[ঀ-৿]/g) || []).length;
    log(`chat: answers (${lang})`, after.length > 150 && !/সীমা শেষ|সাড়া দিচ্ছে না/.test(after), `${((Date.now() - t0) / 1000).toFixed(1)}s, ${latin} latin / ${bangla} bangla chars`);
    log(`chat: shows sources or no-source note (${lang})`, /উৎস|সূত্র|source/i.test(after));
  }
  await page.screenshot({ path: OUT + "chat.png", fullPage: true });
  log("chat: no browser errors", page.problems.length === 0, page.problems.join(" | "));
  await page.context().close();
}

async function forms(browser) {
  for (const path of ["/plan", "/crops"]) {
    const page = await newPage(browser);
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const before = await page.locator("main:visible").last().innerText();
    // শেষ বোতামটা এখন ⓘ-ও হতে পারে, তাই নাম দিয়ে আসল জমা দেওয়ার বোতাম
    await page.getByRole("button", { name: /সাজেস্ট করুন|পরিকল্পনা বানান|পরিকল্পনা দেখান/ }).last().click();
    await page.waitForTimeout(6000);
    const after = await page.locator("main:visible").last().innerText();
    log(`${path}: submit shows result`, after.length > before.length + 100, page.problems.join(" | "));
    await page.screenshot({ path: `${OUT}form${path.replace("/", "_")}.png`, fullPage: true });
    await page.context().close();
  }
}

const browser = await chromium.launch();
const suites = { smoke, weather, dashboard, chat, forms };
for (const [name, fn] of Object.entries(suites)) {
  if (only && only !== name) continue;
  console.log(`\n### ${name}`);
  try { await fn(browser); } catch (e) { log(`${name} crashed`, false, e.message.split("\n")[0]); }
}
await browser.close();
fs.writeFileSync(OUT + "results.json", JSON.stringify(results, null, 1));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
