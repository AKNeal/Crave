// Onboarding pages (/rhonda for the owner, /onboard for the crew): collect the form and send it to /api/waitlist?site=onboard.
// Fields: name="x" → x, name="links.k" → links.k, radio groups → the checked value, [data-features] → features / featuresOff,
// the crew rows (owner page) → crew: [{name, job, email}]. Answers are kept in this browser until sent, so a reload loses nothing.
(function () {
  var form = document.getElementById("ob"); if (!form) return;
  var KEY = "crave-ob-" + form.getAttribute("data-form");
  var crewBox = document.getElementById("crew");

  function crewRow(v) {
    v = v || {};
    var row = document.createElement("div"); row.className = "crew-row";
    row.innerHTML = '<input type="text" data-c="name" placeholder="Name" maxlength="80" aria-label="Name">' +
      '<input type="text" data-c="job" placeholder="Job (baker, barista…)" maxlength="80" aria-label="Job">' +
      '<input type="email" data-c="email" placeholder="Email (for their login)" maxlength="120" aria-label="Email">' +
      '<button type="button" class="crew-x" aria-label="Remove">×</button>';
    row.querySelector('[data-c="name"]').value = v.name || ""; row.querySelector('[data-c="job"]').value = v.job || ""; row.querySelector('[data-c="email"]').value = v.email || "";
    row.querySelector(".crew-x").addEventListener("click", function () { row.remove(); if (!crewBox.children.length) crewRow(); save(); });
    crewBox.appendChild(row); return row;
  }
  if (crewBox) {
    document.getElementById("addCrew").addEventListener("click", function () { crewRow().querySelector("input").focus(); });
  }

  function collect() {
    var out = { form: form.getAttribute("data-form"), links: {}, features: [], featuresOff: [] };
    form.querySelectorAll("input[name], textarea[name]").forEach(function (el) {
      if (el.type === "radio") { if (el.checked) out[el.name] = el.value; return; }
      if (el.name.indexOf("links.") === 0) out.links[el.name.slice(6)] = el.value.trim();
      else out[el.name] = el.value.trim();
    });
    form.querySelectorAll("[data-features] input").forEach(function (el) { (el.checked ? out.features : out.featuresOff).push(el.value); });
    if (crewBox) out.crew = Array.prototype.map.call(crewBox.querySelectorAll(".crew-row"), function (r) {
      return { name: r.querySelector('[data-c="name"]').value.trim(), job: r.querySelector('[data-c="job"]').value.trim(), email: r.querySelector('[data-c="email"]').value.trim() };
    }).filter(function (c) { return c.name; });
    return out;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(collect())); } catch (e) {} }
  function restore() {
    var d; try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (crewBox) { ((d && d.crew && d.crew.length) ? d.crew : [{}, {}]).forEach(crewRow); }
    if (!d) return;
    form.querySelectorAll("input[name], textarea[name]").forEach(function (el) {
      if (el.name === "website") return;
      if (el.type === "radio") { el.checked = d[el.name] === el.value; return; }
      var v = el.name.indexOf("links.") === 0 ? (d.links || {})[el.name.slice(6)] : d[el.name];
      if (typeof v === "string") el.value = v;
    });
    form.querySelectorAll("[data-features] input").forEach(function (el) {
      if ((d.features || []).indexOf(el.value) > -1) el.checked = true;
      if ((d.featuresOff || []).indexOf(el.value) > -1) el.checked = false;
    });
  }
  restore();
  form.addEventListener("input", save); form.addEventListener("change", save);

  var err = form.querySelector(".ob-err"), btn = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", function (e) {
    e.preventDefault(); err.textContent = "";
    var data = collect();
    if (!data.name || data.name.length < 2) { err.textContent = "Add your name first."; document.getElementById("name").focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    fetch("/api/waitlist?site=onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (o) {
        if (!o.ok) throw new Error(o.j.error || "Couldn't send. Try again in a minute.");
        try { localStorage.removeItem(KEY); } catch (e) {}
        form.hidden = true; document.querySelector(".ob-done").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(function (x) { err.textContent = x.message || "No connection. Your answers are saved here; try again."; })
      .then(function () { btn.disabled = false; btn.textContent = "Send it again"; });
  });
})();
