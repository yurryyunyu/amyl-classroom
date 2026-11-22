/* Amyl 课堂 — static preview app. Example data only; no real payments. */
(function () {
  "use strict";

  const DATA = window.AMYL_DATA;
  const STORE_KEY = "amyl-course-app-preview-v2";

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function normalizeHomeworkItem(h) {
    const photos = (h.photos && h.photos.length) ? h.photos.slice() : (h.photo ? [h.photo] : []);
    return Object.assign({}, h, {
      photos,
      photo: photos[0] || h.photo || "",
      params: Object.assign({}, h.params || {}),
      type: h.type === "latte" ? "latte" : "brew",
      studentId: h.studentId || "me",
      studentName: h.studentName || (h.studentId && DATA.authors[h.studentId] ? DATA.authors[h.studentId].name : DATA.user.name)
    });
  }

  function loadState() {
    const base = {
      points: DATA.user.points,
      streak: DATA.user.streak,
      checkedInDates: DATA.user.checkedInDates.slice(),
      enrolled: JSON.parse(JSON.stringify(DATA.user.enrolled)),
      cart: {},
      liked: {},
      posts: DATA.posts.map((p) => Object.assign({}, p)),
      comments: JSON.parse(JSON.stringify(DATA.comments)),
      homework: DATA.homework.map((h) => Object.assign({}, h, { params: Object.assign({}, h.params) })),
      orders: DATA.orders.map((o) => Object.assign({}, o)),
      pointsHistory: DATA.pointsHistory.map((p) => Object.assign({}, p)),
      role: null,
      teacherFilter: "pending",
      teacherTypeFilter: "all",
      filterCourse: "全部",
      filterTag: "全部",
      draftHw: { type: null, dose: "15g", water: "250g", ratio: "1:16.7", grind: "", time: "", dripper: "V60", notes: "", photos: [], pattern: "心形", cupSize: "180ml", milkType: "全脂", milkTemp: "55–60°C" },
      draftGrade: {},
      draftPost: { tag: "手冲", title: "", body: "" }
    };
    base.homework = base.homework.map(normalizeHomeworkItem);
    DATA.posts.forEach((p) => {
      if (p.liked) base.liked[p.id] = true;
    });
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      const merged = Object.assign(base, saved, {
        draftHw: Object.assign(base.draftHw, saved.draftHw || {}),
        draftGrade: Object.assign({}, saved.draftGrade || {}),
        draftPost: Object.assign(base.draftPost, saved.draftPost || {})
      });
      merged.homework = (merged.homework || []).map(normalizeHomeworkItem);
      return merged;
    } catch (e) {
      return base;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          points: state.points,
          streak: state.streak,
          checkedInDates: state.checkedInDates,
          enrolled: state.enrolled,
          cart: state.cart,
          liked: state.liked,
          posts: state.posts,
          comments: state.comments,
          homework: state.homework,
          orders: state.orders,
          pointsHistory: state.pointsHistory,
          role: state.role,
          teacherFilter: state.teacherFilter,
          teacherTypeFilter: state.teacherTypeFilter
        })
      );
    } catch (e) { /* ignore quota */ }
  }

  let state = loadState();
  let toastTimer = 0;

  function todayISO() {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return f.format(new Date());
  }

  function nowTime() {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function money(n) {
    return "AUD " + Number(n).toFixed(Number.isInteger(n) ? 0 : 2);
  }

  function courseById(id) {
    return DATA.courses.find((c) => c.id === id);
  }
  function productById(id) {
    return DATA.products.find((p) => p.id === id);
  }
  function tierById(id) {
    return DATA.tiers.find((t) => t.id === id);
  }
  function currentTier() {
    const pts = state.points;
    let cur = DATA.tiers[0];
    for (const t of DATA.tiers) {
      if (pts >= t.minPoints) cur = t;
    }
    return cur;
  }
  function nextTier() {
    const cur = currentTier();
    const i = DATA.tiers.findIndex((t) => t.id === cur.id);
    return DATA.tiers[i + 1] || null;
  }
  function authorOf(id) {
    return DATA.authors[id] || { name: id, role: "member", tierId: "sprout", initial: "?" };
  }
  function isEnrolled(id) {
    return Boolean(state.enrolled[id]);
  }
  function cartCount() {
    return Object.values(state.cart).reduce((a, b) => a + b, 0);
  }
  function cartTotal() {
    return Object.entries(state.cart).reduce((sum, [id, qty]) => {
      const p = productById(id);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }
  function memberPrice(price) {
    const t = currentTier().id;
    const rate = t === "host" ? 0.8 : t === "barista" ? 0.85 : t === "roaster" ? 0.9 : 1;
    return Math.round(price * rate);
  }
  function likeCount(post) {
    const base = post.likes || 0;
    const original = DATA.posts.find((p) => p.id === post.id);
    const originallyLiked = original ? original.liked : false;
    const nowLiked = Boolean(state.liked[post.id]);
    if (nowLiked && !originallyLiked) return base + 1;
    if (!nowLiked && originallyLiked) return Math.max(0, base - 1);
    return base;
  }

  const ICONS = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    bag: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5z"/><path d="M5 21.5A2.5 2.5 0 0 1 7.5 19H20"/></svg>',
    community: '<svg viewBox="0 0 24 24"><path d="M5 16.5 3 20l4-1.5H16a3 3 0 0 0 3-3v-2"/><rect x="6" y="4" width="15" height="11" rx="3"/></svg>',
    learn: '<svg viewBox="0 0 24 24"><path d="M3 8.5 12 4l9 4.5-9 4.5L3 8.5z"/><path d="M7 10.8v4.7c0 .6 2.2 2.5 5 2.5s5-1.9 5-2.5v-4.7"/><path d="M21 9v6"/></svg>',
    me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 19.2c1.4-3.2 3.8-4.7 7-4.7s5.6 1.5 7 4.7"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.2C1.2 9.2 2.4 6 5.6 5.5c1.9-.3 3.4.7 4.4 2 1-1.3 2.5-2.3 4.4-2 3.2.5 4.4 3.7 2.8 6.3C19 15.6 12 20 12 20z"/></svg>',
    comment: '<svg viewBox="0 0 24 24"><path d="M5 16.5 3.5 20 8 18h8.5A3.5 3.5 0 0 0 20 14.5v-6A3.5 3.5 0 0 0 16.5 5h-9A3.5 3.5 0 0 0 4 8.5v8z"/></svg>',
    pin: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 21s7-5.8 7-11.2A7 7 0 0 0 5 9.8C5 15.2 12 21 12 21z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V10A1.5 1.5 0 0 1 4 8.5z"/><circle cx="12" cy="13.5" r="3.2"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.9-3 2.8-4.5 5.5-4.5s4.6 1.5 5.5 4.5"/><circle cx="17" cy="9" r="2.3"/><path d="M16.2 14.6c2 .3 3.5 1.6 4.3 4.4"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9 4.5h6v2.2H9z"/></svg>'
  };

  function parseRoute() {
    let h = (location.hash || "").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    let mode = null;
    let rest = parts;
    if (parts[0] === "role") return { mode: null, name: "role", id: null, parts: [], raw: h };
    if (parts[0] === "student" || parts[0] === "teacher") {
      mode = parts[0];
      rest = parts.slice(1);
    }
    const fallback = mode === "teacher" ? "queue" : "home";
    return { mode, name: rest[0] || fallback, id: rest[1] || null, sub: rest[2] || null, parts: rest, raw: h };
  }

  function pfx() {
    if (state.role === "teacher") return "#teacher/";
    if (state.role === "student") return "#student/";
    return "#";
  }

  function myHomework() {
    return state.homework.filter((h) => h.studentId === "me");
  }

  function hwTypeMeta(type) {
    const list = DATA.hwTypes || [];
    return list.find((t) => t.id === type) || list[0] || { id: "brew", nameZh: "冲煮", nameEn: "Brewing" };
  }

  function rubricFor(type) {
    const key = type === "latte" ? "latte" : "brew";
    return (DATA.rubrics && DATA.rubrics[key]) || DATA.rubrics.brew;
  }

  function templatesFor(type) {
    const key = type === "latte" ? "latte" : "brew";
    return (DATA.gradeTemplates && DATA.gradeTemplates[key]) || [];
  }

  function typeBadge(type) {
    const t = hwTypeMeta(type);
    return `<span class="tag-type ${t.id === "latte" ? "latte" : "brew"}">${esc(t.nameZh)}</span>`;
  }

  function emptyDraftHw() {
    return { type: null, dose: "15g", water: "250g", ratio: "1:16.7", grind: "", time: "", dripper: "V60", notes: "", photos: [], pattern: "心形", cupSize: "180ml", milkType: "全脂", milkTemp: "55–60°C" };
  }

  function pendingCount() {
    return state.homework.filter((h) => h.status === "pending").length;
  }

  function setRole(role) {
    state.role = role;
    saveState();
    location.hash = role === "teacher" ? "#teacher/queue" : "#student/home";
  }

  function avatarHTML(authorId, size) {
    const a = authorOf(authorId);
    const cls = size === "md" ? "avatar-md" : "avatar-sm";
    if (authorId === "amy") {
      return `<span class="${cls}"><img src="assets/avatar.jpg" alt=""></span>`;
    }
    return `<span class="${cls}" aria-hidden="true">${esc(a.initial)}</span>`;
  }

  function badgesHTML(authorId) {
    const a = authorOf(authorId);
    let html = "";
    if (a.role === "teacher") html += `<span class="tag-status teacher">老师</span>`;
    if (a.tierId) {
      const t = tierById(a.tierId);
      if (t) html += `<span class="tag-status tier">${esc(t.nameZh)}</span>`;
    }
    return html;
  }

  function authorRow(authorId, time) {
    const a = authorOf(authorId);
    return `<div class="author-row">
      ${avatarHTML(authorId, "sm")}
      <div style="flex:1;min-width:0">
        <div class="author-name">${esc(a.name)}</div>
        <div class="author-meta">${badgesHTML(authorId)}</div>
      </div>
      ${time ? `<span class="post-time">${esc(time)}</span>` : ""}
    </div>`;
  }

  function demoTag() {
    return `<span class="tag-demo">示例</span>`;
  }

  /* ---------- screens ---------- */

  function renderHome() {
    const featured = courseById("pour-over-intro");
    const enrolledId = Object.keys(state.enrolled)[0];
    const enrolled = enrolledId ? courseById(enrolledId) : null;
    const prog = enrolled ? state.enrolled[enrolledId] : null;
    const previewPost = state.posts[1] || state.posts[0];

    return `
      <section class="hello">
        <p class="kicker">Amyl Classroom</p>
        <h2>欢迎回来，${esc(DATA.user.name)}</h2>
        <p class="en">Welcome back</p>
      </section>
      <a class="camera-card" href="#student/homework/new" data-testid="cta-photo-hw">
        <span class="cam-ico" aria-hidden="true">${ICONS.camera}</span>
        <span>
          <strong>拍照交作业</strong>
          <em>Latte art or brewing</em>
          <p>暂时只有拉花和冲煮两种。照片只留在这台设备上。</p>
        </span>
      </a>
      <a class="chip-note" href="#member">
        ${ICONS.pin}
        <span>从官网 amylcoffee.com 进入 · 网站只负责介绍，买课、买物料和交作业都在 App 里完成。</span>
      </a>
      ${renderCheckinCard()}
      ${enrolled && prog ? `
        <a class="card" href="#learn" style="display:block;margin-top:12px">
          <div class="pad">
            <p class="kicker">继续学习 · Continue</p>
            <h3 style="margin-top:4px">${esc(enrolled.titleZh)} ${demoTag()}</h3>
            <p class="sub">${esc(enrolled.titleEn)} · 第 ${prog.currentLesson} / ${enrolled.lessons} 课</p>
            <div class="progress" style="margin-top:10px"><span style="width:${Math.round((prog.completed.length / enrolled.lessons) * 100)}%"></span></div>
          </div>
        </a>` : ""}
      <h2 class="block-title">精选课程<span class="en">Featured course</span></h2>
      <a class="card" href="#course/${esc(featured.id)}" style="display:block">
        <img class="cover" src="${esc(featured.image)}" alt="">
        <div class="pad">
          <p class="kicker coral">Featured</p>
          <h3>${esc(featured.titleZh)} ${demoTag()}</h3>
          <p class="sub">${esc(featured.titleEn)} · ${esc(featured.blurb)}</p>
          <p class="price" style="margin-top:8px"><small></small>${money(featured.price)}</p>
        </div>
      </a>
      <div class="quick">
        <a href="#shop"><strong>物料商城</strong><em>Materials</em></a>
        <a href="#homework"><strong>交作业</strong><em>Homework</em></a>
        <a href="#member"><strong>会员中心</strong><em>Membership</em></a>
        <a href="#community"><strong>社区</strong><em>Community</em></a>
      </div>
      ${previewPost ? `
        <h2 class="block-title">社区精选<span class="en">From the community</span></h2>
        <a class="card feed-item" href="#post/${esc(previewPost.id)}">
          <div class="pad">
            ${authorRow(previewPost.author, previewPost.time)}
            <div class="post-body">
              <h3>${esc(previewPost.titleZh)} ${demoTag()}</h3>
              <p>${esc(previewPost.body)}</p>
            </div>
          </div>
        </a>` : ""}
    `;
  }

  function weekDots() {
    /* Week of 16–22 Nov 2026, Mon–Sun. Today Sat 21. */
    const days = [
      { key: "2026-11-16", label: "一" },
      { key: "2026-11-17", label: "二" },
      { key: "2026-11-18", label: "三" },
      { key: "2026-11-19", label: "四" },
      { key: "2026-11-20", label: "五" },
      { key: "2026-11-21", label: "六" },
      { key: "2026-11-22", label: "日" }
    ];
    const today = todayISO();
    return days
      .map((d) => {
        const on = state.checkedInDates.includes(d.key);
        const isToday = d.key === today;
        return `<span><i class="dot${on ? " on" : ""}${isToday ? " today" : ""}"></i>${d.label}</span>`;
      })
      .join("");
  }

  function checkedInToday() {
    return state.checkedInDates.includes(todayISO());
  }

  function renderCheckinCard() {
    const done = checkedInToday();
    return `
      <div class="card checkin">
        <div class="top">
          <div>
            <p class="kicker">每日打卡 · Check-in</p>
            <p class="streak">连续 ${state.streak} 天</p>
            <p class="sub">完成打卡可积 5 分（示例）</p>
          </div>
          <button class="btn-gold btn-sm" data-action="checkin" ${done ? "disabled" : ""}>
            ${done ? "今日已打卡" : "今日打卡"}
          </button>
        </div>
        <div class="days">${weekDots()}</div>
      </div>
    `;
  }

  function renderCourses() {
    const filter = state.filterCourse || "全部";
    const list = DATA.courses.filter((c) => filter === "全部" || c.level === filter || c.hwType === (filter === "拉花" ? "latte" : filter === "冲煮" ? "brew" : filter));
    return `
      <p class="kicker" style="margin-bottom:8px">Courses</p>
      <div class="filters" role="tablist">
        ${["全部", "冲煮", "拉花"]
          .map(
            (f) =>
              `<button type="button" class="${f === filter ? "on" : ""}" data-action="filter-course" data-value="${esc(f)}">${esc(f)}</button>`
          )
          .join("")}
      </div>
      ${list
        .map(
          (c) => `
        <a class="card" href="#course/${esc(c.id)}" style="display:block;margin-bottom:12px">
          <img class="cover" src="${esc(c.image)}" alt="">
          <div class="pad">
            <div class="meta-row">
              <span class="tag-demo">${esc(c.level)}</span>
              ${demoTag()}
              ${isEnrolled(c.id) ? '<span class="tag-status graded">已购</span>' : ""}
            </div>
            <h3>${esc(c.titleZh)}</h3>
            <p class="sub">${esc(c.titleEn)} · ${c.lessons} 课 · ${esc(c.duration)}</p>
            <p class="price" style="margin-top:6px">${money(c.price)}</p>
          </div>
        </a>`
        )
        .join("")}
    `;
  }

  function renderCourse(id) {
    const c = courseById(id);
    if (!c) return `<div class="empty"><p>找不到这门课。</p><a href="#courses">返回课程</a></div>`;
    const owned = isEnrolled(c.id);
    const prog = state.enrolled[c.id];
    const sale = memberPrice(c.price);
    return `
      <article class="card course-hero" style="margin-bottom:14px">
        <img class="cover" src="${esc(c.image)}" alt="">
        <div class="pad">
          <div class="meta-row">${demoTag()}<span class="tag-demo">${esc(c.level)}</span></div>
          <h3 style="font-size:1.35rem">${esc(c.titleZh)}</h3>
          <p class="sub">${esc(c.titleEn)}</p>
          <p style="margin-top:8px">${esc(c.blurb)}</p>
          <p class="sub">${esc(c.blurbEn)}</p>
          <div class="meta-row">
            <span class="price">${money(c.price)}</span>
            ${sale < c.price ? `<span class="tiny">会员价 ${money(sale)}（示例 ${currentTier().nameZh} 权益）</span>` : ""}
          </div>
        </div>
      </article>
      <h2 class="block-title">你将获得<span class="en">What you get</span></h2>
      <ul class="includes">${c.includes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h2 class="block-title">课程大纲<span class="en">Lessons</span></h2>
      <ol class="outline">
        ${c.outline
          .map((l) => {
            const done = owned && prog && prog.completed.includes(l.n);
            const current = owned && prog && prog.currentLesson === l.n;
            const cls = done ? "done" : current ? "current" : "";
            return `<li class="${cls}">
              <span class="n">${done ? "✓" : l.n}</span>
              <span><strong>${esc(l.titleZh)}</strong><br><span class="tiny">${esc(l.titleEn)}</span></span>
              <span class="mins">${owned ? l.mins + " 分" : ICONS.bag.replace("width=\"22\"","width=\"14\"").replace("height=\"22\"","height=\"14\"")}</span>
            </li>`;
          })
          .join("")}
      </ol>
      <div class="bundle-hint" style="margin-top:16px">
        <strong>搭配物料</strong> · ${esc(DATA.bundle.labelZh)}，省 ${money(DATA.bundle.save)}。
        <a href="#shop" style="display:inline-block;margin-top:6px;border-bottom:1px solid var(--gold);font-weight:700">去商城看看</a>
      </div>
      <div class="buybar">
        <div>
          <div class="price">${money(owned ? 0 : sale)}</div>
          ${owned ? '<span class="tiny" style="color:var(--ink-2)">已开通</span>' : `<span class="tiny">示例价</span>`}
        </div>
        ${
          owned
            ? `<a class="btn-primary" href="#learn">进入学习</a>`
            : `<button class="btn-primary" type="button" data-action="open-checkout" data-course="${esc(c.id)}">购买课程</button>`
        }
      </div>
    `;
  }

  function renderShop() {
    return `
      <p class="kicker">Materials</p>
      <h2 class="block-title" style="margin-top:4px">课程物料</h2>
      <div class="bundle-hint">
        <strong>${esc(DATA.bundle.labelZh)}</strong>
        <div class="tiny" style="margin-top:4px">${esc(DATA.bundle.labelEn)} · 省 ${money(DATA.bundle.save)}（示例）</div>
        <button class="btn-gold btn-sm" style="margin-top:10px" type="button" data-action="add-bundle">加入购物车</button>
      </div>
      <div class="grid-2">
        ${DATA.products
          .map(
            (p) => `
          <a class="product-card" href="#product/${esc(p.id)}">
            <img class="cover" src="${esc(p.image)}" alt="">
            <div class="pad">
              <h3>${esc(p.titleZh)} ${demoTag()}</h3>
              <p class="sub">${esc(p.titleEn)}</p>
              <p class="price">${money(p.price)}</p>
            </div>
          </a>`
          )
          .join("")}
      </div>
    `;
  }

  function renderProduct(id) {
    const p = productById(id);
    if (!p) return `<div class="empty"><p>找不到这件商品。</p><a href="#shop">返回商城</a></div>`;
    const qty = state.cart[p.id] || 0;
    return `
      <article class="card" style="margin-bottom:14px">
        <img class="cover tall" src="${esc(p.image)}" alt="">
        <div class="pad">
          ${demoTag()}
          <h3 style="font-size:1.3rem;margin-top:6px">${esc(p.titleZh)}</h3>
          <p class="sub">${esc(p.titleEn)}</p>
          <p style="margin-top:8px">${esc(p.blurb)}</p>
          <p class="price" style="margin-top:10px">${money(p.price)}</p>
        </div>
      </article>
      <div class="bundle-hint">
        <strong>与课程一起买</strong> · ${esc(DATA.bundle.labelEn)}，省 ${money(DATA.bundle.save)}（示例）。
        ${!isEnrolled("pour-over-intro") ? `<div style="margin-top:8px"><a href="#course/pour-over-intro" style="font-weight:700;border-bottom:1px solid var(--gold)">先看入门课</a></div>` : ""}
      </div>
      <div class="btn-row">
        <button class="btn-ghost" type="button" data-action="add-cart" data-product="${esc(p.id)}">${qty ? "再加一件" : "加入购物车"}</button>
        <button class="btn-primary" type="button" data-action="add-cart-go" data-product="${esc(p.id)}">立即结算</button>
      </div>
    `;
  }

  function renderCart() {
    const ids = Object.keys(state.cart).filter((id) => state.cart[id] > 0);
    if (!ids.length) {
      return `<div class="empty">
        <p>购物车是空的。</p>
        <p class="sub">The cart is empty.</p>
        <a class="btn-primary" href="#shop" style="margin-top:16px;max-width:200px">去商城看看</a>
      </div>`;
    }
    const total = cartTotal();
    const hasBundleParts = DATA.bundle.productIds.every((id) => state.cart[id]);
    return `
      ${ids
        .map((id) => {
          const p = productById(id);
          if (!p) return "";
          const qty = state.cart[id];
          return `<div class="cart-item">
            <img src="${esc(p.image)}" alt="">
            <div>
              <strong>${esc(p.titleZh)}</strong> ${demoTag()}
              <div class="tiny">${esc(p.titleEn)}</div>
              <div class="qty">
                <button type="button" data-action="qty" data-product="${esc(id)}" data-delta="-1" aria-label="减少">−</button>
                <span>${qty}</span>
                <button type="button" data-action="qty" data-product="${esc(id)}" data-delta="1" aria-label="增加">+</button>
              </div>
            </div>
            <div class="price">${money(p.price * qty)}</div>
          </div>`;
        })
        .join("")}
      ${
        !hasBundleParts
          ? `<div class="bundle-hint" style="margin-top:14px">
              <strong>建议搭配课程物料</strong> · ${esc(DATA.bundle.labelZh)}，省 ${money(DATA.bundle.save)}（示例）。
              <button class="btn-gold btn-sm" style="margin-top:10px" type="button" data-action="add-bundle">加入组合</button>
            </div>`
          : `<div class="bundle-hint" style="margin-top:14px">已加入课程物料组合，结算时减 ${money(DATA.bundle.save)}（示例）。</div>`
      }
      ${!isEnrolled("pour-over-intro")
        ? `<div class="bundle-hint">还没有入门课？可以和物料一起买。
            <div style="margin-top:8px"><a href="#course/pour-over-intro" style="font-weight:700;border-bottom:1px solid var(--gold)">查看手冲入门四堂课</a></div>
          </div>`
        : ""}
      <div class="cart-total">
        <span>合计（示例）</span>
        <span class="price">${money(hasBundleParts ? total - DATA.bundle.save : total)}</span>
      </div>
      <button class="btn-primary" type="button" data-action="open-checkout" data-cart="1">去结算</button>
    `;
  }

  function renderLearn() {
    const ids = Object.keys(state.enrolled);
    return `
      ${renderCheckinCard()}
      <a class="camera-card" href="#student/homework/new">
        <span class="cam-ico" aria-hidden="true">${ICONS.camera}</span>
        <span>
          <strong>拍照交作业</strong>
          <em>Latte art or brewing</em>
          <p>暂时只有拉花和冲煮两种作业。</p>
        </span>
      </a>
      <div class="quick" style="margin-bottom:8px">
        <a href="#student/homework/new/latte"><strong>拉花作业</strong><em>Latte Art</em></a>
        <a href="#student/homework/new/brew"><strong>冲煮作业</strong><em>Brewing</em></a>
      </div>
      <h2 class="block-title">我的课程<span class="en">My courses</span></h2>
      ${
        ids.length
          ? ids
              .map((id) => {
                const c = courseById(id);
                if (!c) return "";
                const prog = state.enrolled[id];
                const pct = Math.round((prog.completed.length / c.lessons) * 100);
                return `
                <div class="card" style="margin-bottom:12px">
                  <a href="#course/${esc(c.id)}" class="row-card" style="grid-template-columns:76px 1fr">
                    <img src="${esc(c.image)}" alt="">
                    <div>
                      <h3>${esc(c.titleZh)} ${demoTag()}</h3>
                      <p class="sub">${esc(c.titleEn)} · 第 ${prog.currentLesson} / ${c.lessons} 课</p>
                      <div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div>
                    </div>
                  </a>
                  <div class="pad" style="padding-top:0">
                    <ol class="outline">
                      ${c.outline
                        .map((l) => {
                          const done = prog.completed.includes(l.n);
                          const current = prog.currentLesson === l.n;
                          return `<li class="${done ? "done" : current ? "current" : ""}">
                            <span class="n">${done ? "✓" : l.n}</span>
                            <span><strong>${esc(l.titleZh)}</strong><br><span class="tiny">${esc(l.titleEn)}</span></span>
                            <span class="mins">${l.mins} 分</span>
                          </li>`;
                        })
                        .join("")}
                    </ol>
                    <button class="btn-gold btn-sm" style="margin-top:8px" type="button" data-action="advance-lesson" data-course="${esc(c.id)}">标记本节完成（演示）</button>
                  </div>
                </div>`;
              })
              .join("")
          : `<div class="card pad"><p>还没有课程。先去课程页看看吧。</p><a class="btn-primary" href="#courses" style="margin-top:12px">浏览课程</a></div>`
      }
      <div class="quick">
        <a href="#homework"><strong>我的作业</strong><em>Homework</em></a>
        <a href="#shop"><strong>课程物料</strong><em>Materials</em></a>
      </div>
    `;
  }

  function hwThumb(h) {
    const src = (h.photos && h.photos[0]) || h.photo || "assets/featured-events.jpg";
    return esc(src);
  }

  function renderPhotoStrip(photos) {
    const list = photos && photos.length ? photos : [];
    if (!list.length) return `<div class="cover" style="background:#ddd4c4;min-height:120px"></div>`;
    return `<div class="photo-strip">
      ${list
        .map(
          (src) =>
            `<button type="button" data-action="view-photo" data-src="${esc(src)}"><img src="${esc(src)}" alt="作业照片"></button>`
        )
        .join("")}
    </div>`;
  }

  function renderHomeworkList() {
    const items = myHomework().slice().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    return `
      <p class="kicker">Homework</p>
      <a class="camera-card" href="#student/homework/new" data-testid="cta-photo-hw">
        <span class="cam-ico" aria-hidden="true">${ICONS.camera}</span>
        <span>
          <strong>拍照交作业</strong>
          <em>Latte art or brewing</em>
          <p>暂时只有拉花和冲煮两种。可连拍多张，仅本机预览。</p>
        </span>
      </a>
      ${items
        .map((h) => {
          const pending = h.status === "pending";
          const typ = hwTypeMeta(h.type);
          const extra = h.type === "latte" ? (h.params && h.params.pattern) : (h.params && h.params.dripper);
          return `<a class="card hw-item" href="#student/homework/${esc(h.id)}" style="display:block;margin-bottom:12px" data-testid="hw-item-${esc(h.id)}">
            <div class="row-card" style="grid-template-columns:76px 1fr">
              <img src="${hwThumb(h)}" alt="">
              <div>
                <div class="meta-row" style="margin:0 0 4px">
                  ${typeBadge(h.type)}
                  <span class="tag-status ${pending ? "pending" : "graded"}">${pending ? "待批改" : "已批改"}</span>
                  ${demoTag()}
                </div>
                <h3>${esc(typ.nameZh)}</h3>
                <p class="sub">${esc(typ.nameEn)}${extra ? " · " + esc(extra) : ""} · ${esc(h.submittedAt)}</p>
                ${h.feedback ? `<p class="sub">评分 ${h.feedback.total}/${h.feedback.max} · ${esc(h.feedback.badge)}</p>` : ""}
              </div>
            </div>
          </a>`;
        })
        .join("")}
      ${items.length === 0 ? `<div class="empty"><p>还没有交过作业。</p></div>` : ""}
    `;
  }

  function renderThumbs(photos) {
    if (!photos || !photos.length) return "";
    return `<div class="thumbs" id="hw-thumbs">
      ${photos
        .map(
          (src, i) => `<div class="thumb">
            <img src="${esc(src)}" alt="已选照片 ${i + 1}">
            <button type="button" class="x" data-action="remove-photo" data-index="${i}" aria-label="删除照片">×</button>
          </div>`
        )
        .join("")}
    </div>`;
  }

  function choiceRow(name, options, current) {
    return `<div class="choice-row">
      ${options
        .map(
          (opt) =>
            `<label><input type="radio" name="${esc(name)}" value="${esc(opt)}" ${opt === current ? "checked" : ""}/>${esc(opt)}</label>`
        )
        .join("")}
    </div>`;
  }

  function renderHomeworkTypeSelect() {
    return `
      <p class="kicker">Homework</p>
      <h2 class="block-title" style="margin-top:4px">选择作业类型<span class="en">Latte art or brewing</span></h2>
      <p class="sub" style="margin-bottom:14px">暂时只做拉花和冲煮两种作业（示例）。</p>
      <div class="type-pick">
        <a class="type-card" href="#student/homework/new/latte" data-testid="type-latte">
          <img src="assets/site-hero.webp" alt="">
          <div class="pad">
            <p class="kicker coral">Latte Art</p>
            <h3>拉花</h3>
            <p class="en-line">Photograph your pour</p>
            <p>拍下杯子里的图案，记下花形、杯量和奶泡。</p>
          </div>
        </a>
        <a class="type-card" href="#student/homework/new/brew" data-testid="type-brew">
          <img src="assets/featured-events.jpg" alt="">
          <div class="pad">
            <p class="kicker">Brewing</p>
            <h3>冲煮</h3>
            <p class="en-line">Photograph your brew</p>
            <p>拍下粉床和成品，记下粉量、滤杯和风味。</p>
          </div>
        </a>
      </div>
    `;
  }

  function renderPhotoField(photos, extraNote) {
    return `
        <div class="field">
          <label>作业照片 <span class="hint">Photos</span></label>
          <label class="uploader camera" id="hw-uploader">
            <input type="file" accept="image/*" capture="environment" multiple id="hw-photos" data-testid="hw-photos" />
            <div class="ph">
              <strong>拍照交作业</strong>
              点这里拍照或从相册选图，可多选（演示，仅本地）
            </div>
          </label>
          ${renderThumbs(photos)}
          ${extraNote || ""}
        </div>`;
  }

  function renderHomeworkSubmit(type) {
    const typ = hwTypeMeta(type);
    const d = state.draftHw;
    const photos = d.photos || [];
    const videoNote = type === "latte"
      ? `<p class="video-note">短视频稍后开放（演示）。现在请先拍照片。</p>`
      : "";
    const fields = type === "latte"
      ? `
        <div class="field"><label>图案 Pattern</label>${choiceRow("pattern", DATA.patterns, d.pattern || "心形")}</div>
        <div class="field"><label>杯量 Cup size</label>${choiceRow("cupSize", DATA.cupSizes, d.cupSize || "180ml")}</div>
        <div class="field"><label>牛奶 Milk</label>${choiceRow("milkType", DATA.milkTypes, d.milkType || "全脂")}</div>
        <div class="field"><label>奶温 Milk temp</label>${choiceRow("milkTemp", DATA.milkTemps, d.milkTemp || "55–60°C")}</div>
        <div class="field">
          <label>笔记 <span class="hint">Notes</span></label>
          <textarea name="notes" placeholder="对称、对比、哪里不满意…">${esc(d.notes)}</textarea>
        </div>`
      : `
        <div class="field"><label>滤杯 Dripper</label>${choiceRow("dripper", DATA.drippers, d.dripper || "V60")}</div>
        <div class="form-grid">
          <div class="field"><label>粉量 Dose</label><input name="dose" value="${esc(d.dose)}" /></div>
          <div class="field"><label>水量 Water</label><input name="water" value="${esc(d.water)}" /></div>
          <div class="field"><label>粉水比 Ratio</label><input name="ratio" value="${esc(d.ratio)}" /></div>
          <div class="field"><label>研磨 Grind</label><input name="grind" value="${esc(d.grind)}" placeholder="例如：中细" /></div>
        </div>
        <div class="field"><label>时间 Time</label><input name="time" value="${esc(d.time)}" placeholder="例如：2:45" /></div>
        <div class="field">
          <label>风味笔记 <span class="hint">Tasting notes</span></label>
          <textarea name="notes" placeholder="气味、味道、尾韵…">${esc(d.notes)}</textarea>
        </div>`;
    return `
      <p class="kicker">${esc(typ.nameEn)}</p>
      <h2 class="block-title" style="margin-top:4px">交一份${esc(typ.nameZh)}作业</h2>
      <p class="sub" style="margin-bottom:14px">在手机上会打开相机。照片只留在这台设备上，不会上传到服务器。</p>
      <form class="form" id="hw-form" data-type="${esc(typ.id)}">
        ${renderPhotoField(photos, videoNote)}
        ${fields}
        <button class="btn-primary" type="submit" data-testid="hw-submit">提交${esc(typ.nameZh)}作业（演示）</button>
      </form>
    `;
  }

  function renderHwParams(h) {
    const p = h.params || {};
    const rows = h.type === "latte"
      ? [
          ["图案", p.pattern],
          ["杯量", p.cupSize],
          ["牛奶", p.milkType],
          ["奶温", p.milkTemp]
        ]
      : [
          ["滤杯", p.dripper],
          ["粉量", p.dose],
          ["水量", p.water],
          ["粉水比", p.ratio],
          ["研磨", p.grind],
          ["时间", p.time]
        ];
    return rows
      .filter((r) => r[1])
      .map(([k, v]) => `<div><span class="tiny">${esc(k)}</span><div>${esc(v)}</div></div>`)
      .join("");
  }

  function renderHomeworkDetail(id) {
    const h = state.homework.find((x) => x.id === id);
    if (!h) return `<div class="empty"><p>找不到这份作业。</p><a href="#student/homework">返回作业</a></div>`;
    const pending = h.status === "pending";
    const fb = h.feedback;
    return `
      <div class="meta-row">
        ${typeBadge(h.type)}
        <span class="tag-status ${pending ? "pending" : "graded"}">${pending ? "待批改" : "已批改"}</span>
        ${demoTag()}
      </div>
      <h2 class="block-title" style="margin-top:6px">${esc(hwTypeMeta(h.type).nameZh)}<span class="en">${esc(hwTypeMeta(h.type).nameEn)}</span></h2>
      <article class="card" style="margin-bottom:14px">
        ${renderPhotoStrip(h.photos)}
        <div class="pad">
          <p class="tiny">提交于 ${esc(h.submittedAt)}${h.photos && h.photos.length > 1 ? " · " + h.photos.length + " 张照片" : ""}</p>
          <div class="form-grid" style="margin-top:10px">
            ${renderHwParams(h)}
          </div>
          <p style="margin-top:12px">${esc(h.notes)}</p>
        </div>
      </article>
      ${
        pending
          ? `<div class="card pad"><p>老师还没有批改。交出去后会出现在老师的批改台里（演示，数据存在这台设备上）。</p></div>`
          : `<div class="feedback-box" data-testid="feedback-box">
              <div class="who">${avatarHTML("amy", "sm")}<span>${esc(fb.by)} 的批改</span> <span class="tag-status teacher">老师</span></div>
              <p>${esc(fb.comments)}</p>
              ${fb.commentsEn ? `<p class="en">${esc(fb.commentsEn)}</p>` : ""}
              ${fb.tip ? `<p style="margin-top:8px"><strong>提示 · </strong>${esc(fb.tip)}</p>` : ""}
            </div>
            <h2 class="block-title">评分细则<span class="en">Rubric</span></h2>
            <div class="card pad rubric">
              ${fb.rubric
                .map(
                  (r) =>
                    `<div class="r-row"><span>${esc(r.nameZh)} <span class="tiny">${esc(r.nameEn)}</span></span><span class="score">${r.score}/${r.max}</span></div>`
                )
                .join("")}
              <div class="r-row"><strong>合计 · ${esc(fb.badge)}</strong><span class="score">${fb.total}/${fb.max}</span></div>
            </div>`
      }
    `;
  }

  function renderCommunity() {
    const tag = state.filterTag || "全部";
    const list = state.posts.filter((p) => tag === "全部" || p.tag === tag);
    return `
      <p class="kicker">Community</p>
      <div class="filters" role="tablist">
        ${DATA.categories
          .map(
            (f) =>
              `<button type="button" class="${f === tag ? "on" : ""}" data-action="filter-tag" data-value="${esc(f)}">${esc(f)}</button>`
          )
          .join("")}
      </div>
      ${list
        .map((p) => {
          const likes = likeCount(p);
          const comments = (state.comments[p.id] || []).length;
          return `<a class="card feed-item" href="#post/${esc(p.id)}" style="display:block;margin-bottom:12px">
            <div class="pad">
              ${authorRow(p.author, p.time)}
              <div class="post-body">
                <div class="meta-row" style="margin:8px 0 4px"><span class="tag-demo">${esc(p.tag)}</span> ${demoTag()}</div>
                <h3>${esc(p.titleZh)}</h3>
                <p>${esc(p.body)}</p>
              </div>
            </div>
            ${p.image ? `<img class="cover" src="${esc(p.image)}" alt="">` : ""}
            <div class="pad post-actions" style="padding-top:10px">
              <span>${ICONS.heart} ${likes}</span>
              <span>${ICONS.comment} ${comments}</span>
            </div>
          </a>`;
        })
        .join("")}
      ${list.length === 0 ? `<div class="empty"><p>这个分类暂时没有帖子。</p></div>` : ""}
      <button class="fab" type="button" data-action="open-compose">${ICONS.plus} 发帖</button>
    `;
  }

  function renderPost(id) {
    const p = state.posts.find((x) => x.id === id);
    if (!p) return `<div class="empty"><p>找不到这篇帖子。</p><a href="#community">返回社区</a></div>`;
    const comments = state.comments[p.id] || [];
    const liked = Boolean(state.liked[p.id]);
    return `
      <article class="card" style="margin-bottom:14px">
        <div class="pad">
          ${authorRow(p.author, p.time)}
          <div class="post-body">
            <div class="meta-row" style="margin:8px 0 4px"><span class="tag-demo">${esc(p.tag)}</span> ${demoTag()}</div>
            <h3 style="font-size:1.25rem">${esc(p.titleZh)}</h3>
            <p>${esc(p.body)}</p>
          </div>
        </div>
        ${p.image ? `<img class="cover" src="${esc(p.image)}" alt="">` : ""}
        <div class="pad post-actions">
          <button type="button" class="${liked ? "liked" : ""}" data-action="like" data-post="${esc(p.id)}">${ICONS.heart} ${likeCount(p)}</button>
          <span>${ICONS.comment} ${comments.length}</span>
        </div>
      </article>
      <h2 class="block-title">评论<span class="en">Comments</span></h2>
      <div class="comments">
        ${
          comments.length
            ? comments
                .map(
                  (c) => `<div class="comment">
                    ${avatarHTML(c.author, "sm")}
                    <div>
                      <div class="author-name">${esc(authorOf(c.author).name)} ${badgesHTML(c.author)}</div>
                      <p class="tiny">${esc(c.time)}</p>
                      <p style="margin-top:4px">${esc(c.text)}</p>
                    </div>
                  </div>`
                )
                .join("")
            : `<p class="sub">还没有评论。</p>`
        }
      </div>
      <form class="composer-inline form" id="comment-form" data-post="${esc(p.id)}">
        <input name="text" maxlength="200" placeholder="写一条评论（演示）" required />
        <button class="btn-primary btn-sm" type="submit">发送</button>
      </form>
    `;
  }

  function renderMember() {
    const cur = currentTier();
    const next = nextTier();
    const remain = next ? Math.max(0, next.minPoints - state.points) : 0;
    const start = cur.minPoints;
    const end = next ? next.minPoints : cur.minPoints;
    const pct = next ? Math.min(100, Math.round(((state.points - start) / (end - start)) * 100)) : 100;
    return `
      ${renderMemberCard(true)}
      <h2 class="block-title">会员等级<span class="en">Tiers · 示例</span></h2>
      <div class="tier-list">
        ${DATA.tiers
          .map((t) => {
            const on = t.id === cur.id;
            return `<div class="tier-item ${on ? "current" : ""}">
              <h3>${esc(t.nameZh)} <em>${esc(t.nameEn)}</em> ${on ? '<span class="tag-status graded">当前</span>' : ""} ${demoTag()}</h3>
              <p class="need">${t.minPoints === 0 ? "从 0 分开始" : "满 " + t.minPoints + " 分"}</p>
              <ul>${t.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
            </div>`;
          })
          .join("")}
      </div>
      <h2 class="block-title">如何积分<span class="en">Earn points</span></h2>
      <div class="card pad">
        <p>购买课程或物料按金额积分，每日打卡 +5，提交作业 +20，获评优秀再 +30。以上均为示例规则。</p>
        ${next ? `<p class="sub" style="margin-top:8px">再积 ${remain} 分可升至 ${esc(next.nameZh)}（进度 ${pct}%）。</p>` : `<p class="sub" style="margin-top:8px">已到最高示例等级。</p>`}
      </div>
      <h2 class="block-title">积分明细<span class="en">Points history</span></h2>
      <ul class="ledger">
        ${state.pointsHistory
          .map(
            (row) => `<li>
              <div>
                <div>${esc(row.title)} ${demoTag()}</div>
                <div class="when">${esc(row.date)} · ${esc(row.titleEn)}</div>
              </div>
              <div class="delta ${row.delta < 0 ? "neg" : ""}">${row.delta > 0 ? "+" : ""}${row.delta}</div>
            </li>`
          )
          .join("")}
      </ul>
    `;
  }

  function renderMemberCard(link) {
    const cur = currentTier();
    const next = nextTier();
    const remain = next ? Math.max(0, next.minPoints - state.points) : 0;
    const start = cur.minPoints;
    const end = next ? next.minPoints : cur.minPoints;
    const pct = next ? Math.min(100, Math.round(((state.points - start) / (end - start)) * 100)) : 100;
    return `
      <div class="member-card">
        <div class="inner">
          <div class="brand-row"><span>Amyl 会员</span><span>示例</span></div>
          <div class="tier">${esc(cur.nameZh)}</div>
          <div class="tier-en">${esc(cur.nameEn)}</div>
          <div class="who">${esc(DATA.user.name)} · ${esc(DATA.user.memberId)}</div>
          <div class="pts">${state.points} 积分</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="next">${next ? `距 ${esc(next.nameZh)} 还需 ${remain} 分` : "已是最高示例等级"}</div>
          ${link ? "" : `<a href="#member" class="enter">进入会员中心</a>`}
        </div>
      </div>
    `;
  }

  function renderMe() {
    return `
      <div class="profile-row">
        <div class="av">示</div>
        <div>
          <h3 style="font-family:var(--serif);font-size:1.25rem">${esc(DATA.user.name)}</h3>
          <p class="sub">${esc(DATA.user.email)}</p>
          <p class="tiny">之后可与官网 amylcoffee.com 同一账号登录</p>
        </div>
      </div>
      ${renderMemberCard(false)}
      <h2 class="block-title">我的订单<span class="en">Orders</span></h2>
      ${state.orders
        .map(
          (o) => `<div class="card" style="margin-bottom:10px">
            <div class="pad">
              <div class="meta-row" style="margin:0 0 4px">${demoTag()}<span class="tag-status graded">${esc(o.statusZh)}</span></div>
              <h3>${esc(o.titleZh)}</h3>
              <p class="sub">${esc(o.titleEn)} · ${esc(o.date)} · ${money(o.price)}</p>
            </div>
          </div>`
        )
        .join("")}
      <div class="role-switch">
        <span>当前是<strong>学生端</strong>（演示）</span>
        <a href="#role">切换身份</a>
      </div>
      <ul class="menu-list">
        <li><a href="#shop">物料商城<span class="chev">›</span></a></li>
        <li><a href="#homework">我的作业<span class="chev">›</span></a></li>
        <li><a href="#cart">购物车<span class="chev">›</span></a></li>
        <li><a href="#member">会员中心<span class="chev">›</span></a></li>
        <li><a href="#role">切换到老师端 / 学生端<span class="chev">›</span></a></li>
        <li><button type="button" data-action="reset-demo">重置演示数据<span class="chev">›</span></button></li>
      </ul>
    `;
  }

  function renderRoleSelect() {
    return `
      <section class="role-hero">
        <p class="kicker">Amyl Classroom</p>
        <h2>选择一个入口</h2>
        <p class="en">Student or teacher</p>
        <p class="note">这是演示切换。正式 App 会按登录账号识别身份，学生看到交作业，老师看到批改台。全部为示例数据，不会上传照片，也不会产生真实付款。</p>
      </section>
      <button type="button" class="role-card" data-action="choose-role" data-role="student" data-testid="role-student">
        <span class="who-av">示</span>
        <span>
          <h3>学生端</h3>
          <div class="en-line">Student</div>
          <p>拍照交作业、看批改、学课和打卡。</p>
        </span>
      </button>
      <button type="button" class="role-card teacher" data-action="choose-role" data-role="teacher" data-testid="role-teacher">
        <span class="who-av"><img src="assets/avatar.jpg" alt=""></span>
        <span>
          <h3>老师端</h3>
          <div class="en-line">Teacher</div>
          <p>批改作业、看学员队列、写下评分和评语。</p>
        </span>
      </button>
    `;
  }

  function renderTeacherQueue() {
    const filter = state.teacherFilter || "pending";
    const typeFilter = state.teacherTypeFilter || "all";
    const all = state.homework.slice().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    const pending = all.filter((h) => h.status === "pending").length;
    const graded = all.filter((h) => h.status === "graded").length;
    const items = all.filter((h) => {
      if (filter !== "all" && h.status !== filter) return false;
      if (typeFilter !== "all" && h.type !== typeFilter) return false;
      return true;
    });
    return `
      <p class="kicker">Review desk</p>
      <h2 class="block-title" style="margin-top:4px">批改台</h2>
      <div class="queue-counts">
        <button type="button" class="${filter === "pending" ? "on" : ""}" data-action="teacher-filter" data-value="pending">
          <span class="n">${pending}</span><span class="l">待批改</span>
        </button>
        <button type="button" class="${filter === "graded" ? "on" : ""}" data-action="teacher-filter" data-value="graded">
          <span class="n">${graded}</span><span class="l">已批改</span>
        </button>
        <button type="button" class="${filter === "all" ? "on" : ""}" data-action="teacher-filter" data-value="all">
          <span class="n">${all.length}</span><span class="l">全部</span>
        </button>
      </div>
      <div class="filters type-tabs" role="tablist">
        ${[
          ["all", "全部"],
          ["latte", "拉花"],
          ["brew", "冲煮"]
        ]
          .map(
            ([v, lab]) =>
              `<button type="button" class="${typeFilter === v ? "on" : ""}" data-action="teacher-type-filter" data-value="${v}">${lab}</button>`
          )
          .join("")}
      </div>
      ${items
        .map((h) => {
          const pending = h.status === "pending";
          const typ = hwTypeMeta(h.type);
          const extra = h.type === "latte" ? (h.params && h.params.pattern) : (h.params && h.params.dripper);
          return `<a class="card hw-item" href="#teacher/grade/${esc(h.id)}" style="display:block;margin-bottom:12px" data-testid="grade-item-${esc(h.id)}">
            <div class="row-card" style="grid-template-columns:76px 1fr">
              <img src="${hwThumb(h)}" alt="">
              <div>
                <div class="meta-row" style="margin:0 0 4px">
                  ${typeBadge(h.type)}
                  <span class="tag-status ${pending ? "pending" : "graded"}">${pending ? "待批改" : "已批改"}</span>
                  ${demoTag()}
                </div>
                <h3>${esc(h.studentName)}</h3>
                <p class="sub">${esc(typ.nameZh)}${extra ? " · " + esc(extra) : ""} · ${esc(h.submittedAt)}</p>
                ${h.feedback ? `<p class="sub">${h.feedback.total}/${h.feedback.max} · ${esc(h.feedback.badge)}</p>` : ""}
              </div>
            </div>
          </a>`;
        })
        .join("")}
      ${items.length === 0 ? `<div class="empty"><p>这个筛选下暂时没有作业。</p></div>` : ""}
    `;
  }

  function gradeDraftFor(id) {
    const h = state.homework.find((x) => x.id === id);
    const existing = (h && h.feedback) || {};
    const saved = state.draftGrade[id] || {};
    const list = rubricFor(h && h.type);
    const rubric = {};
    list.forEach((r) => {
      const prev = (existing.rubric || []).find((x) => x.nameZh === r.nameZh || x.nameEn === r.nameEn);
      rubric[r.key] = saved.rubric && saved.rubric[r.key] != null ? saved.rubric[r.key] : (prev ? prev.score : 8);
    });
    return {
      comments: saved.comments != null ? saved.comments : (existing.comments || ""),
      tip: saved.tip != null ? saved.tip : (existing.tip || ""),
      rubric
    };
  }

  function renderTeacherGrade(id) {
    const h = state.homework.find((x) => x.id === id);
    if (!h) return `<div class="empty"><p>找不到这份作业。</p><a href="#teacher/queue">返回批改台</a></div>`;
    const typ = hwTypeMeta(h.type);
    const rubric = rubricFor(h.type);
    const d = gradeDraftFor(id);
    const scores = rubric.map((r) => d.rubric[r.key] || 0);
    const total = scores.reduce((a, b) => a + b, 0);
    const max = rubric.length * 10;
    return `
      <div class="meta-row">
        ${typeBadge(h.type)}
        <span class="tag-status ${h.status === "pending" ? "pending" : "graded"}">${h.status === "pending" ? "待批改" : "已批改"}</span>
        ${demoTag()}
      </div>
      <h2 class="block-title" style="margin-top:6px">${esc(h.studentName)}<span class="en">${esc(typ.nameZh)} · ${esc(typ.nameEn)}</span></h2>
      <article class="card" style="margin-bottom:14px">
        ${renderPhotoStrip(h.photos)}
        <div class="pad">
          <p class="tiny">提交于 ${esc(h.submittedAt)}</p>
          <div class="form-grid" style="margin-top:10px">
            ${renderHwParams(h)}
          </div>
          <p style="margin-top:12px">${esc(h.notes)}</p>
        </div>
      </article>
      <form class="form" id="grade-form" data-id="${esc(id)}" data-type="${esc(h.type)}">
        <div class="field">
          <label>快捷评语 <span class="hint">Templates · 示例</span></label>
          <div class="templates">
            ${templatesFor(h.type).map((tp) => `<button type="button" data-action="grade-template" data-text="${esc(tp.text)}">${esc(tp.title)}</button>`).join("")}
          </div>
        </div>
        <div class="field">
          <label>评语 Comments</label>
          <textarea name="comments" id="grade-comments" placeholder="写给学生的批改…">${esc(d.comments)}</textarea>
        </div>
        <div class="field">
          <label>提示（可选） <span class="hint">Tip</span></label>
          <input name="tip" id="grade-tip" value="${esc(d.tip)}" placeholder="一句可执行的小建议" />
        </div>
        <h2 class="block-title">评分细则<span class="en">${esc(typ.nameZh)} rubric · /10 · 示例</span></h2>
        <div class="card pad rubric" id="grade-rubric">
          ${rubric
            .map(
              (r) => `<div class="r-row">
                <span>${esc(r.nameZh)} <span class="tiny">${esc(r.nameEn)}</span></span>
                <div class="stepper">
                  <button type="button" data-action="rubric-delta" data-key="${esc(r.key)}" data-delta="-1" aria-label="减少">−</button>
                  <output data-key="${esc(r.key)}">${d.rubric[r.key]}</output>
                  <button type="button" data-action="rubric-delta" data-key="${esc(r.key)}" data-delta="1" aria-label="增加">+</button>
                </div>
              </div>`
            )
            .join("")}
          <div class="r-row"><strong>合计</strong><span class="score" id="grade-total">${total}/${max}</span></div>
        </div>
        <button class="btn-primary" type="submit" data-testid="submit-grade" style="margin-top:16px">提交批改（演示）</button>
      </form>
    `;
  }

  function renderTeacherStudents() {
    const by = {};
    state.homework.forEach((h) => {
      const id = h.studentId || "me";
      if (!by[id]) by[id] = { id, name: h.studentName, items: [] };
      by[id].items.push(h);
    });
    const rows = Object.values(by);
    return `
      <p class="kicker">Students</p>
      <h2 class="block-title" style="margin-top:4px">学员</h2>
      ${rows
        .map((s) => {
          const pending = s.items.filter((x) => x.status === "pending").length;
          const last = s.items.slice().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
          return `<div class="card" style="margin-bottom:10px">
            <div class="pad">
              <div class="author-row">
                ${avatarHTML(s.id === "me" ? "me" : s.id, "md")}
                <div>
                  <div class="author-name">${esc(s.name)} ${demoTag()}</div>
                  <p class="sub">${s.items.length} 份作业${pending ? " · " + pending + " 份待批改" : ""}</p>
                  ${last ? `<p class="tiny">最近：${esc(last.titleZh)} · ${esc(last.submittedAt)}</p>` : ""}
                </div>
              </div>
            </div>
          </div>`;
        })
        .join("")}
    `;
  }

  function renderTeacherMe() {
    return `
      <div class="profile-row">
        <div class="av" style="padding:0;overflow:hidden"><img src="assets/avatar.jpg" alt="" style="width:64px;height:64px;object-fit:cover"></div>
        <div>
          <h3 style="font-family:var(--serif);font-size:1.25rem">Amy Liu</h3>
          <p class="sub">老师端 · Teacher</p>
          <p class="tiny">正式版会按登录账号进入此端</p>
        </div>
      </div>
      <div class="card pad" style="margin-bottom:14px">
        <p>待批改作业 <strong>${pendingCount()}</strong> 份（示例）</p>
        <a class="btn-gold btn-sm" href="#teacher/queue" style="margin-top:10px">打开批改台</a>
      </div>
      <div class="role-switch">
        <span>当前是<strong>老师端</strong>（演示）</span>
        <button type="button" data-action="choose-role" data-role="student">切到学生端</button>
      </div>
      <ul class="menu-list">
        <li><a href="#role">重新选择身份<span class="chev">›</span></a></li>
        <li><button type="button" data-action="reset-demo">重置演示数据<span class="chev">›</span></button></li>
      </ul>
    `;
  }

  function renderNotFound() {
    return `<div class="empty"><p>没有这个页面。</p><a href="#role">回入口</a></div>`;
  }

  /* ---------- chrome ---------- */

  function topbarConfig(route) {
    if (route.name === "role") return { title: "Amyl 课堂", sub: "Choose a role", brand: true, hideCart: true, hideBack: true };
    if (route.mode === "teacher" || state.role === "teacher") {
      const tmap = {
        queue: { title: "批改台", sub: "Review", hideCart: true },
        homework: { title: "批改台", sub: "Review", hideCart: true },
        grade: { title: "批改作业", sub: "Grade", back: "#teacher/queue", hideCart: true },
        students: { title: "学员", sub: "Students", hideCart: true },
        community: { title: "社区", sub: "Community", hideCart: true },
        post: { title: "帖子", sub: "Post", back: "#teacher/community", hideCart: true },
        me: { title: "我的", sub: "Teacher", hideCart: true }
      };
      return tmap[route.name] || { title: "老师端", sub: "Teacher", hideCart: true };
    }
    const map = {
      home: { title: "Amyl 课堂", sub: "Classroom", brand: true },
      courses: { title: "课程", sub: "Courses" },
      course: { title: "课程详情", sub: "Course", back: "#student/courses" },
      shop: { title: "物料商城", sub: "Shop", back: "#student/home" },
      product: { title: "商品详情", sub: "Product", back: "#student/shop" },
      cart: { title: "购物车", sub: "Cart", back: "#student/shop" },
      learn: { title: "学习", sub: "Learn" },
      homework: {
        title: route.id === "new"
          ? (route.sub === "latte" ? "拉花作业" : route.sub === "brew" ? "冲煮作业" : "选择作业")
          : route.id ? "作业详情" : "作业",
        sub: route.sub === "latte" ? "Latte Art" : route.sub === "brew" ? "Brewing" : "Homework",
        back: route.id === "new" && route.sub ? "#student/homework/new" : route.id ? "#student/homework" : "#student/learn"
      },
      me: { title: "我的", sub: "Me" },
      member: { title: "会员中心", sub: "Membership", back: "#student/me" },
      community: { title: "社区", sub: "Community" },
      post: { title: "帖子", sub: "Post", back: "#student/community" }
    };
    return map[route.name] || { title: "Amyl 课堂", sub: "" };
  }

  function renderTopbar(route) {
    const cfg = topbarConfig(route);
    const count = cartCount();
    const h1class = cfg.brand ? "" : "page-title";
    const hideBack = cfg.hideBack || !cfg.back;
    const right = cfg.hideCart
      ? (route.name === "role" ? `<span style="width:44px"></span>` : `<a class="icon-btn" href="#role" aria-label="切换身份" title="切换身份" style="font-size:11px;font-weight:700;letter-spacing:.04em;width:auto;padding:0 8px">切换</a>`)
      : `<a class="icon-btn" href="#student/cart" aria-label="购物车">${ICONS.bag}${count ? `<span class="cart-badge">${count}</span>` : ""}</a>`;
    $("#topbar").innerHTML = `
      <a class="back" href="${cfg.back || "#student/home"}" ${hideBack ? "hidden" : ""} aria-label="返回">${ICONS.back}</a>
      <div class="titles">
        <h1 class="${h1class}">${esc(cfg.title)}</h1>
        ${cfg.sub ? `<div class="sub">${esc(cfg.sub)}</div>` : ""}
      </div>
      ${right}
    `;
  }

  function renderStatus() {
    const el = $("#clock");
    if (el) el.textContent = nowTime();
  }

  function renderTabbar(route) {
    const bar = $("#tabbar");
    const teacher = (route.mode || state.role) === "teacher" && route.name !== "role";
    const pending = pendingCount();
    if (route.name === "role") {
      bar.innerHTML = "";
      return;
    }
    if (teacher) {
      bar.innerHTML = `
        <a href="#teacher/queue" data-tab="queue">${ICONS.clipboard}<span>批改</span>${pending ? `<span class="tab-badge">${pending}</span>` : ""}</a>
        <a href="#teacher/students" data-tab="students">${ICONS.users}<span>学员</span></a>
        <a href="#teacher/community" data-tab="community">${ICONS.community}<span>社区</span></a>
        <a href="#teacher/me" data-tab="me">${ICONS.me}<span>我的</span></a>
      `;
    } else {
      bar.innerHTML = `
        <a href="#student/home" data-tab="home">${ICONS.home}<span>首页</span></a>
        <a href="#student/courses" data-tab="courses">${ICONS.book}<span>课程</span></a>
        <a href="#student/community" data-tab="community">${ICONS.community}<span>社区</span></a>
        <a href="#student/learn" data-tab="learn">${ICONS.learn}<span>学习</span></a>
        <a href="#student/me" data-tab="me">${ICONS.me}<span>我的</span></a>
      `;
    }
  }

  function setActiveTab(route) {
    const teacher = (route.mode || state.role) === "teacher";
    const tabMap = teacher
      ? { queue: "queue", homework: "queue", grade: "queue", students: "students", community: "community", post: "community", me: "me" }
      : { home: "home", courses: "courses", course: "courses", community: "community", post: "community", learn: "learn", homework: "learn", me: "me", member: "me", shop: "home", product: "home", cart: "home" };
    const tab = tabMap[route.name] || "";
    $$("#tabbar a").forEach((a) => {
      a.classList.toggle("active", a.dataset.tab === tab);
    });
  }

  /* ---------- sheets / toast ---------- */

  function showToast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  }

  function closeOverlay() {
    const o = $("#overlay");
    o.hidden = true;
    o.innerHTML = "";
  }

  function openOverlay(inner) {
    const o = $("#overlay");
    o.innerHTML = inner;
    o.hidden = false;
  }

  function openCheckout(opts) {
    const course = opts.courseId ? courseById(opts.courseId) : null;
    const fromCart = Boolean(opts.cart);
    const ids = fromCart ? Object.keys(state.cart).filter((id) => state.cart[id] > 0) : [];
    const hasBundle = fromCart && DATA.bundle.productIds.every((id) => state.cart[id]);
    const goodsTotal = fromCart ? cartTotal() : 0;
    const goodsSale = hasBundle ? goodsTotal - DATA.bundle.save : goodsTotal;
    const cPrice = course ? memberPrice(course.price) : 0;
    let bundleChecked = false;

    function linesHTML(withBundle) {
      let rows = "";
      let total = 0;
      if (course) {
        rows += `<div class="sheet-line"><span>${esc(course.titleZh)}（会员示例价）</span><span>${money(cPrice)}</span></div>`;
        total += cPrice;
        if (withBundle) {
          const add = DATA.bundle.productIds.reduce((s, id) => s + productById(id).price, 0) - DATA.bundle.save;
          rows += `<div class="sheet-line"><span>${esc(DATA.bundle.labelZh)}</span><span>${money(add)}</span></div>`;
          total += add;
        }
      }
      if (fromCart) {
        ids.forEach((id) => {
          const p = productById(id);
          rows += `<div class="sheet-line"><span>${esc(p.titleZh)} × ${state.cart[id]}</span><span>${money(p.price * state.cart[id])}</span></div>`;
        });
        if (hasBundle) rows += `<div class="sheet-line"><span>组合优惠（示例）</span><span>− ${money(DATA.bundle.save)}</span></div>`;
        total += goodsSale;
      }
      rows += `<div class="sheet-line total"><span>应付（演示）</span><span class="price">${money(total)}</span></div>`;
      return { rows, total };
    }

    function paint() {
      const { rows } = linesHTML(bundleChecked);
      $("#checkout-lines").innerHTML = rows;
    }

    openOverlay(`
      <div class="sheet" role="dialog" aria-labelledby="co-title">
        <div class="handle"></div>
        <h2 id="co-title">确认订单</h2>
        <p class="sub">Checkout · Demo</p>
        <div class="demo-alert">这是演示结算，不会产生真实付款，也不会向你收取任何费用。<br>Demo only — no real payment.</div>
        ${
          course
            ? `<label class="check-row">
                <input type="checkbox" id="bundle-check" />
                <span><strong>同时搭配课程物料</strong><br><span class="tiny">${esc(DATA.bundle.labelZh)}，省 ${money(DATA.bundle.save)}（示例）</span></span>
              </label>`
            : ""
        }
        <div id="checkout-lines"></div>
        <button class="btn-primary" type="button" data-action="confirm-demo-pay" style="margin-top:8px">确认购买（演示）</button>
        <button class="btn-ghost" type="button" data-action="close-overlay" style="margin-top:8px">取消</button>
      </div>
    `);
    paint();
    const box = $("#bundle-check");
    if (box) {
      box.addEventListener("change", () => {
        bundleChecked = box.checked;
        paint();
      });
    }
    const confirmBtn = $('[data-action="confirm-demo-pay"]');
    confirmBtn.addEventListener("click", () => confirmDemoPay({ course, fromCart, bundleChecked: box ? box.checked : false }));
  }

  function confirmDemoPay({ course, fromCart, bundleChecked }) {
    const now = todayISO();
    if (course && !isEnrolled(course.id)) {
      state.enrolled[course.id] = { currentLesson: 1, completed: [] };
      const paid = memberPrice(course.price);
      state.orders.unshift({
        id: "ord-" + Date.now(),
        type: "course",
        titleZh: course.titleZh,
        titleEn: course.titleEn,
        price: paid,
        date: now,
        statusZh: "已开通（演示）",
        statusEn: "Unlocked (demo)"
      });
      addPoints(paid, "购买「" + course.titleZh + "」（演示）", "Demo course purchase");
    }
    const addIds = [];
    if (fromCart) addIds.push(...Object.keys(state.cart).filter((id) => state.cart[id] > 0));
    if (bundleChecked) DATA.bundle.productIds.forEach((id) => addIds.push(id));
    const unique = Array.from(new Set(addIds));
    unique.forEach((id) => {
      const p = productById(id);
      if (!p) return;
      const qty = fromCart && state.cart[id] ? state.cart[id] : 1;
      state.orders.unshift({
        id: "ord-" + Date.now() + "-" + id,
        type: "product",
        titleZh: p.titleZh,
        titleEn: p.titleEn,
        price: p.price * qty,
        date: now,
        statusZh: "演示下单",
        statusEn: "Demo order"
      });
      addPoints(p.price * qty, "购买「" + p.titleZh + "」（演示）", "Demo materials purchase", true);
    });
    if (fromCart) state.cart = {};
    saveState();
    closeOverlay();
    showToast("演示成功，未产生真实付款");
    renderApp();
    if (course) location.hash = "#learn";
    else location.hash = "#me";
  }

  function addPoints(delta, title, titleEn, skipSave) {
    state.points += delta;
    state.pointsHistory.unshift({
      id: "p-" + Date.now() + Math.random(),
      date: todayISO(),
      title,
      titleEn,
      delta
    });
    if (!skipSave) saveState();
  }

  function openCompose() {
    const d = state.draftPost;
    openOverlay(`
      <div class="sheet" role="dialog" aria-labelledby="cmp-title">
        <div class="handle"></div>
        <h2 id="cmp-title">发一张帖</h2>
        <p class="sub">Compose · Demo only, stays on this device.</p>
        <form class="form" id="compose-form" style="margin-top:12px">
          <div class="field">
            <label>分类 Tag</label>
            <select name="tag">${["手冲", "器具", "豆子", "作业分享", "问答"].map((t) => `<option ${t === d.tag ? "selected" : ""}>${t}</option>`).join("")}</select>
          </div>
          <div class="field"><label>标题</label><input name="title" maxlength="40" required value="${esc(d.title)}" placeholder="短一点的标题" /></div>
          <div class="field"><label>正文</label><textarea name="body" required placeholder="分享一次冲煮、提问或作业。">${esc(d.body)}</textarea></div>
          <button class="btn-primary" type="submit">发布（演示）</button>
          <button class="btn-ghost" type="button" data-action="close-overlay" style="margin-top:8px">取消</button>
        </form>
      </div>
    `);
    $("#compose-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const id = "post-local-" + Date.now();
      state.posts.unshift({
        id,
        author: "me",
        tag: String(fd.get("tag") || "手冲"),
        time: "刚刚",
        titleZh: String(fd.get("title") || "").trim(),
        body: String(fd.get("body") || "").trim() + "（示例帖，仅本地可见）",
        image: null,
        likes: 0,
        liked: false
      });
      state.comments[id] = [];
      state.draftPost = { tag: "手冲", title: "", body: "" };
      saveState();
      closeOverlay();
      showToast("已发布到本机演示社区");
      location.hash = "#post/" + id;
    });
  }

  /* ---------- actions ---------- */

  function doCheckin() {
    if (checkedInToday()) {
      showToast("今天已经打过卡了");
      return;
    }
    state.checkedInDates.push(todayISO());
    state.streak += 1;
    addPoints(5, "每日打卡", "Daily check-in");
    saveState();
    showToast("打卡成功，积分 +5（示例）");
    renderApp();
  }

  function addToCart(id, n) {
    const p = productById(id);
    if (!p) return;
    const next = (state.cart[id] || 0) + (n || 1);
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = next;
    saveState();
  }

  function addBundle() {
    DATA.bundle.productIds.forEach((id) => {
      if (!state.cart[id]) state.cart[id] = 1;
    });
    saveState();
    showToast("已加入课程物料组合（示例）");
    renderApp();
  }

  function advanceLesson(courseId) {
    const c = courseById(courseId);
    const prog = state.enrolled[courseId];
    if (!c || !prog) return;
    if (!prog.completed.includes(prog.currentLesson)) prog.completed.push(prog.currentLesson);
    if (prog.currentLesson < c.lessons) prog.currentLesson += 1;
    saveState();
    showToast("已标记完成（演示）");
    renderApp();
  }

  function readFilesAsDataURLs(files) {
    return Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
              const max = 1200;
              let w = img.width;
              let h = img.height;
              if (Math.max(w, h) > max) {
                const s = max / Math.max(w, h);
                w = Math.round(w * s);
                h = Math.round(h * s);
              }
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              URL.revokeObjectURL(url);
              resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.onerror = () => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => resolve("");
              reader.readAsDataURL(file);
              URL.revokeObjectURL(url);
            };
            img.src = url;
          })
      )
    ).then((urls) => urls.filter(Boolean));
  }

  function currentRubricScores() {
    const out = {};
    $$("#grade-rubric output[data-key]").forEach((el) => {
      out[el.getAttribute("data-key")] = Number(el.textContent) || 0;
    });
    return out;
  }

  function updateGradeTotal() {
    const scores = currentRubricScores();
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const form = $("#grade-form");
    const type = form && form.getAttribute("data-type");
    const max = rubricFor(type).length * 10;
    const el = $("#grade-total");
    if (el) el.textContent = total + "/" + max;
  }

  function badgeFor(total, max) {
    const r = max ? total / max : 0;
    if (r >= 0.8) return "优秀";
    if (r >= 0.6) return "良好";
    return "继续练习";
  }

  function submitGrade(id) {
    const h = state.homework.find((x) => x.id === id);
    if (!h) return;
    const comments = ($("#grade-comments") && $("#grade-comments").value.trim()) || "";
    if (!comments) {
      showToast("请先写一句评语（演示）");
      return;
    }
    const tip = ($("#grade-tip") && $("#grade-tip").value.trim()) || "";
    const scores = currentRubricScores();
    const rubric = rubricFor(h.type).map((r) => ({
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      score: scores[r.key] || 0,
      max: 10
    }));
    const total = rubric.reduce((a, b) => a + b.score, 0);
    const max = rubric.length * 10;
    const badge = badgeFor(total, max);
    h.status = "graded";
    h.gradedAt = todayISO() + " " + nowTime();
    h.feedback = {
      by: "Amy Liu",
      comments,
      tip,
      rubric,
      total,
      max,
      badge
    };
    delete state.draftGrade[id];
    if (h.studentId === "me") {
      addPoints(20, "作业获批改「" + h.titleZh + "」", "Homework graded", true);
      if (badge === "优秀") addPoints(10, "作业获评优秀", "Homework rated excellent", true);
    }
    saveState();
    showToast(h.studentId === "me" ? "已批改，学员积分已记上（示例）" : "已批改（示例）");
    location.hash = "#teacher/queue";
  }

  function bindViewEvents(route) {
    const view = $("#view");
    if (route.name === "homework" && (route.id === "new" || route.id === "submit")) {
      const form = $("#hw-form");
      const photo = $("#hw-photos");
      if (photo) {
        photo.addEventListener("change", () => {
          const files = photo.files ? Array.from(photo.files) : [];
          if (!files.length) return;
          readFilesAsDataURLs(files).then((urls) => {
            state.draftHw.photos = (state.draftHw.photos || []).concat(urls);
            const thumbs = $("#hw-thumbs");
            const html = renderThumbs(state.draftHw.photos);
            if (thumbs) thumbs.outerHTML = html;
            else $("#hw-uploader").insertAdjacentHTML("afterend", html);
            photo.value = "";
          });
        });
      }
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const type = form.getAttribute("data-type") === "latte" ? "latte" : "brew";
          const typ = hwTypeMeta(type);
          const photos = (state.draftHw.photos || []).slice();
          if (!photos.length) {
            showToast("请先拍一张或选一张照片（演示）");
            return;
          }
          const id = "hw-local-" + type + "-" + Date.now();
          const params = type === "latte"
            ? {
                pattern: String(fd.get("pattern") || "心形"),
                cupSize: String(fd.get("cupSize") || "180ml"),
                milkType: String(fd.get("milkType") || "全脂"),
                milkTemp: String(fd.get("milkTemp") || "55–60°C")
              }
            : {
                dose: String(fd.get("dose") || ""),
                water: String(fd.get("water") || ""),
                ratio: String(fd.get("ratio") || ""),
                grind: String(fd.get("grind") || ""),
                time: String(fd.get("time") || ""),
                dripper: String(fd.get("dripper") || "V60")
              };
          state.homework.unshift({
            id,
            type,
            studentId: "me",
            studentName: DATA.user.name,
            courseId: typ.courseId,
            titleZh: typ.nameZh,
            titleEn: typ.nameEn,
            status: "pending",
            submittedAt: todayISO() + " " + nowTime(),
            photo: photos[0],
            photos,
            params,
            notes: (String(fd.get("notes") || "").trim() || "（未填写笔记）") + "（示例提交，仅本地可见）"
          });
          addPoints(20, "提交作业「" + typ.nameZh + "」", "Homework submitted");
          state.draftHw = emptyDraftHw();
          saveState();
          showToast("作业已提交，等待老师批改（演示）");
          location.hash = "#student/homework/" + id;
        });
      }
    }
    if (route.name === "grade") {
      const form = $("#grade-form");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          submitGrade(form.getAttribute("data-id"));
        });
      }
    }
    if (route.name === "post") {
      const form = $("#comment-form");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const text = String(new FormData(form).get("text") || "").trim();
          if (!text) return;
          const pid = form.getAttribute("data-post");
          if (!state.comments[pid]) state.comments[pid] = [];
          state.comments[pid].push({
            id: "c-local-" + Date.now(),
            author: "me",
            time: "刚刚",
            text: text + "（示例）"
          });
          saveState();
          showToast("评论已发布（演示）");
          renderApp();
        });
      }
    }
  }

  /* ---------- router ---------- */

  function renderStudentScreen(route) {
    switch (route.name) {
      case "home":
        return renderHome();
      case "courses":
        return renderCourses();
      case "course":
        return renderCourse(route.id);
      case "shop":
        return renderShop();
      case "product":
        return renderProduct(route.id);
      case "cart":
        return renderCart();
      case "learn":
        return renderLearn();
      case "homework":
        if (route.id === "new" || route.id === "submit") {
          if (route.sub === "latte" || route.sub === "brew") return renderHomeworkSubmit(route.sub);
          return renderHomeworkTypeSelect();
        }
        if (route.id) return renderHomeworkDetail(route.id);
        return renderHomeworkList();
      case "me":
        return renderMe();
      case "member":
        return renderMember();
      case "community":
        return renderCommunity();
      case "post":
        return renderPost(route.id);
      default:
        return renderNotFound();
    }
  }

  function renderTeacherScreen(route) {
    switch (route.name) {
      case "queue":
      case "homework":
        return renderTeacherQueue();
      case "grade":
        return renderTeacherGrade(route.id);
      case "students":
        return renderTeacherStudents();
      case "community":
        return renderCommunity();
      case "post":
        return renderPost(route.id);
      case "me":
        return renderTeacherMe();
      default:
        return renderTeacherQueue();
    }
  }

  function renderApp() {
    const route = parseRoute();
    if (route.mode === "student" || route.mode === "teacher") {
      if (state.role !== route.mode) {
        state.role = route.mode;
        saveState();
      }
    }
    if (!state.role && route.name !== "role") {
      if (location.hash !== "#role") {
        location.hash = "#role";
        return;
      }
    }
    const app = $("#app");
    app.classList.toggle("mode-role", route.name === "role");
    app.classList.toggle("mode-teacher", (route.mode || state.role) === "teacher" && route.name !== "role");
    app.classList.toggle("mode-student", (route.mode || state.role) === "student" && route.name !== "role");

    let html = "";
    if (route.name === "role") html = renderRoleSelect();
    else if ((route.mode || state.role) === "teacher") html = renderTeacherScreen(route);
    else html = renderStudentScreen(route);

    $("#view").innerHTML = html;
    $("#view").scrollTop = 0;
    window.scrollTo(0, 0);
    renderTabbar(route);
    renderTopbar(route);
    renderStatus();
    setActiveTab(route);
    bindViewEvents(route);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) {
      if (e.target.id === "overlay") closeOverlay();
      return;
    }
    const action = t.getAttribute("data-action");
    if (action === "checkin") {
      e.preventDefault();
      doCheckin();
    } else if (action === "filter-course") {
      state.filterCourse = t.getAttribute("data-value");
      renderApp();
    } else if (action === "filter-tag") {
      state.filterTag = t.getAttribute("data-value");
      renderApp();
    } else if (action === "open-checkout") {
      e.preventDefault();
      openCheckout({ courseId: t.getAttribute("data-course"), cart: t.getAttribute("data-cart") });
    } else if (action === "close-overlay") {
      e.preventDefault();
      closeOverlay();
    } else if (action === "add-cart" || action === "add-cart-go") {
      e.preventDefault();
      addToCart(t.getAttribute("data-product"), 1);
      renderApp();
      showToast("已加入购物车（示例）");
      if (action === "add-cart-go") location.hash = "#cart";
    } else if (action === "add-bundle") {
      e.preventDefault();
      addBundle();
    } else if (action === "qty") {
      e.preventDefault();
      addToCart(t.getAttribute("data-product"), Number(t.getAttribute("data-delta")));
      renderApp();
    } else if (action === "open-compose") {
      e.preventDefault();
      openCompose();
    } else if (action === "like") {
      e.preventDefault();
      const id = t.getAttribute("data-post");
      state.liked[id] = !state.liked[id];
      saveState();
      renderApp();
    } else if (action === "advance-lesson") {
      e.preventDefault();
      advanceLesson(t.getAttribute("data-course"));
    } else if (action === "reset-demo") {
      e.preventDefault();
      try {
        localStorage.removeItem(STORE_KEY);
      } catch (err) { /* ignore */ }
      state = loadState();
      showToast("已恢复示例数据");
      location.hash = "#role";
      renderApp();
    } else if (action === "choose-role") {
      e.preventDefault();
      setRole(t.getAttribute("data-role"));
    } else if (action === "teacher-filter") {
      state.teacherFilter = t.getAttribute("data-value");
      renderApp();
    } else if (action === "teacher-type-filter") {
      state.teacherTypeFilter = t.getAttribute("data-value");
      renderApp();
    } else if (action === "remove-photo") {
      e.preventDefault();
      const i = Number(t.getAttribute("data-index"));
      state.draftHw.photos.splice(i, 1);
      const box = $("#hw-thumbs");
      const html = renderThumbs(state.draftHw.photos);
      if (box) {
        if (html) box.outerHTML = html;
        else box.remove();
      }
    } else if (action === "grade-template") {
      e.preventDefault();
      const area = $("#grade-comments");
      if (!area) return;
      const add = t.getAttribute("data-text") || "";
      area.value = area.value.trim() ? area.value.trim() + " " + add : add;
    } else if (action === "rubric-delta") {
      e.preventDefault();
      const key = t.getAttribute("data-key");
      const out = $(`#grade-rubric output[data-key="${key}"]`);
      if (!out) return;
      const next = Math.max(0, Math.min(10, (Number(out.textContent) || 0) + Number(t.getAttribute("data-delta"))));
      out.textContent = String(next);
      updateGradeTotal();
    } else if (action === "view-photo") {
      e.preventDefault();
      const src = t.getAttribute("data-src");
      openOverlay(`
        <div class="sheet lightbox" role="dialog">
          <div class="handle"></div>
          <img src="${esc(src)}" alt="作业照片大图">
          <button class="btn-ghost" type="button" data-action="close-overlay" style="margin-top:12px">关闭</button>
        </div>
      `);
    }
  });

  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href || href === "#" || href === "#role") return;
      if (href.startsWith("#student/") || href.startsWith("#teacher/")) return;
      if (!state.role) return;
      e.preventDefault();
      location.hash = "#" + state.role + "/" + href.slice(1);
    },
    true
  );

  window.addEventListener("hashchange", renderApp);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  if (!location.hash) {
    location.hash = state.role === "teacher" ? "#teacher/queue" : state.role === "student" ? "#student/home" : "#role";
  } else {
    renderApp();
  }
})();
