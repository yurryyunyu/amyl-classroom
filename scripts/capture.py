#!/usr/bin/env python3
"""Capture 390x844 screenshots and verify navigation / no console errors."""
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots"
BASE = "http://127.0.0.1:8767/index.html"
STORE = "amyl-course-app-preview-v2"
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
    page.evaluate(
        """async () => {
          const imgs = Array.from(document.querySelectorAll('img')).filter(i => !i.complete);
          await Promise.all(imgs.map(img => new Promise(res => {
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
            setTimeout(res, 4000);
          })));
        }"""
    )
    page.wait_for_timeout(200)


def go(page, hash_):
    page.goto(BASE + hash_, wait_until="networkidle", timeout=30000)
    wait_ready(page)
    reset_scroll(page)


def shot(page, name):
    wait_ready(page)
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
            fail = req.failure
            errors.append(f"requestfailed: {u} {fail if fail else ''}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)
        page.on("requestfailed", on_requestfailed)

        page.goto(BASE, wait_until="domcontentloaded")
        page.evaluate(
            f"() => {{ localStorage.removeItem('{STORE}'); localStorage.removeItem('amyl-course-app-preview-v1'); }}"
        )
        go(page, "#student/home")

        for href, label in [
            ("#student/courses", "课程"),
            ("#student/community", "社区"),
            ("#student/learn", "学习"),
            ("#student/me", "我的"),
            ("#student/home", "首页"),
        ]:
            page.click(f'#tabbar a[href="{href}"]')
            wait_ready(page)
            h = page.evaluate("() => location.hash")
            if h != href:
                errors.append(f"tab {label} expected {href} got {h}")

        shot(page, "home.png")

        go(page, "#student/courses")
        shot(page, "courses.png")

        go(page, "#student/course/pour-over-intro")
        shot(page, "course-detail.png")

        go(page, "#student/product/dripper")
        page.click('[data-action="add-cart-go"]')
        wait_ready(page)
        page.click('[data-action="open-checkout"]')
        page.wait_for_selector(".sheet", state="visible")
        page.wait_for_timeout(280)
        shot(page, "checkout.png")
        page.click('[data-action="close-overlay"]')
        page.wait_for_selector("#overlay", state="hidden")

        go(page, "#student/shop")
        shot(page, "shop.png")

        go(page, "#student/learn")
        shot(page, "learn.png")

        go(page, "#student/homework/new")
        shot(page, "homework-submit.png")

        go(page, "#student/homework/hw-brew-graded")
        page.evaluate(
            """() => {
              const view = document.querySelector('#view');
              const el = document.querySelector('.feedback-box');
              if (!view || !el) return;
              const top = el.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop;
              view.scrollTop = Math.max(0, top - 8);
            }"""
        )
        page.wait_for_timeout(200)
        shot(page, "homework-feedback.png")

        go(page, "#student/me")
        shot(page, "me.png")

        go(page, "#student/member")
        shot(page, "member.png")

        go(page, "#student/community")
        shot(page, "community.png")

        go(page, "#student/post/post-xiaolin")
        page.evaluate(
            """() => {
              const view = document.querySelector('#view');
              const el = document.querySelector('.comments') || document.querySelector('h2.block-title');
              if (view && el) view.scrollTop = Math.max(0, el.offsetTop - 220);
            }"""
        )
        page.wait_for_timeout(200)
        shot(page, "post-detail.png")

        # Interactions
        go(page, "#student/product/dripper")
        page.click('[data-action="add-cart"]')
        page.wait_for_timeout(250)
        go(page, "#student/cart")
        cart_text = page.locator("#view").inner_text()
        if "滤杯" not in cart_text:
            errors.append("cart did not show added dripper")

        go(page, "#student/learn")
        page.click('[data-action="checkin"]')
        page.wait_for_timeout(400)
        toast = ""
        try:
            toast = page.locator("#toast").inner_text()
        except Exception:
            pass
        if "打卡" not in toast and "已经" not in toast:
            disabled = page.eval_on_selector(
                '[data-action="checkin"]', "el => el.disabled"
            )
            if not disabled:
                errors.append("check-in did not toast or disable")

        go(page, "#student/homework")
        if "待批改" not in page.locator("#view").inner_text():
            errors.append("homework list missing 待批改")

        # Like on post
        go(page, "#student/post/post-amy-1")
        page.click('[data-action="like"]')
        page.wait_for_timeout(200)
        liked = page.eval_on_selector('[data-action="like"]', "el => el.classList.contains('liked')")
        if not liked:
            errors.append("like toggle did not apply class")

        browser.close()

    report = {"ok": len(errors) == 0, "errors": errors, "logs": logs}
    (OUT / "verify.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
