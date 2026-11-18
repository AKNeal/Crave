// Home page "Fresh from Instagram": deals a hand of polaroids from Crave's last 20 Instagram posts (10 on a computer,
// 6 on a phone). The Shuffle button deals a new hand. Posts come from the site's own Instagram connection (Meta app "Beam",
// connected in the staff page under Account), so nothing loads from Instagram directly. Hidden until there are posts.
(function () {
  var box = document.querySelector("[data-ig-shuffle]"); if (!box || !window.fetch) return;
  var table = box.querySelector(".igs-table"), btn = box.querySelector(".igs-btn");
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var posts = [], last = [];
  function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function handSize() { return window.innerWidth < 640 ? 6 : 10; }
  function words(s, n) { s = String(s || "").replace(/#\S+/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; }
  function card(m, i) {
    var a = document.createElement("a");
    a.className = "igs-card"; a.href = m.permalink; a.target = "_blank"; a.rel = "noopener";
    a.style.setProperty("--tilt", (Math.random() * 7 - 3.5).toFixed(1) + "deg");
    a.style.setProperty("--delay", (i * 45) + "ms");
    var img = document.createElement("img");
    img.src = "/api/artists?ig=img&id=" + encodeURIComponent(m.id); img.loading = "lazy"; img.decoding = "async"; img.width = 400; img.height = 400;
    img.alt = m.caption ? words(m.caption, 120) : "Crave on Instagram";
    img.onerror = function () { a.remove(); };
    var cap = document.createElement("span"); cap.className = "igs-cap"; cap.textContent = words(m.caption, 38) || "@crave.907";
    var ph = document.createElement("span"); ph.className = "igs-ph"; ph.appendChild(img);
    a.appendChild(ph); a.appendChild(cap);
    if (m.type === "VIDEO") { var v = document.createElement("span"); v.className = "igs-play"; v.setAttribute("aria-hidden", "true"); v.textContent = "▶"; a.appendChild(v); }
    return a;
  }
  function deal() {
    var n = Math.min(handSize(), posts.length), pool = shuffled(posts);
    // Prefer posts that weren't in the last hand, so a shuffle always looks different.
    var fresh = pool.filter(function (m) { return last.indexOf(m.id) === -1; }), hand = fresh.concat(pool.filter(function (m) { return last.indexOf(m.id) > -1; })).slice(0, n);
    last = hand.map(function (m) { return m.id; });
    var put = function () {
      table.textContent = ""; hand.forEach(function (m, i) { table.appendChild(card(m, i)); });
      table.classList.remove("is-out"); if (!still) { table.classList.add("is-in"); setTimeout(function () { table.classList.remove("is-in"); }, 900); }
    };
    if (still || !table.children.length) return put();
    table.classList.add("is-out"); setTimeout(put, 260);
  }
  fetch("/api/artists?ig=feed&n=20").then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (feed) {
    posts = (feed.items || []).slice(0, 20); if (posts.length < 4) return;
    var h = box.querySelector("[data-ig-handle]");
    if (h && feed.username) { h.textContent = "@" + feed.username; h.href = "https://www.instagram.com/" + encodeURIComponent(feed.username) + "/"; }
    box.hidden = false; deal();
    btn.addEventListener("click", deal);
  }).catch(function () {});
})();
