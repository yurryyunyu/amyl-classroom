#!/usr/bin/env python3
"""Verify student/teacher homework flow and capture role screenshots."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots"
ASSETS = ROOT / "assets"
BASE = "http://127.0.0.1:8767/index.html"
OUT.mkdir(exist_ok=True)

errors: list[str] = []
logs: list[str] = []


def reset_scroll(page):
    page.evaluate(
        """() => {
          window.scrollTo(0, 0);
          const v = document.querySelector('#view');
          if (v) v.scrollTop = 0;
        }"""
    )


def wait_ready(page):
    page.wait_for_selector("#view", state="visible", timeout=15000)
    page.evaluate("() => document.fonts && document.fonts.ready")
    page.wait_for_timeout(180)


def go(page, hash_):
    page.goto(BASE + hash_, wait_until="networkidle", timeout=30000)
    wait_ready(page)
    reset_scroll(page)


def hide_toast(page):
    page.evaluate("""() => {
      const t = document.querySelector('#toast');
      if (t) t.hidden = true;
    }""")


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

        # First open with empty storage should land on #role
        page.goto(BASE, wait_until="domcontentloaded")
        page.evaluate("() => localStorage.removeItem('amyl-course-app-preview-v1')")
        page.goto(BASE, wait_until="networkidle")
        wait_ready(page)
        page.wait_for_timeout(300)
        h = page.evaluate("() => location.hash")
        if h not in ("#role",):
            # boot may need a moment
            go(page, "#role")
            h = page.evaluate("() => location.hash")
        if h != "#role":
            errors.append(f"first open expected #role got {h}")
        body = page.locator("#view").inner_text()
        if "学生端" not in body or "老师端" not in body:
            errors.append("role select missing 学生端/老师端")
        shot(page, "role-select.png")

        # Enter student
        page.click('[data-testid="role-student"]')
        wait_ready(page)
        h = page.evaluate("() => location.hash")
        if not str(h).startswith("#student"):
            errors.append(f"student entry expected #student/* got {h}")
        if "拍照交作业" not in page.locator("#view").inner_text():
            errors.append("student home missing 拍照交作业")

        go(page, "#student/homework/new")
        # pick two photos
        page.set_input_files(
            '[data-testid="hw-photos"]',
            [str(ASSETS / "featured-events.jpg"), str(ASSETS / "thumb-site.jpg")],
        )
        page.wait_for_selector("#hw-thumbs img", timeout=8000)
        thumbs = page.locator("#hw-thumbs img").count()
        if thumbs < 2:
            errors.append(f"expected 2 photo thumbs, got {thumbs}")
        page.fill('input[name="dose"]', "15g")
        page.fill('input[name="water"]', "250g")
        page.fill('input[name="ratio"]', "1:16.7")
        page.fill('input[name="grind"]', "中细 · 示例")
        page.fill('input[name="time"]', "2:48")
        page.fill('textarea[name="notes"]', "柑橘和红茶，尾韵偏干。这是演示提交。")
        page.wait_for_timeout(200)
        reset_scroll(page)
        shot(page, "student-submit.png")

        page.click('[data-testid="hw-submit"]')
        wait_ready(page)
        page.wait_for_timeout(300)
        # should be on detail of new hw, pending
        h = page.evaluate("() => location.hash")
        if "#student/homework/hw-local-" not in h:
            errors.append(f"after submit expected detail hash, got {h}")
        new_id = h.split("/")[-1]
        detail = page.locator("#view").inner_text()
        if "待批改" not in detail:
            errors.append("new submission detail missing 待批改")

        go(page, "#student/homework")
        listing = page.locator("#view").inner_text()
        if "待批改" not in listing or "拍照交作业" not in listing:
            errors.append("student status list missing 待批改 or CTA")
        shot(page, "student-status.png")

        # Switch to teacher via role page
        go(page, "#role")
        page.click('[data-testid="role-teacher"]')
        wait_ready(page)
        h = page.evaluate("() => location.hash")
        if h != "#teacher/queue":
            errors.append(f"teacher entry expected #teacher/queue got {h}")
        queue = page.locator("#view").inner_text()
        if "批改台" not in queue or "待批改" not in queue:
            errors.append("teacher queue missing 批改台/待批改")
        if "示例学员" not in queue:
            errors.append("teacher queue missing new student submission")
        shot(page, "teacher-queue.png")

        # Open the newly submitted homework
        go(page, f"#teacher/grade/{new_id}")
        wait_ready(page)
        grade_txt = page.locator("#view").inner_text()
        if "评语" not in grade_txt or "萃取" not in grade_txt:
            errors.append("grade screen missing 评语 or rubric")
        # photos should be visible
        if page.locator(".photo-strip img").count() < 1:
            errors.append("grade screen missing photos")
        # fill comments via template + type
        page.click('button[data-action="grade-template"]')
        page.wait_for_timeout(100)
        page.fill("#grade-tip", "第二段再慢半拍。（示例提示）")
        # bump flavour score
        page.click('button[data-action="rubric-delta"][data-key="flavour"][data-delta="1"]')
        page.wait_for_timeout(200)
        shot(page, "teacher-grade.png")

        page.click('[data-testid="submit-grade"]')
        wait_ready(page)
        page.wait_for_timeout(300)
        # back to queue, filter may be pending so new item might disappear — switch to graded or all
        # confirm it's graded
        go(page, f"#teacher/grade/{new_id}")
        if "已批改" not in page.locator("#view").inner_text():
            errors.append("after grading, teacher view not 已批改")

        # Student sees feedback
        go(page, "#role")
        page.click('[data-testid="role-student"]')
        wait_ready(page)
        go(page, f"#student/homework/{new_id}")
        wait_ready(page)
        fb = page.locator("#view").inner_text()
        if "已批改" not in fb:
            errors.append("student feedback missing 已批改")
        if "Amy Liu" not in fb and "评语" not in fb and "的批改" not in fb:
            errors.append("student feedback missing teacher comments")
        if "评分细则" not in fb and "萃取" not in fb:
            errors.append("student feedback missing rubric")
        # scroll so comments + rubric are in frame
        shot(
            page,
            "student-feedback.png",
            scroll_js="""() => {
              const view = document.querySelector('#view');
              const el = document.querySelector('.feedback-box');
              if (!view || !el) return;
              const top = el.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop;
              view.scrollTop = Math.max(0, top - 8);
            }""",
        )

        # Tab bars
        go(page, "#teacher/queue")
        tabs = page.locator("#tabbar").inner_text()
        if "批改" not in tabs or "学员" not in tabs:
            errors.append("teacher tab bar missing 批改/学员")
        go(page, "#student/home")
        tabs = page.locator("#tabbar").inner_text()
        if "首页" not in tabs or "学习" not in tabs:
            errors.append("student tab bar missing 首页/学习")

        browser.close()

    report = {"ok": len(errors) == 0, "errors": errors, "logs": logs}
    (OUT / "verify-roles.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
