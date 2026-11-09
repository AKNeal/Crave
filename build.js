// Crave: builds public/*.html from src/pages/*.html (shared head, header and footer, plus the menu rendered from
// public/assets/menu-data.js so the menu page works without JavaScript and is readable by Google).
// Run: node build.js   (also runs automatically on Vercel)

const fs = require("fs");
const path = require("path");
const MENU = require("./public/assets/menu-data.js");
const shop = require("./config/crave.js");
const SPECIAL = require("./public/assets/specials.js");

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

const NAV = [["/menu", "Menu", "menu"], ["/catering", "Catering & cakes", "catering"], ["/visit", "Visit", "visit"]];
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
        <ul><li><a href="tel:+19074158499">(907) 415-8499</a></li><li><a href="mailto:admin@mamamafiaco.com">admin@mamamafiaco.com</a></li><li><a href="https://www.instagram.com/crave.907/" rel="noopener">@crave.907</a></li><li><a href="${MAP}" rel="noopener">${S.address.split(", ").map(esc).reduce((a, p, i) => a + (i === 1 ? "<br>" : i ? ", " : "") + p, "")}</a></li></ul>
      </div>
      <div>
        <h4>Hours</h4>
        <ul>${HOURS.map(([d, h]) => `<li>${d}<br><span class="muted">${h}</span></li>`).join("")}</ul>
      </div>
      <div>
        <h4>Eat</h4>
        <ul><li><a href="/order">Crave To Go</a></li><li><a href="/menu">Menu</a></li><li><a href="/catering">Catering &amp; cakes</a></li><li><a href="${SPECIAL.path}">${esc(SPECIAL.title)}</a></li><li><a href="https://craveprep.goprep.com" rel="noopener">Weekly meal prep ↗</a></li><li><a href="/admin">Staff</a></li></ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-shop="year">${new Date().getFullYear()}</span> Crave Coffee &amp; Bakery · North Pole, AK</span>
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
        <li${i.photo ? ' class="has-photo"' : ""}>${i.photo ? `<img class="mi-photo" src="${i.photo}" alt="" loading="lazy">` : ""}<div class="mi-top"><h3>${esc(i.name)}${(i.tags || []).map((t) => ` <span class="tag">${esc(t)}</span>`).join("")}</h3><span class="leader" aria-hidden="true"></span><span class="price">${MENU.money(i.price)}</span></div>
          ${i.desc ? `<p>${esc(i.desc)}</p>` : ""}</li>`).join("")}
      </ul></section>`;
  }).join("\n");
}
const menuNav = () => `<nav class="menu-jump" aria-label="Menu sections">${MENU.categories.map((c) => `<a href="#${c.id}">${esc(c.name)}</a>`).join("")}<a href="#bakery">Bakery case</a><a href="#coffee">Coffee</a><a href="#cakes">Cakes</a></nav>`;

// A few favorites for the home page.
const favorites = () => MENU.items.filter((i) => (i.tags || []).includes("Favorite")).slice(0, 4).map((i) => `
  <a class="fav" href="/order">${i.photo ? `<img src="${i.photo}" alt="${esc(i.name.replace("*", ""))} at Crave" loading="lazy">` : `<span class="fav-ring" aria-hidden="true"></span>`}
    <span class="fav-body"><span class="price">${MENU.money(i.price)}</span><h3>${esc(i.name.replace("*", ""))}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ""}</span></a>`).join("");

// Seasonal preorder banner (hidden by a tiny script outside the order dates).
const specialBanner = () => `<section class="special-band" data-from="${SPECIAL.orderFrom}" data-by="${SPECIAL.orderBy}" hidden>
  <div class="page special-inner">
    <img src="/assets/food/cinnamon-roll-tray.jpg" alt="" width="900" height="931" loading="lazy">
    <div><p class="eyebrow">${esc(SPECIAL.kicker)} · order by ${new Date(SPECIAL.orderBy + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
      <h2>${esc(SPECIAL.title)} are open</h2>
      <p>${esc(SPECIAL.blurb)} ${SPECIAL.items.slice(0, 4).map((i) => esc(i.name.toLowerCase().replace(/^\d+-inch |^12 large /, ""))).join(", ")} and more.</p>
      <a class="btn sign" href="${SPECIAL.path}">Preorder now</a></div>
  </div>
</section>
<script>(function(){var b=document.currentScript.previousElementSibling,t=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Anchorage"}).format(new Date());if(t>=b.dataset.from&&t<=b.dataset.by)b.hidden=false;})();</script>`;

const jsonLd = () => `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "CafeOrCoffeeShop", name: "Crave Coffee & Bakery", servesCuisine: ["Coffee", "Bakery", "Breakfast"], priceRange: "$$",
  address: { "@type": "PostalAddress", streetAddress: "235 N Santa Claus Ln, Suite 8", addressLocality: "North Pole", addressRegion: "AK", postalCode: "99705", addressCountry: "US" },
  telephone: "+1-907-415-8499", email: "admin@mamamafiaco.com", sameAs: ["https://www.instagram.com/crave.907/"],
  areaServed: ["North Pole, AK", "Fairbanks, AK", "Eielson Air Force Base, AK", "Fort Wainwright, AK"],
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
    .replace(/<!--#special-->/g, specialBanner())
    .replace(/<!--#jsonld-->/g, jsonLd())
    .replace(/%MAP%/g, MAP)
    .replace(/%ADDRESS%/g, esc(S.address))
    .replace(/%MENUNOTE%/g, esc(MENU.note));
  fs.writeFileSync(path.join(OUT, file), html);
  n++;
}
console.log(`built ${n} pages`);
