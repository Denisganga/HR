#!/usr/bin/env python3
"""Local HRImara server and Gemini proxy; standard library only."""
import http.server
import json
import os
from pathlib import Path
import re
import queue
import threading
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = {'/', '/index.html', '/app.js', '/styles.css', '/test_gemini.html', '/hrimara-logo.png'}


def request_gemini(request):
    # Socket timeouts do not bound DNS resolution on Windows.
    result_queue = queue.Queue(maxsize=1)
    def fetch():
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result_queue.put((json.load(response), None))
        except Exception as exc:
            result_queue.put((None, exc))
    threading.Thread(target=fetch, daemon=True).start()
    try:
        result, error = result_queue.get(timeout=25)
    except queue.Empty:
        raise TimeoutError('Gemini request deadline exceeded') from None
    if error:
        raise error
    return result

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'application/javascript', '.css': 'text/css'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def send_head(self):
        if urllib.parse.urlsplit(self.path).path == '/hrimara-logo.png':
            asset = ROOT / 'hrimara-logo.png'
            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', str(asset.stat().st_size))
            self.end_headers()
            return asset.open('rb')
        if urllib.parse.urlsplit(self.path).path not in PUBLIC_FILES:
            self.send_error(404)
            return None
        return super().send_head()

    def reply(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def error(self, status, message):
        self.reply(status, {'error': {'code': status, 'message': message}})

    def do_POST(self):
        if urllib.parse.urlsplit(self.path).path != '/api/gemini':
            self.error(404, 'Unknown API endpoint')
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.error(400, 'Invalid Content-Length')
            return
        if not 0 < length <= 32768:
            self.error(413 if length > 32768 else 400, 'Request body must be 1-32768 bytes')
            return
        try:
            data = json.loads(self.rfile.read(length))
            prompt = data['contents'][0]['parts'][0]['text']
            tokens = data.get('generationConfig', {}).get('maxOutputTokens', 150)
            if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 10000:
                raise ValueError()
            if type(tokens) is not int or not 1 <= tokens <= 1024:
                raise ValueError()
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            self.error(400, 'Provide a nonempty text prompt and maxOutputTokens between 1 and 1024')
            return
        key = os.environ.get('GEMINI_API_KEY', '').strip()
        model = os.environ.get('GEMINI_MODEL', 'gemini-3.8-flash')
        if not key:
            self.error(503, 'AI is unavailable: configure GEMINI_API_KEY on the server')
            return
        if not re.fullmatch(r'[A-Za-z0-9._-]+', model):
            self.error(503, 'Invalid server GEMINI_MODEL configuration')
            return
        payload = {'contents': [{'parts': [{'text': prompt}]}],
                   'generationConfig': {'maxOutputTokens': tokens, 'temperature': 0.7}}
        if model.startswith('gemini-3'):
            payload['generationConfig']['temperature'] = 1
            payload['generationConfig']['thinkingConfig'] = {'thinkingLevel': 'low'}
        request = urllib.request.Request(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'x-goog-api-key': key}, method='POST')
        try:
            result = request_gemini(request)
            if not isinstance(result, dict) or 'error' in result:
                raise ValueError()
            self.reply(200, result)
        except urllib.error.HTTPError as exc:
            messages = {
                400: 'Gemini rejected the request. Check the server model configuration.',
                401: 'Gemini authentication failed. Check the configured API key.',
                403: 'Gemini access is denied. Check API key permissions and project access.',
                404: 'The configured Gemini model is unavailable. Update GEMINI_MODEL and restart the server.',
                429: 'Gemini quota is exhausted or requests are too frequent. Check quota and billing, then retry.'
            }
            self.error(429 if exc.code == 429 else 502, messages.get(exc.code, 'Gemini is temporarily unavailable. Please retry.'))
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            self.error(502, 'AI provider is unavailable; try again later')

def main():
    config = ROOT / '.env'
    if config.is_file():
        for line in config.read_text(encoding='utf-8-sig').splitlines():
            name, separator, value = line.partition('=')
            if separator and name.strip() in {'GEMINI_API_KEY', 'GEMINI_MODEL', 'PORT'}:
                os.environ.setdefault(name.strip(), value.strip().strip('\"\''))
    try:
        port = int(os.environ.get('PORT', '8080'))
        if not 0 < port <= 65535:
            raise ValueError('PORT must be between 1 and 65535')
        with http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler) as server:
            print(f'HRImara is running at http://localhost:{port}', flush=True)
            print('Press Ctrl+C to stop', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except (OSError, ValueError) as exc:
        raise SystemExit(f'Cannot start HRImara (check PORT and whether it is in use): {exc}') from exc

if __name__ == '__main__':
    main()
