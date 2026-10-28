# PURPOSE browser dashboard

Private, local browser interface for Shronda. Uses the existing policy, approvals,
usage budget, Hive gateway, and audit chain. No public website changes.

## Install on Windows

From the repository's `purpose` folder, after pulling `develop-ai-studio`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-dashboard.ps1
```

This creates a PURPOSE desktop shortcut and opens the browser. Future use needs
only a double-click. Node.js 22.13 or newer is required (the dashboard uses SQLite).
The process loads only Hive settings from `$HOME\HiveAI\.env`. It never embeds the
key in a page or saves it in Git. A missing key is reported in the dashboard.

The personal sigil is visible only as the local tab/shortcut icon. It is not
rendered in the dashboard content, and the public site's hidden source is untouched.

## Use

Write instructions and optionally supply text/context, click Review request, then
Approve & run. Each approved run can spend Hive credit. No calls run at startup.
Recommendations and usage are saved in `.data/dashboard.db` on this computer.
Open Connections for recorded setup status; these are snapshots, not live service
checks. Brand fields remain unapproved unless already approved in the source config.
No website browsing, inbox reading, sending, booking changes, or publishing exists
in this version. Copy results using the Copy response button.

Click Close PURPOSE to stop the local server. Closing just the tab leaves the
local service running so the shortcut can reopen it. Avoid deleting `.data` if you
want to keep history. If you clear browser cookies while it is running, end its
Node process using Windows Task Manager and reopen the shortcut for a fresh session.

## Local access model

Listens only on `127.0.0.1:8788`, never a network interface. A random process-local
bootstrap token in the launch URL creates an HttpOnly SameSite=Strict cookie. The
browser removes the fragment immediately. API routes require that cookie; writes
also require exact Origin, Host, and a same-origin request header. A private in-memory
signing key authenticates the local owner to the existing router; it is not a
Cloudflare login and is not suitable for hosting. Do not expose or proxy this port.
The code serializes paid runs and reuses the existing approval and budget checks.

For development without a shortcut:

```powershell
node src/local/dashboard.js
```

Open the printed session link locally. Do not share it. For hosting or phone access,
use a separate deployment with real owner authentication; this local adapter must
not be deployed.
