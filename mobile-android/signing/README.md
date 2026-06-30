# Release signing (Android)

PetPal release builds use a Java keystore in this folder.

## First-time setup

1. Copy the example properties file:

   ```bash
   cp signing/keystore.properties.example signing/keystore.properties
   ```

2. Generate an upload keystore (keep backups — you need the same key for Play Store updates):

   ```bash
   keytool -genkeypair -v \
     -storetype PKCS12 \
     -keystore signing/petpal-upload.keystore \
     -alias petpal-upload \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=PetPal, OU=Mobile, O=PetPal, L=Nicosia, ST=Cyprus, C=CY"
   ```

3. Edit `signing/keystore.properties` with your keystore passwords.

## Files that must stay private

| File | Commit to git? |
|------|----------------|
| `petpal-upload.keystore` | **No** — back up in 1Password / vault |
| `keystore.properties` | **No** |
| `keystore.properties.example` | Yes (template only) |

The pre-built `.aab` in `releases/` was signed with the maintainer upload key at build time. If you rebuild locally with your own keystore, you will produce a **different signature** — use your bundle for a **new** Play Console app, or keep using the same upload key for updates to an existing listing.

## Google Play App Signing

Google Play recommends **Play App Signing**: Google holds the app signing key; you upload builds signed with an **upload key**. You can reset the upload key from Play Console if the keystore is lost (once enrolled).
