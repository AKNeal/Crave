// Crave's menu: one list used by the menu page, the order-ahead page and the server (which re-checks every price).
// To change the menu, edit this file only. Each item: id (never reuse), name, desc, price, and optional
// `choices` (pick one from each group) and `tags`. `orderAhead: false` keeps an item on the menu but off Order Ahead.
(function (root) {
  // Add-ons from the menu board: "add your choice of 2 eggs for $2.00", "add your choice of protein for $2.00",
  // and lunch "* comes with chips or 8oz soup". (Protein choices: confirm with Crave.)
  var EGGS = { name: "Add 2 eggs", options: ["No eggs", "Scrambled (+$2)", "Over easy (+$2)", "Over medium (+$2)", "Over hard (+$2)"] };
  var PROTEIN = { name: "Add protein", options: ["No protein", "Bacon (+$2)", "Sausage (+$2)", "Ham (+$2)"] };
  var SIDE = { name: "Side", options: ["Chips", "8 oz soup"] };
  var MENU = {
    note: "Prices include tax. Menu changes with the seasons; ask at the counter for today's soup and specials.",
    categories: [
      { id: "breakfast", prep: 10, name: "Breakfast", blurb: "Add your choice of 2 eggs for $2.00. Add your choice of protein for $2.00." },
      { id: "lunch", prep: 10, name: "Lunch", blurb: "* Comes with chips or an 8 oz soup." },
      { id: "desserts", prep: 2, name: "Desserts", blurb: "Baked here." },
    ],
    items: [
      { id: "b1", cat: "breakfast", name: "Biscuits & Gravy", price: 12.5, tags: ["Favorite"], desc: "", choices: [EGGS, PROTEIN] },
      { id: "b2", cat: "breakfast", name: "Breakfast Sammy", price: 8.55, desc: "Base price. Build it with eggs and protein.", choices: [EGGS, PROTEIN] },
      { id: "b3", cat: "breakfast", name: "Southwest Burrito", price: 11, desc: "", choices: [EGGS, PROTEIN] },
      { id: "b4", cat: "breakfast", name: "Crave Burrito", price: 12.75, tags: ["Favorite"], desc: "", choices: [EGGS, PROTEIN] },
      { id: "b5", cat: "breakfast", name: "Pancake Bites", price: 4, desc: "" },
      { id: "l1", cat: "lunch", name: "Buffalo Wrap*", price: 12, tags: ["Favorite"], desc: "", choices: [SIDE] },
      { id: "l2", cat: "lunch", name: "Caesar Wrap*", price: 14.5, desc: "", choices: [SIDE] },
      { id: "l3", cat: "lunch", name: "Soup of the Day", price: 7, desc: "Ask what's on today." },
      { id: "l4", cat: "lunch", name: "Bavarian Pretzel", price: 8.75, desc: "" },
      { id: "l5", cat: "lunch", name: "Grilled Cheese*", price: 7.79, desc: "", choices: [SIDE] },
      { id: "l6", cat: "lunch", name: "Turkey Pesto*", price: 9.78, desc: "", choices: [SIDE] },
      { id: "d1", cat: "desserts", name: "Cupcakes", price: 4.75, desc: "" },
      { id: "d2", cat: "desserts", name: "Cinnamon Rolls", price: 6, tags: ["Favorite"], desc: "" },
      { id: "d3", cat: "desserts", name: "Cookies", price: 4, desc: "" },
      { id: "d4", cat: "desserts", name: "Cream Pie", price: 4.15, desc: "" },
    ],
  };

  // "(+$2)" or "(−$4)" in an option changes the price.
  MENU.optionDelta = function (opt) {
    var m = /\(([+−-])\$(\d+(?:\.\d{1,2})?)\)/.exec(String(opt || ""));
    return m ? (m[1] === "+" ? 1 : -1) * Number(m[2]) : 0;
  };
  MENU.byId = function (id) { for (var i = 0; i < MENU.items.length; i++) if (MENU.items[i].id === id) return MENU.items[i]; return null; };
  MENU.money = function (n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); };

  if (typeof module === "object" && module.exports) module.exports = MENU;
  else root.CRAVE_MENU = MENU;
})(this);
