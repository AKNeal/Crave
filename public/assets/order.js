// Order ahead (Perfect Timing): day → pickup window → items → details → lock it in. Also shows a tracked order (?t=).
(() => {
  const { api, el } = window.BW;
  const M = window.CRAVE_MENU;
  const $ = (id) => document.getElementById(id);
  const money = M.money;
  const KEY = "crave-cart";
  const state = { date: null, dayLabel: "", time: null, window: "", cart: [], pay: "card", cat: M.categories[0].id };
  try { const saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (saved && Array.isArray(saved.cart)) state.cart = saved.cart.filter((l) => M.byId(l.id)); } catch (e) {}
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ cart: state.cart })); } catch (e) {} };

  // ---------- Tracking an order ----------
  const t = new URLSearchParams(location.search).get("t");
  if (t) { $("orderView").hidden = true; track(t); return; }

  async function track(token) {
    const box = $("trackView"); box.hidden = false;
    document.querySelector(".page-head h1").textContent = "Your order";
    document.querySelector(".page-head .intro").textContent = "This page updates on its own. Keep it open, or come back to the link any time.";
    const draw = async () => {
      let o;
      try { o = (await api(`/api/orders?track=${encodeURIComponent(token)}`)).order; }
      catch (e) { box.replaceChildren(el("p", { class: "notice" }, e.message)); return; }
      const steps = ["new", "cooking", "ready", "done"], at = steps.indexOf(o.status);
      box.replaceChildren(el("div", { class: "ticket", style: "transform:none;max-width:560px;margin:0 auto 60px" },
        el("h3", {}, el("span", {}, `Order ${o.code}`), el("span", {}, o.statusWord)),
        o.status === "cancelled" ? el("p", { class: "notice" }, "This order was cancelled. Questions? Call or stop by the counter.") :
          el("div", { class: "status-track" }, ...["Received", "On the grill", "Ready", "Picked up"].map((w, i) => el("span", { class: i <= at ? "on" : "" }, w))),
        ...o.items.map((i) => el("div", { class: "t-row" }, el("span", {}, `${i.qty} × ${i.name}`, i.choices.length ? el("small", { class: "muted", style: "display:block" }, i.choices.join(" · ")) : null), el("span", {}, money(i.line)))),
        el("p", { class: "t-time" }, o.window.split("–")[0]),
        el("p", { class: "t-small" }, `${o.dayLabel} · pickup window ${o.window} · pay ${o.pay} at the counter · total ${money(o.total)}`)));
      if (o.status !== "done" && o.status !== "cancelled") setTimeout(draw, 20000);
    };
    draw();
  }

  // ---------- Step 1: days ----------
  async function loadDays() {
    let d;
    try { d = await api("/api/orders"); }
    catch (e) { $("days").replaceChildren(el("p", { class: "notice" }, "Crave Curbside isn't available right now. Please call or stop in.")); return; }
    if (d.message) { $("pauseMsg").textContent = d.message; $("pauseMsg").hidden = false; }
    if (!d.on) { $("pauseMsg").textContent = d.message || "Crave Curbside is paused right now. Please stop in, we'd love to see you."; $("pauseMsg").hidden = false; $("days").replaceChildren(); return; }
    $("days").replaceChildren(...d.days.map((day) => el("button", { type: "button", class: "cchip", disabled: !day.open, "aria-pressed": "false", "data-date": day.date,
      onclick: (ev) => pickDay(day, ev.currentTarget) }, day.label.split(" ")[0], el("small", {}, day.label.includes(" ") ? day.label.split(" ").slice(1).join(" ") : (day.open ? fmtDate(day.date) : "Closed")))));
    setupScroll();
    const first = d.days.find((x) => x.open);
    if (!first) $("days").append(el("p", { class: "muted", style: "width:100%" }, "No pickup days open right now."));
  }
  function setupScroll() {
    const row = $("days"), wrap = row.parentNode, prev = wrap.querySelector(".prev"), next = wrap.querySelector(".next");
    const upd = () => { prev.hidden = row.scrollLeft < 4; next.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4; };
    prev.onclick = () => row.scrollBy({ left: -row.clientWidth * 0.8, behavior: "smooth" });
    next.onclick = () => row.scrollBy({ left: row.clientWidth * 0.8, behavior: "smooth" });
    row.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd); upd();
  }
  const fmtDate = (k) => new Date(k + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  async function pickDay(day, btn) {
    document.querySelectorAll("#days .cchip").forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
    state.date = day.date; state.dayLabel = day.label; state.time = null; state.window = "";
    $("stepDay").classList.add("done"); $("stepTime").classList.remove("locked");
    $("times").replaceChildren(el("p", { class: "muted" }, "Loading times…"));
    await loadTimes();
    render();
  }

  async function loadTimes() {
    let d;
    try { d = await api(`/api/orders?date=${state.date}`); } catch (e) { $("times").replaceChildren(el("p", { class: "notice" }, e.message)); return; }
    const ws = d.windows || [];
    if (!ws.length) { $("times").replaceChildren(el("p", { class: "muted" }, "No pickup times left that day. Try another.")); return; }
    $("times").replaceChildren(...ws.map((w) => el("button", { type: "button", class: `cchip${w.left <= 0 ? " full" : ""}`, "aria-pressed": String(state.time === w.time),
      "aria-label": w.left <= 0 ? `${w.label}, full` : null,
      onclick: (ev) => { if (w.left <= 0) return tooSlow(); state.time = w.time; state.window = w.label; document.querySelectorAll("#times .cchip").forEach((c) => c.setAttribute("aria-pressed", String(c === ev.currentTarget)));
        $("stepTime").classList.add("done"); $("stepFood").classList.remove("locked"); $("stepYou").classList.remove("locked"); render(); } },
      w.label.split("–")[0], el("small", {}, w.left <= 0 ? "Full" : w.left <= 2 ? `${w.left} left` : "Open"))));
  }

  // A pickup window is full (3 orders): an original crayon cinnamon roll zooms off.
  function tooSlow() {
    if (document.getElementById("tooSlow")) return;
    const F = '<defs><filter id="crayon2" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="w"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="w" scale="3" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9" result="g"/>' +
      '<feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.5" result="h"/><feComposite in="d" in2="h" operator="in"/></filter>' +
      '<pattern id="rollfill" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="6" height="6" fill="#d99a55" opacity=".35"/><line x1="0" y1="3" x2="6" y2="3" stroke="#d99a55" stroke-width="3.4" stroke-linecap="round"/></pattern></defs>';
    const roll = '<svg viewBox="0 0 260 150" aria-hidden="true">' + F + '<g filter="url(#crayon2)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="ts-lines" stroke="#a8582a" stroke-width="5"><path d="M10 52h46"/><path d="M0 76h52"/><path d="M14 100h40"/></g>' +
      '<g class="ts-roll"><circle cx="150" cy="72" r="46" fill="url(#rollfill)" stroke="#7a4a20" stroke-width="4"/>' +
      '<path d="M150 72m-8 0a8 8 0 1 0 8-8a16 16 0 1 0 16 16a24 24 0 1 0-24-24a32 32 0 1 0 32 32" stroke="#7a4a20" stroke-width="4"/>' +
      '<path d="M118 44q20-18 50-8" stroke="#fffdf6" stroke-width="9"/>' +
      '<circle cx="168" cy="62" r="4" fill="#2a1d16" stroke="none"/><circle cx="184" cy="62" r="4" fill="#2a1d16" stroke="none"/>' +
      '<path d="M166 82q10 8 20 0" stroke="#2a1d16" stroke-width="3.5"/>' +
      '<g class="ts-legs" stroke="#2a1d16" stroke-width="5"><path d="M134 114l-14 22h-10"/><path d="M164 114l16 20h10"/></g>' +
      '<path d="M196 70l26-16M222 54l4 12M222 54l-10-4" stroke="#2a1d16" stroke-width="4.5"/></g></g></svg>';
    const box = el("div", { class: "ts-bg", id: "tooSlow", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "tsTitle" },
      el("div", { class: "ts-card" },
        el("div", { class: "ts-art", html: roll }),
        el("p", { class: "ts-title", id: "tsTitle" }, "You gotta be quicker than that!"),
        el("p", { class: "ts-sub" }, "That pickup time already has 3 orders. Grab another one before it goes too."),
        el("button", { type: "button", class: "btn sign", onclick: () => close() }, "Pick another time")));
    const close = () => { box.remove(); document.removeEventListener("keydown", esc); $("times").scrollIntoView({ behavior: "smooth", block: "center" }); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", esc);
    document.body.append(box); box.querySelector("button").focus();
  }

  // ---------- Step 3: menu ----------
  function drawCats() {
    $("cats").replaceChildren(...M.categories.map((c) => el("button", { type: "button", class: "cchip", "aria-pressed": String(state.cat === c.id), style: "min-width:0",
      onclick: () => { state.cat = c.id; drawCats(); drawItems(); } }, c.name)));
  }
  function drawItems() {
    $("items").replaceChildren(...M.items.filter((i) => i.cat === state.cat && i.orderAhead !== false).map((i) =>
      el("button", { type: "button", class: "o-item", onclick: () => openItem(i) },
        el("strong", {}, i.name), i.desc ? el("span", {}, i.desc) : null, el("span", { class: "price" }, money(i.price)))));
  }

  function openItem(item) {
    const picks = (item.choices || []).map((g) => g.options[0]);
    let qty = 1;
    const unit = () => item.price + picks.reduce((s, o) => s + M.optionDelta(o), 0);
    const priceEl = el("strong", {});
    const qtyEl = el("span", { style: "min-width:2ch;text-align:center;font-weight:700" });
    const upd = () => { priceEl.textContent = `Add · ${money(unit() * qty)}`; qtyEl.textContent = String(qty); };
    const note = el("input", { type: "text", maxlength: "140", placeholder: "e.g. no onions, extra crispy" });
    const close = () => { bg.remove(); document.body.style.overflow = ""; };
    const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": item.name },
      el("h2", {}, item.name), item.desc ? el("p", { class: "muted", style: "margin:0" }, item.desc) : null,
      ...(item.choices || []).map((g, gi) => el("fieldset", {}, el("legend", {}, g.name),
        el("div", { class: "cchips" }, ...g.options.map((o, oi) => el("button", { type: "button", class: "cchip", "aria-pressed": String(oi === 0), style: "min-width:0",
          onclick: (ev) => { picks[gi] = o; ev.currentTarget.parentNode.querySelectorAll(".cchip").forEach((c) => c.setAttribute("aria-pressed", String(c === ev.currentTarget))); upd(); } }, o))))),
      el("div", { class: "field", style: "margin-top:16px" }, el("label", {}, "Note for the cook ", el("span", { class: "opt" }, "(optional)")), note),
      el("div", { class: "row" },
        el("div", { class: "qty", style: "display:flex;align-items:center;gap:10px" },
          el("button", { type: "button", class: "cchip", style: "min-width:44px", "aria-label": "One fewer", onclick: () => { qty = Math.max(1, qty - 1); upd(); } }, "−"), qtyEl,
          el("button", { type: "button", class: "cchip", style: "min-width:44px", "aria-label": "One more", onclick: () => { qty = Math.min(20, qty + 1); upd(); } }, "+")),
        el("button", { type: "button", class: "btn sign", onclick: () => {
          state.cart.push({ id: item.id, qty, choices: picks.slice(), note: note.value.trim() }); save(); close(); render();
          if (window.innerWidth < 680) { const mc = $("mobileCart"); mc.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 300 }); }
        } }, priceEl)),
      el("p", { style: "text-align:center;margin:14px 0 0" }, el("button", { type: "button", class: "linkish", style: "background:none;border:0;color:var(--graphite);cursor:pointer;text-decoration:underline", onclick: close }, "Cancel")));
    const bg = el("div", { class: "sheet-bg", onclick: (e) => { if (e.target === bg) close(); } }, sheet);
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
    upd(); document.body.append(bg); document.body.style.overflow = "hidden";
    sheet.querySelector("button").focus();
  }

  // ---------- Cart ----------
  const lineUnit = (l) => { const i = M.byId(l.id); return i.price + (l.choices || []).reduce((s, o) => s + M.optionDelta(o), 0); };
  function render() {
    const total = state.cart.reduce((s, l) => s + lineUnit(l) * l.qty, 0);
    const count = state.cart.reduce((s, l) => s + l.qty, 0);
    $("when").textContent = state.time ? `${state.dayLabel} · ${state.window}` : state.date ? `${state.dayLabel} · pick a time` : "";
    $("lines").replaceChildren(...state.cart.map((l, idx) => {
      const i = M.byId(l.id);
      return el("li", {}, el("span", {}, el("strong", {}, i.name)), el("span", {}, money(lineUnit(l) * l.qty)),
        (l.choices.length || l.note) ? el("span", { class: "opts" }, [...l.choices, l.note ? `“${l.note}”` : ""].filter(Boolean).join(" · ")) : null,
        el("span", { class: "qty" },
          el("button", { type: "button", "aria-label": `One fewer ${i.name}`, onclick: () => { l.qty -= 1; if (l.qty < 1) state.cart.splice(idx, 1); save(); render(); } }, "−"),
          String(l.qty),
          el("button", { type: "button", "aria-label": `One more ${i.name}`, onclick: () => { l.qty = Math.min(20, l.qty + 1); save(); render(); } }, "+")));
    }));
    $("emptyCart").hidden = state.cart.length > 0;
    $("total").textContent = money(total);
    $("place").disabled = !(state.cart.length && state.time);
    $("place").textContent = !state.time ? "Pick a pickup time" : !state.cart.length ? "Add something" : `Lock in my order · ${money(total)}`;
    $("mcCount").textContent = `${count} item${count === 1 ? "" : "s"} · view ticket`;
    $("mcTotal").textContent = money(total);
    $("mobileCart").hidden = !count;
  }
  $("mobileCart").addEventListener("click", () => $("cart").scrollIntoView({ behavior: "smooth" }));

  state.pickup = "inside";
  document.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    state.pickup = b.dataset.pick; document.querySelectorAll("[data-pick]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("carF").hidden = state.pickup !== "curbside";
  }));
  document.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", () => {
    state.pay = b.dataset.pay; document.querySelectorAll("[data-pay]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));

  $("place").addEventListener("click", async () => {
    const err = $("placeErr"); err.hidden = true;
    document.querySelectorAll("#who .field").forEach((f) => { f.classList.remove("invalid"); const e = f.querySelector(".err"); if (e) e.textContent = ""; });
    const btn = $("place"); btn.disabled = true; const label = btn.textContent; btn.textContent = "Locking it in…";
    try {
      const r = await api("/api/orders", { body: { action: "place", date: state.date, time: state.time, items: state.cart, pay: state.pay,
        name: $("name").value, phone: $("phone").value, email: $("email").value, notes: $("notes").value, pickup: state.pickup, car: $("car").value, website: document.querySelector('#who [name="website"]').value } });
      state.cart = []; save();
      const o = r.order;
      $("orderView").replaceChildren(el("div", { class: "cconfirm", style: "grid-column:1/-1" },
        el("p", { class: "eyebrow", style: "justify-content:center" }, "Order locked in"),
        el("p", { class: "code" }, o.code),
        el("h2", {}, `${o.dayLabel}, ${o.window}`),
        el("p", { class: "muted", style: "max-width:46ch;margin:10px auto 22px" }, o.pickup === "curbside" ? `Pull up out front and call (907) 415-8499; we'll bring it out. Total ${money(o.total)}, pay by ${o.pay}.` : `Give the counter your name (${o.name}) or the code above. Total ${money(o.total)}, pay by ${o.pay} at pickup.`),
        el("a", { class: "btn sign", href: `/order?t=${r.track}` }, "Track my order"),
        el("p", { class: "small muted", style: "margin-top:16px" }, "Bookmark that page; it shows when your order hits the grill and when it's ready.")));
      $("mobileCart").hidden = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const errs = e.data && e.data.errors;
      if (errs) for (const [k, v] of Object.entries(errs)) { const f = document.querySelector(`#who [data-f="${k}"]`); if (f) { f.classList.add("invalid"); f.querySelector(".err").textContent = v; } }
      err.textContent = e.message; err.hidden = false;
      if (e.data && e.data.full) tooSlow();
      if (e.data && e.data.pickAgain) { state.time = null; await loadTimes(); }
      btn.disabled = false; btn.textContent = label; render();
      if (errs) $("stepYou").scrollIntoView({ behavior: "smooth" });
    }
  });

  drawCats(); drawItems(); render(); loadDays();
})();
