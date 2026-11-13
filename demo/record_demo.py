#!/usr/bin/env python3
"""Record a paced walkthrough of the live Summit Ridge lead system."""

import asyncio
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3847"
OUT_DIR = Path("/tmp/demo-rec")
W, H = 1280, 800
CHROME = "/usr/bin/google-chrome-stable"

CURSOR_JS = r"""
(() => {
  if (window.__demoCursorInstalled) return;
  window.__demoCursorInstalled = true;
  const style = document.createElement("style");
  style.id = "demo-cursor-style";
  style.textContent = `
    #demo-cursor {
      position: fixed;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;
      z-index: 2147483647;
      pointer-events: none;
      transform: translate(-2px, -1px);
      filter: drop-shadow(0 1px 1px rgba(18,28,51,0.45));
    }
  `;
  const svg = `
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2.5 L3 18.5 L7.2 14.6 L10.2 22 L13.1 20.7 L10.1 13.4 L16.5 13.2 Z"
            fill="#fff" stroke="#1b2a4a" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>`;
  function mount() {
    if (!document.getElementById("demo-cursor-style") && document.head) {
      document.head.appendChild(style);
    }
    if (document.body && !document.getElementById("demo-cursor")) {
      const el = document.createElement("div");
      el.id = "demo-cursor";
      el.innerHTML = svg;
      document.body.appendChild(el);
    }
  }
  window.moveDemoCursor = (x, y) => {
    const el = document.getElementById("demo-cursor");
    if (el) el.style.transform = `translate(${x - 2}px, ${y - 1}px)`;
  };
  const obs = new MutationObserver(mount);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
"""

marks = []
t0 = None


def mark(label):
    elapsed = time.time() - t0
    marks.append((elapsed, label))
    print(f"[{elapsed:6.1f}s] {label}", flush=True)


def pause(page, seconds):
    page.wait_for_timeout(int(seconds * 1000))


