import unittest
from storage import Connection
class FakeCursor:
 description=[]
 def fetchone(self):return None
class FakeRaw:
 def __init__(self):
  self.info=type('Info',(),{'transaction_status':type('State',(),{'value':2})()})()
  self.sql=[]
 def execute(self,sql,params):self.sql.append((sql,params));return FakeCursor()
class StorageContractTests(unittest.TestCase):
 def test_postgres_serializes_workflow_writes(self):
  con=Connection.__new__(Connection);con.raw=FakeRaw()
  con.execute('BEGIN IMMEDIATE')
  con.execute('SELECT body FROM store WHERE id=1')
  con.execute('UPDATE store SET body=? WHERE id=1',('state',))
  self.assertEqual(con.raw.sql[0][0],'BEGIN')
  self.assertEqual(con.raw.sql[1][0],'SELECT body FROM store WHERE id=1 FOR UPDATE')
  self.assertEqual(con.raw.sql[2],('UPDATE store SET body=%s WHERE id=1',('state',)))
if __name__=='__main__':unittest.main()
