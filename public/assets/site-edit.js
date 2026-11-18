// "Edit the website" (same idea as jmhealing.com).
// Everyone: loads the text changes saved for this page and shows them.
// Owner, Site admin or Neal Media: open any page with ?edit=1 (the Edit the website button on the staff page) to tap a sentence and
// change it. Each change saves when you click away and is live for everyone right away. Menu items and prices aren't editable
// here because Crave Curbside uses them for orders: those go through Request a change.
(function () {
  var page = location.pathname.replace(/^\/+/, "").replace(/\.html$/, "").replace(/\/$/, "") || "index";
  if (["index", "menu", "catering", "give", "visit", "thanksgiving"].indexOf(page) === -1) return;
  var SEL = "main h1, main h2, main h3, main p, main li, main .eyebrow";
  var OK_CHILD = /^(EM|STRONG|B|I|BR|SPAN)$/;
  function plain(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function eligible(el) {
    if (el.closest("form, .btn, nav, .menu-list, .menu-jump, .chours, [data-shop], .crew-float, .g-rating, script")) return false;
    if (el.querySelector(SEL)) return false;
    var kids = el.querySelectorAll("*");
    for (var i = 0; i < kids.length; i++) if (!OK_CHILD.test(kids[i].tagName) || kids[i].hasAttribute("data-shop")) return false;
    return plain(el.textContent).length > 0;
  }
  var blocks = [];
  function index() {
    blocks = Array.prototype.filter.call(document.querySelectorAll(SEL), eligible);
    blocks.forEach(function (el, n) { el.setAttribute("data-eid", "b" + n); el.__orig = { html: el.innerHTML, text: plain(el.textContent) }; });
  }
  function apply(edits) {
    Object.keys(edits || {}).forEach(function (id) {
      var e = edits[id], el = document.querySelector('[data-eid="' + id + '"]');
      if (!el || el.__orig.text !== plain(e.orig)) { el = null; for (var i = 0; i < blocks.length; i++) if (blocks[i].__orig.text === plain(e.orig)) { el = blocks[i]; break; } }
      if (el) { el.innerHTML = e.html; el.__edit = el.getAttribute("data-eid"); }
    });
  }
  function go() {
    index();
    fetch("/api/waitlist?site=edits&page=" + encodeURIComponent(page)).then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { if (j && j.edits) apply(j.edits); }).catch(function () {}).then(maybeEdit);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();

  function maybeEdit() {
    var q = new URLSearchParams(location.search);
    try {
      if (q.get("edit") === "1") sessionStorage.setItem("crave-edit", "1");
      if (q.get("edit") === "0") sessionStorage.removeItem("crave-edit");
      if (sessionStorage.getItem("crave-edit") !== "1") return;
    } catch (e) { if (q.get("edit") !== "1") return; }
    fetch("/api/admin/login", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.user) startEditing(); else { try { sessionStorage.removeItem("crave-edit"); } catch (e) {} location.href = "/admin"; } }).catch(function () {});
  }

  function startEditing() {
    var css = document.createElement("style");
    css.textContent = ".cr-ed{outline:1.5px dashed transparent;outline-offset:5px;border-radius:4px;cursor:text;transition:outline-color .15s}" +
      ".cr-ed:hover{outline-color:rgba(168,88,42,.7)}.cr-ed[contenteditable=true]{outline:2px solid #a8582a;background:rgba(255,253,246,.9)}" +
      ".cr-ed.cr-changed{box-shadow:-9px 0 0 -6px #e0a419}.reveal,.rv{opacity:1!important;transform:none!important}" +
      ".cr-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;" +
      "max-width:calc(100vw - 20px);background:#2a1d16;color:#fffaf1;border-radius:16px;padding:12px 16px;font:15px/1.4 Figtree,system-ui,sans-serif;box-shadow:0 18px 40px -12px rgba(0,0,0,.5)}" +
      ".cr-bar b{font-weight:700}.cr-bar button{font:inherit;border:1px solid rgba(255,250,241,.35);background:none;color:inherit;border-radius:999px;padding:6px 14px;cursor:pointer}" +
      ".cr-bar .cr-done{background:#e0a419;color:#2a1d16;border-color:#e0a419;font-weight:700}.cr-bar .cr-say{color:#f3c96b;min-width:4ch}" +
      ".crew-float,.g-rating,.mobile-cart{display:none!important}";
    document.head.appendChild(css);
    var bar = document.createElement("div"); bar.className = "cr-bar";
    bar.innerHTML = "<span><b>Editing</b> · tap any text to change it. It saves when you tap away.</span><span class=\"cr-say\" aria-live=\"polite\"></span>" +
      "<button type=\"button\" class=\"cr-undo\" hidden>Put back the original</button><button type=\"button\" class=\"cr-done\">Done</button>";
    document.body.appendChild(bar);
    var say = bar.querySelector(".cr-say"), undo = bar.querySelector(".cr-undo"), current = null, lastEl = null, t;
    function tell(m) { say.textContent = m; clearTimeout(t); t = setTimeout(function () { say.textContent = ""; }, 2600); }
    function showUndo(el) { lastEl = el; undo.hidden = !(el && (el.__edit || el.innerHTML !== el.__orig.html)); }
    blocks.forEach(function (el) { el.classList.add("cr-ed"); if (el.__edit) el.classList.add("cr-changed"); });
    function post(body) {
      return fetch("/api/admin/photo?site=edit", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); });
    }
    function save(el) {
      if (el.innerHTML === el.__before) return;
      tell("Saving…");
      post({ page: page, id: el.getAttribute("data-eid"), orig: el.__orig.text, html: el.innerHTML }).then(function (o) {
        if (o.s === 401) { location.href = "/admin"; return; }
        if (!o.j.ok) { el.innerHTML = el.__before; return tell(o.j.error || "That didn't save."); }
        if (o.j.edit) { el.innerHTML = o.j.edit.html; el.__edit = el.getAttribute("data-eid"); el.classList.add("cr-changed"); } else { el.__edit = null; el.classList.remove("cr-changed"); }
        tell("Saved"); showUndo(el);
      }).catch(function () { el.innerHTML = el.__before; tell("No connection. Not saved."); });
    }
    function finish(el, keep) { if (!el) return; if (!keep) el.innerHTML = el.__before; el.removeAttribute("contenteditable"); if (keep) save(el); current = null; }
    document.addEventListener("click", function (ev) {
      if (ev.target.closest(".cr-bar")) return;
      var el = ev.target.closest(".cr-ed");
      if (!el) { if (current) finish(current, true); var a = ev.target.closest("main a"); if (a) ev.preventDefault(); return; }
      ev.preventDefault(); if (current === el) return; if (current) finish(current, true);
      current = el; el.__before = el.innerHTML; el.setAttribute("contenteditable", "true"); el.focus(); showUndo(el);
    }, true);
    document.addEventListener("keydown", function (ev) {
      if (!current) return;
      if (ev.key === "Escape") { ev.preventDefault(); var e1 = current; finish(e1, false); e1.blur(); }
      if (ev.key === "Enter" && current.tagName !== "P") { ev.preventDefault(); var e2 = current; finish(e2, true); e2.blur(); }
    });
    document.addEventListener("focusout", function (ev) { if (current && ev.target === current && !bar.contains(ev.relatedTarget)) finish(current, true); });
    document.addEventListener("paste", function (ev) { if (!current) return; ev.preventDefault(); document.execCommand("insertText", false, (ev.clipboardData || window.clipboardData).getData("text/plain")); });
    undo.addEventListener("click", function () {
      var el = lastEl; if (!el) return; if (current) finish(current, false);
      post({ page: page, id: el.__edit || el.getAttribute("data-eid"), action: "revert" }).then(function () { el.innerHTML = el.__orig.html; el.__edit = null; el.classList.remove("cr-changed"); tell("Original back"); showUndo(null); });
    });
    bar.querySelector(".cr-done").addEventListener("click", function () { if (current) finish(current, true); try { sessionStorage.removeItem("crave-edit"); } catch (e) {} setTimeout(function () { location.href = location.pathname; }, 400); });
  }
})();
