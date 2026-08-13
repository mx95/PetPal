# PetPal Firebase Auth Hosting (`petpal-auth`)

Minimal Firebase Hosting site for the future `auth.petpal.com.cy` Authentication
custom-domain flow.

- Firebase project: `petpal-aecda`
- Hosting site ID: `petpal-auth`
- This directory is isolated from `petpal/` (app, functions, Firestore).

Deploy only this site:

```bash
cd firebase-auth-hosting
firebase deploy --only hosting --project petpal-aecda --non-interactive
```

Do **not** run this from `petpal/` and do **not** deploy the default
`petpal-aecda` Hosting site from this folder.
