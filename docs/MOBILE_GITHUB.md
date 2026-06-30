# PetPal mobile apps — GitHub repos

Android and iOS Capacitor wrappers live in **separate private GitHub repos** (not in the main PetPal server deploy).

| Repo | Purpose |
|------|---------|
| [mx95/petpal-android](https://github.com/mx95/petpal-android) | Google Play / sideload APK |
| [mx95/petpal-ios](https://github.com/mx95/petpal-ios) | App Store (build on macOS) |

The web server only serves `petpal/build/` — it never loads these native projects.

---

## How to update Android and iOS

Most updates are **web/UI changes only**. You change the React app in `PetPal`, then refresh the native wrappers.

```
PetPal (web)     →  push to main     →  live website updates (server deploy)
       ↓
petpal-android   →  sync + push      →  new test APK (GitHub Actions)
petpal-ios       →  sync + Xcode     →  TestFlight / App Store (Mac only)
```

### Step 1 — Update the web app (PetPal)

```powershell
cd PetPal
# edit files in petpal/
git add .
git commit -m "Your change"
git push origin main
```

If the change needs production Firebase or tracker URLs, set them **before** syncing mobile builds:

`PetPal/petpal/.env.production.local`

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=petpal-aecda
REACT_APP_XEXUN_HTTP_BASE_URL=https://YOUR_HOST:5002
```

---

### Step 2 — Update Android

**Easiest (CI builds the APK):**

```powershell
cd petpal-android
$env:PETPAL_WEB_DIR = "../PetPal/petpal"
node scripts/sync-petpal-web.cjs
git add web-app app/src/main/assets/public
git commit -m "Sync web build from PetPal"
git push origin main
```

GitHub Actions rebuilds the debug APK and publishes it to
[Releases → debug-latest](https://github.com/mx95/petpal-android/releases/tag/debug-latest).

**Local build (optional — needs Android Studio + SDK):**

```powershell
node scripts/sync-petpal-web.cjs
.\gradlew.bat assembleDebug
# APK: app\build\outputs\apk\debug\app-debug.apk
```

**Google Play release (`.aab`):**

```powershell
.\scripts\build-release.ps1
# Output: releases/petpal-1.0.0-release.aab → upload in Play Console
```

---

### Step 3 — Update iOS (Mac only)

```bash
cd petpal-ios
export PETPAL_WEB_DIR=../PetPal/petpal
./scripts/sync-petpal-web.sh
cd App && pod install && open App.xcworkspace
```

In Xcode: choose a simulator or device → **Run**.

For App Store / TestFlight: **Product → Archive → Distribute**.

There is no iOS CI yet — builds must be done on a Mac.

---

### When to bump version numbers

Only required for **store uploads** (not for sideload debug APK testing).

| Platform | File | Fields |
|----------|------|--------|
| **Android** | `petpal-android/app/build.gradle` | `versionCode` (integer, must increase every Play upload), `versionName` (e.g. `"1.0.1"`) |
| **iOS** | `petpal-ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (user-visible), `CURRENT_PROJECT_VERSION` (build number) |

Example Android bump:

```gradle
versionCode 2        // was 1
versionName "1.0.1"  // was "1.0"
```

Then sync web assets again, rebuild, and upload to the store.

---

### Release checklist

1. Push web changes to `mx95/PetPal` (website deploys automatically).
2. In `petpal-android`: run `node scripts/sync-petpal-web.cjs` → commit → push (APK rebuilds via CI).
3. On a Mac: in `petpal-ios`, run `./scripts/sync-petpal-web.sh` → archive in Xcode.
4. For store releases: bump version numbers first, then rebuild and upload.

---

## Test Android APK (no Android Studio)

1. Open [petpal-android → Releases → debug-latest](https://github.com/mx95/petpal-android/releases/tag/debug-latest)
2. Download `app-debug.apk`
3. Install on your phone (allow “Install unknown apps” for your file manager)

---

## Local folder layout

```
Desktop/Projects/
├── PetPal/           ← main repo (web + tracker)
├── petpal-android/   ← clone of mx95/petpal-android
└── petpal-ios/       ← clone of mx95/petpal-ios
```

---

## First-time export (if repos need recreating)

```powershell
cd PetPal
.\scripts\export-mobile-repos.ps1 3031e22
# Then copy CI workflow + package.json from mx95/petpal-android before pushing.
```

See also `docs/MOBILE_GITLAB.md` if you prefer GitLab remotes instead of GitHub.
