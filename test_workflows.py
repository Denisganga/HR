import http.server
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch
import server
import workflows

class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.envpatch=patch.dict('os.environ',{'DATABASE_URL':'','POSTGRES_URL':'','VERCEL':''});self.envpatch.start()
        self.clock_counter=20000000
        self.admin_cookie=""
        self.temp=tempfile.TemporaryDirectory()
        temp_root=Path(self.temp.name)
        (temp_root/'server_seed.json').write_text((workflows.ROOT/'server_seed.json').read_text(encoding='utf-8-sig'),encoding='utf-8')
        self.rootpatch=patch.object(workflows,'ROOT',temp_root);self.rootpatch.start()
        self.patch=patch.object(workflows,'DB',Path(self.temp.name)/'test.sqlite3');self.patch.start()
        self.http=server.http.server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True);self.thread.start()
        self.base=f'http://127.0.0.1:{self.http.server_port}'
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.thread.join();self.patch.stop();self.rootpatch.stop();self.temp.cleanup();self.envpatch.stop()
    def req(self,action,body=None,cookie=''):
        if action=='clock' and body is not None and 'code' not in body:
            self.clock_counter+=1
            with patch('workflows.time.time',return_value=self.clock_counter*60+1):
                code=self.req('attendance_code',cookie=self.admin_cookie)[1].get('code','')
                return self.req(action,{**body,'code':code},cookie)
        req=urllib.request.Request(self.base+'/api/work/'+action,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Cookie':cookie})
        try:
            with urllib.request.urlopen(req,timeout=5) as r:return r.status,json.load(r),r.headers.get('Set-Cookie','').split(';')[0]
        except urllib.error.HTTPError as e:return e.code,json.load(e),''
    def login(self,role='admin'):
        credentials={'admin':('admin@university.edu','Admin@2026'),'hr':('hr@university.edu','HRManager@2026'),'employee':('s.chen@uni.edu','Sarah@2026')}
        email,password=credentials[role]
        status,data,cookie=self.req('login',dict(email=email,password=password,role=role));self.assertEqual(status,200)
        if role=='admin':self.admin_cookie=cookie
        return cookie
    def test_public_assessment_and_verification(self):
        admin=self.login();hr=self.login('hr')
        job=dict(title='Test chef',dept='Kitchen',type='Hourly',description='Prepare meals',requirements='Food safety certificate',status='Open')
        status,data,_=self.req('job',job,admin);self.assertEqual(status,200);jid=data['data']['jobs'][-1]['id']
        self.assertEqual(self.req('test',dict(jobId=jid,questions=[dict(question='Safe storage?',options=['Cold','Hot','Floor','Outside'],answer=0)],passMark=60),hr)[0],403)
        self.assertEqual(self.req('test',dict(jobId=jid,questions=[dict(question='Safe storage?',options=['Cold','Hot','Floor','Outside'],answer=0)],passMark=60),admin)[0],200)
        status,public,_=self.req('careers');self.assertNotIn('answer',public['tests'][0]['questions'][0])
        application=dict(jobId=jid,name='Test Candidate',email='candidate@example.test',institution='Test Institute',qualification='Food safety',statement='Relevant experience',experience=2,consent=True,answers=[0])
        status,result,_=self.req('apply',application);self.assertEqual(status,200);cid=result['reference']
        self.assertEqual(self.req('apply',application)[0],400)
        self.req('candidate',dict(id=cid,status='Shortlisted'),hr)
        self.req('registrar',dict(institution='Test Institute',email='registrar@example.test'),admin)
        status,data,_=self.req('verification',dict(jobId=jid),hr);self.assertEqual(status,200)
        self.assertEqual(data['verifications'][0]['status'],'Draft — not sent')
        vid=data['verifications'][0]['id']
        self.assertEqual(self.req('send_verification',dict(id=vid,confirm=True),hr)[0],400)
        with patch('mailer.configured',return_value=True),patch('mailer.send_verification',return_value='test-message-id') as sender:
            self.assertEqual(self.req('send_verification',dict(id=vid,confirm=False),hr)[0],400)
            status,sent,_=self.req('send_verification',dict(id=vid,confirm=True),hr)
            self.assertEqual(status,200);self.assertEqual(sent['verifications'][0]['status'],'Sent — awaiting reply')
            self.assertEqual(self.req('send_verification',dict(id=vid,confirm=True),hr)[0],400)
            self.assertEqual(sender.call_count,1)
        self.assertEqual(data['data']['applicants'][-1]['testScore'],100)
        self.req('job',{**job,'id':jid,'status':'Closed'},hr)
        self.assertNotIn(jid,[j['id'] for j in self.req('careers')[1]['jobs']])
    def test_accounts_growth_attendance_exit_and_audit(self):
        admin=self.login();hr=self.login('hr');employee=self.login('employee')
        self.assertEqual(self.req('settings',dict(name='Restaurant',sector='Restaurant',features=workflows.FEATURES,promotionThreshold=100),employee)[0],403)
        account=dict(name='Test Worker',email='worker@example.test',password='TestPassword123!',role='employee',dept='Kitchen',jobTitle='Chef',payType='Hourly',hourlyRate=250)
        self.assertEqual(self.req('account',account,hr)[0],403)
        self.assertEqual(self.req('account',account,admin)[0],200)
        worker=self.req('login',dict(email=account['email'],password=account['password'],role='employee'))[2]
        self.assertEqual(self.req('clock',dict(direction='out'),worker)[0],400)
        self.assertEqual(self.req('clock',dict(direction='in'),worker)[0],200)
        self.assertEqual(self.req('clock',dict(direction='in'),worker)[0],400)
        _,data,_=self.req('clock',dict(direction='out'),worker);shift=data['shifts'][0]
        self.assertEqual(shift['rate'],250);self.assertEqual(shift['amount'],workflows.shift_totals(shift)[2])
        self.assertEqual(self.req('pay_review',dict(id=shift['id']),worker)[0],403)
        self.req('pay_review',dict(id=shift['id']),hr)
        _,data,_=self.req('credential',dict(title='Safety badge',issuer='Test institute',reference='CERT-123'),worker);cid=data['certificates'][0]['id']
        self.assertEqual(data['certificates'][0]['points'],0)
        self.assertEqual(self.req('credential_review',dict(id=cid,status='Approved',points=50,note='Evidence checked'),worker)[0],403)
        self.req('credential_review',dict(id=cid,status='Approved',points=50,note='Evidence checked'),hr)
        _,data,_=self.req('exit',dict(kind='Resignation',lastDay='2026-10-31',reason='New opportunity'),worker);eid=data['exits'][0]['id']
        self.assertEqual(self.req('exit_complete',dict(id=eid),admin)[0],400)
        for step in data['exits'][0]['steps']:self.req('clearance',dict(id=eid,step=step),hr)
        self.assertEqual(self.req('exit_complete',dict(id=eid),admin)[0],200)
        self.assertEqual(self.req('state',cookie=worker)[0],401)
        self.assertEqual(self.req('login',dict(email=account['email'],password=account['password'],role='employee'))[0],401)
        _,data,_=self.req('state',cookie=admin)
        self.assertTrue(any(l['action']=='exit_complete' for l in data['logs']))
        self.assertNotIn(account['password'],json.dumps(data));self.assertNotIn('hash',json.dumps(data['users']))
    def test_evidence_privacy_and_persistent_leave(self):
        import base64
        employee=self.login('employee');hr=self.login('hr')
        body=dict(title='Safety certificate',issuer='Test issuer',reference='CERT-1',fileData=base64.b64encode(b'%PDF-1.4\nTest evidence').decode())
        status,data,_=self.req('credential',body,employee);self.assertEqual(status,200)
        cid=data['certificates'][0]['id']
        with urllib.request.urlopen(urllib.request.Request(self.base+f'/api/work/file?id={cid}',headers={'Cookie':employee})) as response:
            self.assertTrue(response.read().startswith(b'%PDF-'))
        other=self.req('login',dict(email='j.okafor@uni.edu',password='James@2026',role='employee'))[2]
        self.assertEqual(self.req(f'file?id={cid}',cookie=other)[0],403)
        self.assertEqual(self.req('credential',{**body,'fileData':base64.b64encode(b'<script>bad</script>').decode()},employee)[0],400)
        status,data,_=self.req('leave_create',dict(type='Annual Leave',**{'from':'2026-11-01','to':'2026-11-03'},driver='planned',reason='Rest'),employee)
        self.assertEqual(status,200);lid=data['data']['leaveRequests'][-1]['id']
        self.assertEqual(self.req('leave_status',dict(id=lid,status='Approved'),employee)[0],403)
        self.req('leave_status',dict(id=lid,status='Approved'),hr)
        status,state,_=self.req('state',cookie=employee)
        self.assertEqual(state['data']['leaveRequests'][-1]['status'],'Approved')

    def test_clock_cannot_spoof_identity_time_or_replay(self):
        admin=self.login();employee=self.login('employee')
        self.assertEqual(self.req('attendance_code',cookie=employee)[0],403)
        self.assertEqual(self.req('clock',dict(direction='in',code='invalid'),employee)[0],403)
        with patch('workflows.time.time',return_value=1200000001):
            code=self.req('attendance_code',cookie=admin)[1]['code']
            self.assertEqual(self.req('clock',dict(direction='in',code=code,hours=8),employee)[0],400)
            self.assertEqual(self.req('clock',dict(direction='in',code=code,email='another@example.org'),employee)[0],400)
            self.assertEqual(self.req('clock',dict(direction='in',code=code),employee)[0],200)
            self.assertEqual(self.req('clock',dict(direction='out',code=code),employee)[0],400)
        with patch('workflows.time.time',return_value=1200000061):
            code=self.req('attendance_code',cookie=admin)[1]['code']
            self.assertEqual(self.req('clock',dict(direction='out',code=code),employee)[0],200)
        state=self.req('state',cookie=admin)[1]
        self.assertNotIn('attendanceSecret',state['settings'])
        self.assertNotIn('clockCounters',state['settings'])

    def test_vercel_requires_durable_database(self):
        with patch.dict('os.environ',{'VERCEL':'1','DATABASE_URL':'','POSTGRES_URL':''}):
            self.assertEqual(self.req('careers')[0],503)

    def test_profile_feedback_and_review_cycle_persist(self):
        admin=self.login();employee=self.login('employee')
        self.assertEqual(self.req('profile',dict(name='Grace Wanjiku',phone='0700000000'),employee)[0],200)
        self.assertEqual(self.req('state',cookie=employee)[1]['user']['name'],'Grace Wanjiku')
        self.assertEqual(self.req('feedback',dict(category='Workload',text='Please review team cover',hideName=True),employee)[0],200)
        feedback=self.req('state',cookie=admin)[1]['feedback'][0]
        self.assertEqual(feedback['name'],'Name hidden');self.assertNotIn('owner',feedback)
        self.assertEqual(self.req('review_cycle',dict(name='Quarterly review'),employee)[0],403)
        self.assertEqual(self.req('review_cycle',dict(name='Quarterly review'),admin)[0],200)
        self.assertEqual(self.req('state',cookie=admin)[1]['reviewCycles'][0]['name'],'Quarterly review')

    def test_disabled_modules_and_employee_privacy(self):
        admin=self.login();employee=self.login('employee')
        status,data,_=self.req('state',cookie=employee)
        self.assertEqual(data['logs'],[]);self.assertEqual(data['users'],[]);self.assertEqual(data['data']['applicants'],[])
        self.req('settings',dict(name='Restaurant',sector='Restaurant',features=['exits'],promotionThreshold=100),admin)
        self.assertEqual(self.req('clock',dict(direction='in'),employee)[0],403)
        self.assertEqual(self.req('careers')[1]['jobs'],[])
        self.assertEqual(self.req('state')[0],401)

if __name__=='__main__': unittest.main()
