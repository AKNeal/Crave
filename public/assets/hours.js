// Shop hours: the website shows the hours Rhonda set on the staff page (Website tab, Shop hours).
// The hours built into the page are only the fallback until this loads.
(function () {
  var lists = document.querySelectorAll("[data-hours]"); if (!lists.length || !window.fetch) return;
  fetch("/api/waitlist?site=hours").then(function (r) { return r.ok ? r.json() : null; }).then(function (h) {
    if (!h || !h.rows || !h.rows.length) return;
    lists.forEach(function (box) {
      box.textContent = "";
      h.rows.forEach(function (row) {
        if (box.getAttribute("data-hours") === "dl") {
          var div = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
          dt.textContent = row[0]; dd.textContent = row[1]; div.appendChild(dt); div.appendChild(dd); box.appendChild(div);
        } else {
          var li = document.createElement("li"), sp = document.createElement("span");
          li.appendChild(document.createTextNode(row[0])); li.appendChild(document.createElement("br"));
          sp.className = "muted"; sp.textContent = row[1]; li.appendChild(sp); box.appendChild(li);
        }
      });
      var old = box.parentNode.querySelector(".hours-note"); if (old) old.remove();
      if (h.note) { var n = document.createElement("p"); n.className = "hours-note"; n.textContent = h.note; box.parentNode.insertBefore(n, box.nextSibling); }
    });
  }).catch(function () {});
})();
