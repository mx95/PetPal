# petpal.com.cy — domain & server setup

Guide for pointing **petpal.com.cy** at your Hetzner tracker host (currently `116.203.209.68`) and serving the PetPal app over **HTTPS**.

PetPal runs as one PM2 process on port **5002** (React build + REST API). Collars still connect on **5001** (Xexun) and **5003** (365GPS) — those ports must stay open on the server firewall.

---

## 1. Registrar (`.com.cy`)

In your domain panel (the **Edit petpal.com.cy** screen):

1. **Contact emails** — keep valid admin / billing / technical addresses (required by the registry).
2. Open **DNS Servers** (nameservers):
   - **Option A — Registrar DNS (simplest):** keep default nameservers and add records in step 2 below.
   - **Option B — Cloudflare (recommended):** set nameservers to Cloudflare’s pair, then manage DNS in Cloudflare (free SSL, caching, DDoS).

You do **not** need to change DNSSEC for a basic setup.

---

## 2. DNS records

Point the domain at your server IP **`116.203.209.68`** (replace if your VPS IP changes).

| Type | Name / host | Value | TTL |
|------|-------------|-------|-----|
| **A** | `@` (apex) | `116.203.209.68` | 300–3600 |
| **A** | `www` | `116.203.209.68` | 300–3600 |

Optional (same server, same app):

| Type | Name | Value |
|------|------|-------|
| **A** | `api` | `116.203.209.68` |

**Propagation:** allow 15 minutes–48 hours. Check:

```bash
dig +short petpal.com.cy A
dig +short www.petpal.com.cy A
```

---

## 3. Reverse proxy + HTTPS (nginx on the server)

Browsers need **HTTPS** for “Set home on map” (geolocation) and the full Device tab Wi‑Fi flow. nginx terminates TLS and forwards to PM2 on `127.0.0.1:5002`.

SSH to the server, then:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/petpal.com.cy`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name petpal.com.cy www.petpal.com.cy;

    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and obtain a certificate:

```bash
sudo ln -sf /etc/nginx/sites-available/petpal.com.cy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d petpal.com.cy -d www.petpal.com.cy
```

Certbot adds the `listen 443 ssl` block and auto-renewal.

---

## 4. Firewall (Hetzner + UFW)

Allow public web and collar TCP ingest:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5001/tcp    # Xexun collars
sudo ufw allow 5003/tcp    # 365GPS collars
sudo ufw enable
```

Port **5002** can stay **localhost-only** once nginx is in front (do not expose `:5002` publicly if nginx handles HTTPS).

In **Hetzner Cloud → Firewalls**, mirror the same rules.

---

## 5. PetPal app build (server)

On the server, set **`petpal/.env.local`** before `npm run build`:

```env
REACT_APP_XEXUN_HTTP_BASE_URL=same
REACT_APP_TRACKING_WIFI_ENABLED=1
# Firebase vars unchanged …
```

`same` means the SPA and API share **https://petpal.com.cy** — no CORS issues.

Redeploy:

```bash
cd ~/PetPal && bash scripts/deploy-server.sh
```

Or push to `main` if GitHub Actions deploy is enabled.

---

## 6. Tracker server env (optional)

In `tracker-tcp-server/ecosystem.config.cjs` (or PM2 env), restrict CORS if you ever split UI and API:

```env
HTTP_CORS_ORIGIN=https://petpal.com.cy,https://www.petpal.com.cy
```

Restart: `pm2 restart tracker`.

---

## 7. Point collars at your host

After the domain works, program collars to use the **hostname** (not only the raw IP):

| Collar type | Setting | Example |
|-------------|---------|---------|
| **Xexun** | `ip=` command | `ip=petpal.com.cy:5001` |
| **365GPS** | server redirect | `POST /api/g365/commands/server-redirect` with `"host":"petpal.com.cy","port":5003` |
| **gpspos cloud** | No TCP to PetPal | Poll via `GPSPOS_*` env — see [GPSPOS_SETUP.md](../tracker-tcp-server/docs/GPSPOS_SETUP.md) |

Use the API reference for exact command bodies: [API_REFERENCE.md](../tracker-tcp-server/docs/API_REFERENCE.md).

---

## 8. Verify

```bash
curl -sI https://petpal.com.cy | head -5
curl -s "https://petpal.com.cy/api/app/devices" | head -c 200
curl -s "https://petpal.com.cy/api/gpspos" | head -c 200
```

In the browser: open **https://petpal.com.cy**, hard refresh (`Ctrl+F5`), sign in, open **Live** tracking for a pet with a linked IMEI.

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Domain does not resolve | Wait for DNS; confirm A records at registrar / Cloudflare |
| Certificate fails | Ensure port 80 reaches the server; `certbot` needs HTTP challenge |
| App loads but tracking empty | Rebuild with `REACT_APP_XEXUN_HTTP_BASE_URL=same`; check IMEI on pet |
| Mixed content errors | Use `https://` everywhere; do not hard-code `http://116.203.209.68:5002` in env |
| Old UI after deploy | Hard refresh; confirm `pm2 logs tracker` shows new git hash |

---

## Related docs

- [TRACKING_SETUP.md](./TRACKING_SETUP.md) — env vars, Wi‑Fi, deploy checklist
- [API_REFERENCE.md](../tracker-tcp-server/docs/API_REFERENCE.md) — all HTTP endpoints
- [GPSPOS_SETUP.md](../tracker-tcp-server/docs/GPSPOS_SETUP.md) — cloud collar polling
