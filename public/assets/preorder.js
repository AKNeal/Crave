// Seasonal preorders (public/assets/specials.js). Live pickup windows and open/closed come from /api/orders?special=1.
(() => {
  const { api, el } = window.BW;
  const S = window.CRAVE_SPECIAL, M = window.CRAVE_MENU, money = M.money;
  const $ = (id) => document.getElementById(id);
  const state = { qty: {}, choice: {}, date: null, time: null, window: "", dayLabel: "" };
  const fmt = (k) => new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  $("preKicker").textContent = S.kicker; $("preTitle").textContent = S.title; $("preBlurb").textContent = S.blurb;
  $("preBy").textContent = `Order by ${fmt(S.orderBy)}`; $("prePick").textContent = `Pickup ${S.pickups.map((p) => p.label.split(",")[0]).join(" or ")}`;
  $("preExtra").textContent = [S.soldOutNote, S.extra].filter(Boolean).join(" ");
  $("prePickNote").textContent = S.pickupNote || "";

  $("preItems").replaceChildren(...S.items.map((it) => {
    state.choice[it.id] = (it.choices || []).map((g) => g.options[0]);
    const qtyEl = el("span", { class: "pre-q" }, "0");
    const set = (n) => { state.qty[it.id] = Math.max(0, Math.min(10, n)); qtyEl.textContent = String(state.qty[it.id]); li.classList.toggle("on", state.qty[it.id] > 0); render(); };
    const li = el("li", { class: "pre-item" },
      el("div", { class: "pre-info" },
        el("div", { class: "mi-top" }, el("h3", {}, it.name), el("span", { class: "leader", "aria-hidden": "true" }), el("span", { class: "price" }, money(it.price))),
        it.desc ? el("p", {}, it.desc) : null,
        ...(it.choices || []).map((g, gi) => el("div", { class: "cchips pre-choice", role: "group", "aria-label": `${it.name}: ${g.name}` }, ...g.options.map((o, oi) =>
          el("button", { type: "button", class: "cchip", "aria-pressed": String(oi === 0), onclick: (e) => { state.choice[it.id][gi] = o; e.currentTarget.parentNode.querySelectorAll(".cchip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); render(); } }, o))))),
      el("div", { class: "pre-step" },
        el("button", { type: "button", "aria-label": `One fewer ${it.name}`, onclick: () => set((state.qty[it.id] || 0) - 1) }, "−"), qtyEl,
        el("button", { type: "button", "aria-label": `One more ${it.name}`, onclick: () => set((state.qty[it.id] || 0) + 1) }, "+")));
    return li;
  }));

  async function loadPickups() {
    let d;
    try { d = await api("/api/orders?special=1"); } catch (e) { $("prePickups").replaceChildren(el("p", { class: "notice" }, "Preorders aren't available online right now. Please call or stop in.")); return; }
    if (!d.open) {
      const before = d.today < S.orderFrom;
      $("preClosed").textContent = before ? `Preorders open ${fmt(S.orderFrom)}.` : `${S.title} are closed. Thank you, North Pole! Watch for the next round of specials.`;
      $("preClosed").hidden = false; $("preView").hidden = true; return;
    }
    $("prePickups").replaceChildren(...d.special.pickups.map((p) => el("div", { class: "pre-pick" },
      el("h3", {}, p.label, el("small", {}, ` · ${p.note}`)),
      el("div", { class: "cchips" }, ...p.windows.map((w) => el("button", { type: "button", class: "cchip", disabled: w.left <= 0, "aria-pressed": String(state.date === p.date && state.time === w.time),
        onclick: (e) => { state.date = p.date; state.time = w.time; state.window = w.label; state.dayLabel = p.label;
          document.querySelectorAll("#prePickups .cchip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); render(); } },
        w.label.split("–")[0], el("small", {}, w.left <= 0 ? "Full" : w.left <= 2 ? `${w.left} left` : "Open")))))));
  }

  function lines() { return S.items.filter((it) => state.qty[it.id] > 0).map((it) => ({ it, qty: state.qty[it.id], choices: state.choice[it.id] })); }
  function render() {
    const L = lines(), total = L.reduce((s, l) => s + l.it.price * l.qty, 0);
    $("when").textContent = state.time ? `${state.dayLabel} · ${state.window}` : "Pick a pickup time";
    $("lines").replaceChildren(...L.map((l) => el("li", {}, el("span", {}, el("strong", {}, `${l.qty} × ${l.it.name}`)), el("span", {}, money(l.it.price * l.qty)),
      l.choices.length ? el("span", { class: "opts" }, l.choices.join(" · ")) : null)));
    $("emptyCart").hidden = L.length > 0;
    $("total").textContent = money(total);
    $("place").disabled = !(L.length && state.time);
    $("place").textContent = !L.length ? "Add a treat" : !state.time ? "Pick a pickup time" : `Send my preorder · ${money(total)}`;
  }

  $("place").addEventListener("click", async () => {
    const err = $("placeErr"); err.hidden = true;
    document.querySelectorAll("#who .field").forEach((f) => { f.classList.remove("invalid"); const e = f.querySelector(".err"); if (e) e.textContent = ""; });
    const btn = $("place"), label = btn.textContent; btn.disabled = true; btn.textContent = "Sending…";
    try {
      const r = await api("/api/orders", { body: { action: "preorder", date: state.date, time: state.time, name: $("name").value, phone: $("phone").value, email: $("email").value,
        notes: $("notes").value, website: document.querySelector('#who [name="website"]').value, items: lines().map((l) => ({ id: l.it.id, qty: l.qty, choices: l.choices })) } });
      const o = r.order;
      $("preView").replaceChildren(el("div", { class: "cconfirm", style: "grid-column:1/-1" },
        el("p", { class: "eyebrow", style: "justify-content:center" }, "Preorder received"), el("p", { class: "code" }, o.code),
        el("h2", {}, `${o.dayLabel}, ${o.window}`),
        el("p", { class: "muted", style: "max-width:48ch;margin:10px auto 22px" }, `Thank you, ${o.name.split(" ")[0]}! We'll reach out to confirm. Total ${money(o.total)}, paid at pickup.`),
        el("a", { class: "btn sign", href: `/order?t=${r.track}` }, "See my preorder")));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const errs = e.data && e.data.errors;
      if (errs) for (const [k, v] of Object.entries(errs)) { const f = document.querySelector(`#who [data-f="${k}"]`); if (f) { f.classList.add("invalid"); f.querySelector(".err").textContent = v; } }
      err.textContent = e.message; err.hidden = false;
      if (e.data && e.data.pickAgain) { state.time = null; loadPickups(); }
      btn.disabled = false; btn.textContent = label; render();
    }
  });

  render(); loadPickups();
})();
