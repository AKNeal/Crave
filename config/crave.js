// Crave's starting settings for the Beam booking engine (catering requests + scheduling).
// Everything here can be changed later in the inbox (/admin → Booking form, Calendar, Team); once it is,
// the saved settings take over and this file is only the starting point.
const T = require("../lib/templates");
const tpl = T.template("catering");

module.exports = {
  slug: "crave",
  active: true,
  kind: "catering",
  hosts: ["crave.nealmedia.app"],
  studio: {
    name: "Crave Coffee & Bakery",
    tagline: "Family-run coffee and bakery in North Pole, Alaska. Breakfast, lunch and scratch-made sweets.",
    city: "North Pole, AK",
    phone: "(907) 415-8499",
    contactEmail: "admin@mamamafiaco.com",
    minAge: 0,
    timeZone: "America/Anchorage",
    address: "235 N Santa Claus Ln, Suite 8, North Pole, AK 99705",
    instagram: "crave.907",
    website: "",
  },
  theme: { mode: "light", accent: "#a8582a", logo: "/assets/crave-logo.png" },
  calendarDefaults: {
    hours: {
      0: { open: "07:00", close: "20:00" }, 1: { open: "07:00", close: "20:00" }, 2: { open: "07:00", close: "20:00" },
      3: { open: "07:00", close: "20:00" }, 4: { open: "07:00", close: "20:00" }, 5: { open: "07:00", close: "20:00" },
      6: { open: "07:00", close: "20:00" },
    },
    stepMin: 30, bufferMin: 60, leadHours: 72, windowDays: 120,
  },
  sessionLengths: [60, 90, 120, 180, 240, 360],
  depositPolicy: "Larger catering orders are held with a deposit that comes off the final bill; the amount and terms are on your offer. Final headcount is due 48 hours before your event.",
  artists: [{ slug: "crave-catering", name: "Crave Catering", styles: ["Breakfast", "Lunch", "Desserts"], bio: "", photo: "", sample: "", instagram: "", email: "", booksOpenDefault: true }],
  templates: {
    decline_style: "Hi {name}, thanks for thinking of Crave. This one isn't something we can do well, and you deserve a caterer who can. Happy to point you to someone.",
    decline_full: "Hi {name}, thanks for reaching out. We're fully booked on that date. If another date works, send a new request and we'll make it happen.",
    need_info: "Hi {name}, thanks for your catering request. Could you send the final guest count and the address so we can price it? Just reply here.",
  },
  words: tpl.words, form: tpl.form, negotiate: tpl.negotiate, ageCheck: tpl.ageCheck, policyCheck: tpl.policyCheck,
};
