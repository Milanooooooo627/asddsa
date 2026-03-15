# Proton Cloud Authentication API

Flask authentication API for ProtonUI. It uses SQLite locally and can switch to PostgreSQL in deployment.

## What is included
- `POST /register` for account creation
- `POST /auth` for login
- `GET /health` for health checks
- CORS enabled for ProtonUI requests
- Support for both `password` and `passwordHash` payloads
- Private update check and gated release download endpoints for a launcher

## Local development
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Initialize the local database:
   ```bash
   python init_db.py
   ```
3. Start the API:
   ```bash
   python app.py
   ```

Windows shortcuts:
- Run `..\Run-ProtonCloudAuth.bat` to start the local Flask API.
- Run `..\Run-ProtonLocalUI.bat` to start the API and open ProtonUI together.

The local SQLite database is created under `instance/protoncloud.db`.

## ProtonUI integration
- ProtonUI now defaults to `http://127.0.0.1:5000`
- The UI can override the API base and save it locally
- The login and register actions now send plain `password`, and the API also accepts `passwordHash` for compatibility
- The configured owner email is promoted automatically and receives exclusive owner-only UI sections in ProtonUI

## Owner account
- `OWNER_EMAIL` controls which account is promoted to the owner/admin tier.
- The default owner email is `Milanraemaekers62@gmail.com`.
- Owner accounts receive these exclusive UI access flags:
   - `core`
   - `owner-console`
   - `multi-ui`
   - `diagnostics`
   - `advanced-controls`
- Existing accounts with the owner email are upgraded automatically on login and during database initialization.

## Owner console
- Owner accounts now see a large owner-only control panel inside ProtonUI.
- The owner console can:
   - assign user roles
   - customize which UI packs a user can access
   - generate timed access keys
   - assign keys to users
   - remove keys from users
   - revoke keys completely
- Timed keys can grant additional interface packs like `multi-ui`, `diagnostics`, and `advanced-controls` without promoting the user to owner.

## Private launcher updates
This API now supports a private update flow for a desktop launcher without exposing releases on a public URL.

How it works:
1. The launcher authenticates with the same account system used by the UI.
2. The launcher calls `POST /updates/check` with:
    - `email`
    - `password` or `passwordHash`
    - `product` (currently `tracex-launcher`)
    - `channel` (`stable` or `beta`)
    - `currentVersion`
    - optional `deviceId`
3. If a newer allowed release exists, the API returns:
    - release metadata
    - a short-lived one-time download token
4. The launcher downloads through `GET /updates/download/<token>`.
5. The token is consumed and recorded for audit purposes.

Release storage:
- Put release files in `Cloud/releases/` by default.
- Override this directory with `RELEASES_DIR` if needed.

Owner-only release endpoints:
- `POST /admin/releases`
   Registers a release file already present in the releases directory.
- `POST /admin/releases/list`
   Lists all registered releases.
- `POST /admin/releases/toggle`
   Enables or disables a release.
- `POST /admin/releases/tokens`
   Lists recent download tokens for audit review.
- `POST /admin/releases/tokens/revoke`
   Revokes a specific issued download token.

Example owner release registration payload:
```json
{
   "requesterEmail": "owner@example.com",
   "requesterPassword": "owner-password",
   "product": "tracex-launcher",
   "channel": "stable",
   "version": "1.0.0",
   "fileName": "TraceX-Launcher-1.0.0.zip",
   "notes": "Initial private release",
   "sha256": "optional-sha256-hash",
   "requiredAccess": "core",
   "forceUpdate": false
}
```

Example launcher update check payload:
```json
{
   "email": "user@example.com",
   "password": "user-password",
   "product": "tracex-launcher",
   "channel": "stable",
   "currentVersion": "0.9.0",
   "deviceId": "desktop-01"
}
```

Control model:
- Only authenticated active users can receive update metadata.
- Release entitlement is checked against the release `requiredAccess` field.
- Download tokens are short-lived and one-time use.
- Owners can disable releases or revoke issued tokens.
- Every issued token stores email, device id, IP, user agent, issue time, and download time.

## Request examples
```json
{
  "email": "user@example.com",
  "password": "plain-text-password"
}
```

```json
{
  "email": "user@example.com",
  "passwordHash": "sha256-from-client"
}
```

## Deploying to Render
The repo now includes a Render blueprint file. If you deploy the whole repository, Render can use `render.yaml` from the repo root and point the web service to `Cloud` automatically.

Manual setup sequence:
1. Push the repository to GitHub.
2. In Render, create a PostgreSQL database.
3. Create a new Web Service and set the Root Directory to `Cloud`.
4. Use these settings:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`
5. Set these environment variables:
   - `DATABASE_URL` = Render PostgreSQL connection string
   - `SECRET_KEY` = your own long random secret
   - `PYTHON_VERSION` = `3.12.8`
6. After the first deploy, open a Render shell and run:
   ```bash
   python init_db.py
   ```
7. Copy your final service URL into ProtonUI if you want the HTA client to use the hosted API instead of `http://127.0.0.1:5000`.

If you prefer Blueprint deploys, commit the included root `render.yaml` and let Render provision both the web service and PostgreSQL database from that file.

If your platform provides `postgres://...`, the app automatically converts it to `postgresql://...`.

## Production notes
- Do not commit `.env`.
- Replace the development `SECRET_KEY` before deployment.
- Use PostgreSQL in hosted environments instead of SQLite.
- `cloud_auth_server.ps1` is now a legacy local server and should not be used for the Flask-based workflow.
- Set `RELEASES_DIR` if release files should live outside `Cloud/releases`.
- Set `DOWNLOAD_TOKEN_TTL_MINUTES` to control how long release download tokens remain valid.
this 