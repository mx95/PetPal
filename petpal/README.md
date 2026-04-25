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

## GPS tracking (Traccar — “many cheap devices”)

PetPal is wired for **[Traccar](https://www.traccar.org/)** on the default REST endpoint: `GET /api/positions?deviceId=…`  
If you do **not** set the env vars below, the **Tracker** screen uses a **mock** point so you can build the rest of the app without hardware.

Add to `petpal/.env.local` when your Traccar server is available:

| Variable | Purpose |
| --- | --- |
| `REACT_APP_TRACCAR_BASE_URL` | Full URL, e.g. `https://traccar.example.com`, **or** `same` to call `/api/...` on the same origin (use with a dev proxy). |
| `REACT_APP_TRACCAR_USER` / `REACT_APP_TRACCAR_PASS` | Optional **HTTP Basic** auth if you front Traccar with a username and password. |

**CORS / browser access:** the React app in the browser must be allowed to call your Traccar host. Common approaches: run Traccar behind the same domain as the app, enable CORS on your reverse proxy, or use Create React App’s `package.json` [`proxy`](https://create-react-app.dev/docs/proxying-api-requests-in-development/) in development so `/api` goes to your local Traccar port.

**Flow:** add any cellular GPS hardware Traccar supports, note the **device id** in the Traccar UI, then open the in-app **Tracker** page and paste that id.

The **Tracker** page also shows a **map** (Leaflet + OpenStreetMap) after a position loads.

## Optional: backend for Traccar (BFF)

For production, prefer a small backend (e.g. **Firebase Cloud Functions**, Cloud Run, or a tiny Node server) that:

- holds Traccar **credentials** and any API keys
- returns a normalized JSON position to the app (no CORS pain)

Set:

| Variable | Purpose |
| --- | --- |
| `REACT_APP_TRACKING_BFF_URL` | Base URL, e.g. `https://europe-west1-xxx.cloudfunctions.net/tracking` — the app will call `GET {base}/position?deviceId=…` |
| `REACT_APP_TRACKING_BFF_TOKEN` | Optional `Authorization: Bearer …` for your function |

**Expected response** (JSON), either:

- `{ "lat": number, "lng": number, "speed"?: number, "address"?: string, "deviceTime"?: string, "serverTime"?: string }`, or
- Traccar-style `latitude` / `longitude` fields (also accepted).

`REACT_APP_TRACKING_BFF_URL` **takes priority** over direct Traccar and over mock data.

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

- **Option A (quick)**: `firebase functions:config:set traccar.base_url=\"https://traccar.example.com\" traccar.user=\"...\" traccar.pass=\"...\" petpal.token=\"...\"`
- **Option B (recommended)**: use Google Cloud Secret Manager and load via runtime env

This function reads these runtime env vars:

- `TRACCAR_BASE_URL` (**required**)
- `TRACCAR_USER` / `TRACCAR_PASS` (optional)
- `PETPAL_BFF_TOKEN` (optional)

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
