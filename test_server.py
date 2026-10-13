import io
import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
import server

class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.http.server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.httpd.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def request(self, path, body=None):
        req = urllib.request.Request(self.base + path, data=body,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=3) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

    def test_static_and_private_files(self):
        for path in ('/', '/app.js', '/styles.css', '/test_gemini.html'):
            self.assertEqual(self.request(path)[0], 200)
        for path in ('/server.py', '/.env', '/test_server.py', '/%2e%2e/server.py'):
            self.assertEqual(self.request(path)[0], 404)

    def test_bad_input(self):
        for body in (b'{', b'[]', b'null', b'{}', b'{"contents":[{"parts":[{"text":4}]}]}'):
            self.assertEqual(self.request('/api/gemini', body)[0], 400)
        self.assertEqual(self.request('/api/gemini', b'x' * 32769)[0], 413)
        self.assertEqual(self.request('/api/unknown', b'{}')[0], 404)

    def payload(self):
        return json.dumps({'contents': [{'parts': [{'text': 'Hello'}]}]}).encode()

    def test_missing_key(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': ''}):
            self.assertEqual(self.request('/api/gemini', self.payload())[0], 503)

    def test_proxy_success(self):
        response = io.BytesIO(b'{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}')
        original = urllib.request.urlopen
        def fake(req, **kwargs):
            if req.full_url.startswith(self.base):
                return original(req, **kwargs)
            self.assertEqual(kwargs['timeout'], 20)
            self.assertEqual(req.get_header('X-goog-api-key'), 'test-secret')
            self.assertNotIn('test-secret', req.full_url)
            return response
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-secret'}), patch('server.urllib.request.urlopen', side_effect=fake):
            status, body = self.request('/api/gemini', self.payload())
        self.assertEqual(status, 200)
        self.assertIn('candidates', json.loads(body))

    def test_upstream_failures(self):
        original = urllib.request.urlopen
        for failure, expected in ((TimeoutError(), 502), (ValueError(), 502),
            (urllib.error.HTTPError('https://provider', 429, 'limited', {}, None), 429),
            (urllib.error.HTTPError('https://provider', 404, 'missing model', {}, None), 502),
            (urllib.error.HTTPError('https://provider', 401, 'unauthorized', {}, None), 502)):
            def fake(req, **kwargs):
                if req.full_url.startswith(self.base):
                    return original(req, **kwargs)
                raise failure
            with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-secret'}), patch('server.urllib.request.urlopen', side_effect=fake):
                status, body = self.request('/api/gemini', self.payload())
            self.assertEqual(status, expected)
            self.assertNotIn(b'test-secret', body)

if __name__ == '__main__':
    unittest.main()
