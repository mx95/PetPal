# Upload key credentials

These credentials sign **release builds** of PetPal for Google Play.

| Field | Value |
|-------|--------|
| Keystore file | `signing/petpal-upload.keystore` |
| Key alias | `petpal-upload` |
| Store password | `PetPalUpload2026!` |
| Key password | `PetPalUpload2026!` |

Gradle reads these from `signing/keystore.properties` (same values).

## Important

- Required to publish **updates** to the same Play Store app as the bundled `.aab`.
- If this repository is **public**, rotate to a new upload key via Play Console → **App integrity** → **Upload key** after your first release.
- Back up `petpal-upload.keystore` in a password manager or secure vault.

## Regenerate (new app listing)

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore signing/petpal-upload.keystore \
  -alias petpal-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=PetPal, OU=Mobile, O=PetPal, L=Nicosia, ST=Cyprus, C=CY"
```

Update this file and `keystore.properties` with the new passwords.
