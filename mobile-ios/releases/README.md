# iOS release artifacts

`.ipa` files are **not** stored in git — Apple code signing is tied to your Developer Team.

Build on macOS:

```bash
cd mobile-ios
./scripts/build-release.sh
```

Then export via Xcode Organizer (see `EXPORT_INSTRUCTIONS.md` after archiving).

See [../README.md](../README.md) for the full App Store checklist.
