# lynx on iOS (Capacitor → TestFlight)

lynx is a server-rendered Next.js app, so the native iOS app is a thin Capacitor
shell that **loads lynx from a URL** (it does not bundle the site offline):

- **Simulator / local device:** loads `http://localhost:3000` (your dev server).
- **TestFlight / App Store:** loads your **deployed HTTPS URL** (set `CAP_SERVER_URL`).

The Xcode project lives in `ios/`. Capacitor 8 uses **Swift Package Manager**, so
**no CocoaPods is needed** — Xcode resolves dependencies automatically.

---

## One-time prerequisites (on your Mac)

1. **Install Xcode** from the Mac App Store (~15 GB), then open it once to install
   components. Confirm with: `xcodebuild -version`.
2. Point the command-line tools at Xcode:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. An **Apple Developer account** ($99/yr) for TestFlight/App Store. A free account
   can run on the simulator and your own device, but **not** TestFlight.

---

## Run it in the simulator (against your dev server)

```sh
npm run dev            # start the web app on :3000 (keep running)
npm run cap:sync       # copy config + assets into the iOS project
npm run ios:open       # open ios/App in Xcode
```

In Xcode: pick an iPhone simulator (or your device) → press ▶ Run.
The app launches and loads lynx from `localhost:3000`. Sign in and use it like the app.

> If a blank/white screen appears, the dev server isn't running or `localhost:3000`
> isn't reachable — start `npm run dev` and re-run.

---

## Sideload onto your own iPhone (free — no App Store, no $99)

Sideloading = build in Xcode and install directly on your device with a **free
Apple ID**. The app runs for **7 days**, then re-run from Xcode to renew (a paid
Apple Developer account makes it last 1 year).

**Pick where the app loads from:**

- **Home / same Wi-Fi (no deployment):** point it at this Mac's dev server.
  ```sh
  npm run dev                                       # keep running
  CAP_SERVER_URL=http://10.0.0.183:3000 npm run cap:sync
  ```
  Works only while your iPhone is on the same Wi-Fi and `npm run dev` is running.
  (10.0.0.183 is this Mac's current LAN IP — re-check with `ipconfig getifaddr en0`
  if your network changes.)

- **Anywhere (recommended):** deploy once (see below), then:
  ```sh
  CAP_SERVER_URL=https://YOUR-APP.vercel.app npm run cap:sync
  ```
  Now the app works on cellular, away from home, with no Mac needed.

**Then install on the device:**

1. Connect your iPhone to the Mac (USB the first time; later Wi-Fi works).
2. `npm run ios:open` → in Xcode, select your iPhone as the run destination.
3. Target **App → Signing & Capabilities** → **Team** → "Add an Account…", sign in
   with your **free Apple ID** (it becomes a "Personal Team"). Xcode auto-generates
   a signing profile. If the bundle id `com.lynx.app` is taken, change `appId` in
   `capacitor.config.ts` to something unique (e.g. `com.<yourname>.lynx`) and re-run
   `npm run cap:sync`.
4. Press ▶ Run. Xcode builds, signs, and installs lynx on your phone.
5. On the iPhone: **Settings → General → VPN & Device Management** → tap your Apple ID
   → **Trust**. Now launch lynx from the home screen.

> Reminder: with a free Apple ID the app stops opening after 7 days — just plug in and
> press Run again to renew. A paid account (or TestFlight) avoids the weekly renew.

---

## Ship a TestFlight beta (needs a deployment)

1. **Deploy the web app** somewhere with HTTPS (Vercel is easiest for Next.js).
   Set the env vars there: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `GEMINI_API_KEY` (and `SUPABASE_DB_URL` is **not** needed at runtime). Also add the
   production URL to **Google Cloud OAuth** redirect + **Supabase → Auth → URL
   Configuration** redirect list, so Google login works in the app.

2. **Point the app at production** and sync:
   ```sh
   CAP_SERVER_URL=https://YOUR-APP.vercel.app npm run cap:sync
   ```
   (This also removes the cleartext exception, since the URL is HTTPS.)

3. **Set your bundle id + signing** in `capacitor.config.ts` (`appId`) and in Xcode:
   - Change `appId` from `com.lynx.app` to your own reverse-domain id, re-run `cap:sync`.
   - In Xcode → target **App** → **Signing & Capabilities** → select your Team; Xcode
     registers the App ID automatically.

4. **Archive & upload:**
   - Xcode → set the run destination to **Any iOS Device (arm64)**.
   - **Product → Archive** → when it finishes, **Distribute App → TestFlight (App Store
     Connect)** → upload.
   - In **App Store Connect → TestFlight**, add testers (internal testers install via the
     TestFlight app). First external testing requires a short Beta App Review.

---

## Notes & gotchas

- **Bundle id** must match an App ID in your Apple Developer account (Xcode auto-creates
  it when you pick a Team). Change `appId` before archiving.
- **`MARKETING_VERSION` / build number:** bump the build number in Xcode for each
  TestFlight upload.
- Re-run `npm run cap:sync` after changing `capacitor.config.ts` or app icons
  (`resources/icon.png` → `npx capacitor-assets generate --ios`).
- Reminders push notifications (a later phase) will need the Apple Push Notification
  capability added in Xcode + APNs setup — not required for the basic beta.
