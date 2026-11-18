// Website checklist: everything Neal Media still needs from Crave to finish the site.
// Shown in the staff page (Website tab, plus a progress card on Today) to the Owner, Site admins and Neal Media's logins.
//
// Each item:
//   kind  "text" one line · "long" paragraphs · "files" uploads only · "both" type it or upload (photos or PDF)
//   form  filled by an onboarding page instead (turns yellow when that form comes in, green when Neal Media signs off)
//   auto  turns green by itself (see lib/checklist.js)
//   neal  Neal Media's own job (shown so Rhonda can see where it's at, not asked of her)
//   where the page on the site this fills in
// Status: red = still needed · yellow = sent, Neal Media is working it in · green = done (Neal Media signed it off).
// Answers and uploads live in the store under "chk:<id>"; editing this file never loses them.

module.exports = {
  heading: "Finish the website",
  intro: "What Neal Media still needs to finish crave.nealmedia.app. Red is still needed, yellow is sent and being worked in, green is done. Type an answer or add photos right here; it saves for Neal Media.",
  // Neal Media's logins: always see the checklist and can sign items off (the shop password login counts too).
  nealMedia: ["nealmedia@yahoo.com", "artemis.nealmedia@gmail.com"],
  groups: [
    { name: "Start here", items: [
      { id: "ownerForm", title: "Rhonda's onboarding page", why: "Five minutes: your story, contact details and social links in one place. Some of this list fills in from it.", form: "owner", href: "/rhonda", action: "Open it" },
      { id: "hours", title: "Set your shop hours", why: "Check the hours on the website and fix anything that's off, right here on the staff page (Shop hours, below). Changes show on the website right away.", auto: "hours", view: "hours", action: "Shop hours" },
      { id: "staff", title: "Your crew: names, jobs and emails", why: "One person per line, like: Jamie, Baker, jamie@email.com. Each one gets their own staff login and onboarding page, and shows up in Meet the crew.", kind: "long", where: { href: "/#crew", label: "Meet the crew" } },
      { id: "curbside", title: "Crave Curbside: what can be ordered ahead", why: "Everything on the menu, or only some items? Anything that sells out early or needs extra time?", kind: "long", where: { href: "/order", label: "Crave Curbside" } },
      { id: "teamForms", title: "Each employee's onboarding page", why: "Send your crew this link: crave.nealmedia.app/onboard. It takes them two minutes.", form: "team", href: "/onboard", action: "Open it" },
    ] },
    { name: "Social media", items: [
      { id: "socials", title: "Social media handles and links", why: "Instagram, Facebook, TikTok, your Google listing, Yelp, anything else. On your phone: open the app, tap Share, then Copy Link.", kind: "long", where: { href: "/visit", label: "Footer and Visit page" } },
      { id: "instagramConnect", title: "Connect the Crave Instagram", why: "Lets the site show your newest posts by itself. Account, then Connect Instagram.", auto: "instagram", view: "account", action: "Account" },
      { id: "googleAccess", title: "Add Neal Media as a Google profile manager", why: "Starts the Google ranking work. On your Business Profile: tap More, Business Profile settings, People and access, Add, then artemis.nealmedia@gmail.com as Manager.", kind: "text", href: "https://business.google.com/", action: "Google" },
    ] },
    { name: "Menu", items: [
      { id: "menu", title: "The complete menu with prices", why: "Photos of the menu board or a PDF are perfect. Or type what's missing or wrong on the Menu page.", kind: "both", where: { href: "/menu", label: "Menu page" } },
      { id: "foodPhotos", title: "Food and drink photos", why: "Phone photos are fine. Best sellers first. They're shrunk before they upload.", kind: "files", where: { href: "/", label: "Home and Menu" } },
      { id: "catering", title: "Catering and cake prices", why: "Party trays, cakes, cupcakes by the dozen: what you offer, starting prices, and how much notice you need.", kind: "both", where: { href: "/catering", label: "Catering & cakes" } },
      { id: "specials", title: "Seasonal items and holiday preorders", why: "What comes back each season, and what people can preorder for Thanksgiving, Christmas and Easter.", kind: "long", where: { href: "/thanksgiving", label: "Preorders" } },
    ] },
    { name: "Your story", items: [
      { id: "story", title: "Crave's story", why: "How Crave started and who's behind it, in your own words. A few sentences is plenty; write it messy and we'll tidy it.", kind: "long", where: { href: "/", label: "Home page" } },
      { id: "crewPhotos", title: "Photos of the shop and the crew", why: "Inside the shop, the counter, the crew at work. Only people who said yes on their onboarding page go on the site.", kind: "files", where: { href: "/#crew", label: "Meet the crew" } },
      { id: "giving", title: "Hometown Crave: who you give back to", why: "The groups and causes you support, so the Giving back page tells the real story.", kind: "long", where: { href: "/give", label: "Giving back" } },
    ] },
    { name: "The practical bits", items: [
      { id: "contact", title: "Public phone and email", why: "The site lists (907) 415-8499 and admin@mamamafiaco.com. Keep them, or use different ones?", kind: "text", where: { href: "/visit", label: "Every page footer" } },
      { id: "logo", title: "Your logo files", why: "The biggest, sharpest versions you have (PNG, SVG or PDF). The site uses the coffee-ring logo now.", kind: "files" },
      { id: "domain", title: "Your own web address", why: "Do you own one (like cravenorthpole.com), or want one? Right now it's crave.nealmedia.app.", kind: "text" },
    ] },
    { name: "Neal Media's part", items: [
      { id: "email", title: "Connect email", why: "So the site can send order and catering emails, password links, and copies of these answers.", neal: true, auto: "email" },
      { id: "texts", title: "Connect text alerts", why: "New Crave Curbside orders and catering requests by text.", neal: true, auto: "sms" },
      { id: "rankTracking", title: "Daily Google ranking checks", why: "Four searches checked every night; results show on Today and in the Website tab.", neal: true, auto: "ranking" },
    ] },
  ],
};
