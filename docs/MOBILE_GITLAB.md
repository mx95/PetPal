# PetPal mobile apps — separate GitLab repos

The **web server only serves** `petpal/build/` (the React SPA). It does **not** serve `mobile-android/` or `mobile-ios/`.

Those folders were removed from the main PetPal repo so your Hetzner server does not store Gradle/Xcode projects, duplicate JS bundles, or `.aab` files.

Mobile apps live in **two separate GitLab repositories** that you create once and build on your PC or in GitLab CI.

---

## 1. Create the two GitLab repos

On GitLab, create empty projects (no README):

| GitLab project | Purpose |
|----------------|---------|
| `petpal-android` | Google Play (Capacitor Android) |
| `petpal-ios` | App Store (Capacitor iOS) |

---

## 2. Export mobile code from PetPal (one-time)

On your PC, from the PetPal repo **before or after** mobile folders were removed from `main`:

```bash
cd PetPal
bash scripts/export-mobile-repos.sh
```

This writes:

- `../petpal-android/` — ready to push to GitLab
- `../petpal-ios/` — ready to push to GitLab

If mobile folders are already deleted from `main`, the script uses the last git commit that still had them.

Push each to GitLab:

```bash
cd ../petpal-android
git init
git add .
git commit -m "Initial PetPal Android app"
git remote add origin git@gitlab.com:YOUR_GROUP/petpal-android.git
git push -u origin main

cd ../petpal-ios
git init
git add .
git commit -m "Initial PetPal iOS app"
git remote add origin git@gitlab.com:YOUR_GROUP/petpal-ios.git
git push -u origin main
```

---

## 3. How mobile repos get the web app

Mobile apps wrap the same React UI. Before each native build:

```bash
# Layout on your machine:
#   PetPal/          ← main web + tracker repo (GitHub or GitLab)
#   petpal-android/  ← GitLab android repo (sibling folder)

cd petpal-android
export PETPAL_WEB_DIR=../PetPal/petpal   # path to web app source
./scripts/sync-petpal-web.sh
./scripts/build-release.sh               # Android AAB
```

`sync-petpal-web.sh`:

1. Runs `npm run build:mobile:web` in the PetPal web app (relative asset paths for WebView)
2. Copies `build/` into the native project (`web-app/` or Capacitor `webDir`)
3. Runs `npx cap sync`

Set production Firebase / tracker URLs in `PetPal/petpal/.env.production.local` **before** syncing.

---

## 4. Server deploy — mobile is not used

`scripts/deploy-server.sh` only runs:

```bash
cd petpal && npm run build
```

The tracker serves **`petpal/build`** on port 5002. After each deploy it also **deletes** any leftover `mobile-android/` / `mobile-ios/` directories so a full `git pull` does not keep extra data on disk.

---

## 5. How to test the mobile apps

### Android (Windows, macOS, or Linux)

**Prerequisites:** Android Studio, JDK 17+, Android SDK (`ANDROID_HOME`).

```bash
cd petpal-android
export PETPAL_WEB_DIR=../PetPal/petpal
./scripts/sync-petpal-web.sh

# Open in Android Studio
studio .   # or File → Open → petpal-android folder

# Run on emulator or USB device: green Play button
```

**Debug APK without Play Store:**

```bash
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Release AAB (Play Store):**

```bash
./scripts/build-release.sh
# Output: releases/petpal-1.0.0-release.aab
```

**What to verify:**

- [ ] App opens (no white screen)
- [ ] Login / Firebase auth works
- [ ] Tracker map loads (needs `REACT_APP_XEXUN_HTTP_BASE_URL` pointing at your server **with HTTPS** for full features)
- [ ] Scan IMEI (camera permission) on My Pets
- [ ] Bottom navigation works

Point the web build at your live server in `petpal/.env.production.local`:

```env
REACT_APP_XEXUN_HTTP_BASE_URL=https://your-domain.com:5002
# or same-origin if you proxy API through HTTPS
```

Then re-run `sync-petpal-web.sh` and rebuild.

---

### iOS (macOS only)

**Prerequisites:** Xcode, CocoaPods (`sudo gem install cocoapods`).

```bash
cd petpal-ios
export PETPAL_WEB_DIR=../PetPal/petpal
./scripts/sync-petpal-web.sh

cd App
pod install
open App.xcworkspace
```

In Xcode:

1. Select your **Team** under Signing & Capabilities
2. Choose an **iPhone simulator** or a plugged-in device
3. Press **Run** (▶)

**TestFlight / App Store:** Product → Archive → Distribute to App Store Connect.

**What to verify:** same checklist as Android.

---

### Quick test without native projects (sanity check)

The mobile app **is** the web app in a WebView. You can confirm behaviour in Chrome on your phone:

1. Open `https://your-petpal-domain` in mobile Safari/Chrome
2. If that works, the Capacitor build will work once synced with the same env vars

---

## 6. GitLab CI (optional)

**Android** — `.gitlab-ci.yml` in `petpal-android` (needs Android SDK runner or Docker image):

```yaml
stages: [build]
android-release:
  stage: build
  image: mingc/android-build-box:latest
  script:
    - export PETPAL_WEB_DIR=$CI_PROJECT_DIR/../PetPal/petpal
    - ./scripts/sync-petpal-web.sh
    - ./scripts/build-release.sh
  artifacts:
    paths: [releases/*.aab]
```

Use a **multi-project pipeline** or clone the web repo in `before_script` if repos are not siblings on the runner:

```yaml
before_script:
  - git clone --depth 1 https://gitlab.com/YOUR_GROUP/PetPal.git ../PetPal
  - export PETPAL_WEB_DIR=../PetPal/petpal
```

**iOS** — requires a **macOS GitLab runner** with Xcode; most teams archive locally or use TestFlight from a Mac.

---

## 7. Repo layout summary

```
GitLab: petpal-android/     GitLab: petpal-ios/
├── app/                    ├── App/
├── scripts/                ├── scripts/
│   ├── sync-petpal-web.sh  │   ├── sync-petpal-web.sh
│   └── build-release.sh    │   └── build-release.sh
├── signing/                └── releases/
└── releases/

GitHub/GitLab: PetPal/      ← main repo (web + tracker only)
├── petpal/                 ← served by server as petpal/build
├── tracker-tcp-server/
└── scripts/deploy-server.sh
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| White screen in app | Re-run `sync-petpal-web.sh`; web build must use `PUBLIC_URL=.` |
| Server disk full of mobile files | Deploy latest `deploy-server.sh` — it removes mobile folders after pull |
| Camera scan fails | Grant camera permission; use HTTPS backend |
| Tracker map empty on phone | Set `REACT_APP_XEXUN_HTTP_BASE_URL` to your live API URL before sync |
