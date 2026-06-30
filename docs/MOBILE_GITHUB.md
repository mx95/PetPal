# PetPal mobile apps — GitHub repos

Android and iOS Capacitor wrappers live in **separate private GitHub repos** (not in the main PetPal server deploy).

| Repo | Purpose |
|------|---------|
| [mx95/petpal-android](https://github.com/mx95/petpal-android) | Google Play / sideload APK |
| [mx95/petpal-ios](https://github.com/mx95/petpal-ios) | App Store (build on macOS) |

The web server only serves `petpal/build/` — it never loads these native projects.

---

## Test Android APK (no Android Studio)

1. Open [petpal-android → Releases → debug-latest](https://github.com/mx95/petpal-android/releases/tag/debug-latest)
2. Download `app-debug.apk`
3. Install on your phone (allow “Install unknown apps” for your file manager)

CI rebuilds the APK on every push to `petpal-android` `main` (includes latest web app from `mx95/PetPal`).

---

## Local layout

```
Desktop/Projects/
├── PetPal/           ← main repo (web + tracker)
├── petpal-android/   ← clone of mx95/petpal-android
└── petpal-ios/       ← clone of mx95/petpal-ios
```

## Sync web changes into Android

```powershell
cd petpal-android
$env:PETPAL_WEB_DIR = "../PetPal/petpal"
node scripts/sync-petpal-web.cjs
npx cap sync android
git add web-app app/src/main/assets
git commit -m "Sync web build"
git push
```

---

## First-time export (if repos need recreating)

```powershell
cd PetPal
.\scripts\export-mobile-repos.ps1 3031e22
# Then copy CI workflow + package.json from mx95/petpal-android before pushing.
```

See also `docs/MOBILE_GITLAB.md` if you prefer GitLab remotes instead of GitHub.