def move_cursor(page, x, y, steps=18):
    page.evaluate(
        """([x, y, steps]) => new Promise((resolve) => {
          const el = document.getElementById("demo-cursor");
          const cur = el ? el.getBoundingClientRect() : { left: 40, top: 40 };
          const x0 = cur.left, y0 = cur.top;
          let i = 0;
          function tick() {
            i += 1;
            const t = i / steps;
            const e = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
            const nx = x0 + (x - x0) * e;
            const ny = y0 + (y - y0) * e;
            if (window.moveDemoCursor) window.moveDemoCursor(nx, ny);
            if (i >= steps) resolve();
            else requestAnimationFrame(tick);
          }
          tick();
        })""",
        [x, y, steps],
    )
    page.mouse.move(x, y, steps=max(5, steps // 2))


def center_of(page, selector):
    loc = page.locator(selector).first
    loc.scroll_into_view_if_needed()
    page.wait_for_timeout(180)
    box = loc.bounding_box()
    if not box:
        raise RuntimeError(f"No box for {selector}")
    return box["x"] + box["width"] / 2, box["y"] + min(box["height"] / 2, 18)


def move_to(page, selector, steps=18):
    x, y = center_of(page, selector)
    move_cursor(page, x, y, steps)
    pause(page, 0.18)
    return x, y


def click_sel(page, selector, steps=18):
    x, y = move_to(page, selector, steps)
    page.mouse.click(x, y)
    pause(page, 0.25)


def type_into(page, selector, text, delay=42):
    click_sel(page, selector)
    page.locator(selector).first.fill("")
    page.keyboard.type(text, delay=delay)
    pause(page, 0.2)


def choose(page, selector, value):
    click_sel(page, selector)
    pause(page, 0.25)
    page.locator(selector).first.select_option(value)
    pause(page, 0.35)


def smooth_scroll(page, target_y, duration=1.6):
    page.evaluate(
        """([target, duration]) => new Promise((resolve) => {
          const start = window.scrollY;
          const dist = target - start;
          const t0 = performance.now();
          function frame(now) {
            const p = Math.min(1, (now - t0) / (duration * 1000));
            const e = p < 0.5 ? 2*p*p : -1 + (4 - 2*p)*p;
            window.scrollTo(0, start + dist * e);
            if (p < 1) requestAnimationFrame(frame);
            else resolve();
          }
          requestAnimationFrame(frame);
        })""",
        [target_y, duration],
    )


def max_scroll(page):
    return page.evaluate("Math.max(0, document.documentElement.scrollHeight - window.innerHeight)")


def run():
    global t0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*"):
        old.unlink()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            viewport={"width": W, "height": H},
            device_scale_factor=1,
            record_video_dir=str(OUT_DIR),
            record_video_size={"width": W, "height": H},
        )
        context.add_init_script(CURSOR_JS)
        page = context.new_page()
        t0 = time.time()

        # 1) Public form
        page.goto(BASE + "/", wait_until="networkidle")
        page.evaluate("window.moveDemoCursor && window.moveDemoCursor(80, 80)")
        mark("form loaded")
        pause(page, 2.8)
        # scroll to show the full form
        bottom = max_scroll(page)
        mark(f"scrolling form (max={bottom})")
        if bottom > 20:
            smooth_scroll(page, min(bottom, 520), 2.4)
            pause(page, 1.2)
            smooth_scroll(page, min(bottom, 980), 2.0)
            pause(page, 1.4)
            smooth_scroll(page, 0, 1.6)
            pause(page, 0.6)
        else:
            pause(page, 2.0)

        # 2) Fill a new Colorado emergency lead
        mark("filling form")
        type_into(page, "#full_name", "Elena Vargas")
        type_into(page, "#phone", "(303) 555-0164")
        type_into(page, "#email", "elena.vargas@email.com")
        choose(page, "#preferred_contact", "Phone")
        type_into(page, "#street", "847 Spruce St")
        type_into(page, "#city", "Boulder")
        choose(page, "#state", "CO")
        type_into(page, "#zip", "80302", delay=70)
        choose(page, "#property_type", "Residential")
        choose(page, "#roof_type", "Asphalt shingle")
        choose(page, "#service_needed", "Leak / emergency repair")
        choose(page, "#urgency", "Emergency — active leak")
        type_into(
            page,
            "#issue_description",
            "Hail last night opened a leak over the living room. Water is dripping from the ceiling and we need someone out today.",
            delay=28,
        )
        pause(page, 1.6)
        mark("submitting")
        click_sel(page, "form button[type=submit]")
        page.wait_for_url("**/thanks*", timeout=10000)
        page.wait_for_load_state("networkidle")
        mark("thank-you page")
        pause(page, 3.6)

        # 3) Log in, land on dashboard
        mark("login")
        page.goto(BASE + "/admin/login", wait_until="networkidle")
        pause(page, 0.8)
        type_into(page, "#username", "admin", delay=70)
        type_into(page, "#password", "SummitRidge2026!", delay=55)
        click_sel(page, "form button[type=submit]")
        page.wait_for_url("**/admin", timeout=10000)
        page.wait_for_selector("section.kpi-grid")
        page.wait_for_load_state("networkidle")
        mark("dashboard")
        pause(page, 3.2)
        # gentle peek at lower dashboard
        mid = max_scroll(page)
        if mid > 40:
            smooth_scroll(page, min(mid, 420), 1.8)
            pause(page, 2.0)
            smooth_scroll(page, 0, 1.2)
            pause(page, 1.0)
        else:
            pause(page, 2.0)
        # thumbnail of dashboard
        page.screenshot(path="/tmp/demo-rec/dash-frame.png")

        # 4) Notification bell — new lead alert
        mark("opening notifications")
        click_sel(page, "summary.bell-btn")
        page.wait_for_selector("details.notify-menu[open]")
        pause(page, 2.8)
        mark("opening Elena notification")
        click_sel(page, 'a.notify-item:has-text("Elena Vargas")')
        page.wait_for_url("**/admin/leads/**", timeout=10000)
        page.wait_for_selector("section.ai-panel")
        page.wait_for_load_state("networkidle")

        # 5) Lead detail — AI scoring
        mark("lead detail / AI scoring")
        # keep AI panel in view
        page.locator("section.ai-panel").scroll_into_view_if_needed()
        pause(page, 0.4)
        page.screenshot(path="/tmp/demo-rec/ai-frame.png")
        pause(page, 4.6)
        # slight scroll to show more of the record
        smooth_scroll(page, 280, 1.4)
        pause(page, 1.8)

        # 6) Tasks then email log
        mark("tasks")
        click_sel(page, 'nav.admin-nav a[href="/admin/tasks"]')
        page.wait_for_url("**/admin/tasks", timeout=10000)
        page.wait_for_load_state("networkidle")
        pause(page, 2.2)
        bottom = max_scroll(page)
        if bottom > 40:
            # show today/upcoming after overdue
            smooth_scroll(page, min(bottom, 500), 1.8)
            pause(page, 2.2)
        else:
            pause(page, 1.6)

        mark("email log")
        click_sel(page, 'nav.admin-nav a[href="/admin/emails"]')
        page.wait_for_url("**/admin/emails", timeout=10000)
        page.wait_for_load_state("networkidle")
        pause(page, 1.0)
        # Elena should be near the top; scroll a little if needed so her body is visible
        elena = page.locator("article.email-item:has-text('Elena Vargas')").first
        if elena.count():
            elena.scroll_into_view_if_needed()
        pause(page, 3.8)

        # 7) Lead list showing the scored lead
        mark("lead list")
        click_sel(page, 'nav.admin-nav a[href="/admin/leads"]')
        page.wait_for_url("**/admin/leads", timeout=10000)
        page.wait_for_load_state("networkidle")
        pause(page, 1.0)
        row = page.locator("table.leads-table a:has-text('Elena Vargas')").first
        if row.count():
            row.scroll_into_view_if_needed()
            move_to(page, "table.leads-table a:has-text('Elena Vargas')")
        pause(page, 3.8)
        mark("walkthrough done")

        video_path = page.video.path()
        context.close()
        browser.close()
        print("RAW_VIDEO", video_path)
        Path("/tmp/demo-rec/marks.txt").write_text(
            "\n".join(f"{t:.2f}\t{label}" for t, label in marks) + "\n"
        )
        return video_path


if __name__ == "__main__":
    run()
