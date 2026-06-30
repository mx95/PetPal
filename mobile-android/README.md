# PetPal — Android (Google Play)

Capacitor wrapper for the PetPal React web app. Upload the release **App Bundle** (`.aab`) from `releases/` to [Google Play Console](https://play.google.com/console).

| Field | Value |
|-------|--------|
| **Package name** | `io.petpal.app` |
| **App name** | PetPal |
| **Version** | 1.0 (`versionCode` 1) |
| **Min SDK** | 22 (Android 5.1) |
| **Target SDK** | 34 |

---

## Quick start — upload to Play Store

1. Open [Google Play Console](https://play.google.com/console) → **Create app**.
2. Complete **Store listing**, **Content rating**, **Data safety**, and **Privacy policy** (host your policy at a public HTTPS URL).
3. Go to **Release → Production → Create new release**.
4. Upload:

   ```
   mobile-android/releases/petpal-1.0.0-release.aab
   ```

5. Enroll in **Play App Signing** when prompted (recommended).
6. Submit for review.

If `releases/` has no `.aab` yet, run the [**Build Android Release**](../../.github/workflows/build-android-release.yml) GitHub Action (or build locally — below).

---

## Pre-built bundle

| File | Description |
|------|-------------|
| `releases/petpal-1.0.0-release.aab` | Signed release bundle for Play Store |

Built by GitHub Actions (or `scripts/build-release.ps1` / `build-release.sh` locally).

### Upload keystore (for future updates)

The bundle is signed with the **upload keystore** in `signing/`. You need the **same keystore** to publish updates to the same Play listing.

| Item | Location |
|------|----------|
| Keystore file | `signing/petpal-upload.keystore` |
| Alias | `petpal-upload` |
| Store / key password | See `signing/UPLOAD_KEY_CREDENTIALS.md` |

> **Security:** Treat the keystore like a password. For production, consider generating a new upload key and using Play App Signing key reset if this repo is public.

---

## Build locally (Windows / macOS / Linux)

### Prerequisites

- [Node.js 22](https://nodejs.org/) (matches `petpal/package.json`)
- [JDK 17 or 21](https://adoptium.net/)
- [Android Studio](https://developer.android.com/studio) (installs Android SDK)

### 1. Configure Android SDK

Set `ANDROID_HOME` (or create `local.properties`):

**Windows (`local.properties`):**
```properties
sdk.dir=C\:\\Users\\YOUR_USER\\AppData\\Local\\Android\\Sdk
```

**macOS / Linux:**
```properties
sdk.dir=/Users/YOUR_USER/Library/Android/sdk
```

Copy from example:
```bash
cp local.properties.example local.properties
# edit sdk.dir
```

### 2. Build web app + sync Capacitor

From repo root:

```bash
cd petpal
npm ci
npm run build:mobile
```

This builds the SPA with relative asset paths (`PUBLIC_URL=.`) and copies it into `mobile-android/app/src/main/assets/public/`.

### 3. Sign release (first time only)

```bash
cd mobile-android
cp signing/keystore.properties.example signing/keystore.properties
# Edit passwords, or use the committed keystore + signing/UPLOAD_KEY_CREDENTIALS.md
```

See [signing/README.md](signing/README.md) to generate a new keystore.

### 4. Build App Bundle

**Windows:**
```powershell
cd mobile-android
.\scripts\build-release.ps1
```

**macOS / Linux:**
```bash
cd mobile-android
./scripts/build-release.sh
```

Output: `releases/petpal-1.0.0-release.aab`

**Alternative — Android Studio:** Open `mobile-android/` → **Build → Generate Signed Bundle / APK**.

---

## Firebase & backend config

The web app reads Firebase from build-time env. For a store build pointing at production:

1. Create `petpal/.env.production.local` (or set CI secrets) with:

   ```env
   REACT_APP_FIREBASE_API_KEY=...
   REACT_APP_FIREBASE_AUTH_DOMAIN=...
   REACT_APP_FIREBASE_PROJECT_ID=petpal-aecda
   REACT_APP_FIREBASE_STORAGE_BUCKET=...
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
   REACT_APP_FIREBASE_APP_ID=...
   REACT_APP_XEXUN_HTTP_BASE_URL=https://YOUR_TRACKER_HOST:5002
   ```

2. Re-run `npm run build:mobile` before rebuilding the AAB.

**Optional native Firebase** (push, etc.):

- Download `google-services.json` from Firebase Console → Android app (`io.petpal.app`)
- Place at `mobile-android/app/google-services.json`
- Rebuild

---

## Permissions (already declared)

| Permission | Purpose |
|------------|---------|
| `INTERNET` | App API, Firebase, maps |
| `CAMERA` | Scan tracker IMEI QR / barcodes |
| `ACCESS_FINE_LOCATION` | Maps, nearby places, walk tracking |

Declare the same uses in **Play Console → Data safety**.

---

## Version bumps

Edit `mobile-android/app/build.gradle`:

```gradle
versionCode 2        // integer, must increase every upload
versionName "1.0.1"  // user-visible version
```

Then rebuild and upload a new AAB.

---

## Project layout

```
mobile-android/
├── README.md                 ← this file
├── app/                      ← Android app module (Capacitor)
├── releases/                 ← signed .aab for Play Store
├── scripts/
│   ├── build-release.ps1
│   └── build-release.sh
├── signing/                  ← upload keystore + properties
├── local.properties.example
└── gradlew / gradlew.bat
```

Web source lives in `petpal/`. Capacitor config: `petpal/capacitor.config.json` → `"android": { "path": "../mobile-android" }`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `SDK location not found` | Set `sdk.dir` in `local.properties` |
| White screen on launch | Rebuild with `npm run build:mobile` (needs `PUBLIC_URL=.`) |
| Camera scan fails | Grant camera permission; use HTTPS backend |
| Gradle / JDK errors | Use JDK 17–21; run `.\gradlew.bat --version` |

---

## CI

GitHub Actions workflow **Build Android Release** (`.github/workflows/build-android-release.yml`) builds and commits the AAB to `releases/` on demand or when mobile sources change.
