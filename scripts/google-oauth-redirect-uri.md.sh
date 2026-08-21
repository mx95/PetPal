#!/usr/bin/env bash
# Print exact Google Cloud steps to allow petpal.com.cy as Firebase authDomain.
# After this is done once, redeploy with:
#   PETPAL_FIREBASE_AUTH_DOMAIN=petpal.com.cy bash scripts/deploy-server.sh
set -euo pipefail

cat <<'EOF'
Google login Error 400: redirect_uri_mismatch
=============================================

Cause: the app used authDomain=petpal.com.cy, so Google received
  redirect_uri=https://petpal.com.cy/__/auth/handler
but that URI is not registered on the Firebase Web OAuth client.

Fix (one-time, Google Cloud Console):
1. Open https://console.cloud.google.com/apis/credentials?project=petpal-aecda
2. Under "OAuth 2.0 Client IDs", open the Web client
   (often named "Web client (auto created by Google Service)")
3. Authorized JavaScript origins — add:
     https://petpal.com.cy
     https://www.petpal.com.cy
4. Authorized redirect URIs — add:
     https://petpal.com.cy/__/auth/handler
     https://www.petpal.com.cy/__/auth/handler
5. Save
6. Firebase Console → Authentication → Settings → Authorized domains
   must include petpal.com.cy (usually already there)
7. Redeploy with first-party authDomain:
     PETPAL_FIREBASE_AUTH_DOMAIN=petpal.com.cy bash scripts/deploy-server.sh

Until step 4 is done, production keeps authDomain=petpal-aecda.firebaseapp.com
so Google login works again.
EOF
