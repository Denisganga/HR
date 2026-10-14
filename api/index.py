"""Vercel Python entry point. All files pass through the static allowlist."""
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlencode
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Handler
class handler(Handler):
    def normalize(self):
        query=parse_qs(urlsplit(self.path).query)
        route=query.pop('route',None)
        if route:
            self.path=route[0]+('?' + urlencode(query,doseq=True) if query else '')
    def do_GET(self): self.normalize();super().do_GET()
    def do_POST(self): self.normalize();super().do_POST()
    def do_HEAD(self): self.normalize();super().do_HEAD()
