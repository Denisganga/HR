import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch
import workflows
from api.index import handler
from http.server import ThreadingHTTPServer

class VercelRoutingTests(unittest.TestCase):
 def test_routes_and_private_assets(self):
  with tempfile.TemporaryDirectory() as folder,patch.object(workflows,'DB',Path(folder)/'test.sqlite3'),patch.dict('os.environ',{'VERCEL':'','DATABASE_URL':'','POSTGRES_URL':''}):
   server=ThreadingHTTPServer(('127.0.0.1',0),handler)
   thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
   try:
    for route,expected in [('/',200),('/careers',200),('/lifecycle.js',200),('/api/health',200),('/api/work/careers',200),('/server_seed.json',404),('/workflows.py',404),('/.env',404),('/hrimara.sqlite3',404),('/api/work/state',401)]:
     url=f'http://127.0.0.1:{server.server_port}/api/index?route='+urllib.parse.quote(route,safe='')
     try:
      with urllib.request.urlopen(url,timeout=5) as response:actual=response.status
     except urllib.error.HTTPError as error:actual=error.code
     self.assertEqual(actual,expected,route)
   finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
