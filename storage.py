"""PostgreSQL adapter for the local workflow SQL interface."""
class Row:
    def __init__(self, values, columns): self.values=values;self.columns=columns
    def __getitem__(self,key): return self.values[key if isinstance(key,int) else self.columns.index(key)]
class Cursor:
    def __init__(self,cursor): self.cursor=cursor
    def fetchone(self):
        row=self.cursor.fetchone()
        return Row(row,[c.name for c in self.cursor.description]) if row else None
class Connection:
    def __init__(self,url):
        import psycopg
        self.raw=psycopg.connect(url,autocommit=True,connect_timeout=10)
    def execute(self,sql,params=()):
        sql=sql.replace('BEGIN IMMEDIATE','BEGIN').replace('?','%s')
        if sql=='SELECT body FROM store WHERE id=1' and self.raw.info.transaction_status.value==2: sql+=' FOR UPDATE'
        if sql.startswith('INSERT INTO store VALUES'): sql+=' ON CONFLICT (id) DO NOTHING'
        return Cursor(self.raw.execute(sql,params))
    def commit(self): self.raw.commit()
    def rollback(self): self.raw.rollback()
    def close(self): self.raw.close()
