/**
 * Proxy Firebase Auth helper routes so Google redirect sign-in stays first-party
 * on petpal.com.cy (avoids third-party storage blocking on iOS Safari / Chrome).
 *
 * @see https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
const https = require("https");

const DEFAULT_AUTH_HOST =
  process.env.FIREBASE_AUTH_PROXY_HOST || "petpal-aecda.firebaseapp.com";

/**
 * @param {import('express').Express} app
 * @param {{ authHost?: string }} [options]
 */
function registerFirebaseAuthProxy(app, options = {}) {
  const authHost = String(options.authHost || DEFAULT_AUTH_HOST).trim();
  if (!authHost) return;

  app.use("/__/auth", (req, res) => {
    const targetPath = req.originalUrl || req.url || "/__/auth";
    const headers = { ...req.headers, host: authHost };
    delete headers["accept-encoding"];

    const proxyReq = https.request(
      {
        hostname: authHost,
        path: targetPath,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        for (const [key, value] of Object.entries(proxyRes.headers || {})) {
          if (value == null) continue;
          // Avoid leaking upstream encoding mismatches; Express will handle body as-is.
          if (String(key).toLowerCase() === "transfer-encoding") continue;
          res.setHeader(key, value);
        }
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.warn(`[auth-proxy] ${req.method} ${targetPath} → ${authHost} failed:`, err.message || err);
      if (!res.headersSent) {
        res.status(502).type("text").send("Auth helper proxy failed");
      }
    });

    req.pipe(proxyReq);
  });

  console.log(`[auth-proxy] /__/auth → https://${authHost}/__/auth`);
}

module.exports = { registerFirebaseAuthProxy };
