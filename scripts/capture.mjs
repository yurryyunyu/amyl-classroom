import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "screenshots");
const BASE = process.env.APP_URL || "http://127.0.0.1:8767/index.html";
const STORE = "amyl-course-app-preview-v2";

const errors = [];
const logs = [];

async function waitReady(page) {
  await page.waitForSelector("#view", { state: "visible", timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll("img")).filter((i) => !i.complete);
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((res) => {
            img.addEventListener("load", res, { once: true });
            img.addEventListener("error", res, { once: true });
            setTimeout(res, 4000);
          })
      )
    );
  });
  await page.waitForTimeout(180);
}

async function resetScroll(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const v = document.querySelector("#view");
    if (v) v.scrollTop = 0;
  });
}

async function shot(page, name) {
  await waitReady(page);
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, type: "png" });
  logs.push("saved " + dest);
}

async function go(page, hash) {
  await page.goto(BASE + hash, { waitUntil: "networkidle", timeout: 30000 });
  await waitReady(page);
  await resetScroll(page);
}

(async () => {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console.error: " + msg.text());
  });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.includes("fonts.googleapis") || u.includes("fonts.gstatic")) return;
    errors.push("requestfailed: " + u + " " + req.failure()?.errorText);
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((store) => {
    localStorage.removeItem(store);
    localStorage.removeItem("amyl-course-app-preview-v1");
  }, STORE);
  await go(page, "#student/home");

  const tabs = [
    ["#student/courses", "课程"],
    ["#student/community", "社区"],
    ["#student/learn", "学习"],
    ["#student/me", "我的"],
    ["#student/home", "首页"]
  ];
  for (const [hash, label] of tabs) {
    await page.click(`#tabbar a[href="${hash}"]`);
    await waitReady(page);
    const h = await page.evaluate(() => location.hash);
    if (h !== hash) errors.push(`tab ${label} expected ${hash} got ${h}`);
  }

  await shot(page, "home.png");

  await go(page, "#student/courses");
  await shot(page, "courses.png");

  await go(page, "#student/course/pour-over-intro");
  await shot(page, "course-detail.png");

  await go(page, "#student/product/dripper");
  await page.click('[data-action="add-cart-go"]');
  await waitReady(page);
  await page.click('[data-action="open-checkout"]');
  await page.waitForSelector(".sheet", { state: "visible" });
  await page.waitForTimeout(280);
  await shot(page, "checkout.png");
  await page.click('[data-action="close-overlay"]');
  await page.waitForSelector("#overlay", { state: "hidden" });

  await go(page, "#student/shop");
  await shot(page, "shop.png");

  await go(page, "#student/learn");
  await shot(page, "learn.png");

  await go(page, "#student/homework/new");
  await shot(page, "homework-submit.png");

  await go(page, "#student/homework/hw-brew-graded");
  await page.evaluate(() => {
    const view = document.querySelector("#view");
    const el = document.querySelector(".feedback-box");
    if (!view || !el) return;
    const top = el.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop;
    view.scrollTop = Math.max(0, top - 8);
  });
  await page.waitForTimeout(200);
  await shot(page, "homework-feedback.png");

  await go(page, "#student/me");
  await shot(page, "me.png");

  await go(page, "#student/member");
  await shot(page, "member.png");

  await go(page, "#student/community");
  await shot(page, "community.png");

  await go(page, "#student/post/post-xiaolin");
  await page.evaluate(() => {
    const view = document.querySelector("#view");
    const el = document.querySelector(".comments") || document.querySelector("h2.block-title");
    if (view && el) view.scrollTop = Math.max(0, el.offsetTop - 220);
  });
  await page.waitForTimeout(200);
  await shot(page, "post-detail.png");

  await go(page, "#student/product/dripper");
  await page.click('[data-action="add-cart"]');
  await page.waitForTimeout(250);
  await go(page, "#student/cart");
  const cartText = await page.locator("#view").innerText();
  if (!cartText.includes("滤杯")) errors.push("cart did not show added dripper");

  await go(page, "#student/learn");
  await page.click('[data-action="checkin"]');
  await page.waitForTimeout(400);
  const toast = await page.locator("#toast").innerText().catch(() => "");
  if (!toast.includes("打卡") && !toast.includes("已经")) {
    const disabled = await page.$eval('[data-action="checkin"]', (el) => el.disabled).catch(() => false);
    if (!disabled) errors.push("check-in did not toast or disable");
  }

  await go(page, "#student/homework");
  if (!(await page.locator("#view").innerText()).includes("待批改")) {
    errors.push("homework list missing 待批改");
  }

  await go(page, "#student/post/post-amy-1");
  await page.click('[data-action="like"]');
  await page.waitForTimeout(200);
  const liked = await page.$eval('[data-action="like"]', (el) => el.classList.contains("liked")).catch(() => false);
  if (!liked) errors.push("like toggle did not apply class");

  await browser.close();

  const report = { ok: errors.length === 0, errors, logs };
  await writeFile(path.join(outDir, "verify.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
