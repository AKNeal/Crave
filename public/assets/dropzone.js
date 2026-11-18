// Drag-and-drop file area (menu photos and PDFs). Used on the staff page checklist and on Rhonda's onboarding page.
//   CraveDrop.attach(zoneElement, { upload: async (dataUrl, file) => {...}, done: (count) => {...} })
// Photos are shrunk in the browser (longest side 2000px, JPEG) before upload; PDFs go as they are (3 MB max).
window.CraveDrop = (function () {
  function shrink(file, maxPx, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, maxPx / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = quality, out = c.toDataURL("image/jpeg", q);
        while (out.length > 2400000 && q > 0.45) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo we can read.")); };
      img.src = url;
    });
  }
  function read(file) {
    if (file.type === "application/pdf") {
      if (file.size > 3.4 * 1024 * 1024) return Promise.reject(new Error("That PDF is over 3 MB. Try photos of the pages instead."));
      return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(file); });
    }
    if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return Promise.reject(new Error(file.name + " isn't a photo or PDF."));
    return shrink(file, 2000, 0.85);
  }
  function attach(zone, opts) {
    var input = document.createElement("input");
    input.type = "file"; input.multiple = true; input.accept = "image/*,application/pdf"; input.hidden = true;
    zone.appendChild(input);
    var status = zone.querySelector(".drop-status");
    function say(t) { if (status) status.textContent = t; }
    async function go(files) {
      files = Array.prototype.slice.call(files || []); if (!files.length) return;
      zone.classList.add("is-busy"); var n = 0, okCount = 0;
      for (var i = 0; i < files.length; i++) {
        say("Uploading " + (++n) + " of " + files.length + "…");
        try { await opts.upload(await read(files[i]), files[i]); okCount++; }
        catch (e) { say(files[i].name + ": " + (e.message || "didn't upload")); zone.classList.remove("is-busy"); if (opts.done) opts.done(okCount); return; }
      }
      zone.classList.remove("is-busy"); say(okCount === 1 ? "1 file added. Drop more any time." : okCount + " files added. Drop more any time.");
      if (opts.done) opts.done(okCount);
    }
    zone.setAttribute("tabindex", "0"); zone.setAttribute("role", "button");
    zone.addEventListener("click", function (e) { if (!e.target.closest("a, button, input")) input.click(); });
    zone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", function () { go(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); if (t === "dragleave" && zone.contains(e.relatedTarget)) return; zone.classList.remove("is-over"); }); });
    zone.addEventListener("drop", function (e) { go(e.dataTransfer && e.dataTransfer.files); });
    return { open: function () { input.click(); } };
  }
  return { attach: attach };
})();
