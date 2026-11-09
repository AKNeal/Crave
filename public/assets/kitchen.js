// Crave Curbside board (Perfect Timing). Used in two places: the staff page (/admin, "Today") and the full-screen
// kitchen screen (/kitchen). Orders sit in columns by status, sorted by the time to start each one so it finishes
// right at its pickup window. CraveBoard.mount(element) builds everything inside that element.
(() => {
  const { api, el } = window.BW;
  const money = (n) => "$" + Number(n).toFixed(2);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Anchorage" }).format(new Date());

  function mount(root, opts = {}) {
    let data = null, timer = null, day = todayKey(), mode = "today";
    const k = (name) => root.querySelector(`[data-k="${name}"]`);
    root.classList.add("cboard");
    root.replaceChildren(
      el("div", { class: "cb-top" },
        el("div", { class: "cb-days" },
          el("strong", { class: "cb-today", "data-k": "todayLabel" }, "Today"),
          el("button", { class: "linkbtn cb-week", type: "button", "data-k": "weekBtn", onclick: () => { mode = mode === "week" ? "today" : "week"; load(); } }, "This week")),
        el("div", { class: "cb-tools" },
          el("button", { class: "linkbtn", type: "button", onclick: toggleSettings }, "Settings"),
          opts.kitchenLink ? el("a", { class: "linkbtn", href: "/kitchen", target: "_blank", rel: "noopener" }, "Kitchen screen ↗") : null)),
      el("div", { "data-k": "msg" }),
      el("div", { class: "cb-load", "data-k": "load", "aria-label": "Orders per pickup window" }),
      el("div", { class: "cb-cols", "data-k": "cols" }),
      el("div", { class: "cb-weekview", "data-k": "week", hidden: true }),
      el("div", { "data-k": "settings", hidden: true }));

    const visible = () => root.offsetParent !== null;
    async function drawDays() {
      let u; try { u = await api("/api/orders?upcoming=1"); } catch (e) { return null; }
      const later = u.days.slice(1).reduce((n, d) => n + d.count, 0);
      k("weekBtn").textContent = mode === "week" ? "← Back to today" : later ? `This week (${later} more)` : "This week";
      k("todayLabel").textContent = mode === "week" ? "This week" : `Today · ${u.days[0].count} order${u.days[0].count === 1 ? "" : "s"}`;
      if (opts.onSummary) opts.onSummary(u);
      return u;
    }

    async function drawWeek() {
      const u = await drawDays();
      k("cols").hidden = true; k("load").hidden = true; const t = root.querySelector(".cb-tail"); if (t) t.remove();
      const box = k("week"); box.hidden = false;
      if (!u) return;
      const busy = u.days.filter((d) => d.count);
      const boards = await Promise.all(busy.map((d) => api(`/api/orders?board=${d.date}`).then((b) => ({ d, b })).catch(() => ({ d, b: { orders: [] } }))));
      box.replaceChildren(...u.days.map((d) => {
        const b = boards.find((x) => x.d.date === d.date);
        const list = b ? b.b.orders.filter((o) => o.status !== "cancelled").sort((x, y) => x.pickupAt - y.pickupAt) : [];
        return el("section", { class: `cb-wday${d.open ? "" : " shut"}` },
          el("h3", {}, el("span", {}, d.label), el("b", {}, d.open ? `${list.length} order${list.length === 1 ? "" : "s"}` : "Closed")),
          list.length ? el("ul", {}, ...list.map((o) => el("li", {},
            el("span", { class: "cb-wtime" }, o.window.split("–")[0]),
            el("span", { class: "cb-wwho" }, el("strong", {}, `${o.code} · ${o.name}`), el("small", {}, o.items.map((i) => `${i.qty}× ${i.name.replace("*", "")}`).join(", "))),
            el("span", { class: "cb-wmeta" }, o.pickup === "curbside" ? "Curbside" : "", ` ${money(o.total)}`)))) : null);
      }));
      timer = setTimeout(tick, 60000);
    }

    async function load() {
      clearTimeout(timer);
      day = todayKey();
      if (mode === "week") return drawWeek();
      k("week").hidden = true; k("cols").hidden = false;
      drawDays();
      const want = day; let d;
      try { d = await api(`/api/orders?board=${want}`); if (want !== day) return; data = d; }
      catch (e) {
        if (e.status === 401) { k("msg").replaceChildren(el("p", { class: "notice" }, "Log in first. ", el("a", { href: "/admin" }, "Open the staff page to log in"), ", then come back here.")); return; }
        k("msg").replaceChildren(el("p", { class: "notice" }, e.message)); timer = setTimeout(tick, 30000); return;
      }
      k("msg").replaceChildren(!data.settings.on ? el("p", { class: "notice" }, "Crave Curbside is paused: customers can't place orders. Turn it back on in Settings.") : "");
      draw();
      timer = setTimeout(tick, 20000);
    }
    const tick = () => { if (visible()) load(); else timer = setTimeout(tick, 20000); };

    function draw() {
      const now = Date.now(), per = data.settings.perWindow;
      k("load").hidden = Boolean(opts.compact);
      k("load").replaceChildren(...(data.windows || []).map((w) => {
        const used = per - w.left;
        return el("span", { class: `cb-w${w.left <= 0 ? " full" : used ? " some" : ""}`, title: `${w.label}: ${used} of ${per}` },
          /:00 /.test(w.label.split("–")[0]) ? w.label.split("–")[0].replace(":00", "").replace(" AM", "a").replace(" PM", "p") : "", el("i", { style: `height:${Math.round((used / per) * 100)}%` }));
      }));
      if (!(data.windows || []).length) k("load").replaceChildren(el("span", { class: "muted small" }, "Closed this day."));
      if (data.special) k("load").prepend(el("span", { class: "cb-special" }, data.special));
      const cols = [["new", "Up next"], ["cooking", "Cooking"], ["ready", "Ready for pickup"]];
      const by = (s) => data.orders.filter((o) => o.status === s).sort((a, b) => a.fireAt - b.fireAt);
      const cancelled = by("cancelled");
      k("cols").replaceChildren(...cols.map(([s, name]) => {
        const list = by(s);
        return el("section", { class: `cb-col s-${s}` }, el("h3", {}, el("span", {}, name), el("b", {}, String(list.length))),
          ...(list.length ? list.map((o) => card(o, now)) : [el("p", { class: "cb-empty" }, s === "new" ? "No orders waiting. Nice." : "—")]),
          null);
      }));
      const done = by("done");
      const tail = el("div", { class: "cb-tail" },
        done.length ? el("details", {}, el("summary", {}, `Picked up (${done.length})`), el("div", { class: "cb-tail-list" }, ...done.map((o) => card(o, now)))) : null,
        cancelled.length ? el("details", {}, el("summary", {}, `Cancelled (${cancelled.length})`), el("div", { class: "cb-tail-list" }, ...cancelled.map((o) => card(o, now)))) : null);
      const old = root.querySelector(".cb-tail"); if (old) old.remove();
      k("cols").after(tail);
    }

    function card(o, now) {
      const today = data.today === day, fireIn = Math.round((o.fireAt - now) / 60000);
      const hot = o.status === "new" && today && fireIn <= 2;
      const fireText = o.status !== "new" ? `Pickup ${o.window.split("–")[0]}` : !today || fireIn > 2 ? `Start ${o.fireLabel.replace(" AM", "a").replace(" PM", "p")}` : fireIn >= -1 ? "Start now" : `${-fireIn} min late`;
      const main = (label, status) => el("button", { type: "button", class: "btn sign cb-go", onclick: () => setStatus(o, status) }, label);
      const small = (label, status) => el("button", { type: "button", class: "linkbtn cb-small", onclick: () => setStatus(o, status) }, label);
      const actions = { new: [main(o.preorder ? "Start packing" : "Start cooking", "cooking"), small("Cancel order", "cancelled")],
        cooking: [main("Ready for pickup", "ready"), small("Undo", "new")],
        ready: [main("Picked up", "done"), small("Undo", "cooking")], done: [small("Undo", "ready")], cancelled: [small("Restore", "new")] }[o.status];
      return el("article", { class: `cb-card${hot ? " hot" : ""}` },
        el("div", { class: "cb-h" }, el("span", { class: "cb-code" }, o.code), el("span", { class: "cb-fire" }, o.preorder && o.status === "new" ? `Pickup ${o.window.split("–")[0]}` : fireText)),
        o.preorder ? el("span", { class: "cb-pre" }, "Preorder · call to confirm") : null,
        el("div", { class: "cb-who" }, el("strong", {}, o.name), " · ", el("a", { href: `tel:${o.phone}` }, o.phone)),
        o.pickup === "curbside" ? el("span", { class: "cb-curb" }, `Curbside${o.car ? `: ${o.car}` : ""}`) : null,
        el("ul", {}, ...o.items.map((i) => el("li", {}, el("b", {}, `${i.qty}×`), ` ${i.name.replace("*", "")}`, (i.choices.length || i.note) ? el("small", {}, [...i.choices.map((c) => c.split(": ")[1]).filter((c) => !/^No /.test(c)), i.note ? `“${i.note}”` : ""].filter(Boolean).join(" · ")) : null))),
        o.notes ? el("p", { class: "cb-note" }, o.notes) : null,
        el("div", { class: "cb-foot" }, el("span", {}, `${money(o.total)} · pays ${o.pay}`)),
        el("div", { class: "cb-actions" }, ...actions));
    }

    async function setStatus(o, status) {
      if (status === "cancelled" && !confirm(`Cancel order ${o.code} for ${o.name}? Their pickup time opens back up.`)) return;
      try { await api("/api/orders", { body: { action: "status", id: o.id, status } }); load(); }
      catch (e) { alert(e.message); }
    }

    function toggleSettings() { const s = k("settings"); s.hidden = !s.hidden; if (!s.hidden && data) { drawSettings(); s.scrollIntoView({ behavior: "smooth" }); } }
    function drawSettings() {
      const S = data.settings;
      const f = (name) => root.querySelector(`[name="${name}"]`);
      const num = (name, label, v, hint) => el("div", { class: "field" }, el("label", {}, label), el("input", { name, type: "number", value: v, min: "0" }), hint ? el("p", { class: "hint" }, hint) : null);
      const hoursRows = DAYS.map((d, i) => {
        const h = S.hours[i];
        return el("div", { class: "cb-hours" }, el("label", { class: "check" }, el("input", { type: "checkbox", name: `on${i}`, checked: Boolean(h) }), ` ${d}`),
          el("input", { type: "time", name: `op${i}`, value: h ? h.open : "07:30", "aria-label": `${d} first pickup` }), el("span", {}, "to"),
          el("input", { type: "time", name: `cl${i}`, value: h ? h.close : "15:15", "aria-label": `${d} last pickup` }));
      });
      k("settings").replaceChildren(el("section", { class: "panel cb-settings" },
        el("h2", {}, "Crave Curbside settings"),
        el("label", { class: "check", style: "margin-bottom:14px" }, el("input", { type: "checkbox", name: "sOn", checked: S.on }), " Take online orders"),
        el("div", { class: "field" }, el("label", {}, "Message on the order page"), el("input", { name: "sMsg", type: "text", maxlength: "200", value: S.message || "", placeholder: "e.g. Cinnamon rolls are sold out today" })),
        el("div", { class: "row" },
          el("div", { class: "field" }, el("label", {}, "Pickup window length"), el("select", { name: "sWin" }, ...[10, 15, 20, 30].map((m) => el("option", { value: m, selected: S.windowMin === m }, `${m} minutes`)))),
          num("sPer", "Orders per window", S.perWindow, "What the kitchen can handle at once.")),
        el("div", { class: "row" }, num("sLead", "Shortest notice (minutes)", S.leadMin, "For same-day orders."), num("sAhead", "Days ahead", S.daysAhead, "How far out people can order.")),
        el("h3", { style: "margin-top:18px" }, "Pickup hours (first and last pickup)"), ...hoursRows,
        el("div", { class: "field", style: "margin-top:14px" }, el("label", {}, "Closed days"),
          el("textarea", { name: "sClosed", rows: "2", placeholder: "One per line, like 2026-12-25" }, (S.closed || []).join("\n")), el("p", { class: "hint" }, "No orders on these dates (holidays, inventory).")),
        el("div", { style: "display:flex;gap:8px" }, el("button", { class: "btn sign", type: "button", onclick: save }, "Save settings"), el("button", { class: "btn line", type: "button", onclick: toggleSettings }, "Close")),
        el("p", { class: "form-error", "data-k": "sErr", hidden: true })));
      async function save() {
        const hours = {};
        for (let i = 0; i < 7; i++) hours[i] = f(`on${i}`).checked ? { open: f(`op${i}`).value, close: f(`cl${i}`).value } : null;
        try {
          await api("/api/orders", { body: { action: "settings", on: f("sOn").checked, message: f("sMsg").value, windowMin: Number(f("sWin").value),
            perWindow: Number(f("sPer").value), leadMin: Number(f("sLead").value), daysAhead: Number(f("sAhead").value), hours, closed: f("sClosed").value.split(/\s+/).filter(Boolean) } });
          k("settings").hidden = true; load();
        } catch (e) { const x = k("sErr"); x.textContent = e.message; x.hidden = false; }
      }
    }

    load();
    return { reload: load };
  }

  window.CraveBoard = { mount };
})();
