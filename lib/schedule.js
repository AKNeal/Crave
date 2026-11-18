// Staff schedule: the Owner (or a Site admin) sets everyone's shifts; each staff login sees only their own shifts and can
// request time off, which the Owner approves or turns down. Runs through /api/admin/photo?site=schedule|shift|timeoff
// (Crave is at Vercel's 12-function limit; see lib/site.js).
//   shifts  "sched:shifts"   [{ id, uid, date "YYYY-MM-DD", start "HH:MM", end "HH:MM", note, by, at }]
//   timeoff "sched:timeoff"  [{ id, uid, name, startDate, endDate, from?, to?, reason, status pending|approved|denied, at, decidedAt, decidedBy, reply }]

const crypto = require("crypto");
const store = require("./store");
const auth = require("./auth");
const T = require("./time");
const { sendEmail, emailReady } = require("./email");

const fail = (status, message) => Object.assign(new Error(message), { status });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const newId = () => `${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
const line = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const canSet = (me) => auth.isFull(me); // Owner or Site admin (the shop password counts as Owner)
const hm = (s) => { const [h, m] = s.split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`; };

async function shifts() { return (await store.getJSON("sched:shifts")) || []; }
async function timeoff() { return (await store.getJSON("sched:timeoff")) || []; }
async function staff() {
  return (await auth.users()).filter((u) => u.active !== false && u.role !== "artist")
    .map((u) => ({ id: u.id, name: u.name, role: auth.ROLES[u.role] || u.role }));
}

// What the schedule screen gets. Staff: only their own shifts and requests. Owner / Site admin: everyone's.
async function view(me) {
  const today = T.dateKey(Date.now());
  const keepFrom = T.dateKey(Date.now() - 35 * 86400e3);
  const [S, O] = await Promise.all([shifts(), timeoff()]);
  const mine = (x) => x.uid === me.id;
  const out = {
    canSet: canSet(me), today, me: { id: me.id, name: me.name },
    shifts: S.filter((s) => s.date >= keepFrom && (canSet(me) || mine(s))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .map((s) => ({ ...s, label: `${hm(s.start)} – ${hm(s.end)}` })),
    timeoff: O.filter((t) => t.endDate >= keepFrom && (canSet(me) || mine(t))).sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
  if (canSet(me)) out.staff = await staff();
  return out;
}

async function saveShift(me, b) {
  if (!canSet(me)) throw fail(403, "Only the Owner sets the schedule.");
  const all = await shifts();
  if (b.remove) { await store.setJSON("sched:shifts", all.filter((s) => s.id !== b.id)); return view(me); }
  if (b.copyWeek) { // copy one week's shifts onto the next week (skips any that are already there)
    const from = String(b.copyWeek); if (!DATE_RE.test(from)) throw fail(400, "Bad week.");
    const plus7 = (d) => T.dateKey(Date.parse(`${d}T20:00:00Z`) + 7 * 86400e3), end = plus7(from);
    const src = all.filter((s) => s.date >= from && s.date < end);
    let n = 0;
    for (const s of src) {
      const date = plus7(s.date);
      if (!all.some((x) => x.uid === s.uid && x.date === date && x.start === s.start)) { all.push({ ...s, id: newId(), date, at: new Date().toISOString() }); n++; }
    }
    await store.setJSON("sched:shifts", all);
    return { ...(await view(me)), copied: n };
  }
  const uid = line(b.uid, 40), date = line(b.date, 10), start = line(b.start, 5), end = line(b.end, 5);
  if (!(await staff()).some((u) => u.id === uid)) throw fail(400, "Pick who's working.");
  if (!DATE_RE.test(date)) throw fail(400, "Pick a day.");
  if (!HM_RE.test(start) || !HM_RE.test(end) || end <= start) throw fail(400, "Pick a start time and a later end time.");
  const entry = { id: b.id && all.some((s) => s.id === b.id) ? b.id : newId(), uid, date, start, end, note: line(b.note, 80), by: me.name, at: new Date().toISOString() };
  await store.setJSON("sched:shifts", all.filter((s) => s.id !== entry.id).concat(entry).filter((s) => s.date >= T.dateKey(Date.now() - 120 * 86400e3)));
  return view(me);
}

async function timeOff(me, b) {
  const all = await timeoff();
  if (b.action === "request") {
    if (me.id === "shop") throw fail(400, "Log in with your own account to request time off.");
    const startDate = line(b.startDate, 10), endDate = line(b.endDate, 10) || startDate;
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) throw fail(400, "Pick the first and last day you need off.");
    if (endDate < T.dateKey(Date.now())) throw fail(400, "Those days have already passed.");
    const from = line(b.from, 5), to = line(b.to, 5);
    if ((from || to) && (!HM_RE.test(from) || !HM_RE.test(to) || to <= from)) throw fail(400, "For part of a day, pick a start time and a later end time.");
    if ((await store.hit(`rl:timeoff:${me.id}`, 3600)) > 15) throw fail(429, "That's a lot of requests. Talk to Rhonda.");
    const t = { id: newId(), uid: me.id, name: me.name, startDate, endDate, from: from || null, to: to || null, reason: line(b.reason, 300), status: "pending", at: new Date().toISOString() };
    all.push(t);
    await store.setJSON("sched:timeoff", all);
    if (emailReady()) {
      const owners = (await auth.users()).filter((u) => u.role === "owner" && u.active !== false && u.email).map((u) => u.email);
      if (owners.length) try { await sendEmail({ to: owners, subject: `Time off request: ${me.name}`, title: `${me.name} asked for time off`,
        paragraphs: [`${dayRange(t)}${t.from ? `, ${hm(t.from)} to ${hm(t.to)}` : " (all day)"}`, t.reason ? `Reason: ${t.reason}` : "", "Approve or turn it down on the staff page, under Schedule."] }); } catch {}
    }
    return view(me);
  }
  const t = all.find((x) => x.id === b.id);
  if (!t) throw fail(404, "That request isn't there.");
  if (b.action === "cancel") {
    if (t.uid !== me.id && !canSet(me)) throw fail(403, "Not yours.");
    await store.setJSON("sched:timeoff", all.filter((x) => x.id !== t.id));
    return view(me);
  }
  if (b.action === "approve" || b.action === "deny") {
    if (!canSet(me)) throw fail(403, "Only the Owner approves time off.");
    t.status = b.action === "approve" ? "approved" : "denied"; t.decidedAt = new Date().toISOString(); t.decidedBy = me.name; t.reply = line(b.reply, 300);
    await store.setJSON("sched:timeoff", all);
    const u = (await auth.users()).find((x) => x.id === t.uid);
    if (emailReady() && u?.email) try { await sendEmail({ to: u.email, subject: `Time off ${t.status}`, title: `Your time off was ${t.status}`,
      paragraphs: [dayRange(t), t.reply ? `${me.name}: ${t.reply}` : ""] }); } catch {}
    return view(me);
  }
  throw fail(400, "Unknown action.");
}
function dayRange(t) {
  const f = (d) => T.dayLabel(Date.parse(`${d}T20:00:00Z`));
  return t.startDate === t.endDate ? f(t.startDate) : `${f(t.startDate)} to ${f(t.endDate)}`;
}

module.exports = { view, saveShift, timeOff };
