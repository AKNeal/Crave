// GET /api/admin/photo?p=<path> — streams a client's private reference photo, for the logged-in shop only.
// /api/admin/photo?site=<op> — finishing the website: checklist, change requests, text edits, onboarding answers,
//   Google ranking (staff only). Lives here because Crave is at Vercel's 12-function limit. See lib/site.js.

const config = require("../../config/studio");
const auth = require("../../lib/auth");
const store = require("../../lib/store");
const files = require("../../lib/files");
const { send, method, body } = require("../../lib/http");

module.exports = async function handler(req, res) {
  const site = new URL(req.url, "http://x").searchParams.get("site");
  if (site) return require("../../lib/site").staffApi(req, res, site, send, body);
  if (!method(req, res, "GET")) return;
  const me = await auth.currentUser(req);
  if (!me) return send(res, 401, { error: "Log in first." });

  const p = new URL(req.url, "http://x").searchParams.get("p") || "";
  // Only files this app stored for requests; no other paths in the store.
  const m = new RegExp(`^${config.tenant}/requests/([\\w-]+)/(?:done-)?\\d+-[a-f0-9]{16}\\.(jpg|png|webp)$`).exec(p);
  if (!m) return send(res, 400, { error: "Bad photo path." });
  if (!auth.seesAll(me)) {
    const r = await store.getJSON(`req:${m[1]}`);
    if (!r || !auth.canSeeRequest(me, r)) return send(res, 404, { error: "Photo not found." });
  }

  return files.stream(res, p, send);
};

// Beam Book: run this endpoint for the shop at this web address.
module.exports = require("../../lib/tenant").handler(module.exports);
