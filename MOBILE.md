# PetPal mobile apps

Native Android and iOS wrappers for the PetPal web app ([Capacitor 6](https://capacitorjs.com/)).

| Store | Directory | Release artifact |
|-------|-----------|------------------|
| **Google Play** | [`mobile-android/`](mobile-android/) | `mobile-android/releases/petpal-1.0.0-release.aab` |
| **Apple App Store** | [`mobile-ios/`](mobile-ios/) | Build on macOS (see README) |

## Build everything

```bash
cd petpal
npm ci
npm run build:mobile
```

## Submit to stores

- **Android:** Read [`mobile-android/README.md`](mobile-android/README.md) — upload the `.aab` to Play Console.
- **iOS:** Read [`mobile-ios/README.md`](mobile-ios/README.md) — archive in Xcode on a Mac.

## CI

- [Build Android Release](.github/workflows/build-android-release.yml) — builds signed AAB on Ubuntu, commits to `mobile-android/releases/`.
- [Build iOS Release](.github/workflows/build-ios-release.yml) — verifies Xcode build on macOS (App Store export needs your Apple Team).

Web app source: [`petpal/`](petpal/)
