// Perfect Timing: order ahead, pick a pickup window, and the kitchen fires each order so it's hot right at pickup.
//
// Public
//   GET  /api/orders                         -> { on, days:[{date,label,open}], note }
//   GET  /api/orders?date=YYYY-MM-DD         -> { ..., windows:[{time,label,left}] }
//   GET  /api/orders?track=<id>.<token>      -> the customer's own order (status, items, pickup)
//   POST { action:"place", date, time, items:[{id,qty,choices:[],note}], name, phone, email, notes, pay }
// Kitchen (logged in to /admin)
//   GET  /api/orders?board=YYYY-MM-DD        -> every order that day + settings
//   POST { action:"status", id, status }     new | cooking | ready | done | cancelled
//   POST { action:"settings", ...settings }
//
// Storage (shop prefix "crave:"): pt:settings, pt:order:<id>, pt:day:<date> (index, score = pickup minute), pt:load:<date> ({"07:15": 3})

const store = require("../lib/store");
const T = require("../lib/time");
const auth = require("../lib/auth");
const config = require("../config/studio");
const MENU = require("../public/assets/menu-data.js");
const { sendEmail } = require("../lib/email");
const { send, body, ip, id, str, baseUrl } = require("../lib/http");

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULTS = {
  on: true,
  // Pickup hours (last window starts before "close").
  // Crave: Mon, Tue, Thu, Fri 7:30–3:30 · Wed closed · Sat, Sun 9:30–3:30 (last pickup window starts 3:15).
  hours: { 0: { open: "09:30", close: "15:15" }, 1: { open: "07:30", close: "15:15" }, 2: { open: "07:30", close: "15:15" }, 3: null,
    4: { open: "07:30", close: "15:15" }, 5: { open: "07:30", close: "15:15" }, 6: { open: "09:30", close: "15:15" } },
  windowMin: 15,     // length of a pickup window
  perWindow: 5,      // orders the line can take per window
  leadMin: 30,       // shortest notice for a same-day order
  daysAhead: 7,      // how far ahead customers can order
  maxItems: 30,
  closed: [],        // ["2026-12-25", ...]
  message: "",       // shown on the order page (e.g. "Pie is sold out today")
};
const STATUSES = ["new", "cooking", "ready", "done", "cancelled"];
const STATUS_WORDS = { new: "Order received", cooking: "On the grill", ready: "Ready for pickup", done: "Picked up", cancelled: "Cancelled" };

