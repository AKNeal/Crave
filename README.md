# crave.nealmedia.app

Website for **Crave.**, 235 N Santa Claus Lane, Suite 8, North Pole, Alaska. Built by Neal Media & Production.

## What's on it
| Address | What's there |
|---|---|
| `/` | Home: hours, favorites, Crave Curbside and catering |
| `/menu` | Full menu (built from `public/assets/menu-data.js`) |
| `/order` | **Crave Curbside (Perfect Timing order-ahead):** pick a pickup day and 15-minute window, build the order (eggs, protein, chips or soup), pay at the counter. `/order?t=…` is the customer's live tracking page |
| `/kitchen` | **Kitchen board:** orders by status, sorted by the time to start each one so it's ready right at pickup; load per window; Crave Curbside settings (hours, window length, orders per window, notice, closed days, pause switch) |
| `/catering` | Catering info |
| `/booking` | Catering request form (**Beam** booking engine, same as Black Wolf): client can name a budget; offers and counter-offers; accepted offers go on the calendar |
| `/request`, `/schedule` | Client's private request page and time picker (linked from emails) |
| `/admin` | Catering inbox: offers, calendar, team logins, booking form editor |

## Editing
- Menu, prices, add-ons: `public/assets/menu-data.js` (one file; the server re-checks every price from it).
- Shop details, dining-room hours, nav, footer: top of `build.js`; catering starting settings: `config/crave.js` (after the first change in /admin, the saved settings win).
- Page text: `src/pages/*.html`, then `node build.js` (Vercel runs it on deploy).

## Setup on Vercel
1. Storage: connect **Upstash for Redis** (orders, catering requests, logins) and a **private Blob** store (catering photos).
2. Env: `ADMIN_PASSWORD` (shop key: log in at /admin with a blank email, then create real logins under Team), `SESSION_SECRET`. For email: `RESEND_API_KEY`, `EMAIL_FROM`. Texts: `TWILIO_*` (see Black Wolf README).
3. Domain: crave.nealmedia.app.

## Local
`npm install`, then `ADMIN_PASSWORD=test SESSION_SECRET=x npm run dev` → http://localhost:3000
