# Appearich — PWA

## 1. Add your real assets
Add these into an `images/` folder at the project root (same names your app already references):
`appearich-logo.png`, `appearich-hero.jpg`, `appearich-perfume1.jpg` … `appearich-perfume4.jpg`, `heroo-ai.jpg`.

The **splash screen** and **header logo** both use `images/appearich-logo.png` — make sure that file has a **transparent background** (PNG), not a white/square one, so it blends into the pure-black splash screen.

Generate real icon files too, and drop them in `icons/`:
- `icons/icon-192.png` (192×192)
- `icons/icon-512.png` (512×512)
- `icons/icon-maskable-512.png` (512×512, logo kept within the center ~80%)
- `icons/apple-touch-icon.png` (180×180)

Any icon generator (e.g. realfavicongenerator.net, or PWA Builder's image generator) works.

## 2. Run the database schema
In your Supabase project's **SQL Editor**, run `supabase-schema.sql`. This creates:
- `profiles` — one row per user (`full_name`, `phone`), auto-created on signup via a trigger
- `orders` — every meal/perfume order, tied to `user_id`, protected by Row Level Security so each person can only ever see and modify their own data

Supabase credentials are already wired into `js/supabase-client.js` (Project URL + anon key).

## 3. Email confirmation
By default, Supabase requires users to confirm their email before their first login. If you want people to land straight in the app after registering, turn this off in **Authentication → Providers → Email → Confirm email**. The app handles both cases: with confirmation on, it tells them to check their email; with it off, registration signs them straight in.

## 4. Serve it as an actual PWA
Browsers only install PWAs served over **HTTPS** (or `localhost` for local testing) — opening `index.html` via `file://` will not register the service worker. Deploy the whole folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages) with `index.html` at the root.

To test locally:
```
npx serve .
# or
python3 -m http.server 8080
```
then open `http://localhost:PORT`.

## 5. What's wired up
- **Splash screen** — pure black background, transparent logo, shown for exactly **2.5 seconds** before routing automatically to Login or Home.
- **Auth** — Supabase email/password, with a Log In ⇄ Create Account toggle on one screen. Session persists via `supabase-js`, so refresh/reopen keeps the user logged in until they tap **Log Out**.
- **Personalized greeting** — the Home screen shows *"Welcome, [First Name]!"* using the `full_name` stored in the `profiles` table — never the email.
- **Logout** — a button in the top-right of the Home screen and another at the bottom of the Profile screen. Both sign out of Supabase and return to the Login screen.
- **Header branding** — displays as **Appearich** (not all-caps).
- **Local-first data** (`js/db.js`) — every order and the user's profile are cached in `localStorage` immediately, then pushed to Supabase. If offline, writes are queued and retried automatically on the next `online` event.
- **Installable** — `manifest.json` + `service-worker.js` cache the app shell for offline load, and a custom "Install Appearich" banner appears when the browser's `beforeinstallprompt` fires (Android/desktop Chrome/Edge). iOS Safari installs via **Share → Add to Home Screen**.

## File map
```
index.html               splash + auth + app screens (all one page)
manifest.json             PWA manifest
service-worker.js         offline caching, app-shell strategy
offline.html               fallback page for uncached navigations
supabase-schema.sql        run once in Supabase SQL editor
css/style.css               all styling (theme + splash + auth + app)
js/supabase-client.js       Supabase connection (URL + anon key)
js/db.js                    localStorage cache + Supabase sync + offline queue
js/auth.js                  splash timing, session check, login/register/logout
js/app.js                   screens, orders, install prompt, DOM wiring
icons/                      PWA icons — replace placeholders with your real logo-based ones
images/                     put your image assets here
```