const hmToMin = (s) => { const p = T.parseHM(s); return p ? p.h * 60 + p.mi : null; };
const minToHm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const label12 = (hm) => { const [h, m] = hm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

async function settings() {
  const s = (await store.getJSON("pt:settings")) || {};
  return { ...DEFAULTS, ...s, hours: { ...DEFAULTS.hours, ...(s.hours || {}) } };
}
const todayKey = () => T.dateKey(Date.now());
const nowMin = () => { const p = T.parts(Date.now()); return p.h * 60 + p.mi; };

function dayInfo(S, dateKey) {
  const d = T.parseDate(dateKey);
  if (!d) return null;
  const wd = T.weekdayOf(d);
  const h = S.hours[wd];
  const open = Boolean(S.on && h && !S.closed.includes(dateKey));
  return { date: dateKey, wd, open, hours: h, label: `${DAY_NAMES[wd]} ${new Date(Date.UTC(d.y, d.m - 1, d.d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` };
}

function days(S) {
  const start = T.parseDate(todayKey());
  const out = [];
  for (let i = 0; i <= S.daysAhead; i++) {
    const info = dayInfo(S, T.keyOf(T.addDays(start, i)));
    if (i === 0) info.label = "Today";
    else if (i === 1) info.label = `Tomorrow`;
    out.push(info);
  }
  // Today closes for ordering once its last window is inside the lead time.
  if (out[0].open && !windowsFor(S, out[0], {}).some((w) => w.left > 0)) out[0].open = false;
  return out.map(({ date, label, open }) => ({ date, label, open }));
}

function windowsFor(S, info, load) {
  if (!info || !info.open) return [];
  const a = hmToMin(info.hours.open), b = hmToMin(info.hours.close);
  const earliest = info.date === todayKey() ? nowMin() + S.leadMin : -1;
  const out = [];
  for (let m = a; m <= b; m += S.windowMin) {
    if (m < earliest) continue;
    const time = minToHm(m);
    out.push({ time, label: `${label12(time)}–${label12(minToHm(m + S.windowMin))}`, left: Math.max(0, S.perWindow - (load[time] || 0)) });
  }
  return out;
}

// Rebuild an order from the menu, ignoring any prices the browser sent.
function priceItems(raw, S) {
  if (!Array.isArray(raw) || !raw.length) throw new Error("Add something to your order first.");
  let count = 0;
  const items = raw.slice(0, 40).map((x) => {
    const item = MENU.byId(String(x.id || ""));
    if (!item || item.orderAhead === false) throw new Error("Something in your cart isn't on the menu anymore. Please remove it.");
    const qty = Math.max(1, Math.min(20, Math.floor(Number(x.qty) || 1)));
    count += qty;
    const groups = item.choices || [];
    const picked = groups.map((g, i) => {
      const v = Array.isArray(x.choices) ? String(x.choices[i] || "") : "";
      return g.options.includes(v) ? v : g.options[0];
    });
    const unit = Math.round((item.price + picked.reduce((s, o) => s + MENU.optionDelta(o), 0)) * 100) / 100;
    const cat = MENU.categories.find((c) => c.id === item.cat) || {};
    return { id: item.id, name: item.name, qty, choices: groups.map((g, i) => `${g.name}: ${picked[i]}`), note: str(x.note, 140),
      unit, line: Math.round(unit * qty * 100) / 100, prep: cat.prep || 10, cat: item.cat };
  });
  if (count > S.maxItems) throw new Error(`Up to ${S.maxItems} items per order online. For bigger orders, try Catering.`);
  return items;
}

const pickupMs = (o) => { const d = T.parseDate(o.date), t = T.parseHM(o.time); return T.toUtc(d.y, d.m, d.d, t.h, t.mi); };
// When the kitchen should start so everything finishes together, right at pickup.
const fireMs = (o) => pickupMs(o) - Math.max(...o.items.map((i) => i.prep)) * 60000;
function publicOrder(o) {
  return { id: o.id, code: o.code, date: o.date, time: o.time, window: o.window, dayLabel: o.dayLabel, items: o.items.map(({ prep, cat, ...i }) => i),
    total: o.total, name: o.name, pay: o.pay, status: o.status, statusWord: STATUS_WORDS[o.status], notes: o.notes, updatedAt: o.updatedAt };
}

module.exports = async function handler(req, res) {
  try {
    const q = new URL(req.url, "http://x").searchParams;
    if (req.method === "GET") {
      if (q.get("board")) return await board(req, res, q.get("board"));
      if (q.get("track")) return await track(res, q.get("track"));
      const S = await settings();
      const out = { on: S.on, message: S.message, days: days(S), windowMin: S.windowMin };
      const date = q.get("date");
      if (date) {
        const info = dayInfo(S, date);
        if (!info) return send(res, 400, { error: "Pick a date." });
        out.windows = windowsFor(S, info, (await store.getJSON(`pt:load:${date}`)) || {});
      }
      return send(res, 200, out);
    }
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const b = body(req);
    if (b.action === "place") return await place(req, res, b);
    if (b.action === "status") return await setStatus(req, res, b);
    if (b.action === "settings") return await saveSettings(req, res, b);
    return send(res, 400, { error: "Unknown action." });
  } catch (e) {
    console.error("[orders]", e);
    return send(res, 400, { error: e.message || "Something went wrong. Please call us." });
  }
};

async function place(req, res, b) {
  if (str(b.website)) return send(res, 200, { ok: true }); // bots fill the hidden field
  if ((await store.hit(`rl:order:${ip(req)}`, 3600)) > 12) return send(res, 429, { error: "Too many orders from here in the last hour. Please call us." });
  const S = await settings();
  if (!S.on) return send(res, 400, { error: "Crave To Go is paused right now. Please call us." });
  const name = str(b.name, 60), phone = str(b.phone, 30), email = str(b.email, 120).toLowerCase();
  const errors = {};
  if (name.length < 2) errors.name = "Enter the name for the order.";
  if (phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a phone number so we can reach you about the order.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Check the email, or leave it blank.";
  if (Object.keys(errors).length) return send(res, 400, { error: "Check the highlighted fields.", errors });
  const items = priceItems(b.items, S);
  const info = dayInfo(S, str(b.date, 10));
  if (!info || !info.open) return send(res, 400, { error: "We're not taking orders for that day. Pick another.", pickAgain: true });
  const time = str(b.time, 5);

  if (!(await store.lock(`pt:${info.date}`, 8000))) return send(res, 409, { error: "Lots of orders at once. Please try again.", pickAgain: false });
  try {
    const load = (await store.getJSON(`pt:load:${info.date}`)) || {};
    const w = windowsFor(S, info, load).find((x) => x.time === time);
    if (!w) return send(res, 409, { error: "That pickup time just passed. Pick another.", pickAgain: true });
    if (w.left <= 0) return send(res, 409, { error: "That pickup time just filled up. Pick another.", pickAgain: true });
    const total = Math.round(items.reduce((s, i) => s + i.line, 0) * 100) / 100;
    const n = await store.hit(`pt:seq:${info.date}`, 3 * 86400);
    const o = { id: id(6), token: id(9), code: `${DAY_NAMES[info.wd][0]}${String(n).padStart(2, "0")}`, date: info.date, time, window: w.label,
      dayLabel: info.label, items, total, name, phone, email, notes: str(b.notes, 300), pay: b.pay === "cash" ? "cash" : "card",
      status: "new", createdAt: Date.now(), updatedAt: Date.now(), history: [{ at: Date.now(), status: "new" }] };
    await store.setJSON(`pt:order:${o.id}`, o);
    await store.indexAdd(`pt:day:${o.date}`, o.id, hmToMin(time));
    load[time] = (load[time] || 0) + 1;
    await store.setJSON(`pt:load:${o.date}`, load);
    const site = baseUrl(req), link = `${site}/order?t=${o.id}.${o.token}`;
    const lines = o.items.map((i) => `${i.qty} × ${i.name}${i.choices.length ? ` (${i.choices.map((c) => c.split(": ")[1]).join(", ")})` : ""}`);
    const when = `${info.label === "Today" || info.label === "Tomorrow" ? info.label : info.label}, ${w.label}`;
    await Promise.all([
      email && sendEmail({ to: email, subject: `Order ${o.code} is in — pickup ${when}`, title: "Your order is locked in",
        paragraphs: [`Hi ${name.split(" ")[0]},`, `We'll have it hot at ${when}. Pay at the counter (${o.pay}).`, lines.join("\n"), `Total: ${MENU.money(total)}`],
        button: { label: "Track your order", url: link } }),
      config.studio.contactEmail && sendEmail({ to: config.studio.contactEmail, subject: `New order ${o.code} — ${when}`, title: `Order ${o.code} for ${name}`,
        paragraphs: [`Pickup ${when}. ${phone}`, lines.join("\n"), o.notes ? `Notes: ${o.notes}` : "", `Total ${MENU.money(total)}, paying ${o.pay}.`],
        button: { label: "Open the kitchen board", url: `${site}/kitchen` } }),
    ]);
    return send(res, 201, { ok: true, order: publicOrder(o), track: `${o.id}.${o.token}` });
  } finally {
    await store.unlock(`pt:${info.date}`);
  }
}

async function track(res, t) {
  const [oid, token] = String(t).split(".");
  const o = oid && (await store.getJSON(`pt:order:${oid.slice(0, 20)}`));
  if (!o || o.token !== token) return send(res, 404, { error: "We couldn't find that order. Check the link, or call us." });
  return send(res, 200, { order: publicOrder(o) });
}

async function staff(req, res) {
  const me = await auth.currentUser(req);
  if (!me) { send(res, 401, { error: "Log in first.", login: true }); return null; }
  return me;
}

async function board(req, res, date) {
  if (!(await staff(req, res))) return;
  if (!T.parseDate(date)) return send(res, 400, { error: "Pick a date." });
  const S = await settings();
  const ids = await store.indexRangeByScore(`pt:day:${date}`, 0, 24 * 60);
  const orders = (await Promise.all(ids.map((x) => store.getJSON(`pt:order:${x}`)))).filter(Boolean)
    .map((o) => ({ ...publicOrder(o), phone: o.phone, email: o.email, pickupAt: pickupMs(o), fireAt: fireMs(o),
      fireLabel: T.timeLabel(fireMs(o)), items: o.items.map(({ cat, ...i }) => i), history: o.history }));
  const info = dayInfo(S, date);
  return send(res, 200, { orders, settings: S, now: Date.now(), today: todayKey(), day: info,
    windows: windowsFor({ ...S, leadMin: 0 }, info, (await store.getJSON(`pt:load:${date}`)) || {}) });
}

async function setStatus(req, res, b) {
  const me = await staff(req, res); if (!me) return;
  const o = await store.getJSON(`pt:order:${str(b.id, 20)}`);
  if (!o) return send(res, 404, { error: "No such order." });
  if (!STATUSES.includes(b.status)) return send(res, 400, { error: "Unknown status." });
  if (o.status === b.status) return send(res, 200, { ok: true });
  // Cancelling frees the pickup window; un-cancelling takes it back.
  if ((b.status === "cancelled") !== (o.status === "cancelled")) {
    if (await store.lock(`pt:${o.date}`, 8000)) {
      try {
        const load = (await store.getJSON(`pt:load:${o.date}`)) || {};
        load[o.time] = Math.max(0, (load[o.time] || 0) + (b.status === "cancelled" ? -1 : 1));
        await store.setJSON(`pt:load:${o.date}`, load);
      } finally { await store.unlock(`pt:${o.date}`); }
    }
  }
  o.status = b.status; o.updatedAt = Date.now();
  o.history = [...(o.history || []), { at: Date.now(), status: b.status, by: me.name }].slice(-20);
  await store.setJSON(`pt:order:${o.id}`, o);
  if (b.status === "ready" && o.email) {
    await sendEmail({ to: o.email, subject: `Order ${o.code} is ready`, title: "Your order is ready", paragraphs: [`Hi ${o.name.split(" ")[0]}, it's hot and waiting at the counter.`] });
  }
  return send(res, 200, { ok: true });
}

async function saveSettings(req, res, b) {
  const me = await staff(req, res); if (!me) return;
  if (!auth.isFull(me) && me.role !== "desk") return send(res, 403, { error: "Ask the owner to change Crave To Go settings." });
  const S = await settings();
  const num = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const next = { ...S };
  if (b.on !== undefined) next.on = Boolean(b.on);
  if (b.windowMin !== undefined) next.windowMin = [10, 15, 20, 30].includes(Number(b.windowMin)) ? Number(b.windowMin) : S.windowMin;
  if (b.perWindow !== undefined) next.perWindow = num(b.perWindow, 1, 50, S.perWindow);
  if (b.leadMin !== undefined) next.leadMin = num(b.leadMin, 0, 24 * 60, S.leadMin);
  if (b.daysAhead !== undefined) next.daysAhead = num(b.daysAhead, 0, 30, S.daysAhead);
  if (b.maxItems !== undefined) next.maxItems = num(b.maxItems, 1, 100, S.maxItems);
  if (b.message !== undefined) next.message = str(b.message, 200);
  if (b.closed !== undefined) next.closed = [...new Set((Array.isArray(b.closed) ? b.closed : []).filter((d) => T.parseDate(d)))].sort().slice(-200);
  if (b.hours) {
    const hours = {};
    for (let d = 0; d < 7; d++) {
      const h = b.hours[d];
      if (!h) { hours[d] = null; continue; }
      const a = hmToMin(h.open), z = hmToMin(h.close);
      if (a == null || z == null || a > z) throw new Error(`Check ${DAY_NAMES[d]}: the first pickup must be before the last.`);
      hours[d] = { open: h.open, close: h.close };
    }
    next.hours = hours;
  }
  await store.setJSON("pt:settings", next);
  return send(res, 200, { ok: true, settings: next });
}

module.exports = require("../lib/tenant").handler(module.exports);
