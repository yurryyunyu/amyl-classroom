#!/usr/bin/env python3
"""Verify latte art + brewing homework flow and capture screenshots."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots"
ASSETS = ROOT / "assets"
BASE = "http://127.0.0.1:8767/index.html"
STORE = "amyl-course-app-preview-v2"
OUT.mkdir(exist_ok=True)

errors: list[str] = []
logs: list[str] = []


def hide_toast(page):
    page.evaluate("""() => { const t = document.querySelector('#toast'); if (t) t.hidden = true; }""")


def reset_scroll(page):
    page.evaluate("""() => { window.scrollTo(0,0); const v=document.querySelector('#view'); if(v) v.scrollTop=0; }""")


def wait_ready(page):
    page.wait_for_selector("#view", state="visible", timeout=15000)
    page.evaluate("() => document.fonts && document.fonts.ready")
    page.wait_for_timeout(160)


def go(page, hash_):
    page.goto(BASE + hash_, wait_until="networkidle", timeout=30000)
    wait_ready(page)
    hide_toast(page)
    reset_scroll(page)


def shot(page, name, scroll_js=None):
    wait_ready(page)
    hide_toast(page)
    if scroll_js:
        page.evaluate(scroll_js)
        page.wait_for_timeout(200)
    else:
        reset_scroll(page)
        page.wait_for_timeout(80)
    dest = OUT / name
    page.screenshot(path=str(dest), type="png")
    logs.append(f"saved {dest}")
    print("saved", dest)


def pick_photos(page, files):
    page.set_input_files('[data-testid="hw-photos"]', files)
    page.wait_for_selector("#hw-thumbs img", timeout=8000)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=["--disable-dev-shm-usage"])
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            service_workers="block",
        )
        page = context.new_page()

        def on_console(msg):
            if msg.type == "error":
                errors.append(f"console.error: {msg.text}")

        def on_pageerror(err):
            errors.append(f"pageerror: {err.message}")

        def on_requestfailed(req):
            u = req.url
            if "fonts.googleapis" in u or "fonts.gstatic" in u:
                return
            errors.append(f"requestfailed: {u} {req.failure or ''}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)
        page.on("requestfailed", on_requestfailed)

        page.goto(BASE, wait_until="domcontentloaded")
        page.evaluate(f"() => localStorage.removeItem('{STORE}')")
        go(page, "#role")
        page.click('[data-testid="role-student"]')
        wait_ready(page)

        go(page, "#student/homework/new")
        text = page.locator("#view").inner_text()
        if "拉花" not in text or "冲煮" not in text:
            errors.append("type select missing 拉花/冲煮")
        if "焖蒸" in text or "杯测" in text:
            errors.append("type select still shows other assignment kinds")
        shot(page, "hw-type-select.png")

        # Latte submit
        go(page, "#student/homework/new/latte")
        pick_photos(page, [str(ASSETS / "site-hero.webp"), str(ASSETS / "thumb-collab.jpg")])
        page.locator('label:has-text("郁金香")').click()
        page.fill('textarea[name="notes"]', "第二层有点散，想请老师看看对称。")
        page.wait_for_timeout(200)
        if page.locator("#hw-thumbs img").count() < 1:
            errors.append("latte form missing photo thumbs")
        if "短视频" not in page.locator("#view").inner_text():
            errors.append("latte form missing video placeholder note")
        shot(page, "latte-submit.png")
        page.click('[data-testid="hw-submit"]')
        wait_ready(page)
        page.wait_for_timeout(250)
        h = page.evaluate("() => location.hash")
        if "hw-local-latte-" not in h:
            errors.append(f"after latte submit expected detail, got {h}")
        latte_id = h.split("/")[-1]
        if "待批改" not in page.locator("#view").inner_text():
            errors.append("latte submission not 待批改")

        # Brew submit
        go(page, "#student/homework/new/brew")
        pick_photos(page, [str(ASSETS / "featured-events.jpg"), str(ASSETS / "thumb-site.jpg")])
        page.locator('label:has-text("V60")').click()
        page.fill('input[name="dose"]', "15g")
        page.fill('input[name="water"]', "250g")
        page.fill('input[name="ratio"]', "1:16.7")
        page.fill('input[name="grind"]', "中细 · 示例")
        page.fill('input[name="time"]', "2:48")
        page.fill('textarea[name="notes"]', "柑橘和红茶，尾韵偏干。这是演示冲煮。")
        page.wait_for_timeout(200)
        shot(page, "brew-submit.png")
        page.click('[data-testid="hw-submit"]')
        wait_ready(page)
        page.wait_for_timeout(250)
        h = page.evaluate("() => location.hash")
        if "hw-local-brew-" not in h:
            errors.append(f"after brew submit expected detail, got {h}")
        brew_id = h.split("/")[-1]

        # Teacher queue
        go(page, "#role")
        page.click('[data-testid="role-teacher"]')
        wait_ready(page)
        go(page, "#teacher/queue")
        q = page.locator("#view").inner_text()
        if "拉花" not in q or "冲煮" not in q:
            errors.append("teacher queue missing type tabs or badges")
        if "全部" not in q:
            errors.append("teacher queue missing 全部 type tab")
        shot(page, "teacher-queue.png")

        # Grade the new latte
        go(page, f"#teacher/grade/{latte_id}")
        g = page.locator("#view").inner_text()
        if "对称" not in g or "奶泡质地" not in g:
            errors.append("latte grade missing 拉花 rubric")
        if "萃取" in g:
            errors.append("latte grade unexpectedly shows brewing rubric")
        page.click('button[data-action="grade-template"]')
        page.fill("#grade-tip", "把起点再靠近杯心一点。（示例）")
        page.wait_for_timeout(200)
        shot(
            page,
            "latte-grade.png",
            scroll_js="""() => {
              const view = document.querySelector('#view');
              const el = document.querySelector('#grade-rubric') || document.querySelector('.templates');
              if (!view || !el) return;
              const top = el.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop;
              view.scrollTop = Math.max(0, top - 160);
            }""",
        )
        page.click('[data-testid="submit-grade"]')
        wait_ready(page)
        page.wait_for_timeout(300)

        # Student sees feedback
        go(page, "#role")
        page.click('[data-testid="role-student"]')
        wait_ready(page)
        go(page, f"#student/homework/{latte_id}")
        fb = page.locator("#view").inner_text()
        if "已批改" not in fb:
            errors.append("student did not see 已批改 after latte grade")
        if "对称" not in fb and "评分细则" not in fb:
            errors.append("student feedback missing latte rubric")
        if "的批改" not in fb and "Amy" not in fb:
            errors.append("student feedback missing teacher comments")

        browser.close()

    report = {"ok": len(errors) == 0, "errors": errors, "logs": logs}
    (OUT / "verify-homework.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
