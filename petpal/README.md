# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## PetPal auth (Firebase)

This app uses **Firebase Authentication** (email/password) as the cheapest/lowest-ops login approach.

### Setup steps

- Create a Firebase project.
- Enable **Authentication → Sign-in method → Email/Password**.
- Add a Web App in Firebase settings and copy the config values.
- Create a local env file `petpal/.env.local` with:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

Then run:

### `yarn start`

Open `http://localhost:3000`.

## Native apps (Android & iOS — Capacitor)

The web UI is wrapped with [Capacitor](https://capacitorjs.com/) so the same production bundle can ship in the Google Play Store and App Store.

- **Config:** `petpal/capacitor.config.json` — `appId` is `io.petpal.app` (change this before a public release). `webDir` is `build`.
- **`homepage`:** `package.json` sets `"homepage": "."` so JS/CSS load correctly inside the native WebView. Keep it for mobile builds; use a subpath only if you maintain a separate web deploy config.

**Typical workflow**

1. `npm run build` — Create React App output in `build/`.
2. `npm run cap:sync` (or `npm run build:mobile` to do both) — copies assets into `android/` and `ios/`.
3. **Android:** Install [Android Studio](https://developer.android.com/studio), a JDK (e.g. 17), and ensure `JAVA_HOME` is set. Run `npm run cap:open:android`, then build or run on a device/emulator from Android Studio.
4. **iOS (macOS):** Install Xcode and CocoaPods. From `petpal/ios/App` run `pod install` if pods are not installed yet. Open `petpal/ios/App/App.xcworkspace` in Xcode (or `npm run cap:open:ios`), then run on a simulator or archive for TestFlight/App Store.

Add **Firebase** `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) when you use native Firebase features; configure **OAuth redirect URLs** and **App Links / Universal Links** if you use third-party sign-in.

## GPS tracking (PetPal vendor)

PetPal can load live positions from:

- **Xexun ingest** (`tracker-tcp-server`) via `REACT_APP_XEXUN_HTTP_BASE_URL` (the web app calls `/api/app/*`)
- An optional **PetPal vendor REST** endpoint (common GPS-platform REST shape) via `REACT_APP_PETPAL_VENDOR_BASE_URL`

If you do **not** set any tracking env vars, the **Tracker** screen uses a **mock** point so you can build the rest of the app without hardware.

Add to `petpal/.env.local` when your vendor server is available:

| Variable | Purpose |
| --- | --- |
| `REACT_APP_PETPAL_VENDOR_BASE_URL` | Full URL, e.g. `https://vendor.example.com`, **or** `same` to call `/api/...` on the same origin (use with a dev proxy). |
| `REACT_APP_PETPAL_VENDOR_USER` / `REACT_APP_PETPAL_VENDOR_PASS` | Optional **HTTP Basic** auth if your vendor endpoint requires it. |

The **Tracker** page also shows a **map** (Leaflet + OpenStreetMap by default) after a position loads.

### Tracking setup (Wi‑Fi, HTTPS, deploy)

**Read [`../docs/TRACKING_SETUP.md`](../docs/TRACKING_SETUP.md)** for:

- **HTTP vs HTTPS** — Wi‑Fi / Device tab / one-tap home are **off on `http://`** (browser geolocation needs HTTPS)
- **`REACT_APP_TRACKING_WIFI_ENABLED`** — when to set `1` after you add HTTPS
- **`REACT_APP_XEXUN_HTTP_BASE_URL=same`** on the Hetzner server
- Deploy checklist (`npm run build` + `pm2 restart tracker` + hard refresh)
- Router BSSID vs map home (one tap, no address typing)

Quick env for production on the tracker host (`http://YOUR_IP:5002`):

```env
REACT_APP_XEXUN_HTTP_BASE_URL=same
REACT_APP_GOOGLE_MAPS_API_KEY=your-key
# Optional: REACT_APP_TRACKING_MAP=osm  — force OpenStreetMap on tracker instead of Google
# Wi‑Fi off on http:// by default — do not set REACT_APP_TRACKING_WIFI_ENABLED=1 until HTTPS
```

## Tracker backend API use cases

The tracker backend (`tracker-tcp-server`) exposes two API groups. Keep them separate:

- **App API (frontend-safe)**: `/api/app/*`
  - **Use this in the PetPal UI**
  - Backed by **SQLite**, so devices and history persist across restarts
  - Typical calls:
    - `GET /api/app/position?deviceId=<imei>` (map pin + summary)
    - `GET /api/app/devices` (admin list)
    - `GET /api/app/history?deviceId=<imei>&limit=…` (optional `from` / `to` ISO bounds for a full-day or multi-day trail, up to 20k points)

- **Tracker API (device commands)**: `/api/tracker/commands/*`
  - **Use this only for configuring the collar**
  - Commands are queued and delivered on the next TCP uplink
  - Typical calls:
    - `POST /api/tracker/commands/ip-transfer` (server switch)
    - `POST /api/tracker/commands/tracking` (upload schedule)
    - `GET /api/tracker/commands/pending/<imei>` (debug queue)

## Optional: tracking backend (BFF)

For production, prefer a small backend (e.g. **Firebase Cloud Functions**, Cloud Run, or a tiny Node server) that:

- holds vendor **credentials** and any API keys
- returns a normalized JSON position to the app (no CORS pain)

Set:

| Variable | Purpose |
| --- | --- |
| `REACT_APP_TRACKING_BFF_URL` | Base URL, e.g. `https://europe-west1-xxx.cloudfunctions.net/tracking` — the app will call `GET {base}/position?deviceId=…` |
| `REACT_APP_TRACKING_BFF_TOKEN` | Optional `Authorization: Bearer …` for your function |

**Expected response** (JSON), either:

- `{ "lat": number, "lng": number, "speed"?: number, "address"?: string, "deviceTime"?: string, "serverTime"?: string }`, or
- Vendor-style `latitude` / `longitude` fields (also accepted).

`REACT_APP_TRACKING_BFF_URL` **takes priority** over direct vendor calls and over mock data.

### Firebase Cloud Functions BFF (included)

This repo includes a minimal Cloud Function at `petpal/functions/index.js`:

- Function name: `tracking`
- Endpoint: `GET https://<region>-<project>.cloudfunctions.net/tracking/position?deviceId=…`
- Optional auth: `Authorization: Bearer <PETPAL_BFF_TOKEN>`

#### Deploy steps (one-time)

- Install Firebase CLI: `npm i -g firebase-tools`
- Login: `firebase login`
- From `petpal/`: `firebase init functions` (pick **JavaScript**, Node 18) and select your Firebase project

> If Firebase init creates files you don’t want, keep the existing `functions/index.js` and `functions/package.json`.

#### Configure secrets (recommended)

Set function env (choose one approach):

- **Option A (quick)**: `firebase functions:config:set vendor.base_url=\"https://vendor.example.com\" vendor.user=\"...\" vendor.pass=\"...\" petpal.token=\"...\"`
- **Option B (recommended)**: use Google Cloud Secret Manager and load via runtime env

This function reads these runtime env vars:

- `PETPAL_VENDOR_BASE_URL` (**required**)
- `PETPAL_VENDOR_USER` / `PETPAL_VENDOR_PASS` (optional)
- `PETPAL_BFF_TOKEN` (optional)

## Deployment (Hetzner / Ubuntu)

Typical flow after you commit locally:

- SSH to the server
- Pull latest code
- Rebuild the PetPal frontend (updates `petpal/build/`)
- Restart the `tracker` PM2 process (serves `/api/*` and the PetPal SPA)

Commands:

```bash
cd ~/PetPal
git pull

cd ~/PetPal/petpal
npm ci
npm run build

cd ~/PetPal/tracker-tcp-server
npm ci
pm2 restart tracker
pm2 logs tracker --lines 20
```

After restart, logs must show `[db] … position rows on disk`. If you see `PERSIST_TO_SQLITE=0` or `0 position rows` while you expect history, see `tracker-tcp-server/README.md` (PM2 database path).

**Tracking / Wi‑Fi / HTTPS:** see [`docs/TRACKING_SETUP.md`](../docs/TRACKING_SETUP.md) — Wi‑Fi Device tab is off on `http://`; rebuild with `REACT_APP_TRACKING_WIFI_ENABLED=1` only after HTTPS.

Notes:

- If you changed only frontend files, you can usually skip `npm ci` in `tracker-tcp-server`.
- If you changed only backend files, you can skip `npm ci` + `npm run build` in `petpal`.
- First-time PM2 setup: `cd tracker-tcp-server && pm2 start ecosystem.config.cjs && pm2 save`.

Then in `petpal/.env.local` set:

- `REACT_APP_TRACKING_BFF_URL=https://<region>-<project>.cloudfunctions.net/tracking`
- `REACT_APP_TRACKING_BFF_TOKEN=<same as PETPAL_BFF_TOKEN>`

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `yarn build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
