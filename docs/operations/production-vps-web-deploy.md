# Production web/PWA release on VPS

This runbook publishes the current `main` static web/PWA build to
`https://planmyplan.ru`. It is intentionally separate from EAS staging: do not
run `qa:staging:*` for production and do not point the production build at the
staging Supabase project.

## What this process changes

- It replaces only the static files under `/var/www/tasktracker`.
- It does not change Nginx, DNS, TLS/SSL, Supabase dashboard settings or any
  secret.
- It never commits `.env.local`, a session, a token or a publishable key.

## Before each release

Run these commands on the VPS checkout that has the production `.env.local`:

```bash
git switch main
git pull --ff-only origin main
npm ci
npm run production:export
```

`production:export` first validates that `.env.local` contains exactly the two
approved public client variables and that its Supabase URL is
`https://lskslmsqjrgbbgvzdoqs.supabase.co`. It then runs TypeScript, ESLint,
the full Jest suite (with the required `--forceExit` workaround), makes the
static export and validates `dist`. The final check requires `index.html`,
`manifest.json`, `sw.js`, JavaScript assets and the reviewed production
Supabase URL, while rejecting source maps and server-secret markers.

If the guard reports an invalid URL, stop. Do not substitute the staging URL,
copy a key from a log or edit a secret in Git. Correct the production server's
local `.env.local` through the established secret-management path and restart
from `npm run production:export`.

## Publish the already verified export

Confirm the exact target before removing files:

```bash
sudo test "$(readlink -f /var/www/tasktracker)" = /var/www/tasktracker
sudo rm -rf /var/www/tasktracker/*
sudo cp -a dist/. /var/www/tasktracker/
```

The removal is restricted to the verified web root. Do not replace it with a
broader path and do not delete hidden server-managed files unless that has been
explicitly reviewed separately.

## Smoke test

```bash
curl -fsSI https://planmyplan.ru/
curl -fsSI https://planmyplan.ru/manifest.json
curl -fsSI https://planmyplan.ru/sw.js
```

Each request must return a successful HTTP status. Then open the site once in a
browser and, for an installed PWA, fully close it and reopen it. The service
worker deliberately does not force-reload an already open application; this
protects local IndexedDB data and durable sync outbox from an interrupted
session.

## Rollback

Keep the last known-good `dist` outside `/var/www/tasktracker` before starting
a release. To roll back, run the same verified replacement sequence with that
known-good export. Do not clear browser storage, unregister the service worker
or change Supabase data as a release rollback.
