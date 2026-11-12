// Community: profile setup, image post, reactions, comments, share, save, dashboard — two users, against the
// test backend on :8001 (SQLite, DEV_LOGIN=1, local media). Run: node community.mjs <out-dir> <big.jpg> <small.jpg>
import { chromium } from "playwright";

const [OUT, BIG, SMALL] = [(process.argv[2] ?? ".") + "/", process.argv[3], process.argv[4]];
const BASE = "http://localhost:3000";
const log = (name, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
const browser = await chromium.launch();

async function user(email, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } });
  await ctx.route("http://localhost:8000/**", (r) => r.continue({ url: r.request().url().replace("localhost:8000", "localhost:8001") }));
  await ctx.request.post("http://localhost:8001/api/auth/dev", { data: { email } });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errs.push(m.text().slice(0, 160)));
  return page;
}

async function setup(p, avatarTitle, name, w) {
  await p.goto(BASE + "/community", { waitUntil: "networkidle" });
  await p.getByText("বাগান কমিউনিটিতে স্বাগতম").waitFor();
  await p.getByTitle(avatarTitle).click();
  await p.screenshot({ path: `${OUT}community_setup_${w}.png` });
  await p.getByRole("button", { name: "পরের ধাপ →" }).click();
  await p.getByRole("button", { name: /ফুলের পাপড়ি/ }).click();
  await p.getByRole("button", { name: "পরের ধাপ →" }).click();
  await p.getByPlaceholder(/ছাদবাগানী/).fill("দুই শব্দ");
  log(`${w} one-word name enforced`, await p.getByRole("button", { name: /প্রোফাইল তৈরি করুন/ }).isDisabled());
  await p.getByPlaceholder(/ছাদবাগানী/).fill(name);
  await p.getByRole("button", { name: /প্রোফাইল তৈরি করুন/ }).click();
  await p.getByLabel("পোস্টের লেখা").waitFor();
}

const stamp = Date.now();
for (const w of [1280, 390]) {
  const CAP = `আমার ছাদের কুমড়া ${stamp % 100000}-${w}`;
  const a = await user(`alice-${w}-${stamp}@gmail.com`, w);
  await setup(a, "টমেটো", w === 1280 ? "ছাদবাগানী" : "Gardener", w);
  log(`${w} profile created, feed shown`, true);

  // ছবি ছাড়া পোস্ট বোতাম বন্ধ
  await a.getByLabel("পোস্টের লেখা").fill(`${CAP} 🎃 আর গোলাপ`);
  log(`${w} text-only post blocked`, await a.getByRole("button", { name: "পোস্ট করুন" }).isDisabled());
  await a.locator('input[type="file"]').setInputFiles([BIG, SMALL]);
  await a.getByRole("button", { name: "পোস্ট করুন" }).click();
  const card = a.locator("article:visible", { hasText: CAP });
  await card.getByText(CAP).waitFor({ timeout: 60000 });
  const img = card.locator("img[loading=lazy]").first();
  await img.scrollIntoViewIfNeeded();
  await a.waitForFunction((el) => el.complete && el.naturalWidth > 0, await img.elementHandle());
  const nat = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight, el.currentSrc]);
  log(`${w} post with 2 images, feed size webp`, nat[0] === 1080 && /feed\.webp/.test(nat[2]), nat.join(" "));
  await a.screenshot({ path: `${OUT}community_feed_${w}.png` });

  // দ্বিতীয় ব্যবহারকারী
  const b = await user(`bob-${w}-${stamp}@gmail.com`, w);
  await setup(b, "গাজর", "Bob", w);
  const bc = b.locator("article:visible", { hasText: CAP });
  await bc.getByText(CAP).waitFor();
  await bc.getByRole("button", { name: "অন্য রিঅ্যাকশন বাছুন" }).click({ force: true }).catch(async () => {
    await bc.getByRole("button", { name: "লাইক" }).first().click({ button: "right" });
  });
  await bc.getByRole("button", { name: "ভালোবাসা" }).click();
  await bc.getByRole("button", { name: /ভালোবাসা দিয়েছেন/ }).waitFor();
  log(`${w} love reaction`, true);
  await bc.getByRole("button", { name: /মন্তব্য/ }).first().click();
  await bc.getByLabel("মন্তব্য লিখুন").fill("দারুণ হয়েছে! Nice 🌻");
  await bc.getByRole("button", { name: "পাঠান" }).click();
  await bc.getByText("দারুণ হয়েছে! Nice 🌻").waitFor();
  log(`${w} comment`, true);
  await bc.getByRole("button", { name: "সেভ", exact: true }).click(); // সেভ
  await b.getByRole("status").filter({ hasText: /সেভ/ }).first().waitFor(); // সারা সাইটের glass notification (lib/notify)
  await bc.getByRole("button", { name: /শেয়ার/ }).first().click();
  await bc.getByRole("button", { name: /প্রোফাইলে শেয়ার করুন/ }).click();
  await b.waitForTimeout(800);
  await b.screenshot({ path: `${OUT}community_bob_${w}.png` });

  // Bob-এর ড্যাশবোর্ড: সেভ ও শেয়ার করা
  await b.goto(BASE + "/community", { waitUntil: "networkidle" });
  await b.getByRole("link", { name: /ড্যাশবোর্ড/ }).click();
  await b.getByRole("tab", { name: /সেভ করা/ }).click();
  await b.locator("article:visible", { hasText: CAP }).waitFor();
  log(`${w} saved tab shows post`, (await b.locator(":visible").getByText(/সেভ করেছেন/).count()) > 0);
  await b.getByRole("tab", { name: /শেয়ার করা/ }).click();
  await b.locator("article:visible").getByText(/আপনি শেয়ার করেছেন/).waitFor();
  const author = await b.locator("article:visible", { hasText: CAP }).locator("header").innerText();
  log(`${w} shared keeps original author`, /ছাদবাগানী|Gardener/.test(author), author.replace(/\s+/g, " "));
  log(`${w} no horizontal scroll`, !(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await b.screenshot({ path: `${OUT}community_dashboard_${w}.png`, fullPage: true });

  // Alice দেখে: রিঅ্যাকশন আর মন্তব্য, তারপর পোস্ট মোছে
  await a.reload({ waitUntil: "networkidle" });
  const ac = a.locator("article:visible", { hasText: CAP });
  const counts = await ac.innerText();
  log(`${w} alice sees reaction + comment`, /১ মন্তব্য/.test(counts) && /১ শেয়ার/.test(counts));
  await ac.getByRole("button", { name: "আরও" }).click();
  await ac.getByRole("button", { name: /পোস্ট মুছে ফেলুন/ }).click();
  await a.getByRole("alertdialog").getByRole("button", { name: "হ্যাঁ, মুছে ফেলুন" }).click(); // glass নিশ্চিতকরণ বক্স (lib/notify)
  await a.waitForTimeout(800);
  log(`${w} delete own post`, (await a.locator("article:visible", { hasText: CAP }).count()) === 0);
  log(`${w} no page errors`, a.errs.length + b.errs.length === 0, [...a.errs, ...b.errs].join(" | "));
  await a.context().close();
  await b.context().close();
}
await browser.close();
