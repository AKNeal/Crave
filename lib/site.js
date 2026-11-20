// Finishing the website: the checklist, change requests, on-page text edits, the onboarding pages and Google ranking.
// Crave is at Vercel's 12-function limit, so this has no endpoint of its own. It runs through two existing ones:
//   public  /api/waitlist?site=<op>     edits, hours, rating, rankDue (GET); onboard / menuUpload / rankIngest (POST)
//   staff   /api/admin/photo?site=<op>  overview, file, schedule (GET); checklist / change / edit / rankRefresh / onboardDone / shift / timeoff / hours (POST)
// Everything is kept in the shop's store, so it works before email is connected; once it is, Neal Media also gets an email.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const config = require("../config/studio");
const LIST = require("../config/checklist");
const store = require("./store");
const auth = require("./auth");
const T = require("./time");
const { sendEmail, emailReady } = require("./email");

const fail = (status, message) => Object.assign(new Error(message), { status });
const line = (s, n = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const block = (s, n = 4000) => String(s ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const list = (a, n = 20) => (Array.isArray(a) ? a : []).map((x) => line(x, 80)).filter(Boolean).slice(0, n);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const newId = () => `${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
const whoName = (me) => (me.id === "shop" ? "Neal Media (shop password)" : me.name || me.email || "Staff");

// Neal Media: its own logins, and the shop password (only Neal Media uses it).
const isNealMedia = (me) => Boolean(me) && (me.id === "shop" || LIST.nealMedia.includes(String(me.email || "").toLowerCase()));
const canManage = (me) => Boolean(me) && (auth.isFull(me) || isNealMedia(me));

async function tellNealMedia({ subject, title, paragraphs, replyTo }) {
  if (!emailReady()) return { skipped: true };
  try { return await sendEmail({ to: LIST.nealMedia, subject, title, paragraphs, replyTo }); }
  catch (e) { console.error("[site] email", e.message); return { ok: false }; }
}

// ===================================================================================== checklist
const ITEMS = LIST.groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.name })));
const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const ckey = (id) => `chk:${id}`;

async function autoChecks() {
  const checks = await rankChecks().catch(() => []);
  const last = checks[checks.length - 1];
  let ig = null; try { ig = await require("./instagram").status(); } catch {}
  return {
    instagram: Boolean(ig && ig.connected),
    email: emailReady(),
    sms: require("./sms").smsReady(),
    ranking: Boolean(last && Date.now() - Date.parse(last.at) < 4 * 86400e3),
    hours: Boolean((await store.getJSON("site:hours"))?.savedAt),
  };
}

async function checklist(me) {
  const [states, auto, forms] = await Promise.all([Promise.all(ITEMS.map((i) => store.getJSON(ckey(i.id)))), autoChecks(), onboardList()]);
  const owner = forms.filter((f) => f.form === "owner"), team = forms.filter((f) => f.form === "team");
  const items = ITEMS.map((it, n) => {
    const s = states[n] || {};
    let status = "waiting", detail = "";
    if (it.auto) status = auto[it.auto] ? "done" : "waiting";
    else if (s.doneAt) status = "done";
    else if (it.form === "owner") status = owner.length ? "review" : "waiting";
    else if (it.form === "team") status = team.length ? "review" : "waiting";
    else if ((s.value || "").trim() || (s.files || []).length) status = "review";
    // Waits on the signed agreement: grey and not counted, unless it's already done.
    if (it.after && !LIST.agreementSigned && status !== "done") {
      status = "later";
      // An answer already in (e.g. from the onboarding page) is kept and shown, so nothing is asked twice.
      if ((s.value || "").trim()) detail = `Already sent: ${s.value.trim().split("\n")[0].slice(0, 80)}`;
    }
    if (it.form === "owner" && owner.length) detail = `Sent ${T.dayLabel(Date.parse(owner[0].at))}`;
    if (it.form === "team") detail = team.length ? `${team.length} sent: ${team.map((f) => f.name).join(", ")}` : "None yet";
    return {
      id: it.id, group: it.group, title: it.title, why: it.why, kind: it.form || it.auto ? null : it.kind, form: it.form || null,
      neal: Boolean(it.neal), after: Boolean(it.after), auto: Boolean(it.auto), where: it.where || null, href: it.href || null, view: it.view || null, action: it.action || null,
      status, detail, value: s.value || "", files: (s.files || []).map((f) => ({ ...f, url: fileUrl(f.name) })), note: s.note || "",
      sentAt: s.sentAt || null, sentBy: s.sentBy || "", doneAt: s.doneAt || null, doneBy: s.doneBy || "",
    };
  });
  const counted = items.filter((i) => !i.neal && i.status !== "later");
  return {
    heading: LIST.heading, intro: LIST.intro, items, groups: LIST.groups.map((g) => g.name),
    done: counted.filter((i) => i.status === "done").length, review: counted.filter((i) => i.status === "review").length, total: counted.length,
    canSignOff: isNealMedia(me), agreementSigned: Boolean(LIST.agreementSigned),
  };
}

// Uploads: photos (shrunk in the browser to JPEG) or a PDF. Private: only the staff page can open them.
const MAX_UPLOAD = 3.5 * 1024 * 1024;
function decodeUpload(data) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ""));
  if (!m) throw fail(400, "That file couldn't be read. Photos or PDFs, please.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_UPLOAD) throw fail(400, "That file is too big (3 MB max). Try a photo of it instead.");
  if (buf[0] === 0xff && buf[1] === 0xd8) return { buf, ext: "jpg", type: "image/jpeg" };
  if (buf.slice(0, 4).toString("hex") === "89504e47") return { buf, ext: "png", type: "image/png" };
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return { buf, ext: "webp", type: "image/webp" };
  if (buf.slice(0, 4).toString() === "%PDF") return { buf, ext: "pdf", type: "application/pdf" };
  throw fail(400, "Photos (JPG, PNG) or PDFs, please.");
}
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const localPath = (name) => path.join(process.env.DATA_DIR || path.join(process.cwd(), ".data"), "uploads", name);
const fileUrl = (name) => `/api/admin/photo?site=file&p=${encodeURIComponent(name)}`;
const FILE_RE = () => new RegExp(`^${config.tenant}/checklist/[a-zA-Z]+/\\d+-[a-f0-9]{12}\\.(jpg|png|webp|pdf)$`);

async function putFile(name, f) {
  if (useBlob()) { const { put } = require("@vercel/blob"); await put(name, f.buf, { access: "private", contentType: f.type, addRandomSuffix: false }); return; }
  fs.mkdirSync(path.dirname(localPath(name)), { recursive: true }); fs.writeFileSync(localPath(name), f.buf);
}
async function streamFile(res, name, send) {
  if (!FILE_RE().test(name)) return send(res, 400, { error: "Bad file." });
  const type = name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  if (!useBlob()) {
    if (!fs.existsSync(localPath(name))) return send(res, 404, { error: "Not found." });
    res.statusCode = 200; res.setHeader("Content-Type", type); return res.end(fs.readFileSync(localPath(name)));
  }
  return require("./files").stream(res, name, send);
}

async function checklistAction(me, b) {
  const it = BY_ID[line(b.id, 40)];
  if (!it) throw fail(404, "That isn't on the checklist.");
  if (it.after && !LIST.agreementSigned && !["done", "reopen"].includes(b.action)) throw fail(409, "That one starts after the agreement is signed.");
  const s = (await store.getJSON(ckey(it.id))) || {};
  const now = new Date().toISOString(), by = whoName(me);
  const touched = () => { s.sentAt = now; s.sentBy = by; if (s.doneAt && !isNealMedia(me)) { s.doneAt = null; s.doneBy = ""; } };
  switch (b.action) {
    case "save":
      if (!it.kind || it.kind === "files") throw fail(400, "This one takes files, not text.");
      s.value = block(b.value, 20000); touched(); break;
    case "addFile": {
      if (!["files", "both"].includes(it.kind)) throw fail(400, "This one doesn't take files.");
      if ((s.files || []).length >= 40) throw fail(400, "That's the most files for one item. Send the rest to Neal.");
      const f = decodeUpload(b.data);
      const name = `${config.tenant}/checklist/${it.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${f.ext}`;
      await putFile(name, f);
      s.files = [...(s.files || []), { name, label: line(b.filename, 80) || `${it.id}.${f.ext}`, type: f.type, at: now, by }];
      touched(); break;
    }
    case "removeFile":
      s.files = (s.files || []).filter((f) => f.name !== b.name); break;
    case "done": case "reopen": case "note":
      if (!isNealMedia(me)) throw fail(403, "Neal Media signs items off.");
      if (b.action === "done") { s.doneAt = now; s.doneBy = by; }
      if (b.action === "reopen") { s.doneAt = null; s.doneBy = ""; }
      if (b.action === "note") s.note = block(b.note, 2000);
      break;
    default: throw fail(400, "Unknown checklist action.");
  }
  await store.setJSON(ckey(it.id), s);
  if (["save", "addFile"].includes(b.action) && !isNealMedia(me)) {
    await tellNealMedia({ subject: `Crave checklist: ${it.title}`, title: `${by} sent: ${it.title}`,
      paragraphs: [b.action === "save" ? s.value : `Added a file: ${s.files[s.files.length - 1].label}`, "Open the Crave staff page, Website tab, to see it and sign it off."] });
  }
  return checklist(me);
}

// ===================================================================================== change requests
const PAGES = ["Whole site", "Home", "Menu", "Crave Curbside (ordering)", "Catering & cakes", "Preorders", "Giving back", "Visit", "Meet the crew", "Staff page", "Google / search", "Not sure"];
async function changes() {
  const all = (await store.getJSON("changes:list")) || [];
  return { pages: PAGES, open: all.filter((c) => !c.doneAt).length,
    recent: all.slice(-25).reverse().map(({ id, at, by, page, what, urgent, doneAt }) => ({ id, at, by, page, what, urgent, doneAt: doneAt || null })) };
}
async function changeRequest(me, b) {
  const what = block(b.what, 4000);
  if (what.length < 5) throw fail(400, "Describe the change you want.");
  if ((await store.hit(`rl:change:${me.id}`, 3600)) > 20) throw fail(429, "That's a lot of requests in an hour. Wait a bit, or text Neal.");
  const page = PAGES.includes(b.page) ? b.page : "Not sure";
  const all = (await store.getJSON("changes:list")) || [];
  const entry = { id: newId(), at: new Date().toISOString(), by: whoName(me), byEmail: me.email || "", page, what, urgent: b.urgent === true };
  all.push(entry);
  await store.setJSON("changes:list", all.slice(-300));
  const sent = await tellNealMedia({ replyTo: me.email || undefined,
    subject: `${entry.urgent ? "[TIME-SENSITIVE] " : ""}Crave change request: ${page}`, title: "New change request from Crave",
    paragraphs: [`From: ${entry.by}${entry.byEmail ? ` (${entry.byEmail})` : ""}`, `Page: ${page}${entry.urgent ? "\nTime-sensitive: yes" : ""}`, `What to change:\n${what}`,
      "It's also listed in the Crave staff page, Website tab, where you can mark it done."] });
  return { ok: true, emailed: Boolean(sent.ok || sent.dev), changes: await changes() };
}
async function changeDone(me, b) {
  if (!isNealMedia(me)) throw fail(403, "Neal Media marks changes done.");
  const all = (await store.getJSON("changes:list")) || [];
  const c = all.find((x) => x.id === b.id);
  if (!c) throw fail(404, "That request isn't there.");
  c.doneAt = b.undo ? null : new Date().toISOString();
  await store.setJSON("changes:list", all);
  return { ok: true, changes: await changes() };
}

// ===================================================================================== on-page text edits (like jmhealing)
// Each page keeps { "<block id>": { orig, html, at, by } } under "edits:<page>". The browser only applies an edit while the
// block's original text still matches, so when Neal Media folds edits into the page files nothing lands twice.
const EDIT_PAGES = ["index", "menu", "catering", "give", "visit", "thanksgiving"];
function cleanHtml(html) {
  let s = String(html || "").slice(0, 6000);
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<div[^>]*>/gi, "<br>").replace(/<\/div>/gi, "");
  s = s.replace(/<(\/?)(b|strong)\b[^>]*>/gi, "<$1strong>").replace(/<(\/?)(i|em)\b[^>]*>/gi, "<$1em>").replace(/<br\b[^>]*>/gi, "<br>");
  s = s.replace(/<(?!\/?(strong|em)>|br>)[^>]*>/gi, "").replace(/&nbsp;/g, " ").replace(/(<br>\s*)+$/i, "").trim();
  return s;
}
const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
async function editsFor(page) {
  if (!EDIT_PAGES.includes(page)) return {};
  const all = (await store.getJSON(`edits:${page}`)) || {};
  return Object.fromEntries(Object.entries(all).map(([id, e]) => [id, { orig: e.orig, html: e.html }]));
}
async function saveEdit(me, b) {
  if (!canManage(me)) throw fail(403, "Only the Owner, a Site admin or Neal Media can edit the website.");
  const page = line(b.page, 30), id = line(b.id, 40);
  if (!EDIT_PAGES.includes(page) || !/^b\d{1,4}$/.test(id)) throw fail(400, "That part of the page can't be edited.");
  const all = (await store.getJSON(`edits:${page}`)) || {};
  if (b.action === "revert") delete all[id];
  else {
    const html = cleanHtml(b.html), orig = plain(b.orig).slice(0, 6000);
    if (!plain(html)) throw fail(400, "That would leave it empty.");
    const prev = all[id];
    all[id] = { orig: prev ? prev.orig : orig, html, at: new Date().toISOString(), by: whoName(me) };
    if (plain(html) === all[id].orig) delete all[id]; // changed back to what was there
  }
  await store.setJSON(`edits:${page}`, all);
  return { ok: true, edit: all[id] ? { html: all[id].html } : null };
}
async function allEdits() {
  const out = {};
  for (const p of EDIT_PAGES) { const e = (await store.getJSON(`edits:${p}`)) || {}; if (Object.keys(e).length) out[p] = e; }
  return out;
}

// ===================================================================================== onboarding pages (/rhonda, /onboard)
const LINKS = [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"], ["google", "Google listing"], ["yelp", "Yelp"],
  ["youtube", "YouTube"], ["threads", "Threads"], ["x", "X (Twitter)"], ["pinterest", "Pinterest"], ["delivery", "Delivery apps"], ["other", "Anything else"]];

function ownerSections(b) {
  const crew = (Array.isArray(b.crew) ? b.crew : []).slice(0, 40).map((c) => ({ name: line(c?.name, 80), job: line(c?.job, 80), email: line(c?.email, 120).toLowerCase() })).filter((c) => c.name);
  const links = LINKS.map(([k, label]) => [label, line(b.links?.[k], 300)]);
  return { crew, sections: [
    ["About you and Crave", [["Your name", line(b.name, 100)], ["Your email", line(b.email, 120)], ["Your cell", line(b.phone, 30)], ["Crave's story", block(b.story, 3000)],
      ["Known for", line(b.known, 300)], ["Open since", line(b.since, 60)]]],
    ["Hours and contact", [["Hours right?", line(b.hoursOk, 40)], ["Hours changes", block(b.hours, 1000)], ["Holiday closures", block(b.holidays, 1000)],
      ["Public phone", line(b.publicPhone, 40)], ["Public email", line(b.publicEmail, 120)], ["Own web address", line(b.domain, 120)]]],
    ["Social media and links", links],
    ["Menu", [["How the menu will come", line(b.menuHow, 80)], ["Missing or wrong on the Menu page", block(b.menuNotes, 3000)], ["Best sellers", line(b.bestSellers, 300)],
      ["Gluten-free, vegan, allergies", line(b.dietary, 300)], ["Crave Curbside items", block(b.curbside, 1500)], ["Catering and cakes", block(b.catering, 2000)], ["Seasonal and preorders", block(b.seasonal, 1500)]]],
    ["Crew", crew.map((c) => [c.name, [c.job, c.email].filter(Boolean).join(" · ")])],
    ["Staff page", [["Turn on", list(b.features).join(", ")], ["Leave off", list(b.featuresOff).join(", ")]]],
    ["Google", [["Neal Media as Google manager", line(b.google, 80)], ["Giving back (Hometown Crave)", block(b.giving, 2000)]]],
    ["Ideas", [["Feature request", block(b.featureRequest, 2000)], ["Anything else", block(b.notes, 2000)]]],
  ] };
}
function teamSections(b) {
  return [
    ["About you", [["Name", line(b.name, 100)], ["On the website", line(b.show, 60)], ["Job", [line(b.job, 60), line(b.jobOther, 80)].filter(Boolean).join(": ")],
      ["About you (Meet the crew)", block(b.line, 600)], ["Favorite thing on the menu", line(b.favorite, 120)], ["Working at Crave since", line(b.since, 60)]]],
    ["Staff login", [["Email", line(b.email, 120)], ["Cell", line(b.phone, 30)], ["Turn on", list(b.features).join(", ")], ["Usual shifts", line(b.shifts, 200)]]],
    ["Ideas", [["What would make your shift easier", block(b.featureRequest, 2000)], ["Anything else", block(b.notes, 2000)]]],
  ];
}

async function onboardList() { return ((await store.getJSON("onboard:list")) || []).slice().reverse(); }

// Rhonda's answers also land on the checklist (yellow), so nothing has to be typed twice.
async function fillChecklist(b, crew, by) {
  const links = LINKS.map(([k, l]) => (line(b.links?.[k], 300) ? `${l}: ${line(b.links[k], 300)}` : "")).filter(Boolean).join("\n");
  const put = {
    story: [block(b.story, 3000), line(b.known, 300) && `Known for: ${line(b.known, 300)}`, line(b.since, 60) && `Open since: ${line(b.since, 60)}`].filter(Boolean).join("\n\n"),
    socials: links,
    staff: crew.map((c) => [c.name, c.job, c.email].filter(Boolean).join(", ")).join("\n"),
    menu: [line(b.menuHow, 80) && `How the menu will come: ${line(b.menuHow, 80)}`, block(b.menuNotes, 3000), line(b.bestSellers, 300) && `Best sellers: ${line(b.bestSellers, 300)}`,
      line(b.dietary, 300) && `Gluten-free, vegan, allergies: ${line(b.dietary, 300)}`].filter(Boolean).join("\n\n"),
    curbside: block(b.curbside, 1500), catering: block(b.catering, 2000), specials: block(b.seasonal, 1500), giving: block(b.giving, 2000),
    hours: [line(b.hoursOk, 40), block(b.hours, 1000), block(b.holidays, 1000) && `Holidays: ${block(b.holidays, 1000)}`].filter(Boolean).join("\n"),
    contact: [line(b.publicPhone, 40), line(b.publicEmail, 120)].filter(Boolean).join(" · "),
    domain: line(b.domain, 120), googleAccess: line(b.google, 80),
  };
  const now = new Date().toISOString();
  for (const [id, v] of Object.entries(put)) {
    if (!v || !BY_ID[id]) continue;
    const s = (await store.getJSON(ckey(id))) || {};
    s.value = s.value && s.value.trim() && !s.value.includes(v) ? `${v}\n\n(Earlier:)\n${s.value}` : v;
    s.sentAt = now; s.sentBy = by;
    await store.setJSON(ckey(id), s);
  }
}

async function onboard(req, b) {
  const { ip } = require("./http");
  if (line(b.website, 100)) return { ok: true }; // bots fill the hidden field
  if ((await store.hit(`rl:onboard:${ip(req)}`, 3600)) > 12) throw fail(429, "Too many tries. Wait a bit, or text Neal.");
  const form = b.form === "owner" ? "owner" : b.form === "team" ? "team" : null;
  if (!form) throw fail(400, "Unknown form.");
  const name = line(b.name, 100), email = line(b.email, 120).toLowerCase();
  if (name.length < 2) throw fail(400, "Add your name first.");
  if (email && !EMAIL_RE.test(email)) throw fail(400, "Your email doesn't look right.");
  let sections, crew = [];
  if (form === "owner") ({ sections, crew } = ownerSections(b)); else sections = teamSections(b);
  if (crew.some((c) => c.email && !EMAIL_RE.test(c.email))) throw fail(400, `${crew.find((c) => c.email && !EMAIL_RE.test(c.email)).name}'s email doesn't look right.`);
  if (form === "team" && !block(b.line, 600) && !email) throw fail(400, "Add a line about you or your email before sending.");
  const entry = { id: newId(), form, at: new Date().toISOString(), name, email, sections, crew: form === "owner" ? crew : undefined,
    show: form === "team" ? line(b.show, 60) : undefined, job: form === "team" ? line(b.jobOther, 80) || line(b.job, 60) : undefined };
  const all = (await store.getJSON("onboard:list")) || [];
  all.push(entry);
  await store.setJSON("onboard:list", all.slice(-200));
  if (form === "owner") await fillChecklist(b, crew, name);
  const filled = sections.reduce((n, [, rows]) => n + rows.filter(([, v]) => v).length, 0);
  const paragraphs = [`${name} sent the ${form === "owner" ? "owner" : "crew"} onboarding page (${filled} answers).`,
    ...sections.map(([t, rows]) => `${t.toUpperCase()}\n${rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || "(blank)"}`),
    "Also saved in the Crave staff page, Website tab."];
  await tellNealMedia({ subject: `Crave ${form === "owner" ? "owner" : "crew"} onboarding: ${name}`, title: `Onboarding: ${name}`, paragraphs, replyTo: email || undefined });
  if (email && emailReady()) {
    try { await sendEmail({ to: email, subject: "Your answers for the Crave website", title: `Thanks, ${name.split(" ")[0]}!`,
      paragraphs: ["Here's a copy of what you sent Neal Media & Production.", ...paragraphs.slice(1, -1)] }); } catch {}
  }
  return { ok: true };
}
// Rhonda's onboarding page: menu photos or a PDF dropped there go straight onto the checklist's "complete menu" item.
// Public (no login), so it's capped: 25 files an hour per connection and 80 a day for the whole site, 3 MB each, private storage.
async function menuUpload(req, b) {
  const { ip } = require("./http");
  if (line(b.website, 100)) return { ok: true };
  if ((await store.hit(`rl:menuup:${ip(req)}`, 3600)) > 25) throw fail(429, "That's a lot of files. Wait a bit, or send the rest to Neal.");
  if ((await store.hit("rl:menuup:day", 86400)) > 80) throw fail(429, "Uploads are full for today. Send the rest to Neal.");
  const f = decodeUpload(b.data);
  const s = (await store.getJSON(ckey("menu"))) || {};
  if ((s.files || []).length >= 40) throw fail(400, "That's the most menu files we can take here. Send the rest to Neal.");
  const name = `${config.tenant}/checklist/menu/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${f.ext}`;
  await putFile(name, f);
  const now = new Date().toISOString();
  s.files = [...(s.files || []), { name, label: line(b.filename, 80) || `menu.${f.ext}`, type: f.type, at: now, by: "Rhonda's onboarding page" }];
  s.sentAt = now; s.sentBy = "Rhonda's onboarding page";
  if (s.doneAt) { s.doneAt = null; s.doneBy = ""; }
  await store.setJSON(ckey("menu"), s);
  return { ok: true, count: s.files.length };
}

async function onboardDone(me, b) {
  if (!canManage(me)) throw fail(403, "Not allowed.");
  const all = (await store.getJSON("onboard:list")) || [];
  const e = all.find((x) => x.id === b.id);
  if (!e) throw fail(404, "Not found.");
  e.handledAt = b.undo ? null : new Date().toISOString();
  await store.setJSON("onboard:list", all);
  return { ok: true, onboarding: await onboardList() };
}

// ===================================================================================== Google ranking
// Same as Black Wolf: a real Google search each morning in Neal Media's browser (scheduled task) reads where Crave sits in
// the business list for each search and posts it here. Rank 11 = not in the top 10. Nothing is ever guessed.
const RANK = () => require("../data/rankings.json");
async function rankChecks() { const v = await store.getJSON("rankings:checks"); return Array.isArray(v) ? v : []; }
function tokenOk(req) { const t = process.env.RANK_INGEST_TOKEN; return Boolean(t) && req.headers.authorization === `Bearer ${t}`; }

async function rankIngest(body, now = Date.now()) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date || "")) ? body.date : T.dateKey(now);
  const ranks = {};
  for (const q of RANK().searches) {
    const x = body?.searches?.[q];
    if (!x) throw fail(400, `Missing the search "${q}".`);
    const r = x.rank == null ? 11 : Number(x.rank);
    if (!Number.isInteger(r) || r < 1 || r > 11) throw fail(400, `"${q}": rank should be 1 to 10, or null if Crave wasn't listed.`);
    ranks[q] = { rank: r, top: (Array.isArray(x.top) ? x.top : []).slice(0, 10).map((n) => String(n).slice(0, 80)) };
  }
  const num = (v, lo, hi) => (v == null || v === "" ? null : Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);
  const check = { date, at: new Date(now).toISOString(), source: "google-search", reviews: num(body.reviews, 0, 100000), rating: num(body.rating, 1, 5), ranks };
  if (body.note) check.note = String(body.note).slice(0, 300);
  const all = (await rankChecks()).filter((c) => c.date !== date).concat(check).sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  await store.setJSON("rankings:checks", all);
  return check;
}
async function rankDue(now = Date.now()) {
  const req = await store.getJSON("rankings:requested"), all = await rankChecks(), last = all[all.length - 1];
  if (req && (!last || last.at < req.at)) return { due: true, reason: "refresh requested", requestedAt: req.at, searches: RANK().searches };
  if ((!last || last.date !== T.dateKey(now)) && T.parts(now).h >= 1) return { due: true, reason: "morning check", searches: RANK().searches };
  return { due: false, lastCheck: last ? last.at : null };
}
async function rankRefresh(me) {
  if (!canManage(me)) throw fail(403, "Not allowed.");
  await store.setJSON("rankings:requested", { at: new Date().toISOString(), by: whoName(me) });
  return { ok: true, rankings: await rankSummary() };
}
async function rankSummary() {
  const checks = await rankChecks(), req = await store.getJSON("rankings:requested");
  const searches = RANK().searches;
  if (!checks.length) return { searches: searches.map((q) => ({ q, rank: null, change: null, top: [] })), date: null, requestedAt: req?.at || null, tracking: Boolean(process.env.RANK_INGEST_TOKEN) };
  const last = checks[checks.length - 1], prev = checks[checks.length - 2];
  // Only the searches still tracked count (older checks may hold searches since dropped).
  const avgOf = (c) => { const r = searches.map((q) => c?.ranks?.[q]?.rank).filter(Number.isFinite); return r.length ? Math.round(10 * r.reduce((a, b) => a + b, 0) / r.length) / 10 : null; };
  return {
    date: last.date, at: last.at, rating: last.rating, reviews: last.reviews, avg: avgOf(last), requestedAt: req?.at || null, tracking: Boolean(process.env.RANK_INGEST_TOKEN),
    searches: searches.map((q) => { const now = last.ranks?.[q]?.rank ?? null, before = prev?.ranks?.[q]?.rank;
      return { q, rank: now, change: Number.isFinite(now) && Number.isFinite(before) ? before - now : null, top: last.ranks?.[q]?.top || [] }; }),
    history: checks.slice(-14).map((c) => ({ date: c.date, avg: avgOf(c) })),
  };
}
async function rating() {
  const last = [...(await rankChecks())].reverse().find((c) => c.rating != null);
  return last ? { rating: last.rating, reviews: last.reviews, date: last.date } : { rating: null };
}

// ===================================================================================== shop hours
// The dining-room hours shown on the website (footer, Visit and home pages) and on the staff page. Rhonda changes them on the
// staff page (Website tab, Shop hours); the website picks them up as the page loads (assets/hours.js). The hours written into
// the pages at build time are only the fallback until then.
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_HOURS = { 0: { open: "09:30", close: "15:30" }, 1: { open: "07:30", close: "15:30" }, 2: null, 3: null, 4: { open: "07:30", close: "15:30" }, 5: { open: "07:30", close: "15:30" }, 6: { open: "09:30", close: "15:30" } };
const hm12 = (s) => { const [h, m] = s.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
// Monday first; days in a row with the same hours share a line ("Thu, Fri", or "Mon – Fri" for three or more).
function hourRows(days) {
  const order = [1, 2, 3, 4, 5, 6, 0], text = (d) => (days[d] ? `${hm12(days[d].open)} – ${hm12(days[d].close)}` : "Closed"), rows = [];
  for (const d of order) { const t = text(d), last = rows[rows.length - 1]; if (last && last.t === t) last.d.push(d); else rows.push({ t, d: [d] }); }
  return rows.map(({ t, d }) => [d.length === 1 ? DAY_LONG[d[0]] : d.length === 2 ? `${DAY_SHORT[d[0]]}, ${DAY_SHORT[d[1]]}` : `${DAY_SHORT[d[0]]} – ${DAY_SHORT[d[d.length - 1]]}`, t]);
}
async function getHours() {
  const h = await store.getJSON("site:hours");
  const days = h?.days || DEFAULT_HOURS;
  return { days, rows: hourRows(days), note: h?.note || "", savedAt: h?.savedAt || null, savedBy: h?.savedBy || "" };
}
async function saveHours(me, b) {
  if (!canManage(me)) throw fail(403, "Only the Owner or a Site admin changes the hours.");
  const HM = /^([01]\d|2[0-3]):[0-5]\d$/, days = {};
  for (let d = 0; d < 7; d++) {
    const x = b.days?.[d];
    if (!x) { days[d] = null; continue; }
    if (!HM.test(x.open) || !HM.test(x.close) || x.close <= x.open) throw fail(400, `${DAY_LONG[d]}: pick an opening time and a later closing time.`);
    days[d] = { open: x.open, close: x.close };
  }
  await store.setJSON("site:hours", { days, note: line(b.note, 160), savedAt: new Date().toISOString(), savedBy: whoName(me) });
  return { ok: true, hours: await getHours() };
}

// ===================================================================================== routing
async function publicApi(req, res, op, send, body) {
  try {
    if (op === "edits" && req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return send(res, 200, { ok: true, edits: await editsFor(line(new URL(req.url, "http://x").searchParams.get("page"), 30)) });
    }
    if (op === "rating" && req.method === "GET") { const r = await rating(); send(res, 200, r); return; }
    if (op === "hours" && req.method === "GET") { const h = await getHours(); return send(res, 200, { days: h.days, rows: h.rows, note: h.note }); }
    if (op === "onboard" && req.method === "POST") return send(res, 200, await onboard(req, body(req)));
    if (op === "menuUpload" && req.method === "POST") return send(res, 200, await menuUpload(req, body(req)));
    if (op === "rankDue" && req.method === "GET") return tokenOk(req) ? send(res, 200, await rankDue()) : send(res, 401, { error: "Not allowed." });
    if (op === "rankIngest" && req.method === "POST") return tokenOk(req) ? send(res, 200, { ok: true, check: await rankIngest(body(req)) }) : send(res, 401, { error: "Not allowed." });
    return send(res, 404, { error: "Unknown." });
  } catch (e) {
    if (!e.status) console.error("[site]", e);
    return send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong. Try again in a minute." });
  }
}

async function staffApi(req, res, op, send, body) {
  const me = await auth.currentUser(req);
  if (!me) return send(res, 401, { error: "Log in first." });
  try {
    if (req.method === "GET" && op === "file") {
      if (!canManage(me)) return send(res, 403, { error: "Not allowed." });
      return streamFile(res, String(new URL(req.url, "http://x").searchParams.get("p") || ""), send);
    }
    if (req.method === "GET" && op === "schedule") return send(res, 200, await require("./schedule").view(me));
    if (req.method === "GET" && op === "overview") {
      if (!canManage(me)) return send(res, 200, { allowed: false });
      const [ck, ch, rk, ob, hrs] = await Promise.all([checklist(me), changes(), rankSummary(), onboardList(), getHours()]);
      return send(res, 200, { allowed: true, nealMedia: isNealMedia(me), checklist: ck, changes: ch, rankings: rk, onboarding: ob, hours: hrs, edits: isNealMedia(me) ? await allEdits() : undefined, emailReady: emailReady() });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const b = body(req);
    if (op === "edit") return send(res, 200, await saveEdit(me, b));
    if (op === "shift") return send(res, 200, await require("./schedule").saveShift(me, b));
    if (op === "hours") return send(res, 200, await saveHours(me, b));
    if (op === "timeoff") return send(res, 200, await require("./schedule").timeOff(me, b));
    if (!canManage(me)) return send(res, 403, { error: "Only the Owner, a Site admin or Neal Media can do that." });
    if (op === "checklist") return send(res, 200, { ok: true, checklist: await checklistAction(me, b) });
    if (op === "change") return send(res, 200, await changeRequest(me, b));
    if (op === "changeDone") return send(res, 200, await changeDone(me, b));
    if (op === "rankRefresh") return send(res, 200, await rankRefresh(me));
    if (op === "onboardDone") return send(res, 200, await onboardDone(me, b));
    return send(res, 404, { error: "Unknown." });
  } catch (e) {
    if (!e.status) console.error("[site]", e);
    return send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong. Try again in a minute." });
  }
}

module.exports = { publicApi, staffApi, rankIngest, rankDue, rankSummary, checklist, isNealMedia, canManage, EDIT_PAGES, PAGES };
