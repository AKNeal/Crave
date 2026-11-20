// Website checklist: everything Neal Media still needs from Crave to finish the site.
// Shown in the staff page (Website tab, plus a progress card on Today) to the Owner, Site admins and Neal Media's logins.
//
// Each item:
//   kind  "text" one line · "long" paragraphs · "files" uploads only · "both" type it or upload (photos or PDF)
//   form  filled by an onboarding page instead (turns yellow when that form comes in, green when Neal Media signs off)
//   auto  turns green by itself (see lib/checklist.js)
//   neal  Neal Media's own job (shown so Rhonda can see where it's at, not asked of her)
//   after only once the Neal Media agreement is signed: grey, not counted and not open until agreementSigned is true
//   where the page on the site this fills in
// Status: red = still needed · yellow = sent, Neal Media is working it in · green = done (Neal Media signed it off).
// Answers and uploads live in the store under "chk:<id>"; editing this file never loses them.

module.exports = {
  heading: "Finish the website",
  intro: "What Neal Media still needs to finish crave.nealmedia.app. Red is still needed, yellow is sent and being worked in, green is done. Type an answer or add photos right here; it saves for Neal Media.",
  // Neal Media's logins: always see the checklist and can sign items off (the shop password login counts too).
  nealMedia: ["nealmedia@yahoo.com", "artemis.nealmedia@gmail.com"],
  // Flip to true once Crave has signed the Neal Media website agreement. Until then every "after" item
  // shows grey ("After the agreement is signed"), takes no answers and isn't counted in Rhonda's progress.
  agreementSigned: false,
  groups: [
    { name: "Start here", items: [
      { id: "ownerForm", title: "Rhonda's onboarding page", why: "Five minutes: your story, hours, public phone and email, web address, and social media links, all in one place.", form: "owner", href: "/rhonda", action: "Open it" },
      { id: "crew", title: "Your crew", why: "Send each person this link: crave.nealmedia.app/onboard (two minutes for them). Their answers show up below under Onboarding answers; tap Make their staff login, and they're on the schedule and in Meet the crew if they said yes.", form: "team", href: "/onboard", action: "Open it" },
      { id: "hours", title: "Set your shop hours", why: "Check the hours on the website and fix anything that's off, right here on the staff page (Shop hours, below). Changes show on the website right away.", auto: "hours", view: "hours", action: "Shop hours" },
      { id: "curbside", title: "Crave Curbside: what can be ordered ahead", why: "Everything on the menu, or only some items? Anything that sells out early or needs extra time?", kind: "long", where: { href: "/order", label: "Crave Curbside" } },
    ] },
    { name: "Menu", items: [
      { id: "menu", title: "The complete menu with prices", why: "Photos of the menu board or a PDF are perfect. Or type what's missing or wrong on the Menu page.", kind: "both", where: { href: "/menu", label: "Menu page" } },
      { id: "catering", title: "Catering and cake prices", why: "Party trays, cakes, cupcakes by the dozen: what you offer, starting prices, and how much notice you need.", kind: "both", where: { href: "/catering", label: "Catering & cakes" } },
      { id: "specials", title: "Seasonal items and holiday preorders", why: "What comes back each season, and what people can preorder for Thanksgiving, Christmas and Easter.", kind: "long", where: { href: "/thanksgiving", label: "Preorders" } },
    ] },
    { name: "Photos and logo", items: [
      { id: "photos", title: "Photos: food, the shop and the crew", why: "Phone photos are fine: best sellers, the counter, the crew at work. Only people who said yes on their onboarding page go on the site. They're shrunk before they upload.", kind: "files", where: { href: "/", label: "Home and Menu" } },
      { id: "logo", title: "Your logo files", why: "The biggest, sharpest versions you have (PNG, SVG or PDF). The site uses the coffee-ring logo now.", kind: "files" },
    ] },
    { name: "Giving back", items: [
      { id: "giving", title: "Hometown Crave: who you give back to", why: "The groups and causes you support, so the Giving back page tells the real story.", kind: "long", where: { href: "/give", label: "Giving back" } },
    ] },
    { name: "Neal Media's part", items: [
      { id: "email", title: "Connect email", why: "So the site can send order and catering emails, password links, and copies of these answers.", neal: true, auto: "email" },
    ] },
    { name: "After the agreement is signed", items: [
      { id: "googleAccess", title: "Add Neal Media as a Google profile manager", why: "Starts the Google ranking work. On your Business Profile: tap More, Business Profile settings, People and access, Add, then artemis.nealmedia@gmail.com as Manager. Type Done here when it's added.", kind: "text", href: "https://business.google.com/", action: "Google", after: true },
      { id: "instagramConnect", title: "Connect the Crave Instagram", why: "Puts your newest posts on the home page by themselves. Account, then Connect Instagram.", auto: "instagram", view: "account", action: "Account", after: true },
      { id: "texts", title: "Connect text alerts", why: "New Crave Curbside orders and catering requests by text. Carrier registration is part of the agreement.", neal: true, auto: "sms", after: true },
      { id: "rankTracking", title: "Google ranking work and monthly reports", why: "Business Profile care, search work and reviews, with four searches checked every night; results show on Today and in the Website tab.", neal: true, auto: "ranking", after: true },
    ] },
  ],
};
