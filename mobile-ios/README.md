# PetPal — iOS (App Store)

Capacitor wrapper for the PetPal React web app. Submit via **Xcode Archive** → **TestFlight** → **App Store Connect**.

| Field | Value |
|-------|--------|
| **Bundle ID** | `io.petpal.app` |
| **App name** | PetPal |
| **Version** | 1.0 (build 1) |
| **Min iOS** | 13.0 (Capacitor 6 default) |

> **Requires macOS** with Xcode. iOS apps cannot be built or archived on Windows.

---

## Quick start — App Store submission

### 1. Apple Developer account

- Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
- Create an **App ID** for `io.petpal.app` in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).

### 2. Prepare the web bundle

On any machine with Node 22:

```bash
cd petpal
npm ci
npm run build:mobile
```

This syncs the production SPA into `mobile-ios/App/App/public/`.

### 3. Install CocoaPods (macOS)

```bash
cd mobile-ios/App
pod install
```

Open **`App.xcworkspace`** (not `.xcodeproj`):

```bash
open App.xcworkspace
```

Or from `petpal/`: `npm run cap:open:ios`

### 4. Xcode signing

1. Select the **App** target → **Signing & Capabilities**.
2. Choose your **Team** (Apple Developer account).
3. Enable **Automatically manage signing**.
4. Confirm bundle identifier: `io.petpal.app`.

### 5. Archive & upload

1. Select **Any iOS Device (arm64)** as destination.
2. **Product → Archive**.
3. In **Organizer** → **Distribute App** → **App Store Connect** → Upload.
4. In [App Store Connect](https://appstoreconnect.apple.com/) → **TestFlight** → add testers → submit for **App Review**.

Pre-built `.ipa` files are **not** committed (must be signed with your Apple Team). Use the steps above or CI below.

---

## Build script (macOS)

```bash
cd mobile-ios
./scripts/build-release.sh
```

Exports an archive to `releases/` when run on a Mac with Xcode and valid signing.

---

## Firebase & backend config

Set production env before `npm run build:mobile` in `petpal/.env.production.local`:

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=petpal-aecda
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_XEXUN_HTTP_BASE_URL=https://YOUR_TRACKER_HOST:5002
```

**Optional native Firebase:**

1. Add iOS app in Firebase Console (bundle `io.petpal.app`).
2. Download `GoogleService-Info.plist` → `mobile-ios/App/App/GoogleService-Info.plist`.
3. Rebuild in Xcode.

---

## Privacy strings (Info.plist)

Already configured in `App/App/Info.plist`:

| Key | Purpose |
|-----|---------|
| `NSCameraUsageDescription` | Scan tracker IMEI QR / barcodes |
| `NSLocationWhenInUseUsageDescription` | Maps, nearby places, walks |

Match these in **App Store Connect → App Privacy**.

You also need a **public privacy policy URL** for App Review.

---

## Icons & splash

| Asset | Path |
|-------|------|
| App icon (1024×1024) | `App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |
| Splash | `App/App/Assets.xcassets/Splash.imageset/` |

Replace with final marketing artwork before release.

---

## Version bumps

In Xcode → **App** target → **General**:

- **Version** — user-visible (e.g. `1.0.1`)
- **Build** — must increase every upload (e.g. `2`)

Or edit `App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`).

---

## Project layout

```
mobile-ios/
├── README.md                 ← this file
├── App/
│   ├── App.xcworkspace       ← open this in Xcode
│   ├── App.xcodeproj
│   ├── Podfile
│   └── App/
│       ├── AppDelegate.swift
│       ├── Info.plist
│       ├── Assets.xcassets/
│       └── public/           ← synced web app (Capacitor)
├── releases/                 ← export .ipa / archive notes (macOS builds)
└── scripts/
    └── build-release.sh
```

Web source: `petpal/`. Capacitor: `petpal/capacitor.config.json` → `"ios": { "path": "../mobile-ios" }`.

---

## CI (GitHub Actions)

Workflow **Build iOS Release** (`.github/workflows/build-ios-release.yml`) runs on `macos-latest`, builds an unsigned archive for verification, and documents export steps. **App Store upload still requires your Apple signing certificates** (export via Xcode or `xcodebuild` with match/fastlane).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `pod: command not found` | `sudo gem install cocoapods` |
| Signing errors | Set Team in Xcode; create App ID in Developer portal |
| White screen | Re-run `npm run build:mobile` from `petpal/` |
| Camera not working | Check `NSCameraUsageDescription` in Info.plist |

---

## Checklist before App Review

- [ ] Apple Developer account active
- [ ] App Store Connect app record created
- [ ] Screenshots (6.7", 6.5", iPad if supported)
- [ ] Privacy policy URL
- [ ] App Privacy questionnaire completed
- [ ] TestFlight smoke test on real device
- [ ] Production Firebase / tracker URLs in build env
