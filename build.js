// Crave: builds public/*.html from src/pages/*.html (shared head, header and footer, plus the menu rendered from
// public/assets/menu-data.js so the menu page works without JavaScript and is readable by Google).
// Run: node build.js   (also runs automatically on Vercel)

const fs = require("fs");
const path = require("path");
const MENU = require("./public/assets/menu-data.js");
const shop = require("./config/crave.js");

const SRC = path.join(__dirname, "src/pages");
const OUT = path.join(__dirname, "public");
const S = shop.studio;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Dining-room hours (shown on the site). Crave To Go pickup hours are set on the kitchen board.
const HOURS = [["Mon, Tue", "7:30 AM – 3:30 PM"], ["Wednesday", "Closed"], ["Thu, Fri", "7:30 AM – 3:30 PM"], ["Sat, Sun", "9:30 AM – 3:30 PM"]];
const MAP = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(S.address)}`;

const headHtml = () => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f8f5ef">
<link rel="icon" href="/assets/crave-icon-64.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/crave-icon-180.png">
<meta property="og:image" content="https://crave.nealmedia.app/assets/crave-logo-og.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,800;1,9..144,600;1,9..144,800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/crave.css">
<script src="/assets/shop.js"></script>`;

const NAV = [["/menu", "Menu", "menu"], ["/catering", "Catering", "catering"], ["/visit", "Visit", "visit"]];
const header = (page) => `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="page header-inner">
    <a class="brand crave-brand" href="/" aria-label="Crave, home"><img class="logo" src="/assets/crave-logo.png" alt="Crave." width="64" height="64"><span class="brand-sub">North Pole, Alaska</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Main">
      ${NAV.map(([href, label, key]) => `<a href="${href}"${key === page || (key === "catering" && ["booking", "request", "schedule"].includes(page)) ? ' aria-current="page"' : ""}>${label}</a>`).join("\n      ")}
      <a class="btn sign sm" href="/order"${page === "order" ? ' aria-current="page"' : ""}>Crave To Go</a>
    </nav>
  </div>
</header>`;

const footer = () => `<footer class="site-footer crave-footer">
  <div class="page">
    <div class="footer-grid">
      <div>
        <a class="brand crave-brand" href="/"><img class="logo" src="/assets/crave-logo.png" alt="Crave." width="96" height="96"></a>
        <p style="margin-top:14px;max-width:32ch">${esc(S.tagline)}</p>
      </div>
      <div>
        <h4>Visit</h4>
        <ul><li><a href="${MAP}" rel="noopener">${S.address.split(", ").map(esc).reduce((a, p, i) => a + (i === 1 ? "<br>" : i ? ", " : "") + p, "")}</a></li></ul>
      </div>
      <div>
        <h4>Hours</h4>
        <ul>${HOURS.map(([d, h]) => `<li>${d}<br><span class="muted">${h}</span></li>`).join("")}</ul>
      </div>
      <div>
        <h4>Eat</h4>
        <ul><li><a href="/order">Crave To Go</a></li><li><a href="/menu">Menu</a></li><li><a href="/catering">Catering</a></li><li><a href="/admin">Staff</a></li></ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-shop="year">${new Date().getFullYear()}</span> Crave · North Pole, AK</span>
      <a href="https://nealmedia.app" rel="noopener">Site by Neal Media &amp; Production</a>
    </div>
  </div>
</footer>
<script src="/assets/site.js" defer></script>`;

const poweredBy = `<p class="poweredby"><a href="https://beam.nealmedia.app" rel="noopener" target="_blank">Scheduling powered by: <img class="pb-on-light" src="/assets/brand/beam-book-logo.svg" alt="Beam" width="123" height="22"></a></p>`;

const hoursList = () => `<dl class="chours">${HOURS.map(([d, h]) => `<div><dt>${d}</dt><dd>${h}</dd></div>`).join("")}</dl>`;

// Full menu, rendered at build time.
function menuHtml() {
  return MENU.categories.map((c) => {
    const items = MENU.items.filter((i) => i.cat === c.id);
    return `<section class="menu-cat" id="${c.id}">
      <header><h2>${esc(c.name)}</h2>${c.blurb ? `<p class="muted">${esc(c.blurb)}</p>` : ""}</header>
      <ul class="menu-list">${items.map((i) => `
        <li><div class="mi-top"><h3>${esc(i.name)}${(i.tags || []).map((t) => ` <span class="tag">${esc(t)}</span>`).join("")}</h3><span class="leader" aria-hidden="true"></span><span class="price">${MENU.money(i.price)}</span></div>
          ${i.desc ? `<p>${esc(i.desc)}</p>` : ""}</li>`).join("")}
      </ul></section>`;
  }).join("\n");
}
const menuNav = () => `<nav class="menu-jump" aria-label="Menu sections">${MENU.categories.map((c) => `<a href="#${c.id}">${esc(c.name)}</a>`).join("")}</nav>`;

// A few favorites for the home page.
const favorites = () => MENU.items.filter((i) => (i.tags || []).includes("Favorite")).slice(0, 4).map((i) => `
  <article class="fav"><span class="price">${MENU.money(i.price)}</span><h3>${esc(i.name)}</h3><p>${esc(i.desc)}</p></article>`).join("");

const jsonLd = () => `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "Restaurant", name: "Crave", servesCuisine: "Café", priceRange: "$$",
  address: { "@type": "PostalAddress", streetAddress: "235 N Santa Claus Ln, Suite 8", addressLocality: "North Pole", addressRegion: "AK", postalCode: "99705", addressCountry: "US" },
  url: `https://${shop.hosts[0]}`, menu: `https://${shop.hosts[0]}/menu`, acceptsReservations: false,
  openingHours: ["Mo,Tu,Th,Fr 07:30-15:30", "Sa,Su 09:30-15:30"],
})}</script>`;

let n = 0;
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(SRC, file), "utf8")
    .replace(/<!--#head-->/g, headHtml())
    .replace(/<!--#header (\w+)-->/g, (_, page) => header(page))
    .replace(/<!--#footer-->/g, footer())
    .replace(/<!--#instagram-->/g, "")
    .replace(/<!--#poweredby-->/g, poweredBy)
    .replace(/<!--#hours-->/g, hoursList())
    .replace(/<!--#menu-->/g, menuHtml())
    .replace(/<!--#menunav-->/g, menuNav())
    .replace(/<!--#favorites-->/g, favorites())
    .replace(/<!--#jsonld-->/g, jsonLd())
    .replace(/%MAP%/g, MAP)
    .replace(/%ADDRESS%/g, esc(S.address))
    .replace(/%MENUNOTE%/g, esc(MENU.note));
  fs.writeFileSync(path.join(OUT, file), html);
  n++;
}
console.log(`built ${n} pages`);
