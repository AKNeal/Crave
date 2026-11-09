// Kitchen board for Order Ahead (Perfect Timing). Orders sit in columns by status, sorted by the time to fire them,
// so every order finishes right at its pickup window. Same login as the catering inbox (/admin).
(() => {
  const { api, el } = window.BW;
  const $ = (id) => document.getElementById(id);
  const money = (n) => "$" + Number(n).toFixed(2);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let data = null, timer = null;

  const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Anchorage" }).format(new Date());
  $("day").value = todayKey();
  $("day").addEventListener("change", load);
  $("today").addEventListener("click", () => { $("day").value = todayKey(); load(); });
  $("settingsBtn").addEventListener("click", () => { const s = $("settings"); s.hidden = !s.hidden; if (!s.hidden) drawSettings(); s.scrollIntoView({ behavior: "smooth" }); });

  async function load() {
    clearTimeout(timer);
    try { data = await api(`/api/orders?board=${$("day").value}`); }
    catch (e) {
      if (e.status === 401) { $("msg").replaceChildren(el("p", { class: "notice" }, "Log in first. ", el("a", { href: "/admin" }, "Open the inbox to log in"), ", then come back here.")); return; }
      $("msg").replaceChildren(el("p", { class: "notice" }, e.message)); timer = setTimeout(load, 30000); return;
    }
    $("msg").replaceChildren(!data.settings.on ? el("p", { class: "notice" }, "Order Ahead is paused: customers can't place orders. Turn it back on in Order Ahead settings.") : "");
    draw();
    timer = setTimeout(load, 20000);
  }

  function draw() {
    const now = Date.now();
    $("load").replaceChildren(el("strong", { style: "font-size:.8rem;margin-right:6px;align-self:center" }, "Load:"),
      ...(data.windows || []).map((w) => el("span", { class: w.left <= 0 ? "full" : "", title: `${data.settings.perWindow - w.left} of ${data.settings.perWindow}` },
        `${w.label.split("–")[0].replace(" AM", "a").replace(" PM", "p")} ${data.settings.perWindow - w.left}/${data.settings.perWindow}`)));
    const cols = [["new", "To fire"], ["cooking", "On the grill"], ["ready", "Ready / waiting"], ["done", "Picked up"]];
    const by = (s) => data.orders.filter((o) => o.status === s).sort((a, b) => a.fireAt - b.fireAt);
    const cancelled = by("cancelled");
    $("cols").replaceChildren(...cols.map(([s, name]) => {
      const list = by(s);
      return el("section", { class: "kb-col" }, el("h2", {}, el("span", {}, name), el("span", {}, String(list.length))),
        ...(list.length ? list.map((o) => card(o, now)) : [el("p", { class: "muted small" }, s === "new" ? "Nothing waiting." : "—")]),
        s === "done" && cancelled.length ? el("details", { style: "margin-top:12px" }, el("summary", { class: "small" }, `Cancelled (${cancelled.length})`), ...cancelled.map((o) => card(o, now))) : null);
    }));
  }

  function card(o, now) {
    const fireIn = Math.round((o.fireAt - now) / 60000);
    const fire = o.status === "new" && data.day && data.today === $("day").value && fireIn <= 2;
    const fireText = o.status !== "new" ? `Pickup ${o.window}` : fireIn > 2 || data.today !== $("day").value ? `Fire at ${o.fireLabel}` : fireIn >= -1 ? "FIRE NOW" : `Late by ${-fireIn} min`;
    const btn = (label, status, cls = "line") => el("button", { type: "button", class: `btn sm ${cls}`, onclick: () => setStatus(o, status) }, label);
    const actions = { new: [btn("Start cooking", "cooking", "sign"), btn("Cancel", "cancelled")],
      cooking: [btn("Mark ready", "ready", "sign"), btn("Back", "new")],
      ready: [btn("Picked up", "done", "sign"), btn("Back", "cooking")],
      done: [btn("Undo", "ready")], cancelled: [btn("Restore", "new")] }[o.status];
    return el("article", { class: `kb-card${fire ? " fire" : ""}${o.status === "ready" ? " ready" : ""}` },
      el("div", { class: "kb-h" }, el("span", { class: "kb-code" }, o.code), el("span", { class: "kb-fire" }, fireText)),
      el("div", { class: "small" }, el("strong", {}, o.name), ` · ${o.window.split("–")[0]} · `, el("a", { href: `tel:${o.phone}` }, o.phone)),
      el("ul", {}, ...o.items.map((i) => el("li", {}, `${i.qty} × ${i.name}`, (i.choices.length || i.note) ? el("small", {}, [...i.choices.map((c) => c.split(": ")[1]), i.note ? `“${i.note}”` : ""].filter(Boolean).join(" · ")) : null))),
      o.notes ? el("p", { class: "small", style: "margin:0 0 8px;background:#fbeee0;padding:6px 8px;border-radius:6px" }, `Note: ${o.notes}`) : null,
      el("div", { class: "small muted", style: "margin-bottom:8px" }, `${money(o.total)} · pays ${o.pay}`),
      el("div", { class: "kb-actions" }, ...actions));
  }

  async function setStatus(o, status) {
    if (status === "cancelled" && !confirm(`Cancel order ${o.code} for ${o.name}? Their pickup time opens back up.`)) return;
    try { await api("/api/orders", { body: { action: "status", id: o.id, status } }); load(); }
    catch (e) { alert(e.message); }
  }

  function drawSettings() {
    const S = data.settings;
    const num = (id, label, v, hint) => el("div", { class: "field" }, el("label", { for: id }, label), el("input", { id, type: "number", value: v, min: "0" }), hint ? el("p", { class: "hint" }, hint) : null);
    const hoursRows = DAYS.map((d, i) => {
      const h = S.hours[i];
      return el("div", { class: "row", style: "align-items:center;gap:10px;margin-bottom:6px" },
        el("label", { class: "check", style: "min-width:90px" }, el("input", { type: "checkbox", id: `on${i}`, checked: Boolean(h) }), ` ${d}`),
        el("input", { type: "time", id: `op${i}`, value: h ? h.open : "07:00", "aria-label": `${d} first pickup` }), "to",
        el("input", { type: "time", id: `cl${i}`, value: h ? h.close : "14:00", "aria-label": `${d} last pickup` }));
    });
    const box = $("settings");
    box.replaceChildren(el("section", { class: "panel", style: "margin:30px 0 60px;background:#fff" },
      el("h2", {}, "Order Ahead settings"),
      el("label", { class: "check", style: "margin-bottom:14px" }, el("input", { type: "checkbox", id: "sOn", checked: S.on }), " Take online orders"),
      el("div", { class: "field" }, el("label", { for: "sMsg" }, "Message on the order page"), el("input", { id: "sMsg", type: "text", maxlength: "200", value: S.message || "", placeholder: "e.g. Pie is sold out today" })),
      el("div", { class: "row" },
        el("div", { class: "field" }, el("label", { for: "sWin" }, "Pickup window length"),
          el("select", { id: "sWin" }, ...[10, 15, 20, 30].map((m) => el("option", { value: m, selected: S.windowMin === m }, `${m} minutes`)))),
        num("sPer", "Orders per window", S.perWindow, "What the line can handle at once.")),
      el("div", { class: "row" }, num("sLead", "Shortest notice (minutes)", S.leadMin, "For same-day orders."), num("sAhead", "Days ahead", S.daysAhead, "How far out people can order.")),
      el("h3", { style: "margin-top:18px" }, "Pickup hours (first and last pickup)"), ...hoursRows,
      el("div", { class: "field", style: "margin-top:14px" }, el("label", { for: "sClosed" }, "Closed days"),
        el("textarea", { id: "sClosed", rows: "2", placeholder: "One per line, like 2026-12-25" }, (S.closed || []).join("\n")),
        el("p", { class: "hint" }, "No orders on these dates (holidays, inventory).")),
      el("button", { class: "btn sign", type: "button", onclick: saveSettings }, "Save settings"),
      el("p", { class: "form-error", id: "sErr", hidden: true })));
  }

  async function saveSettings() {
    const hours = {};
    for (let i = 0; i < 7; i++) hours[i] = $(`on${i}`).checked ? { open: $(`op${i}`).value, close: $(`cl${i}`).value } : null;
    try {
      await api("/api/orders", { body: { action: "settings", on: $("sOn").checked, message: $("sMsg").value, windowMin: Number($("sWin").value),
        perWindow: Number($("sPer").value), leadMin: Number($("sLead").value), daysAhead: Number($("sAhead").value), hours,
        closed: $("sClosed").value.split(/\s+/).filter(Boolean) } });
      $("settings").hidden = true; load();
    } catch (e) { $("sErr").textContent = e.message; $("sErr").hidden = false; }
  }

  load();
})();
