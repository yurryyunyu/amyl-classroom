/* Amyl 课堂 — static preview app. Example data only; no real payments. */
(function () {
  "use strict";

  const DATA = window.AMYL_DATA;
  const STORE_KEY = "amyl-course-app-preview-v2";

  const TZ = "Asia/Shanghai";

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function addDaysISO(iso, delta) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function mondayOfWeek(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay();
    const back = dow === 0 ? 6 : dow - 1;
    return addDaysISO(iso, -back);
  }

  function seedCheckinDates(today) {
    const dates = [];
    for (let i = 5; i >= 1; i--) dates.push(addDaysISO(today, -i));
    return dates;
  }

  function computeStreak(dates, today) {
    const set = new Set((dates || []).filter(Boolean));
    let cursor = today;
    if (!set.has(today)) {
      const yesterday = addDaysISO(today, -1);
      if (!set.has(yesterday)) return 0;
      cursor = yesterday;
    }
    let n = 0;
    while (set.has(cursor)) {
      n += 1;
      cursor = addDaysISO(cursor, -1);
    }
    return n;
  }

  function withSeedCheckinHistory(pointsHistory, seedDates) {
    const others = [];
    (pointsHistory || []).forEach((p) => {
      if (p.title !== "每日打卡") others.push(p);
    });
    const checkins = seedDates
      .slice()
      .reverse()
      .map((date, i) => ({
        id: "p-checkin-" + date,
        date,
        title: "每日打卡",
        titleEn: "Daily check-in",
        delta: 5
      }));
    return checkins.concat(others).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  }


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
    const type = h.type === "latte" ? "latte" : "brew";
    const paramsRaw = Object.assign({}, h.params || {});
    const flavoursRaw = h.flavours || paramsRaw.flavours;
    if (paramsRaw.flavours) delete paramsRaw.flavours;
    const item = Object.assign({}, h, {
      photos,
      photo: photos[0] || h.photo || "",
      bedPhoto: type === "brew" ? String(h.bedPhoto || "").trim() : "",
      params: type === "brew" ? normalizeBrewParams(paramsRaw) : paramsRaw,
      flavours: type === "brew" ? normalizeFlavours(flavoursRaw) : (h.flavours || null),
      type,
      studentId: h.studentId || "me",
      studentName: h.studentName || (h.studentId && DATA.authors[h.studentId] ? DATA.authors[h.studentId].name : DATA.user.name),
      feedbackUnread: h.feedbackUnread === true
    });
    if (item.feedback) {
      const fb = Object.assign({}, item.feedback);
      fb.itemNotes = Object.assign({}, fb.itemNotes || {});
      fb.markers = normalizeMarkers(fb.markers);
      if (fb.rubric) {
        fb.rubric.forEach((r) => {
          if (r && r.key && r.note && !fb.itemNotes[r.key]) fb.itemNotes[r.key] = r.note;
        });
      }
      if (item.status === "graded" && fb.pointsAwarded == null) fb.pointsAwarded = true;
      item.feedback = fb;
    }
    return item;
  }

  function loadState() {
    const today = todayISO();
    const seedDates = seedCheckinDates(today);
    const base = {
      points: DATA.user.points,
      streak: computeStreak(seedDates, today),
      checkedInDates: seedDates,
      enrolled: JSON.parse(JSON.stringify(DATA.user.enrolled)),
      cart: {},
      liked: {},
      posts: DATA.posts.map((p) => Object.assign({}, p)),
      comments: JSON.parse(JSON.stringify(DATA.comments)),
      homework: DATA.homework.map((h) => Object.assign({}, h, { params: Object.assign({}, h.params) })),
      orders: DATA.orders.map((o) => Object.assign({}, o)),
      pointsHistory: withSeedCheckinHistory(DATA.pointsHistory.map((p) => Object.assign({}, p)), seedDates),
      role: null,
      teacherFilter: "pending",
      teacherTypeFilter: "all",
      filterCourse: "全部",
      filterTag: "全部",
      draftHw: emptyDraftHw(),
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
        draftHw: Object.assign(base.draftHw, saved.draftHw || {}, {
          flavours: normalizeFlavours((saved.draftHw && saved.draftHw.flavours) || base.draftHw.flavours),
          pours: normalizePours(
            (saved.draftHw && Array.isArray(saved.draftHw.pours) && saved.draftHw.pours.length) ? saved.draftHw.pours : base.draftHw.pours,
            saved.draftHw || {}
          ),
          bedPhoto: saved.draftHw && saved.draftHw.bedPhoto ? String(saved.draftHw.bedPhoto).trim() : "",
          brewMethod: saved.draftHw && saved.draftHw.brewMethod ? String(saved.draftHw.brewMethod).trim() : "",
          dripperSize: saved.draftHw && saved.draftHw.dripperSize ? String(saved.draftHw.dripperSize).trim() : ""
        }),
        draftGrade: Object.assign({}, saved.draftGrade || {}),
        draftPost: Object.assign(base.draftPost, saved.draftPost || {})
      });
      merged.homework = (merged.homework || []).map(normalizeHomeworkItem);
      merged.checkedInDates = Array.isArray(merged.checkedInDates) ? merged.checkedInDates.slice() : seedDates;
      merged.streak = computeStreak(merged.checkedInDates, today);
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
          teacherTypeFilter: state.teacherTypeFilter,
          draftGrade: state.draftGrade || {},
          draftHw: state.draftHw || emptyDraftHw()
        })
      );
    } catch (e) { /* ignore quota */ }
  }

  let state = loadState();
  let toastTimer = 0;
  saveState();

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

  function emptyFlavours() {
    return { tags: [], custom: [], acidity: "", sweetness: "", bitterness: "", body: "", finish: "", openCat: "" };
  }

  function emptyDraftHw() {
    return {
      type: null,
      pattern: "心形",
      cupSize: "180ml",
      milkType: "全脂",
      milkTemp: "55–60°C",
      beanName: "",
      process: "",
      processOther: "",
      roastLevel: "",
      roastDate: "",
      brewMethod: "",
      dripper: "V60",
      dripperOther: "",
      dripperSize: "",
      filter: "",
      grinder: "",
      grind: "",
      dose: "",
      water: "",
      ratio: "",
      temp: "",
      waterType: "",
      tdsWater: "",
      bloomWater: "",
      bloomTime: "",
      pours: [{ water: "", temp: "", flow: "", pattern: "", pause: "" }],
      pourMethod: "",
      pourMethodOther: "",
      agitation: "",
      time: "",
      beverageWeight: "",
      tds: "",
      ey: "",
      notes: "",
      photos: [],
      bedPhoto: "",
      flavours: emptyFlavours()
    };
  }

  function parseNum(v) {
    if (v == null || v === "") return null;
    const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  function formatRatio(dose, water) {
    const d = parseNum(dose);
    const w = parseNum(water);
    if (!d || d <= 0 || w == null || w < 0) return "";
    const r = w / d;
    const rounded = Math.round(r * 10) / 10;
    const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return "1:" + s;
  }

  function formatEY(dose, bev, tds) {
    const d = parseNum(dose);
    const b = parseNum(bev);
    const t = parseNum(tds);
    if (!d || d <= 0 || !b || b <= 0 || t == null || t < 0) return "";
    const ey = (b * t) / d;
    return (Math.round(ey * 10) / 10).toFixed(1);
  }

  function validBrewTime(v) {
    const s = String(v || "").trim();
    return /^\d{1,2}:[0-5]\d$/.test(s);
  }

  function parseRatioNumber(v) {
    if (v == null || v === "") return null;
    const s = String(v).trim().replace("：", ":");
    if (s.indexOf(":") >= 0) return parseNum(s.slice(s.indexOf(":") + 1));
    return parseNum(s);
  }

  function waterFromDoseRatio(dose, ratio) {
    const d = parseNum(dose);
    const r = parseRatioNumber(ratio);
    if (!d || d <= 0 || !r || r <= 0) return "";
    const w = Math.round(d * r * 10) / 10;
    return Number.isInteger(w) ? String(w) : w.toFixed(1);
  }

  function poursWaterSum(pours) {
    return (pours || []).reduce((a, p) => a + (parseNum(p && p.water) || 0), 0);
  }

  function mapPourPattern(v) {
    const s = String(v || "").trim();
    if (s === "中心" || s === "螺旋" || s === "绕圈") return s;
    if (s === "center" || s === "centred" || s === "centered") return "中心";
    if (s === "spiral") return "螺旋";
    if (s === "circular" || s === "circle" || s === "ring") return "绕圈";
    return "";
  }

  function emptyPour() {
    return { water: "", temp: "", flow: "", pattern: "", pause: "" };
  }

  function pourLabel(i) {
    return i === 0 ? "闷蒸" : "第 " + (i + 1) + " 段";
  }

  function roastAgeText(dateStr) {
    if (!dateStr) return "";
    const today = todayISO();
    const a = Date.parse(dateStr + "T00:00:00+08:00");
    const b = Date.parse(today + "T00:00:00+08:00");
    if (!isFinite(a) || !isFinite(b)) return "";
    const days = Math.round((b - a) / 86400000);
    if (days < 0) return "烘焙日期在今天之后";
    if (days === 0) return "今天烘焙";
    return "烘焙后 " + days + " 天";
  }

  function flavorWheel() {
    return (DATA.flavorWheel && DATA.flavorWheel.categories) || [];
  }

  function flavorCategoryById(id) {
    if (!id) return null;
    const cats = flavorWheel();
    const direct = cats.find((c) => c.id === id);
    if (direct) return { id: direct.id, cat: direct.id, nameZh: direct.nameZh };
    const prefixes = [
      ["floral", "floral"],
      ["fruity", "fruity"],
      ["sour", "sour"],
      ["green", "green"],
      ["other", "other"],
      ["roasted", "roasted"],
      ["spices", "spices"],
      ["nutty", "nutty"],
      ["sweet", "sweet"]
    ];
    const raw = String(id);
    for (let i = 0; i < prefixes.length; i++) {
      const pre = prefixes[i][0];
      if (raw === pre || raw.indexOf(pre + "-") === 0) {
        const cat = cats.find((c) => c.id === prefixes[i][1]);
        if (cat) return { id: cat.id, cat: cat.id, nameZh: cat.nameZh };
      }
    }
    const byName = cats.find((c) => c.nameZh === raw);
    return byName ? { id: byName.id, cat: byName.id, nameZh: byName.nameZh } : null;
  }

  function normalizeFlavours(raw) {
    const base = emptyFlavours();
    if (!raw || typeof raw !== "object") return base;
    const seen = {};
    const tags = [];
    const extraCustom = [];
    (Array.isArray(raw.tags) ? raw.tags : []).forEach((t) => {
      if (!t) return;
      if (typeof t === "string") {
        const found = flavorCategoryById(t);
        if (found) {
          if (!seen[found.id]) {
            seen[found.id] = true;
            tags.push(found);
          }
        } else if (t.trim()) extraCustom.push(t.trim());
        return;
      }
      const found = flavorCategoryById(t.id) || flavorCategoryById(t.cat) || flavorCategoryById(t.nameZh);
      if (found) {
        if (!seen[found.id]) {
          seen[found.id] = true;
          tags.push(found);
        }
      } else if (t.nameZh && String(t.nameZh).trim()) {
        extraCustom.push(String(t.nameZh).trim());
      }
    });
    const scale = (v) => {
      const n = parseNum(v);
      if (n == null) return "";
      return Math.max(1, Math.min(5, Math.round(n)));
    };
    const finish = String(raw.finish || "");
    const custom = Array.isArray(raw.custom) ? raw.custom.map((x) => String(x || "").trim()).filter(Boolean) : [];
    extraCustom.forEach((x) => {
      if (custom.indexOf(x) === -1) custom.push(x);
    });
    return {
      tags,
      custom,
      acidity: scale(raw.acidity),
      sweetness: scale(raw.sweetness),
      bitterness: scale(raw.bitterness),
      body: scale(raw.body),
      finish: finish === "短" || finish === "中" || finish === "长" ? finish : ""
    };
  }

  function normalizePours(list, legacy) {
    const src = legacy && typeof legacy === "object" ? legacy : {};
    const raw = Array.isArray(list) ? list : (Array.isArray(src.pours) ? src.pours : []);
    const looksNew = raw.some((p) => p && (p.temp != null || p.flow != null || p.pattern != null || p.pause != null || p.temp_c != null || p.ml != null || p.flow_ml_s != null || p.pause_s != null));
    if (looksNew && raw.length) {
      return raw.map((p) => ({
        water: String((p && (p.water != null && p.water !== "" ? p.water : p.ml)) || "").trim(),
        temp: String((p && (p.temp != null && p.temp !== "" ? p.temp : p.temp_c)) || "").trim(),
        flow: String((p && (p.flow != null && p.flow !== "" ? p.flow : p.flow_ml_s)) || "").trim(),
        pattern: mapPourPattern(p && p.pattern),
        pause: String((p && (p.pause != null && p.pause !== "" ? p.pause : p.pause_s)) || "").trim()
      }));
    }
    const out = [];
    const pattern = mapPourPattern(src.pourMethod);
    const temp = src.temp != null ? String(src.temp).trim() : "";
    if (src.bloomWater || src.bloomTime) {
      out.push({
        water: String(src.bloomWater || "").trim(),
        temp,
        flow: "",
        pattern,
        pause: String(src.bloomTime || "").trim()
      });
    }
    const old = raw.map((p) => ({
      water: p && p.water != null ? String(p.water).trim() : "",
      time: p && p.time != null ? String(p.time).trim() : ""
    }));
    const nums = old.map((p) => parseNum(p.water));
    const usable = nums.filter((n) => n != null);
    const cumulative = usable.length >= 2 && usable.every((n, i) => i === 0 || n + 0.001 >= usable[i - 1]);
    let prev = out.length && parseNum(out[0].water) != null ? parseNum(out[0].water) : 0;
    old.forEach((p, i) => {
      const n = parseNum(p.water);
      if (i === 0 && out.length && n != null && parseNum(out[0].water) === n) {
        prev = n;
        return;
      }
      let vol = p.water;
      if (cumulative && n != null) {
        vol = String(Math.round((n - prev) * 10) / 10);
        prev = n;
      }
      if (vol || temp || pattern) out.push({ water: vol, temp, flow: "", pattern, pause: "" });
    });
    return out;
  }

  function normalizeBrewParams(p) {
    const src = p && typeof p === "object" ? p : {};
    const out = Object.assign({}, src);
    out.pours = normalizePours(out.pours, src);
    if (out.ratio == null || out.ratio === "") {
      const auto = formatRatio(out.dose, out.water);
      if (auto) out.ratio = auto;
    }
    if ((out.water == null || out.water === "") && out.dose && out.ratio) {
      const autoW = waterFromDoseRatio(out.dose, out.ratio);
      if (autoW) out.water = autoW;
    }
    if (out.ey == null || out.ey === "") {
      const auto = formatEY(out.dose, out.beverageWeight, out.tds);
      if (auto) out.ey = auto;
    }
    out.brewMethod = out.brewMethod != null ? String(out.brewMethod).trim() : "";
    out.dripper = out.dripper != null ? String(out.dripper).trim() : "";
    out.dripperOther = out.dripper === "其他" && out.dripperOther != null ? String(out.dripperOther).trim() : "";
    out.dripperSize = out.dripperSize != null ? String(out.dripperSize).trim() : "";
    return out;
  }

  function dripperDisplay(p) {
    const name = p && p.dripper ? String(p.dripper).trim() : "";
    if (!name) return "";
    if (name === "其他" && p.dripperOther && String(p.dripperOther).trim()) {
      return "其他 · " + String(p.dripperOther).trim();
    }
    return name;
  }

  function displayVal(v, unit) {
    if (v == null || String(v).trim() === "") return "";
    const s = String(v).trim();
    if (!unit) return s;
    if (s.endsWith(unit) || s.indexOf(unit) !== -1) return s;
    return s + " " + unit;
  }

  function recipeCell(label, value, unit) {
    const filled = value != null && String(value).trim() !== "";
    const text = filled ? displayVal(value, unit) : "未填";
    return `<div class="recipe-cell ${filled ? "" : "is-empty"}"><span class="tiny">${esc(label)}</span><div>${esc(text)}</div></div>`;
  }

  function scaleLabel(v) {
    return v === "" || v == null ? "未填" : String(v);
  }

  function renderFlavourView(flavours, opts) {
    const f = normalizeFlavours(flavours);
    const hasTags = f.tags.length || f.custom.length;
    const hasScale = f.acidity || f.sweetness || f.bitterness || f.body || f.finish;
    if (!hasTags && !hasScale) {
      return `<section class="flavor-card" data-testid="flavor-card">
        <h3>风味</h3>
        <p class="sub">未填</p>
      </section>`;
    }
    const chips = f.tags
      .map((t) => `<span class="flavor-chip on static">${esc(t.nameZh)}</span>`)
      .concat(f.custom.map((t) => `<span class="flavor-chip on static custom">${esc(t)}</span>`))
      .join("");
    return `<section class="flavor-card" data-testid="flavor-card">
      <h3>风味</h3>
      <p class="tiny flavor-source">${esc((DATA.flavorWheel && DATA.flavorWheel.sourceZh) || "风味选项依据 SCA 与 WCR 的咖啡风味轮整理。")}</p>
      ${hasTags ? `<div class="flavor-selected">${chips}</div>` : `<p class="sub">还没有选风味。</p>`}
      <div class="flavor-scales">
        <div><span>酸度</span><strong>${esc(scaleLabel(f.acidity))}</strong></div>
        <div><span>甜度</span><strong>${esc(scaleLabel(f.sweetness))}</strong></div>
        <div><span>苦度</span><strong>${esc(scaleLabel(f.bitterness))}</strong></div>
        <div><span>醇厚度</span><strong>${esc(scaleLabel(f.body))}</strong></div>
        <div><span>余韵</span><strong>${esc(f.finish || "未填")}</strong></div>
      </div>
    </section>`;
  }

  function renderBrewRecipeCard(h) {
    const p = normalizeBrewParams((h && h.params) || {});
    const process = p.process === "其他" && p.processOther ? p.process + " · " + p.processOther : p.process;
    const ratio = p.ratio || formatRatio(p.dose, p.water);
    const water = p.water || waterFromDoseRatio(p.dose, ratio);
    const age = roastAgeText(p.roastDate);
    const roast = [p.roastDate, age].filter(Boolean).join(" · ");
    const pours = normalizePours(p.pours, p);
    const pourSum = poursWaterSum(pours);
    const target = parseNum(water);
    const sumText = pours.length
      ? (target != null && pourSum
          ? "注水合计 " + pourSum + " g" + (Math.abs(pourSum - target) < 0.15 ? "，与总水量一致" : "，总水量 " + water + " g")
          : "注水合计 " + pourSum + " g")
      : "";
    const rows = pours.length
      ? pours
          .map((row, i) => {
            const cells = [
              ["水量", displayVal(row.water, "g")],
              ["水温", displayVal(row.temp, "°C")],
              ["流速", displayVal(row.flow, "ml/s")],
              ["注水方式", row.pattern],
              ["停顿", displayVal(row.pause, "s")]
            ]
              .map(([lab, val]) => {
                const filled = val != null && String(val).trim() !== "";
                return `<div class="xb-pour-cell ${filled ? "" : "is-empty"}"><span>${esc(lab)}</span><strong>${esc(filled ? val : "未填")}</strong></div>`;
              })
              .join("");
            return `<div class="xb-pour-row" data-testid="pour-row-${i}">
              <div class="xb-pour-name">${esc(pourLabel(i))}</div>
              <div class="xb-pour-grid">${cells}</div>
            </div>`;
          })
          .join("")
      : `<p class="sub is-empty">注水段未填</p>`;
    return `<section class="recipe-card xb-recipe" data-testid="recipe-card">
      <h3>冲煮配方</h3>
      <div class="recipe-block">
        <h4>豆子</h4>
        <div class="form-grid">
          ${recipeCell("名称/产区", p.beanName)}
          ${recipeCell("处理法", process)}
          ${recipeCell("烘焙度", p.roastLevel)}
          ${recipeCell("烘焙日期", roast)}
        </div>
      </div>
      <div class="recipe-block" data-testid="recipe-dripper-block">
        <h4>滤杯</h4>
        <div class="form-grid">
          ${recipeCell("冲煮方式", p.brewMethod)}
          ${recipeCell("滤杯名称", dripperDisplay(p))}
          ${recipeCell("滤杯尺寸", p.dripperSize)}
        </div>
      </div>
      <div class="xb-header" data-testid="xb-header">
        <div class="xb-stat"><span>粉量</span><strong>${esc(p.dose ? displayVal(p.dose, "g") : "未填")}</strong></div>
        <div class="xb-stat"><span>粉水比</span><strong>${esc(ratio || "未填")}</strong></div>
        <div class="xb-stat"><span>总水量</span><strong>${esc(water ? displayVal(water, "g") : "未填")}</strong></div>
        <div class="xb-stat"><span>刻度</span><strong>${esc(p.grind || "未填")}</strong></div>
      </div>
      <div class="recipe-block">
        <h4>注水</h4>
        <div class="xb-pours">${rows}</div>
        ${sumText ? `<p class="tiny xb-sum" data-testid="pour-sum">${esc(sumText)}</p>` : ""}
      </div>
    </section>`;
  }

  function unitInput(name, value, unit, opts) {
    const o = opts || {};
    const req = o.required ? "required-mark" : "";
    const type = o.time ? "text" : "text";
    const mode = o.time ? "numeric" : "decimal";
    const ph = o.placeholder || "";
    const test = o.test ? ` data-testid="${esc(o.test)}"` : "";
    return `<div class="field unit-field">
      <label class="${req}">${esc(o.label || "")}${o.required ? `<span class="req">必填</span>` : ""}</label>
      <div class="unit-wrap">
        <input name="${esc(name)}" value="${esc(value || "")}" inputmode="${mode}" placeholder="${esc(ph)}" autocomplete="off"${test} ${o.required ? `aria-required="true"` : ""}>
        ${unit ? `<span class="unit">${esc(unit)}</span>` : ""}
      </div>
    </div>`;
  }

  function renderPourRows(pours) {
    const list = pours && pours.length ? pours : [emptyPour()];
    const patterns = DATA.pourPatterns || ["中心", "螺旋", "绕圈"];
    return `<div id="pour-list" class="pour-list xb-pour-edit" data-testid="pour-list">
      ${list
        .map((p, i) => {
          const pat = mapPourPattern(p.pattern);
          return `<div class="pour-card" data-index="${i}">
            <div class="pour-card-top">
              <strong>${esc(pourLabel(i))}</strong>
              ${i === 0 ? `<span class="tiny">第一段为闷蒸</span>` : `<button type="button" class="fb-mini" data-action="remove-pour" data-index="${i}" aria-label="删除${esc(pourLabel(i))}">删</button>`}
            </div>
            <div class="form-grid">
              <div class="field unit-field">
                <label>水量</label>
                <div class="unit-wrap"><input name="pour-water-${i}" value="${esc(p.water || "")}" inputmode="decimal" placeholder="${i === 0 ? "45" : "100"}" aria-label="${esc(pourLabel(i))}水量"><span class="unit">g</span></div>
              </div>
              <div class="field unit-field">
                <label>水温</label>
                <div class="unit-wrap"><input name="pour-temp-${i}" value="${esc(p.temp || "")}" inputmode="decimal" placeholder="92" aria-label="${esc(pourLabel(i))}水温"><span class="unit">°C</span></div>
              </div>
              <div class="field unit-field">
                <label>流速</label>
                <div class="unit-wrap"><input name="pour-flow-${i}" value="${esc(p.flow || "")}" inputmode="decimal" placeholder="3.0" aria-label="${esc(pourLabel(i))}流速"><span class="unit">ml/s</span></div>
              </div>
              <div class="field unit-field">
                <label>停顿</label>
                <div class="unit-wrap"><input name="pour-pause-${i}" value="${esc(p.pause || "")}" inputmode="numeric" placeholder="${i === 0 ? "30" : "0"}" aria-label="${esc(pourLabel(i))}停顿"><span class="unit">s</span></div>
              </div>
            </div>
            <div class="field">
              <label>注水方式</label>
              <div class="choice-row compact">
                ${patterns
                  .map(
                    (opt) =>
                      `<label><input type="radio" name="pour-pattern-${i}" value="${esc(opt)}" ${pat === opt ? "checked" : ""}>${esc(opt)}</label>`
                  )
                  .join("")}
              </div>
            </div>
          </div>`;
        })
        .join("")}
    </div>
    <p class="tiny" id="pour-count" data-testid="pour-sum-live">共 ${list.length} 段</p>
    <button type="button" class="fb-mode" data-action="add-pour" data-testid="add-pour">加一段注水</button>`;
  }

  function renderFlavourPicker(flavours) {
    const f = normalizeFlavours(flavours);
    const cats = flavorWheel();
    const selected = f.tags
      .map((t) => `<button type="button" class="flavor-chip on" data-action="remove-flavor" data-id="${esc(t.id)}">${esc(t.nameZh)} ×</button>`)
      .concat(f.custom.map((t, i) => `<button type="button" class="flavor-chip on custom" data-action="remove-custom-flavor" data-index="${i}">${esc(t)} ×</button>`))
      .join("");
    const scaleRow = (name, key, val) => `<div class="scale-row">
        <span>${esc(name)}</span>
        <div class="scale-pips" role="radiogroup" aria-label="${esc(name)}">
          ${[1, 2, 3, 4, 5]
            .map((n) => `<button type="button" class="scale-pip ${val === n ? "on" : ""}" data-action="set-scale" data-key="${esc(key)}" data-value="${n}">${n}</button>`)
            .join("")}
        </div>
      </div>`;
    return `<div class="flavor-picker" id="flavor-picker" data-testid="flavor-picker">
      <p class="tiny flavor-source">${esc((DATA.flavorWheel && DATA.flavorWheel.sourceZh) || "")}</p>
      <p class="sub flavor-hint">点选你认为喝到的风味大类，可多选。</p>
      <div class="flavor-selected" data-testid="flavor-selected">${selected || `<span class="sub">还没有选风味</span>`}</div>
      <div class="flavor-cats" data-testid="flavor-cats">
        ${cats
          .map((c) => {
            const on = f.tags.some((t) => t.id === c.id);
            return `<button type="button" class="flavor-cat ${on ? "on" : ""}" data-action="toggle-flavor-cat" data-id="${esc(c.id)}" data-testid="flavor-cat-${esc(c.id)}">${esc(c.nameZh)}</button>`;
          })
          .join("")}
      </div>
      <div class="flavor-custom">
        <input id="flavor-custom-input" maxlength="20" placeholder="其他，自己写" data-testid="flavor-custom">
        <button type="button" class="fb-mode" data-action="add-custom-flavor">添加</button>
      </div>
      <div class="flavor-scale-box">
        ${scaleRow("酸度", "acidity", f.acidity)}
        ${scaleRow("甜度", "sweetness", f.sweetness)}
        ${scaleRow("苦度", "bitterness", f.bitterness)}
        ${scaleRow("醇厚度", "body", f.body)}
        <div class="scale-row">
          <span>余韵</span>
          <div class="scale-pips" role="radiogroup" aria-label="余韵">
            ${(DATA.finishLengths || ["短", "中", "长"])
              .map(
                (opt) =>
                  `<button type="button" class="scale-pip ${f.finish === opt ? "on" : ""}" data-action="set-finish" data-value="${esc(opt)}">${esc(opt)}</button>`
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderBrewFields(d) {
    const pours = (() => {
      const list = normalizePours(d.pours, d);
      return list.length ? list : [emptyPour()];
    })();
    const ratio = d.ratio || formatRatio(d.dose, d.water) || "";
    const water = d.water || waterFromDoseRatio(d.dose, ratio);
    const age = roastAgeText(d.roastDate);
    const otherProcess = (d.process || "") === "其他";
    const otherDripper = (d.dripper || "") === "其他";
    const ratioNum = parseRatioNumber(ratio);
    const ratioShow = ratio || "";
    return `
      <section class="brew-group">
        <h3>豆子</h3>
        <div class="field">
          <label>名称/产区</label>
          <input name="beanName" value="${esc(d.beanName || "")}" placeholder="例如：耶加雪菲" autocomplete="off">
        </div>
        <div class="field"><label>处理法</label>${choiceRow("process", DATA.processMethods || [], d.process || "")}</div>
        <div class="field other-field" ${otherProcess ? "" : "hidden"} id="process-other-wrap">
          <label>其他处理法</label>
          <input name="processOther" value="${esc(d.processOther || "")}" placeholder="请写明">
        </div>
        <div class="field"><label>烘焙度</label>${choiceRow("roastLevel", DATA.roastLevels || [], d.roastLevel || "")}</div>
        <div class="field">
          <label>烘焙日期</label>
          <input name="roastDate" type="date" value="${esc(d.roastDate || "")}" data-testid="roast-date">
          <p class="tiny" id="roast-age">${esc(age)}</p>
        </div>
      </section>
      <section class="brew-group" data-testid="brew-dripper-fields">
        <h3>滤杯</h3>
        <div class="field" data-testid="brew-method-field">
          <label class="required-mark">冲煮方式<span class="req">必填</span></label>
          ${choiceRow("brewMethod", DATA.brewMethods || ["滴滤", "浸泡"], d.brewMethod || "")}
        </div>
        <div class="field" data-testid="dripper-name-field">
          <label>滤杯名称</label>
          ${choiceRow("dripper", DATA.drippers || ["V60", "Kalita", "Origami", "其他"], d.dripper || "")}
        </div>
        <div class="field other-field" ${otherDripper ? "" : "hidden"} id="dripper-other-wrap">
          <label>其他滤杯名称</label>
          <input name="dripperOther" value="${esc(d.dripperOther || "")}" placeholder="请写明" data-testid="dripper-other" autocomplete="off">
        </div>
        <div class="field" data-testid="dripper-size-field">
          <label>滤杯尺寸</label>
          <input name="dripperSize" value="${esc(d.dripperSize || "")}" placeholder="02 / 2人份 / 500ml" data-testid="dripper-size" autocomplete="off">
        </div>
      </section>
      <section class="brew-group">
        <h3>配方</h3>
        <div class="form-grid">
          ${unitInput("dose", d.dose, "g", { label: "粉量", required: true, placeholder: "15", test: "dose" })}
          <div class="field unit-field">
            <label class="required-mark">粉水比<span class="req">必填</span></label>
            <div class="unit-wrap">
              <span class="unit unit-prefix">1:</span>
              <input name="ratio" value="${esc(ratioNum != null ? String(ratioNum) : "")}" inputmode="decimal" placeholder="16.7" data-testid="ratio" aria-required="true" autocomplete="off">
            </div>
          </div>
          ${unitInput("water", water, "g", { label: "总水量", required: true, placeholder: "250", test: "water" })}
          ${unitInput("grind", d.grind, "", { label: "刻度", required: true, placeholder: "例如：20", test: "grind" })}
        </div>
        <p class="tiny">粉量和粉水比会自动算出总水量。改总水量时，粉水比会跟着变。</p>
      </section>
      <section class="brew-group">
        <h3>注水</h3>
        <p class="tiny">第一段是闷蒸。每一段填写水量、水温、流速、注水方式和停顿。</p>
        ${renderPourRows(pours)}
        <p class="tiny" id="pour-sum-live-extra"></p>
      </section>
      <section class="brew-group">
        <h3>风味</h3>
        ${renderFlavourPicker(d.flavours)}
      </section>
      <section class="brew-group">
        <h3>笔记</h3>
        <div class="field">
          <label>补充说明 <span class="hint">可选</span></label>
          <textarea name="notes" placeholder="手法、口感，或其他想给老师看的话">${esc(d.notes || "")}</textarea>
        </div>
      </section>`;
  }

  function collectBrewDraftFromForm() {
    const form = $("#hw-form");
    if (!form) return state.draftHw;
    const fd = new FormData(form);
    const d = state.draftHw || emptyDraftHw();
    const keys = ["beanName", "process", "processOther", "roastLevel", "roastDate", "brewMethod", "dripper", "dripperOther", "dripperSize", "grind", "dose", "water", "ratio", "notes"];
    keys.forEach((k) => {
      if (fd.has(k)) d[k] = String(fd.get(k) || "").trim();
    });
    if (d.ratio && d.ratio.indexOf(":") < 0 && parseNum(d.ratio) != null) d.ratio = "1:" + String(parseRatioNumber(d.ratio));
    const pours = [];
    form.querySelectorAll(".pour-card, .pour-row").forEach((row) => {
      const i = row.getAttribute("data-index");
      pours.push({
        water: String(fd.get("pour-water-" + i) || "").trim(),
        temp: String(fd.get("pour-temp-" + i) || "").trim(),
        flow: String(fd.get("pour-flow-" + i) || "").trim(),
        pattern: String(fd.get("pour-pattern-" + i) || "").trim(),
        pause: String(fd.get("pour-pause-" + i) || "").trim()
      });
    });
    if (pours.length) d.pours = pours;
    if (d.dose && d.ratio && (d.water == null || d.water === "")) d.water = waterFromDoseRatio(d.dose, d.ratio);
    if (d.dose && d.water) d.ratio = formatRatio(d.dose, d.water) || d.ratio;
    state.draftHw = d;
    return d;
  }

  function updateBrewCalcs(e) {
    const form = $("#hw-form");
    if (!form) return;
    const doseEl = form.querySelector('[name="dose"]');
    const waterEl = form.querySelector('[name="water"]');
    const ratioEl = form.querySelector('[name="ratio"]');
    const roast = form.querySelector('[name="roastDate"]');
    const ageEl = $("#roast-age");
    const source = e && e.target && e.target.getAttribute ? e.target.getAttribute("name") : "";
    const dose = doseEl && doseEl.value;
    if (source === "ratio" || source === "dose") {
      const ratioVal = ratioEl && ratioEl.value;
      const w = waterFromDoseRatio(dose, ratioVal);
      if (w && waterEl && source !== "water") waterEl.value = w;
    } else if (source === "water") {
      const r = formatRatio(dose, waterEl && waterEl.value);
      if (r && ratioEl) {
        const n = parseRatioNumber(r);
        if (n != null) ratioEl.value = String(n);
      }
    }
    const processOther = $("#process-other-wrap");
    const process = form.querySelector('input[name="process"]:checked');
    if (processOther) processOther.hidden = !(process && process.value === "其他");
    const dripperOther = $("#dripper-other-wrap");
    const dripper = form.querySelector('input[name="dripper"]:checked');
    if (dripperOther) dripperOther.hidden = !(dripper && dripper.value === "其他");
    if (ageEl) ageEl.textContent = roastAgeText(roast && roast.value);
    const sumEl = $("#pour-count");
    const extra = $("#pour-sum-live-extra");
    const pours = [];
    form.querySelectorAll(".pour-card").forEach((row) => {
      const i = row.getAttribute("data-index");
      const inp = form.querySelector('[name="pour-water-' + i + '"]');
      pours.push({ water: inp ? inp.value : "" });
    });
    const sum = poursWaterSum(pours);
    const water = waterEl && waterEl.value;
    let msg = "共 " + Math.max(pours.length, 1) + " 段";
    if (sum) {
      const target = parseNum(water);
      if (target != null) {
        msg += (Math.abs(sum - target) < 0.15 ? "，注水合计 " + sum + " g，与总水量一致" : "，注水合计 " + sum + " g，总水量 " + water + " g");
      } else msg += "，注水合计 " + sum + " g";
    }
    if (sumEl) sumEl.textContent = msg;
  }

  function refreshBrewFlavourAndPours() {
    const form = $("#hw-form");
    if (!form || form.getAttribute("data-type") !== "brew") return;
    const scroll = $("#view") ? $("#view").scrollTop : 0;
    const pourBox = $("#pour-list");
    if (pourBox) {
      const html = renderPourRows(state.draftHw.pours);
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const current = pourBox;
      const count = $("#pour-count");
      const addBtn = form.querySelector('[data-action="add-pour"]');
      const next = tmp.querySelector("#pour-list");
      const nextCount = tmp.querySelector("#pour-count");
      const nextAdd = tmp.querySelector('[data-action="add-pour"]');
      if (current && next) current.replaceWith(next);
      if (count && nextCount) count.replaceWith(nextCount);
      else if (nextCount && addBtn) addBtn.insertAdjacentElement("beforebegin", nextCount);
      if (addBtn && nextAdd) addBtn.replaceWith(nextAdd);
    }
    const picker = $("#flavor-picker");
    if (picker) picker.outerHTML = renderFlavourPicker(state.draftHw.flavours);
    if ($("#view")) $("#view").scrollTop = scroll;
    updateBrewCalcs();
  }

  function collectBrewParamsForSubmit() {
    const d = collectBrewDraftFromForm();
    const pours = normalizePours(d.pours, d);
    const ratio = d.ratio || formatRatio(d.dose, d.water);
    const water = d.water || waterFromDoseRatio(d.dose, ratio);
    return {
      beanName: d.beanName || "",
      process: d.process || "",
      processOther: d.process === "其他" ? d.processOther || "" : "",
      roastLevel: d.roastLevel || "",
      roastDate: d.roastDate || "",
      brewMethod: d.brewMethod || "",
      dripper: d.dripper || "",
      dripperOther: d.dripper === "其他" ? d.dripperOther || "" : "",
      dripperSize: d.dripperSize || "",
      grind: d.grind || "",
      dose: d.dose || "",
      water: water || "",
      ratio: ratio || "",
      pours
    };
  }

  function validateBrewSubmit(photos, params, bedPhoto) {
    if (!photos || !photos.length) return "请先拍一张或选一张照片";
    if (!(bedPhoto && String(bedPhoto).trim())) return "请拍一张粉层照片";
    if (!(params.brewMethod && String(params.brewMethod).trim())) return "请选择冲煮方式";
    if (params.dripper === "其他" && !(params.dripperOther && String(params.dripperOther).trim())) return "请填写滤杯名称";
    if (parseNum(params.dose) == null || parseNum(params.dose) <= 0) return "请填写粉量，单位是克";
    if (!(params.grind && String(params.grind).trim())) return "请填写刻度";
    const water = parseNum(params.water) || parseNum(waterFromDoseRatio(params.dose, params.ratio));
    if (water == null || water <= 0) return "请填写粉水比或总水量";
    const first = (params.pours || [])[0];
    if (!first || parseNum(first.water) == null || parseNum(first.water) <= 0) return "请填写闷蒸水量";
    return "";
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
    const today = todayISO();
    const mon = mondayOfWeek(today);
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    return labels
      .map((label, i) => {
        const key = addDaysISO(mon, i);
        const on = state.checkedInDates.includes(key);
        const isToday = key === today;
        return `<span><i class="dot${on ? " on" : ""}${isToday ? " today" : ""}"></i>${label}</span>`;
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
      <p class="sub outline-note">以下为示例大纲，正式课程内容稍后提供。</p>
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
          ${
            owned
              ? `<span class="buybar-owned">已开通</span>`
              : `<div class="price">${money(sale)}</div><span class="tiny">示例价</span>`
          }
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

  function unreadFeedbackCount() {
    return myHomework().filter((h) => h.status === "graded" && h.feedbackUnread).length;
  }

  function normalizeMarkers(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((m, i) => {
        if (!m || typeof m !== "object") return null;
        const x = Math.max(4, Math.min(96, Number(m.x)));
        const y = Math.max(4, Math.min(96, Number(m.y)));
        if (!isFinite(x) || !isFinite(y)) return null;
        return {
          id: String(m.id || "mk-" + i),
          photoIndex: Math.max(0, Number(m.photoIndex) || 0),
          source: m.source === "bed" ? "bed" : "main",
          x,
          y,
          note: String(m.note || "").trim()
        };
      })
      .filter(Boolean);
  }

  function imageContentBox(img) {
    const rect = img.getBoundingClientRect();
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    if (!nw || !nh || !rect.width || !rect.height) {
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    const scale = Math.min(rect.width / nw, rect.height / nh);
    const width = nw * scale;
    const height = nh * scale;
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height
    };
  }

  function layoutPinLayer(stage) {
    if (!stage) return;
    const img = stage.querySelector(".fb-main-photo");
    const layer = stage.querySelector(".fb-pins");
    if (!img || !layer) return;
    const box = imageContentBox(img);
    const s = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    layer.style.left = box.left - s.left + "px";
    layer.style.top = box.top - s.top + "px";
    layer.style.width = box.width + "px";
    layer.style.height = box.height + "px";
  }

  function pointToPercent(img, clientX, clientY) {
    const box = imageContentBox(img);
    if (!box.width || !box.height) return null;
    const x = ((clientX - box.left) / box.width) * 100;
    const y = ((clientY - box.top) / box.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
  }

  function markerSource(m) {
    return m && m.source === "bed" ? "bed" : "main";
  }

  function markerPhotoLabel(m, photos, hasBed) {
    if (markerSource(m) === "bed") return "粉层";
    if (hasBed) return photos && photos.length > 1 ? "作业 第 " + (m.photoIndex + 1) + " 张" : "作业照片";
    if (photos && photos.length > 1) return "第 " + (m.photoIndex + 1) + " 张";
    return "";
  }

  function renderPins(markers, photoIndex, action, source) {
    const src = source || "main";
    const all = markers || [];
    return all
      .map((m, i) => {
        if (markerSource(m) !== src) return "";
        if (src === "main" && m.photoIndex !== photoIndex) return "";
        return `<button type="button" class="fb-pin" style="left:${m.x}%;top:${m.y}%" data-action="${esc(action)}" data-marker="${esc(m.id)}" aria-label="标注 ${i + 1}">${i + 1}</button>`;
      })
      .join("");
  }

  function renderMarkerList(markers, photos, interactive, source, hasBed) {
    const src = source || "main";
    const list = (markers || []).map((m, i) => ({ m, i })).filter((x) => markerSource(x.m) === src);
    if (!list.length) return "";
    return `<ul class="fb-marker-list" data-testid="marker-list${src === "bed" ? "-bed" : ""}">
      ${list
        .map(({ m, i }) => {
          const label = markerPhotoLabel(m, photos, hasBed);
          return `<li>
            <span class="fb-pin-num">${i + 1}</span>
            <span class="fb-marker-text">${esc(m.note || "（未写短评）")}${label ? `<em>${esc(label)}</em>` : ""}</span>
            ${
              interactive
                ? `<button type="button" class="fb-mini" data-action="edit-marker" data-marker="${esc(m.id)}">改</button>
                   <button type="button" class="fb-mini" data-action="delete-marker" data-marker="${esc(m.id)}">删</button>`
                : ""
            }
          </li>`;
        })
        .join("")}
    </ul>`;
  }

  function renderFeedbackPhoto(photos, markers, photoIndex, opts) {
    const o = opts || {};
    const list = photos && photos.length ? photos : [];
    const interactive = !!o.interactive;
    const source = o.source || "main";
    const title = o.title || "";
    const hasBed = !!o.hasBed;
    if (!list.length) {
      return `<div class="fb-photo-card" id="fb-photo-card-${esc(source)}" data-source="${esc(source)}" data-testid="${esc(source)}-photo-card">
        ${title ? `<p class="fb-photo-title">${esc(title)}</p>` : ""}
        <div class="fb-stage empty"><p>${esc(o.emptyText || "没有照片")}</p></div>
      </div>`;
    }
    const idx = Math.max(0, Math.min(list.length - 1, photoIndex || 0));
    const src = list[idx];
    const mode = interactive && o.markMode ? "mark" : "zoom";
    const pinAction = interactive ? "edit-marker" : "show-marker-note";
    const thumbs =
      list.length > 1
        ? `<div class="fb-thumbs" role="list">
            ${list
              .map(
                (p, i) =>
                  `<button type="button" class="fb-thumb ${i === idx ? "on" : ""}" data-action="fb-thumb" data-index="${i}" data-source="${esc(source)}" aria-label="第 ${i + 1} 张">
                    <img src="${esc(p)}" alt="">
                  </button>`
              )
              .join("")}
          </div>`
        : "";
    const tools = interactive
      ? `<div class="fb-photo-tools">
           <button type="button" class="fb-mode ${mode === "mark" ? "on" : ""}" data-action="toggle-mark-mode" data-source="${esc(source)}" data-testid="toggle-mark-mode-${esc(source)}">${mode === "mark" ? "退出标注" : "在照片上标注"}</button>
           <button type="button" class="fb-mode" data-action="zoom-photo" data-src="${esc(src)}" data-index="${idx}" data-source="${esc(source)}" data-testid="zoom-${esc(source)}">全屏查看</button>
         </div>
         <p class="tiny fb-photo-hint">${mode === "mark" ? "点照片上的位置，写一句短评，例如「这里粉层偏高」。" : "点照片可放大。打开标注后，可在图上加编号备注。"}</p>`
      : "";
    return `<div class="fb-photo-card" id="fb-photo-card-${esc(source)}" data-source="${esc(source)}" data-mode="${mode}" data-testid="${esc(source)}-photo-card">
      ${title ? `<p class="fb-photo-title">${esc(title)}</p>` : ""}
      <div class="fb-stage" id="fb-stage-${esc(source)}" data-source="${esc(source)}">
        <img class="fb-main-photo" id="fb-main-photo-${esc(source)}" src="${esc(src)}" alt="${esc(title || "作业照片")}" data-index="${idx}" data-src="${esc(src)}" data-source="${esc(source)}">
        <div class="fb-pins">${renderPins(markers, idx, pinAction, source)}</div>
      </div>
      ${thumbs}
      ${tools}
      ${renderMarkerList(markers, list, interactive, source, hasBed)}
    </div>`;
  }

  function renderHomeworkPhotos(h, markers, opts) {
    const o = opts || {};
    const isBrew = h && h.type === "brew";
    const hasBed = isBrew;
    const mainCard = renderFeedbackPhoto((h && h.photos) || [], markers, o.photoIndex || 0, {
      interactive: !!o.interactive,
      markMode: !!o.markMode && (o.markSource || "main") === "main",
      source: "main",
      title: isBrew ? "作业照片" : "",
      hasBed
    });
    if (!isBrew) return `<div id="fb-photo-stack" data-testid="photo-stack">${mainCard}</div>`;
    const bed = h && h.bedPhoto ? [h.bedPhoto] : [];
    const bedCard = renderFeedbackPhoto(bed, markers, 0, {
      interactive: !!o.interactive && bed.length > 0,
      markMode: !!o.markMode && o.markSource === "bed",
      source: "bed",
      title: "粉层照片",
      emptyText: "未上传",
      hasBed
    });
    return `<div id="fb-photo-stack" data-testid="photo-stack">${mainCard}${bedCard}</div>`;
  }

  let pendingNewMarker = null;
  let pinLayoutObservers = [];

  function clearPinLayoutObservers() {
    pinLayoutObservers.forEach((o) => o.disconnect());
    pinLayoutObservers = [];
  }

  function bindPinLayout(stage) {
    if (!stage) return;
    const img = stage.querySelector(".fb-main-photo");
    const layout = () => layoutPinLayer(stage);
    if (img) {
      if (img.complete && img.naturalWidth) layout();
      else img.addEventListener("load", layout, { once: true });
    }
    if (typeof ResizeObserver !== "undefined") {
      const obs = new ResizeObserver(layout);
      obs.observe(stage);
      if (img) obs.observe(img);
      pinLayoutObservers.push(obs);
    }
  }

  function refreshFeedbackPhoto(id) {
    const wrap = $("#fb-photo-stack") || $("#fb-photo-card-main") || $("#fb-photo-card");
    const h = state.homework.find((x) => x.id === id);
    if (!wrap || !h) return;
    const d = gradeDraftFor(id);
    wrap.outerHTML = renderHomeworkPhotos(h, d.markers, {
      interactive: true,
      photoIndex: d.photoIndex,
      markMode: d.markMode,
      markSource: d.markSource
    });
    bindFeedbackPhotoEvents(id);
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
      <p class="sub outline-note">以下为示例大纲，正式课程内容稍后提供。</p>
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
        <a href="#homework"><strong>我的作业</strong><em>Homework</em>${unreadFeedbackCount() ? `<span class="unread-badge" data-testid="unread-feedback">新反馈</span>` : ""}</a>
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
          const extra = h.type === "latte" ? (h.params && h.params.pattern) : ((h.params && (h.params.ratio || formatRatio(h.params.dose, h.params.water))) || (h.params && h.params.grind));
          return `<a class="card hw-item" href="#student/homework/${esc(h.id)}" style="display:block;margin-bottom:12px" data-testid="hw-item-${esc(h.id)}">
            <div class="row-card" style="grid-template-columns:76px 1fr">
              <img src="${hwThumb(h)}" alt="">
              <div>
                <div class="meta-row" style="margin:0 0 4px">
                  ${typeBadge(h.type)}
                  <span class="tag-status ${pending ? "pending" : "graded"}">${pending ? "待批改" : "已批改"}</span>
                  ${h.feedbackUnread ? `<span class="unread-badge" data-testid="unread-feedback">新反馈</span>` : ""}
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

  function renderBedThumb(src) {
    if (!src) return "";
    return `<div class="thumbs" id="hw-bed-thumbs" data-testid="hw-bed-thumbs">
      <div class="thumb">
        <img src="${esc(src)}" alt="粉层照片">
        <button type="button" class="x" data-action="remove-bed-photo" aria-label="删除粉层照片">×</button>
      </div>
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
            <p>拍下成品和粉层，记下粉量、刻度和风味。</p>
          </div>
        </a>
      </div>
    `;
  }

  function renderPhotoField(photos, extraNote, opts) {
    const o = opts || {};
    const label = o.label || "作业照片";
    const hint = o.hint || "点这里拍照或从相册选图，可多选（演示，仅本地）";
    const req = o.required ? `<span class="req">必填</span>` : `<span class="hint">Photos</span>`;
    return `
        <div class="field">
          <label class="${o.required ? "required-mark" : ""}">${esc(label)} ${req}</label>
          <label class="uploader camera" id="hw-uploader">
            <input type="file" accept="image/*" capture="environment" multiple id="hw-photos" data-testid="hw-photos" />
            <div class="ph">
              <strong>拍照交作业</strong>
              ${esc(hint)}
            </div>
          </label>
          ${renderThumbs(photos)}
          ${extraNote || ""}
        </div>`;
  }

  function renderBedPhotoField(src) {
    return `
        <div class="field" data-testid="bed-photo-field">
          <label class="required-mark">粉层照片<span class="req">必填</span></label>
          <p class="tiny bed-hint">冲完后从正上方拍滤杯里的粉层</p>
          <label class="uploader camera" id="hw-bed-uploader">
            <input type="file" accept="image/*" capture="environment" id="hw-bed-photo" data-testid="hw-bed-photo" />
            <div class="ph">
              <strong>拍粉层</strong>
              冲完后从正上方拍滤杯里的粉层（演示，仅本地）
            </div>
          </label>
          ${renderBedThumb(src)}
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
      : renderBrewFields(d);
    return `
      <p class="kicker">${esc(typ.nameEn)}</p>
      <h2 class="block-title" style="margin-top:4px">交一份${esc(typ.nameZh)}作业</h2>
      <p class="sub" style="margin-bottom:14px">在手机上会打开相机。照片只留在这台设备上，不会上传到服务器。</p>
      <form class="form" id="hw-form" data-type="${esc(typ.id)}">
        ${renderPhotoField(photos, videoNote, type === "brew" ? { label: "作业照片", hint: "杯子或成品，可多选（演示，仅本地）", required: true } : null)}
        ${type === "brew" ? renderBedPhotoField(d.bedPhoto || "") : ""}
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
          ["冲煮方式", p.brewMethod],
          ["滤杯名称", dripperDisplay(p)],
          ["滤杯尺寸", p.dripperSize],
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
    const fb = h.feedback || {};
    const markers = normalizeMarkers(fb.markers);
    const itemNotes = Object.assign({}, fb.itemNotes || {});
    if (fb.rubric) {
      fb.rubric.forEach((r) => {
        if (r && r.key && r.note && !itemNotes[r.key]) itemNotes[r.key] = r.note;
      });
    }
    return `
      <div class="meta-row">
        ${typeBadge(h.type)}
        <span class="tag-status ${pending ? "pending" : "graded"}">${pending ? "待批改" : "已批改"}</span>
        ${demoTag()}
      </div>
      <h2 class="block-title" style="margin-top:6px">${esc(hwTypeMeta(h.type).nameZh)}<span class="en">${esc(hwTypeMeta(h.type).nameEn)}</span></h2>
      <article class="card fb-student-photo" style="margin-bottom:14px">
        ${renderHomeworkPhotos(h, markers, { interactive: false })}
        <div class="pad">
          <p class="tiny">提交于 ${esc(h.submittedAt)}${h.photos && h.photos.length > 1 ? " · " + h.photos.length + " 张作业照片" : ""}${h.type === "brew" ? (h.bedPhoto ? " · 已交粉层照片" : " · 粉层未上传") : ""}</p>
          ${
            h.type === "brew"
              ? `${renderBrewRecipeCard(h)}${renderFlavourView(h.flavours)}${h.notes ? `<p class="hw-notes">${esc(h.notes)}</p>` : ""}`
              : `<div class="form-grid" style="margin-top:10px">${renderHwParams(h)}</div>${h.notes ? `<p style="margin-top:12px">${esc(h.notes)}</p>` : ""}`
          }
        </div>
      </article>
      ${
        pending
          ? `<div class="card pad"><p>老师还没有批改。交出去后会出现在老师的批改台里（演示，数据存在这台设备上）。</p></div>`
          : `<div class="feedback-box" data-testid="feedback-box">
              <div class="who">${avatarHTML("amy", "sm")}<span>${esc(fb.by || "Amy Liu")} 的反馈</span> <span class="tag-status teacher">老师</span></div>
              <p class="fb-score-line" data-testid="feedback-score"><strong>${fb.total}/${fb.max}</strong> · ${esc(fb.badge || "")}</p>
              <p class="fb-comment-text">${esc(fb.comments || "")}</p>
              ${fb.commentsEn ? `<p class="en">${esc(fb.commentsEn)}</p>` : ""}
              ${fb.tip ? `<p style="margin-top:8px"><strong>提示</strong> ${esc(fb.tip)}</p>` : ""}
            </div>
            <h2 class="block-title">评分细则<span class="en">Rubric</span></h2>
            <div class="card pad rubric">
              ${(fb.rubric || [])
                .map((r) => {
                  const note = (r.key && itemNotes[r.key]) || r.note || "";
                  return `<div class="fb-r-block">
                    <div class="r-row"><span>${esc(r.nameZh)} <span class="tiny">${esc(r.nameEn)}</span></span><span class="score">${r.score}/${r.max}</span></div>
                    ${note ? `<p class="fb-item-note-view">${esc(note)}</p>` : ""}
                  </div>`;
                })
                .join("")}
              <div class="r-row"><strong>合计 · ${esc(fb.badge || "")}</strong><span class="score">${fb.total}/${fb.max}</span></div>
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
          const extra = h.type === "latte" ? (h.params && h.params.pattern) : ((h.params && (h.params.ratio || formatRatio(h.params.dose, h.params.water))) || (h.params && h.params.grind));
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
                ${h.feedback ? `<p class="sub">${h.feedback.total}/${h.feedback.max} · ${esc(h.feedback.badge)}</p>` : `<p class="sub">打开反馈窗口</p>`}
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
    const itemNotes = Object.assign({}, existing.itemNotes || {}, saved.itemNotes || {});
    if (existing.rubric) {
      existing.rubric.forEach((r) => {
        const key = r.key || (list.find((x) => x.nameZh === r.nameZh) || {}).key;
        if (key && r.note && itemNotes[key] == null) itemNotes[key] = r.note;
      });
    }
    list.forEach((r) => {
      const prev = (existing.rubric || []).find((x) => x.key === r.key || x.nameZh === r.nameZh || x.nameEn === r.nameEn);
      rubric[r.key] = saved.rubric && saved.rubric[r.key] != null ? saved.rubric[r.key] : (prev ? prev.score : 8);
    });
    const markers = saved.markers ? normalizeMarkers(saved.markers) : normalizeMarkers(existing.markers);
    return {
      comments: saved.comments != null ? saved.comments : (existing.comments || ""),
      tip: saved.tip != null ? saved.tip : (existing.tip || ""),
      rubric,
      itemNotes,
      markers,
      photoIndex: saved.photoIndex != null ? saved.photoIndex : 0,
      markMode: Boolean(saved.markMode),
      markSource: saved.markSource === "bed" ? "bed" : "main"
    };
  }

  function syncGradeFormToDraft(id) {
    const base = gradeDraftFor(id);
    const commentsEl = $("#grade-comments");
    const scores = $("#grade-rubric") ? currentRubricScores() : base.rubric;
    const itemNotes = Object.assign({}, base.itemNotes);
    $$("[data-item-note]").forEach((el) => {
      itemNotes[el.getAttribute("data-item-note")] = el.value;
    });
    const photoEl = $("#fb-main-photo-main") || $(".fb-photo-card-main .fb-main-photo") || $("#fb-main-photo");
    const photoIndex = photoEl ? Number(photoEl.getAttribute("data-index")) || 0 : base.photoIndex || 0;
    const prev = state.draftGrade[id] || {};
    state.draftGrade[id] = {
      comments: commentsEl ? commentsEl.value : base.comments,
      tip: base.tip,
      rubric: Object.keys(scores).length ? scores : base.rubric,
      itemNotes,
      markers: prev.markers ? normalizeMarkers(prev.markers) : (base.markers || []),
      photoIndex,
      markMode: Boolean(prev.markMode),
      markSource: prev.markSource === "bed" ? "bed" : "main"
    };
    return state.draftGrade[id];
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
    const badge = badgeFor(total, max);
    const already = h.status === "graded";
    const recipeLabel = typ.id === "latte" ? "学员笔记" : "冲煮记录";
    return `
      <div class="fb-window" data-testid="feedback-window">
        <div class="meta-row">
          ${typeBadge(h.type)}
          <span class="tag-status ${already ? "graded" : "pending"}">${already ? "已发送" : "待发送"}</span>
          ${demoTag()}
        </div>
        <div class="fb-student">
          ${avatarHTML(h.studentId === "me" ? "me" : h.studentId, "md")}
          <div>
            <h2 class="fb-name">${esc(h.studentName)}</h2>
            <p class="sub">${esc(typ.nameZh)} · 提交于 ${esc(h.submittedAt)}</p>
          </div>
        </div>
        ${renderHomeworkPhotos(h, d.markers, { interactive: true, photoIndex: d.photoIndex, markMode: d.markMode, markSource: d.markSource })}
        <article class="card pad fb-recipe" style="margin:12px 0">
          ${
            typ.id === "brew"
              ? `${renderBrewRecipeCard(h)}${renderFlavourView(h.flavours)}${h.notes ? `<p class="hw-notes">${esc(h.notes)}</p>` : `<p class="sub" style="margin-top:12px">学员没有写笔记。</p>`}`
              : `<p class="tiny">${esc(recipeLabel)}</p><div class="form-grid" style="margin-top:8px">${renderHwParams(h)}</div>${h.notes ? `<p style="margin-top:12px">${esc(h.notes)}</p>` : `<p class="sub" style="margin-top:12px">学员没有写笔记。</p>`}`
          }
        </article>
        <form class="form" id="grade-form" data-id="${esc(id)}" data-type="${esc(h.type)}">
          <div class="fb-total-card" id="grade-live">
            <span class="tiny">合计</span>
            <strong id="grade-total" data-testid="grade-total">${total}/${max}</strong>
            <span class="fb-live-badge" id="grade-badge">${esc(badge)}</span>
          </div>
          <h2 class="block-title">评分<span class="en">${esc(typ.nameZh)} · 每项 10 分</span></h2>
          <div class="card pad rubric" id="grade-rubric">
            ${rubric
              .map(
                (r) => `<div class="fb-r-block">
                  <div class="r-row">
                    <span>${esc(r.nameZh)} <span class="tiny">${esc(r.nameEn)}</span></span>
                    <div class="stepper">
                      <button type="button" data-action="rubric-delta" data-key="${esc(r.key)}" data-delta="-1" aria-label="减少 ${esc(r.nameZh)}">−</button>
                      <output data-key="${esc(r.key)}">${d.rubric[r.key]}</output>
                      <button type="button" data-action="rubric-delta" data-key="${esc(r.key)}" data-delta="1" aria-label="增加 ${esc(r.nameZh)}">+</button>
                    </div>
                  </div>
                  <input class="fb-item-note" data-item-note="${esc(r.key)}" maxlength="40" placeholder="这项的短评（可选）" value="${esc(d.itemNotes[r.key] || "")}">
                </div>`
              )
              .join("")}
          </div>
          <div class="field" style="margin-top:16px">
            <label>评语</label>
            <textarea name="comments" id="grade-comments" class="fb-comment" rows="6" placeholder="用你自己的话写给学生">${esc(d.comments)}</textarea>
          </div>
          <div class="field">
            <label>插入常用评语 <span class="hint">点一下加到评语里，不会自动填写</span></label>
            <div class="templates">
              ${templatesFor(h.type).map((tp) => `<button type="button" data-action="grade-template" data-text="${esc(tp.text)}">${esc(tp.title)}</button>`).join("")}
            </div>
          </div>
          <div class="fb-actions">
            <button type="button" class="btn-ghost" data-action="save-grade-draft" data-id="${esc(id)}" data-testid="save-grade-draft">保存草稿</button>
            <button class="btn-primary" type="submit" data-testid="submit-grade">${already ? "更新反馈" : "发送反馈"}</button>
          </div>
        </form>
      </div>
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
        grade: { title: "反馈窗口", sub: "Feedback", back: "#teacher/queue", hideCart: true },
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
        <a href="#student/learn" data-tab="learn">${ICONS.learn}<span>学习</span>${unreadFeedbackCount() ? `<span class="tab-badge unread" data-testid="unread-tab">${unreadFeedbackCount()}</span>` : ""}</a>
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
    const cancelId = pendingNewMarker && pendingNewMarker.hwId;
    const cancelMk = pendingNewMarker && pendingNewMarker.id;
    if (pendingNewMarker) {
      const draft = state.draftGrade[pendingNewMarker.hwId];
      if (draft && draft.markers) {
        draft.markers = draft.markers.filter((m) => m.id !== pendingNewMarker.id);
      }
      pendingNewMarker = null;
    }
    o.hidden = true;
    o.innerHTML = "";
    o.classList.remove("fb-zoom-overlay");
    if (cancelId && cancelMk) refreshFeedbackPhoto(cancelId);
  }

  function openOverlay(inner, mode) {
    const o = $("#overlay");
    o.innerHTML = inner;
    o.hidden = false;
    o.classList.toggle("fb-zoom-overlay", mode === "zoom");
  }

  function openPhotoZoom(src, markers, photoIndex, source) {
    const srcKind = source || "main";
    const list = markers || [];
    const notes = list
      .map((m, i) => (markerSource(m) === srcKind && (srcKind === "bed" || m.photoIndex === photoIndex) && m.note ? `<li><span class="fb-pin-num">${i + 1}</span>${esc(m.note)}</li>` : ""))
      .join("");
    openOverlay(
      `
      <div class="fb-zoom" role="dialog" aria-label="查看照片">
        <button class="fb-zoom-close" type="button" data-action="close-overlay">关闭</button>
        <div class="fb-stage fb-stage-zoom" id="fb-zoom-stage">
          <img class="fb-main-photo" src="${esc(src)}" alt="${srcKind === "bed" ? "粉层照片大图" : "作业照片大图"}" data-source="${esc(srcKind)}" data-index="${photoIndex || 0}">
          <div class="fb-pins">${renderPins(list, photoIndex, "show-marker-note", srcKind)}</div>
        </div>
        ${notes ? `<ol class="fb-zoom-notes">${notes}</ol>` : ""}
      </div>`,
      "zoom"
    );
    bindPinLayout($("#fb-zoom-stage"));
  }

  function openMarkerSheet(hwId, marker, isNew) {
    if (isNew) pendingNewMarker = { hwId, id: marker.id };
    else pendingNewMarker = null;
    openOverlay(`
      <div class="sheet" role="dialog" aria-labelledby="mk-title">
        <div class="handle"></div>
        <h2 id="mk-title">${isNew ? "添加标注" : "编辑标注"}</h2>
        <p class="sub">写一句短评，学生会在照片上看到这个编号。</p>
        <form id="marker-form" data-id="${esc(hwId)}" data-marker="${esc(marker.id)}" data-new="${isNew ? "1" : "0"}">
          <div class="field">
            <label>短评</label>
            <input id="marker-note" name="note" maxlength="40" value="${esc(marker.note || "")}" placeholder="例如：这里奶泡太厚" data-testid="marker-note">
          </div>
          <button class="btn-primary" type="submit">保存标注</button>
          <button class="btn-ghost" type="button" data-action="${isNew ? "cancel-new-marker" : "delete-marker"}" data-marker="${esc(marker.id)}" style="margin-top:8px">${isNew ? "取消" : "删除标注"}</button>
        </form>
      </div>
    `);
    const form = $("#marker-form");
    const input = $("#marker-note");
    if (input) setTimeout(() => input.focus(), 40);
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const note = (input && input.value.trim()) || "";
        if (!note) {
          showToast("请写一句短评");
          return;
        }
        syncGradeFormToDraft(hwId);
        const draft = state.draftGrade[hwId];
        const m = draft.markers.find((x) => x.id === marker.id);
        if (m) m.note = note;
        pendingNewMarker = null;
        closeOverlay();
        refreshFeedbackPhoto(hwId);
        showToast("标注已加上");
      });
    }
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
    const today = todayISO();
    if (!state.checkedInDates.includes(today)) state.checkedInDates.push(today);
    state.streak = computeStreak(state.checkedInDates, today);
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
    const b = $("#grade-badge");
    if (b) b.textContent = badgeFor(total, max);
  }

  function saveGradeDraft(id) {
    const h = state.homework.find((x) => x.id === id);
    if (!h) return;
    syncGradeFormToDraft(id);
    saveState();
    showToast("草稿已保存，学生还看不到");
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
    const draft = syncGradeFormToDraft(id);
    const comments = (draft.comments || "").trim();
    if (!comments) {
      showToast("请先写一句评语");
      return;
    }
    const scores = draft.rubric || currentRubricScores();
    const itemNotes = draft.itemNotes || {};
    const rubric = rubricFor(h.type).map((r) => ({
      key: r.key,
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      score: scores[r.key] || 0,
      max: 10,
      note: (itemNotes[r.key] || "").trim()
    }));
    const total = rubric.reduce((a, b) => a + b.score, 0);
    const max = rubric.length * 10;
    const badge = badgeFor(total, max);
    const alreadyAwarded = Boolean(h.feedback && h.feedback.pointsAwarded);
    const wasGraded = h.status === "graded";
    h.status = "graded";
    h.gradedAt = todayISO() + " " + nowTime();
    h.feedback = {
      by: "Amy Liu",
      comments,
      tip: draft.tip || "",
      itemNotes,
      markers: normalizeMarkers(draft.markers).filter((m) => m.note),
      rubric,
      total,
      max,
      badge,
      pointsAwarded: alreadyAwarded
    };
    h.feedbackUnread = true;
    delete state.draftGrade[id];
    if (!alreadyAwarded && h.studentId === "me") {
      addPoints(20, "作业获批改「" + h.titleZh + "」", "Homework graded", true);
      if (badge === "优秀") addPoints(30, "作业获评优秀", "Homework rated excellent", true);
      h.feedback.pointsAwarded = true;
    } else if (!alreadyAwarded) {
      h.feedback.pointsAwarded = true;
    }
    saveState();
    if (wasGraded) showToast("反馈已更新");
    else showToast(h.studentId === "me" ? "反馈已发送，学员积分已记上（示例）" : "反馈已发送（示例）");
    renderApp();
  }

  function bindFeedbackPhotoEvents(hwId) {
    clearPinLayoutObservers();
    $$(".fb-stage").forEach((stage) => {
      if (stage.classList.contains("fb-stage-zoom")) return;
      bindPinLayout(stage);
      stage.addEventListener("click", (e) => {
        if (e.target.closest(".fb-pin")) return;
        const img = stage.querySelector(".fb-main-photo");
        if (!img) return;
        const id = hwId || (($("#grade-form") && $("#grade-form").getAttribute("data-id")) || "");
        const idx = Number(img.getAttribute("data-index")) || 0;
        const src = img.getAttribute("data-src") || img.src;
        const source = img.getAttribute("data-source") || "main";
        if (id && state.draftGrade[id] && state.draftGrade[id].markMode && (state.draftGrade[id].markSource || "main") === source) {
          const pt = pointToPercent(img, e.clientX, e.clientY);
          if (!pt) {
            showToast("请点在照片上");
            return;
          }
          syncGradeFormToDraft(id);
          const marker = { id: "mk-" + Date.now(), photoIndex: idx, source, x: pt.x, y: pt.y, note: "" };
          state.draftGrade[id].markers = state.draftGrade[id].markers || [];
          state.draftGrade[id].markers.push(marker);
          openMarkerSheet(id, marker, true);
          return;
        }
        const markers = id ? gradeDraftFor(id).markers : studentMarkersFromView();
        openPhotoZoom(src, markers, idx, source);
      });
    });
  }

  function studentMarkersFromView() {
    const route = parseRoute();
    if (route.name !== "homework" || !route.id) return [];
    const h = state.homework.find((x) => x.id === route.id);
    return normalizeMarkers(h && h.feedback && h.feedback.markers);
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
      const bedInput = $("#hw-bed-photo");
      if (bedInput) {
        bedInput.addEventListener("change", () => {
          const files = bedInput.files ? Array.from(bedInput.files) : [];
          if (!files.length) return;
          readFilesAsDataURLs(files.slice(0, 1)).then((urls) => {
            state.draftHw.bedPhoto = urls[0] || "";
            const box = $("#hw-bed-thumbs");
            const html = renderBedThumb(state.draftHw.bedPhoto);
            if (box) {
              if (html) box.outerHTML = html;
              else box.remove();
            } else if (html) {
              $("#hw-bed-uploader").insertAdjacentHTML("afterend", html);
            }
            bedInput.value = "";
          });
        });
      }
      if (form && form.getAttribute("data-type") === "brew") {
        form.addEventListener("input", updateBrewCalcs);
        form.addEventListener("change", updateBrewCalcs);
        updateBrewCalcs();
      }
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const type = form.getAttribute("data-type") === "latte" ? "latte" : "brew";
          const typ = hwTypeMeta(type);
          const photos = (state.draftHw.photos || []).slice();
          const id = "hw-local-" + type + "-" + Date.now();
          let params;
          let flavours = null;
          if (type === "latte") {
            if (!photos.length) {
              showToast("请先拍一张或选一张照片");
              return;
            }
            params = {
              pattern: String(fd.get("pattern") || "心形"),
              cupSize: String(fd.get("cupSize") || "180ml"),
              milkType: String(fd.get("milkType") || "全脂"),
              milkTemp: String(fd.get("milkTemp") || "55–60°C")
            };
          } else {
            params = collectBrewParamsForSubmit();
            const bedPhoto = state.draftHw.bedPhoto || "";
            const err = validateBrewSubmit(photos, params, bedPhoto);
            if (err) {
              showToast(err);
              return;
            }
            flavours = normalizeFlavours(state.draftHw.flavours);
          }
          const notesRaw = String(fd.get("notes") || "").trim();
          const notes = notesRaw ? notesRaw + "（示例提交，仅本地可见）" : "";
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
            bedPhoto: type === "brew" ? (state.draftHw.bedPhoto || "") : "",
            params,
            flavours,
            notes
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
      bindFeedbackPhotoEvents(form && form.getAttribute("data-id"));
    }
    if (route.name === "homework" && route.id && route.id !== "new" && route.id !== "submit") {
      bindFeedbackPhotoEvents(null);
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
    if ((route.mode || state.role) === "student" && route.name === "homework" && route.id && route.id !== "new" && route.id !== "submit") {
      const hw = state.homework.find((x) => x.id === route.id);
      if (hw && hw.studentId === "me" && hw.feedbackUnread) {
        hw.feedbackUnread = false;
        saveState();
        renderTabbar(route);
        setActiveTab(route);
      }
    }
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
    } else if (action === "remove-bed-photo") {
      e.preventDefault();
      state.draftHw.bedPhoto = "";
      const box = $("#hw-bed-thumbs");
      if (box) box.remove();
    } else if (action === "add-pour") {
      e.preventDefault();
      collectBrewDraftFromForm();
      state.draftHw.pours = (state.draftHw.pours && state.draftHw.pours.length ? state.draftHw.pours : [emptyPour()]).concat([emptyPour()]);
      refreshBrewFlavourAndPours();
    } else if (action === "remove-pour") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const i = Number(t.getAttribute("data-index"));
      const list = (state.draftHw.pours || []).slice();
      if (list.length <= 1) {
        state.draftHw.pours = [emptyPour()];
      } else {
        list.splice(i, 1);
        state.draftHw.pours = list;
      }
      refreshBrewFlavourAndPours();
    } else if (action === "toggle-flavor-cat") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const found = flavorCategoryById(t.getAttribute("data-id"));
      if (!found) return;
      const f = normalizeFlavours(state.draftHw.flavours);
      const exists = f.tags.findIndex((x) => x.id === found.id);
      if (exists >= 0) f.tags.splice(exists, 1);
      else f.tags.push(found);
      state.draftHw.flavours = f;
      refreshBrewFlavourAndPours();
    } else if (action === "remove-flavor") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const id = t.getAttribute("data-id");
      const f = normalizeFlavours(state.draftHw.flavours);
      f.tags = f.tags.filter((x) => x.id !== id);
      state.draftHw.flavours = f;
      refreshBrewFlavourAndPours();
    } else if (action === "add-custom-flavor") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const input = $("#flavor-custom-input");
      const text = (input && input.value.trim()) || "";
      if (!text) {
        showToast("请先写下这个风味");
        return;
      }
      const f = normalizeFlavours(state.draftHw.flavours);
      if (f.custom.indexOf(text) === -1) f.custom.push(text);
      state.draftHw.flavours = f;
      if (input) input.value = "";
      refreshBrewFlavourAndPours();
    } else if (action === "remove-custom-flavor") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const i = Number(t.getAttribute("data-index"));
      const f = normalizeFlavours(state.draftHw.flavours);
      f.custom.splice(i, 1);
      state.draftHw.flavours = f;
      refreshBrewFlavourAndPours();
    } else if (action === "set-finish") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const val = t.getAttribute("data-value");
      const f = normalizeFlavours(state.draftHw.flavours);
      f.finish = f.finish === val ? "" : val;
      state.draftHw.flavours = f;
      refreshBrewFlavourAndPours();
    } else if (action === "set-scale") {
      e.preventDefault();
      collectBrewDraftFromForm();
      const key = t.getAttribute("data-key");
      const val = Number(t.getAttribute("data-value"));
      const f = normalizeFlavours(state.draftHw.flavours);
      f[key] = f[key] === val ? "" : val;
      state.draftHw.flavours = f;
      refreshBrewFlavourAndPours();
    } else if (action === "grade-template") {
      e.preventDefault();
      const area = $("#grade-comments");
      if (!area) return;
      const add = t.getAttribute("data-text") || "";
      area.value = area.value.trim() ? area.value.trim() + " " + add : add;
    } else if (action === "save-grade-draft") {
      e.preventDefault();
      saveGradeDraft(t.getAttribute("data-id"));
    } else if (action === "toggle-mark-mode") {
      e.preventDefault();
      const form = $("#grade-form");
      const id = form && form.getAttribute("data-id");
      if (!id) return;
      const source = t.getAttribute("data-source") || "main";
      syncGradeFormToDraft(id);
      const d = state.draftGrade[id];
      if (d.markMode && (d.markSource || "main") === source) d.markMode = false;
      else {
        d.markMode = true;
        d.markSource = source;
      }
      refreshFeedbackPhoto(id);
    } else if (action === "fb-thumb") {
      e.preventDefault();
      const form = $("#grade-form");
      const id = (form && form.getAttribute("data-id")) || null;
      const idx = Number(t.getAttribute("data-index")) || 0;
      if (id) {
        syncGradeFormToDraft(id);
        state.draftGrade[id].photoIndex = idx;
        refreshFeedbackPhoto(id);
      } else {
        const route = parseRoute();
        const h = state.homework.find((x) => x.id === route.id);
        const stack = $("#fb-photo-stack");
        if (!stack || !h) return;
        const markers = normalizeMarkers(h.feedback && h.feedback.markers);
        stack.outerHTML = renderHomeworkPhotos(h, markers, { interactive: false, photoIndex: idx });
        bindFeedbackPhotoEvents(null);
      }
    } else if (action === "zoom-photo") {
      e.preventDefault();
      const form = $("#grade-form");
      const id = form && form.getAttribute("data-id");
      const idx = Number(t.getAttribute("data-index")) || 0;
      const src = t.getAttribute("data-src");
      const source = t.getAttribute("data-source") || "main";
      const markers = id ? gradeDraftFor(id).markers : studentMarkersFromView();
      openPhotoZoom(src, markers, idx, source);
    } else if (action === "edit-marker") {
      e.preventDefault();
      const form = $("#grade-form");
      const id = form && form.getAttribute("data-id");
      if (!id) return;
      syncGradeFormToDraft(id);
      const marker = (state.draftGrade[id].markers || []).find((m) => m.id === t.getAttribute("data-marker"));
      if (marker) openMarkerSheet(id, marker, false);
    } else if (action === "delete-marker" || action === "cancel-new-marker") {
      e.preventDefault();
      const form = $("#grade-form") || $("#marker-form");
      const id = (form && form.getAttribute("data-id")) || ($("#grade-form") && $("#grade-form").getAttribute("data-id"));
      const mk = t.getAttribute("data-marker");
      if (!id || !mk) return;
      syncGradeFormToDraft(id);
      if (state.draftGrade[id]) {
        state.draftGrade[id].markers = (state.draftGrade[id].markers || []).filter((m) => m.id !== mk);
      }
      if (pendingNewMarker && pendingNewMarker.id === mk) pendingNewMarker = null;
      closeOverlay();
      refreshFeedbackPhoto(id);
      if (action === "delete-marker") showToast("标注已删除");
    } else if (action === "show-marker-note") {
      e.preventDefault();
      const mid = t.getAttribute("data-marker");
      const route = parseRoute();
      let markers = [];
      if (route.name === "grade") markers = gradeDraftFor(route.id).markers;
      else markers = studentMarkersFromView();
      const m = markers.find((x) => x.id === mid);
      const n = markers.findIndex((x) => x.id === mid) + 1;
      if (m && m.note) showToast(n + ". " + m.note);
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
      openPhotoZoom(src, [], 0);
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
