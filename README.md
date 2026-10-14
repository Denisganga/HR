# HRImara local backend

Requires Python 3.9 or newer; no extra packages are needed.

Local settings are now saved in `hr-app/.env` and loaded automatically at startup.
This file is excluded from Git and cannot be served by the backend.
Environment variables override these saved settings. Start `server.py` to use them.

From this directory, start the server in PowerShell:

```powershell
$env:GEMINI_API_KEY = 'your-new-api-key'
$env:GEMINI_MODEL = 'gemini-3.8-flash' # optional
$env:PORT = '8080' # optional
python server.py
```

If Python is not on PATH, this machine has a bundled runtime:

```powershell
& 'C:/Users/rma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' server.py
```

Open http://localhost:8080. Serve the app with this server so /api/gemini is available.
AI is optional: without the key, the API returns 503 and the app uses its existing local fallbacks.
The previously embedded key was exposed in browser source; revoke it and configure a replacement.
Never put the new key in JavaScript or a publicly served file.

The API forwards bounded prompts to the configured model with a 20-second upstream timeout.
Only named public assets are served. The server binds to localhost and supports concurrent requests.
Model documentation: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
API reference: https://ai.google.dev/api

Run backend checks:

```powershell
python -m unittest -v test_server
```

These checks mock the AI provider and do not consume API quota. Live AI success needs a valid key and network access.

New lifecycle workflows use server-side authentication, expiring HttpOnly sessions, role permissions and SQLite persistence. Existing analytics trends and model scores still include demonstration values. This deployment is one organisation; use separate deployments/databases for separate organisations. It is not a hosted multi-tenant service.
# HR


## HR lifecycle workflows

- Public careers page: `/careers`. Open jobs appear automatically; Screening and Closed jobs cannot accept applications.
- Recruitment: persistent applications, manual screening, admin-authored four-option assessments, server scoring, and registrar requests for consenting shortlisted candidates.
- Administration: organisation name, sector presets, module switches, HR/employee account creation and deactivation, and hourly pay settings.
- Audit Logs: login events and workflow changes are recorded with the server actor and time. Passwords and mail/API secrets are omitted. Button/link clicks within the staff application are also recorded as UI-reported interactions, separately from authoritative backend workflow actions. Input values and passwords are not captured.
- Growth: PDF/PNG/JPEG evidence uploads up to 2 MB, private evidence downloads, review, points and development-review thresholds. Duplicate achievements are rejected. Points never automatically decide promotions.
- Attendance: server clock-in/out, one active shift, captured hourly-rate snapshots and HR-approved timesheets. Amounts are estimates; statutory payroll, break deductions and overtime rules are not implemented.
- Exit & Clearance: employee resignation, HR-recorded termination/contract end, handover/IT/finance/HR clearance, then admin offboarding. Completion deactivates the account and revokes sessions without deleting records. Clearance confirmation is manually recorded by HR; external IT access removal must still be performed by the responsible team.
- Leave requests and onboarding changes now persist too.

Persistence: `hrimara.sqlite3` stores records, password hashes and sessions. Back up this database and `private_uploads/` together. Both are Git-ignored and blocked from public static serving. `server_seed.json` is a first-run sample-data seed containing password hashes, not plaintext passwords. Existing demo sign-in credentials continue to work; they are not displayed on the login screen.

## Google Workspace / Gmail registrar delivery

Add these values locally to the private `.env`, then restart the server:

```dotenv
GMAIL_ADDRESS=your-organisation-mailbox@example.org
GMAIL_APP_PASSWORD=your-google-app-password
```

Use an app password permitted by your Google Workspace administrator, not the mailbox's normal password. SMTP uses `smtp.gmail.com:587` with STARTTLS and certificate validation. If the organisation does not permit app passwords, OAuth or an administrator-approved relay integration is needed instead.

Official setup references:
- https://support.google.com/a/answer/176600
- https://support.google.com/mail/answer/185833

Add verified official registrar contacts in Administration. Shortlist candidates who gave consent; prepare requests in Recruitment. **Review & send prepared requests** shows recipients and disclosed fields before delivery. The button remains disabled until the mailbox configuration is available. Each send is audited. A Sent status means Gmail accepted the message, not that the registrar received it or confirmed the award. Delivery-uncertain requests are not automatically retried; check Sent mail before resolving them. Record genuine registrar response evidence separately. Automatic inbox ingestion is not implemented.

## Verification

```powershell
python -m unittest discover -s . -q
node test_leave_analysis.cjs
node test_lifecycle.cjs
```

Tests use temporary databases and mocked mail delivery; they do not contact candidates, institutions or Gmail. Before internet deployment, configure HTTPS, change sample accounts, add login/application throttling, and apply the organisation's privacy, retention and backup policies. The current server binds to localhost, so `/careers` is public without login on this machine but requires hosting for applicants outside it.


## Vercel deployment

The repository now includes `vercel.json`, `requirements.txt`, and the `api/index.py` Python entry point. Set the Vercel project Root Directory to this repository root (the folder containing `vercel.json`). All requests pass through the backend static allowlist; database files, seed data and private source files cannot be downloaded as public assets.

Vercel must use durable PostgreSQL: add a pooled `DATABASE_URL` (or `POSTGRES_URL`) through the provider integration. SQLite remains local-development storage only; Vercel refuses to silently substitute an ephemeral database. Evidence uploads are stored in the durable database rather than the function filesystem.

For a new production database, set `HRIMARA_ADMIN_EMAIL` and `HRIMARA_ADMIN_PASSWORD` (at least 12 characters) in Vercel. First-run production setup creates only this administrator, with empty employee/job/application lists. It does not enable the known local demo accounts. The password is stored as a salted hash. Configure `GEMINI_API_KEY` and optionally Gmail credentials in Vercel Environment Variables, then redeploy. Secrets are never committed in `.env` or sent to the browser.

`/api/health` identifies the current code version and whether database configuration is present. Configuration presence is not proof of database connectivity. Actual login and persisted workflows must be checked after deployment; a successful Git push alone does not prove a successful Vercel deployment.

### Attendance integrity

- Server-owned UTC timestamps and elapsed seconds; Kenya time is presentation only.
- Only the signed-in account can clock for its active employee record.
- Client identity, timestamps, pay rates and hours are rejected.
- A supervisor displays a 60-second rotating workplace code, required for clock-in and clock-out. Only HR/admin can retrieve this code. Each account may use a given code only once; duplicate active shifts are blocked transactionally.
- PostgreSQL row locking serializes simultaneous attendance writes across serverless instances. Local development uses SQLite write transactions.
- Earnings use decimal arithmetic from elapsed seconds and the clock-in rate snapshot. Approval recalculates totals, disallows self-approval and duplicate approval, and requires a note for shifts over 16 hours.

A shared code is an attendance control, not proof of physical presence: a person can relay a current code remotely. Stronger workplace verification needs a managed kiosk/device, supervisor oversight or another agreed presence mechanism. GPS and IP checks alone can also be spoofed. This implementation does not claim to eliminate every form of attendance fraud.

Other corrected flows: profile editing, feedback submission/inbox, review-cycle records and department filtering now work instead of showing success-only placeholders. The former payslip action is accurately labelled an approved-hours/earnings statement; payroll is not configured. AI requests require a current authenticated account.
