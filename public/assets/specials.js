// Seasonal preorders (holidays, pop-ups). One active special at a time. The server re-checks every price, date and
// pickup window from this file; preorders land on the staff board on their pickup day, tagged "Preorder".
// To run the next one: copy the block, change the id, dates, pickups and items. Items are made ahead (prep 0).
(function (root) {
  var SPECIAL = {
    id: "thanksgiving-2026",
    path: "/thanksgiving",
    title: "Thanksgiving preorders",
    kicker: "Holiday table",
    blurb: "Let us do the baking this year. Small batches, made here in North Pole, ready for your table.",
    orderFrom: "2026-11-03",
    orderBy: "2026-11-20",          // last day to order (Alaska time)
    soldOutNote: "While quantities last.",
    extra: "Thanksgiving Eve extras get announced November 11. Check back!",
    perWindow: 6,                   // preorders per 15-minute pickup window
    pickups: [
      { date: "2026-11-24", label: "Tuesday, Nov 24", open: "16:30", close: "17:15", note: "4:30 – 5:30 PM · firm" },
      { date: "2026-11-25", label: "Wednesday, Nov 25", open: "11:00", close: "12:45", note: "11 AM – 1 PM" },
    ],
    pickupNote: "Need another time? Ask when you order; special pickups may carry a fee.",
    items: [
      { id: "tg1", name: "Deviled Egg Tray", price: 40, desc: "24 halves.", choices: [{ name: "Style", options: ["Traditional", "Bacon jalapeño"] }] },
      { id: "tg2", name: "Seasonal Charcuterie Box", price: 75, desc: "Meats, cheeses, seasonal fruit and sweet bites." },
      { id: "tg3", name: "10-inch Cheesecake", price: 70, desc: "", choices: [{ name: "Flavor", options: ["Coffee", "Turtle"] }] },
      { id: "tg4", name: "Carrot Cake or 12 Cupcakes", price: 55, desc: "6-inch, 3-layer cake, or a dozen cupcakes.", photo: "/assets/food/cupcake-box.jpg", choices: [{ name: "Make it", options: ["6-inch carrot cake", "12 cupcakes"] }] },
      { id: "tg5", name: "Gluten-Free Carrot Cake or 12 Cupcakes", price: 65, desc: "GF ingredients, made in a shared kitchen. Not suitable for celiac disease.", choices: [{ name: "Make it", options: ["6-inch carrot cake", "12 cupcakes"] }] },
      { id: "tg6", name: "12 Large Cinnamon Rolls", price: 50, desc: "In multiple pans, with a frosting bag and reheating instructions.", photo: "/assets/food/cinnamon-roll-tray.jpg" },
      { id: "tg7", name: "Pumpkin Roll", price: 45, desc: "Serves 10." },
    ],
  };

  // Is the special taking orders on this Alaska date ("YYYY-MM-DD")?
  SPECIAL.isOpen = function (todayKey) { return todayKey >= SPECIAL.orderFrom && todayKey <= SPECIAL.orderBy; };
  SPECIAL.byId = function (id) { for (var i = 0; i < SPECIAL.items.length; i++) if (SPECIAL.items[i].id === id) return SPECIAL.items[i]; return null; };

  if (typeof module === "object" && module.exports) module.exports = SPECIAL;
  else root.CRAVE_SPECIAL = SPECIAL;
})(this);
