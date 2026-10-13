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

This is still a demo: user credentials and HR data are in app.js, and edits live only in browser memory.
Production authentication, authorization, and database persistence are not implemented.
# HR
