// "Meet the crew": a crayon doodle that floats in the bottom-left corner of every public page and opens a
// crayon-drawn team page. All drawings are inline SVG run through a wax-crayon filter (no image files).
// To change who's on the team, edit CREW below: name, role, a line about them, and which doodle to use
// (baker, cook, barista, kids). Names are roles for now until Crave sends the real ones.
(function () {
  var CREW = [
    { name: "The Baker", role: "Cinnamon rolls, cakes & cupcakes", line: "Up before the sun so the rolls are warm when you walk in. Pipes every sunflower by hand.", doodle: "baker", color: "#c46a2c" },
    { name: "The Cook", role: "Burritos, wraps & breakfast", line: "Runs the griddle and times your Crave Curbside order so it's hot the minute you pull up.", doodle: "cook", color: "#2f6b8a" },
    { name: "The Barista", role: "Coffee & a friendly hello", line: "Knows your order by the second visit. Will absolutely talk about the weather.", doodle: "barista", color: "#7a4a2a" },
    { name: "The Taste Testers", role: "Quality control (the kids)", line: "Very serious about cookies. Have never once said no to a new flavor.", doodle: "kids", color: "#b8332a" },
  ];

  // Wax-crayon look: wobble the lines, then eat holes in them so paper shows through like real crayon.
  var DEFS = '<defs>' +
    '<filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="wob"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="wob" scale="3.2" result="wobbly"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="8" result="grain"/>' +
      '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.5" result="holes"/>' +
      '<feComposite in="wobbly" in2="holes" operator="in"/>' +
    '</filter>' +
    '%PATTERNS%' +
  '</defs>';
  // Scribble fills: one hatch pattern per crayon color (patterns can't inherit a color from where they're used).
  function crayonize(svg) {
    var cols = {};
    svg = svg.replace(/fill="url\(#scribble\)" color="#([0-9a-fA-F]{3,6})"/g, function (_, hex) { cols[hex] = 1; return 'fill="url(#scr-' + hex + ')"'; });
    var pats = Object.keys(cols).map(function (hex) {
      return '<pattern id="scr-' + hex + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">' +
        '<rect width="6" height="6" fill="#' + hex + '" opacity=".28"/><line x1="0" y1="3" x2="6" y2="3" stroke="#' + hex + '" stroke-width="3.4" stroke-linecap="round"/></pattern>';
    }).join("");
    return svg.split("%PATTERNS%").join(pats);
  }
  var S = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';

  // Hand-drawn pieces (original doodles).
  function face(cx, cy, r, skin, hair) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + skin + '" opacity=".55"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + S + ' stroke="#3a2a20" stroke-width="3.2"/>' +
      '<path d="M' + (cx - r * .38) + ' ' + (cy - r * .1) + 'h1M' + (cx + r * .34) + ' ' + (cy - r * .1) + 'h1" stroke="#2a1d16" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M' + (cx - r * .4) + ' ' + (cy + r * .3) + 'q' + (r * .4) + ' ' + (r * .38) + ' ' + (r * .8) + ' 0" ' + S + ' stroke="#2a1d16" stroke-width="3"/>' +
      '<circle cx="' + (cx - r * .62) + '" cy="' + (cy + r * .2) + '" r="' + r * .14 + '" fill="#e8796b" opacity=".5"/>' +
      '<circle cx="' + (cx + r * .62) + '" cy="' + (cy + r * .2) + '" r="' + r * .14 + '" fill="#e8796b" opacity=".5"/>' +
      (hair ? '<path d="' + hair + '" ' + S + ' stroke="#5a3a22" stroke-width="5"/>' : '');
  }
  function body(cx, top, col) {
    return '<path d="M' + (cx - 30) + ' ' + (top + 70) + 'q4 -60 30 -66q26 6 30 66z" fill="url(#scribble)" color="' + col + '" opacity=".75"/>' +
      '<path d="M' + (cx - 30) + ' ' + (top + 70) + 'q4 -60 30 -66q26 6 30 66" ' + S + ' stroke="' + col + '" stroke-width="3.5"/>';
  }
  var DOODLES = {
    baker: function (c) {
      return body(70, 92, c) +
        '<path d="M48 64q-14-22 6-30q4-16 20-10q14-10 24 4q18 2 10 24z" fill="#fffdf9" stroke="#3a2a20" stroke-width="3.2" ' + 'stroke-linejoin="round"/>' +
        face(70, 74, 18, "#f2c79e") +
        '<path d="M96 132l34-20M100 140l34-20" ' + S + ' stroke="#9b6a3a" stroke-width="7"/>' +
        '<circle cx="130" cy="100" r="11" fill="url(#scribble)" color="#c47a3a"/><path d="M130 100m-7 0a7 7 0 1 0 7-7a4 4 0 1 0 3 5" ' + S + ' stroke="#7a4a20" stroke-width="2.6"/>';
    },
    cook: function (c) {
      return body(70, 92, c) +
        '<path d="M50 62q20-18 40 0" ' + S + ' stroke="#b8332a" stroke-width="9"/><path d="M90 60l12 6" ' + S + ' stroke="#b8332a" stroke-width="5"/>' +
        face(70, 76, 18, "#d9a57a", "M54 66q16-6 32 0") +
        '<ellipse cx="126" cy="128" rx="20" ry="7" fill="url(#scribble)" color="#444"/><path d="M106 128h40M146 128l18-8" ' + S + ' stroke="#333" stroke-width="4"/>' +
        '<path d="M118 112q4-8 0-14M128 110q4-8 0-14" ' + S + ' stroke="#999" stroke-width="2.6"/>';
    },
    barista: function (c) {
      return body(70, 92, c) +
        face(70, 74, 18, "#e8b98e", "M52 70q-2-26 18-26q22 0 20 26M52 70q-6 10-2 22M88 70q6 10 2 22") +
        '<path d="M108 108h28v26q0 10-10 10h-8q-10 0-10-10z" fill="#fffdf9" stroke="#3a2a20" stroke-width="3.2"/>' +
        '<path d="M136 114q12 2 0 16" ' + S + ' stroke="#3a2a20" stroke-width="3"/>' +
        '<path d="M116 100q-4-8 2-14M128 100q-4-8 2-14" ' + S + ' stroke="#a8582a" stroke-width="2.6"/>' +
        '<circle cx="122" cy="124" r="6" ' + S + ' stroke="#c4874a" stroke-width="2.4"/>';
    },
    kids: function (c) {
      return '<path d="M30 160q2-40 22-44q20 4 22 44z" fill="url(#scribble)" color="#2f6b8a" opacity=".75"/>' +
        '<path d="M90 160q2-40 22-44q20 4 22 44z" fill="url(#scribble)" color="' + c + '" opacity=".75"/>' +
        face(52, 98, 15, "#f2c79e", "M38 92q14-16 28 0") +
        face(112, 98, 15, "#d9a57a", "M98 90q14-14 28 0M98 90l-6 10M126 90l6 10") +
        '<circle cx="82" cy="138" r="13" fill="#e2b57a" stroke="#7a4a20" stroke-width="3"/>' +
        '<circle cx="78" cy="134" r="2.4" fill="#4a2a14"/><circle cx="86" cy="140" r="2.4" fill="#4a2a14"/><circle cx="80" cy="143" r="2" fill="#4a2a14"/>' +
        '<path d="M66 134l8 2M98 134l-8 2" ' + S + ' stroke="#3a2a20" stroke-width="3"/>';
    },
  };

  // The little North Pole storefront that floats in the corner.
  var SHOP = '<svg viewBox="0 0 200 170" aria-hidden="true">' + DEFS + '<g filter="url(#crayon)">' +
    '<path d="M10 150q90-10 180 0" ' + S + ' stroke="#b9d3e2" stroke-width="10"/>' +
    '<path d="M38 150v-62h108v62" fill="url(#scribble)" color="#e9c79c" stroke="#7a4a2a" stroke-width="3.5"/>' +
    '<path d="M28 92l64-44l64 44z" fill="url(#scribble)" color="#a8582a" stroke="#6a3416" stroke-width="3.5" stroke-linejoin="round"/>' +
    '<path d="M30 92q62-4 124 0" ' + S + ' stroke="#fffdf9" stroke-width="7"/>' +
    '<rect x="56" y="104" width="70" height="20" rx="4" fill="#fffdf9" stroke="#3a2a20" stroke-width="2.6"/>' +
    '<text x="91" y="119" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1c1814">Crave.</text>' +
    '<rect x="80" y="128" width="22" height="22" fill="url(#scribble)" color="#5a3a22" stroke="#3a2a20" stroke-width="2.6"/>' +
    '<rect x="50" y="128" width="20" height="14" fill="#fbe39a" stroke="#3a2a20" stroke-width="2.4"/><rect x="112" y="128" width="20" height="14" fill="#fbe39a" stroke="#3a2a20" stroke-width="2.4"/>' +
    '<path d="M172 150v-74" ' + S + ' stroke="#fffdf9" stroke-width="8"/>' +
    '<path d="M172 150v-74" stroke="#c0392b" stroke-width="8" stroke-dasharray="7 7" fill="none"/>' +
    '<path d="M172 76q0-12 -12-10" ' + S + ' stroke="#c0392b" stroke-width="7"/>' +
    '<path d="M108 40v-14h12v22" fill="#7a4a2a" stroke="#3a2a20" stroke-width="2.6"/>' +
    '<path d="M114 22q-6-8 2-14q-8-6 0-12" ' + S + ' stroke="#a9a9a9" stroke-width="3"/>' +
    '<g fill="#fff" stroke="#9fb9c9" stroke-width="1.2"><circle cx="20" cy="30" r="3.5"/><circle cx="60" cy="18" r="3"/><circle cx="150" cy="22" r="3.5"/><circle cx="186" cy="48" r="3"/><circle cx="14" cy="72" r="3"/></g>' +
    '</g></svg>';
  SHOP = crayonize(SHOP);

  function crewCard(m, i) {
    return '<article class="crew-card" style="--tilt:' + (i % 2 ? 1.6 : -1.4) + 'deg">' +
      crayonize('<svg viewBox="0 0 170 170" class="crew-doodle" aria-hidden="true">' + DEFS + '<g filter="url(#crayon)">' + DOODLES[m.doodle](m.color) + '</g></svg>') +
      '<h3 style="color:' + m.color + '">' + m.name + '</h3><p class="crew-role">' + m.role + '</p><p>' + m.line + '</p></article>';
  }

  function open() {
    if (document.getElementById("crew")) return;
    var wrap = document.createElement("div");
    wrap.id = "crew"; wrap.className = "crew-bg"; wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true"); wrap.setAttribute("aria-labelledby", "crewTitle");
    wrap.innerHTML = '<div class="crew-paper">' +
      '<button type="button" class="crew-close" aria-label="Close">✕</button>' +
      crayonize('<svg class="crew-sun" viewBox="0 0 120 120" aria-hidden="true">' + DEFS + '<g filter="url(#crayon)"><circle cx="60" cy="60" r="22" fill="url(#scribble)" color="#f2b632" stroke="#e39a1a" stroke-width="4"/>' +
        '<path d="M60 20v-12M60 112v-12M20 60h-12M112 60h-12M32 32l-8-8M96 96l-8-8M32 88l-8 8M96 24l-8 8" ' + S + ' stroke="#e39a1a" stroke-width="5"/></g></svg>') +
      '<h2 id="crewTitle">Meet the Crave crew</h2>' +
      '<p class="crew-intro">A small family kitchen on Santa Claus Lane. We bake, we cook, we pour, and our kids keep us honest.</p>' +
      '<div class="crew-grid">' + CREW.map(crewCard).join("") + '</div>' +
      '<div class="crew-town">' + SHOP.replace('viewBox="0 0 200 170"', 'viewBox="0 0 200 170" class="crew-shop"') +
        '<p>Come say hi at <b>235 N Santa Claus Lane, Suite 8</b>.<br>We\'re the ones with flour on our sleeves.</p></div>' +
      '</div>';
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    var close = function () { wrap.remove(); document.body.style.overflow = ""; btn.focus(); document.removeEventListener("keydown", esc); };
    var esc = function (e) { if (e.key === "Escape") close(); };
    wrap.querySelector(".crew-close").onclick = close;
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.addEventListener("keydown", esc);
    wrap.querySelector(".crew-close").focus();
  }

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "crew-float"; btn.setAttribute("aria-label", "Meet the Crave crew");
  btn.innerHTML = SHOP + '<span class="crew-tag">Meet us!</span>';
  btn.onclick = open;
  function mount() {
    document.body.appendChild(btn);
    document.querySelectorAll("[data-crew]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); open(); }); });
    if (location.hash === "#crew") open();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
