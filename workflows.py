"""Persistent HR lifecycle workflows for the local, single-organisation deployment."""
import hashlib
import hmac
import json
import secrets
import base64
import mailer
import smtplib
import sqlite3
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'hrimara.sqlite3'
FEATURES = ['recruitment', 'onboarding', 'performance', 'engagement', 'analytics', 'growth', 'attendance', 'exits']

def now(): return datetime.now(timezone.utc).isoformat()
def workplace_code(secret,counter):
    digest=hmac.new(secret.encode(),str(counter).encode(),hashlib.sha256).digest()
    return f'{int.from_bytes(digest[:8],"big")%1000000:06d}'
def shift_totals(shift):
    seconds=max(0,int((datetime.fromisoformat(shift['out'])-datetime.fromisoformat(shift['in'])).total_seconds()))
    amount=(Decimal(str(shift['rate']))*Decimal(seconds)/Decimal(3600)).quantize(Decimal('0.01'),rounding=ROUND_HALF_UP) if shift['payType']=='Hourly' else Decimal(0)
    return seconds,round(seconds/3600,6),float(amount)
def re_email(value):
    import re
    return bool(re.fullmatch(r"[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", value))
def connect():
    database_url=os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
    if database_url:
        from storage import Connection
        con=Connection(database_url)
    else:
        if os.environ.get('VERCEL'): raise ValueError('Configure DATABASE_URL with persistent PostgreSQL storage before using HR workflows on Vercel')
        con = sqlite3.connect(DB, timeout=10)
        con.row_factory = sqlite3.Row
    con.execute('CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY, body TEXT NOT NULL)')
    con.execute('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT, expires TEXT)')
    if not con.execute('SELECT id FROM store').fetchone():
        seed = json.loads((ROOT/'server_seed.json').read_text(encoding='utf-8-sig'))
        if os.environ.get('VERCEL'):
            email=os.environ.get('HRIMARA_ADMIN_EMAIL','').strip().lower()
            password=os.environ.get('HRIMARA_ADMIN_PASSWORD','')
            if not re_email(email) or len(password)<12: raise ValueError('Set HRIMARA_ADMIN_EMAIL and a 12+ character HRIMARA_ADMIN_PASSWORD for first-run Vercel setup')
            salt=secrets.token_hex(16)
            seed['users']=[{'email':email,'name':'Organisation Admin','role':'admin','avatar':'OA','active':True,'salt':salt,'hash':hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),120000).hex()}]
            for key in ('employees','jobs','applicants','onboarding','leaveRequests','surveys','performance','turnoverRisk'): seed['data'][key]=[]
        seed.update(settings={'name':'HRImara Organisation','sector':'University','features':FEATURES.copy(),'promotionThreshold':100}, logs=[], certificates=[], shifts=[], exits=[], tests=[], verifications=[], registrars=[])
        for i,a in enumerate(seed['data']['applicants'],1):
            a.update(id=i,jobId=1,email='',institution='',qualification=a['edu'],consent=False,testScore=None)
        con.execute('INSERT INTO store VALUES (1, ?)', (json.dumps(seed),))
        con.commit()
    return con

def record(s,u,action,details):
    s['logs'].append({'id':len(s['logs'])+1,'at':now(),'actor':u['email'],'role':u['role'],'action':action,'details':details})
def public_user(u): return {k:u[k] for k in ['email','name','role','avatar','active'] if k in u}
def need(value,label):
    if not isinstance(value,str) or not value.strip() or len(value)>10000: raise ValueError(label+' is required')
    return value.strip()
def number(value,lo=0,hi=100000):
    n=float(value)
    if not lo <= n <= hi: raise ValueError('Number outside allowed range')
    return n

def authorize_ai(handler):
    from http.cookies import SimpleCookie
    con=None
    try:
        con=connect()
        cookie=SimpleCookie();cookie.load(handler.headers.get('Cookie',''))
        token=cookie['hrimara_session'].value if 'hrimara_session' in cookie else ''
        session=con.execute('SELECT email FROM sessions WHERE token=? AND expires>?',(token,now())).fetchone()
        s=json.loads(con.execute('SELECT body FROM store WHERE id=1').fetchone()[0])
        if not session or not any(u['email']==session['email'] and u.get('active',True) for u in s['users']):
            handler.reply(401,{'error':{'message':'Sign in to use AI'}});return False
        if not any(f in s['settings']['features'] for f in ('analytics','engagement','recruitment')):
            handler.reply(403,{'error':{'message':'AI modules are disabled for this organisation'}});return False
        origin=handler.headers.get('Origin')
        if origin and origin not in ('http://'+handler.headers.get('Host',''), 'https://'+handler.headers.get('Host','')):
            handler.reply(403,{'error':{'message':'Request origin denied'}});return False
        return True
    except Exception:
        handler.reply(503,{'error':{'message':'Backend authentication storage is unavailable'}});return False
    finally:
        if con: con.close()

def view(s,u):
    out={k:s[k] for k in ['settings','certificates','shifts','exits','tests','verifications','registrars']}
    out['user']=public_user(u)
    out['settings']={k:v for k,v in s['settings'].items() if k not in ('attendanceSecret','clockCounters','clockFailures')}
    out['settings']['requireWorkplaceCode']=s['settings'].get('requireWorkplaceCode',True)
    out['certificates']=[{k:v for k,v in c.items() if k!='blob'} for c in s['certificates']]
    out['mailConfigured']=mailer.configured() if u['role'] in ('admin','hr') else False
    out['data']=json.loads(json.dumps(s['data']))
    out['feedback']=[{k:v for k,v in item.items() if k!='owner'} for item in s.get('feedback',[]) if u['role']!='employee' or item['owner']==u['email']]
    out['reviewCycles']=s.get('reviewCycles',[])
    out['users']=[public_user(x) for x in s['users']] if u['role']=='admin' else []
    out['logs']=s['logs'][-500:] if u['role']=='admin' else []
    if u['role']=='employee':
        for key in ['certificates','shifts','exits']:
            out[key]=[x for x in out[key] if x['email']==u['email']]
        out['tests']=[];out['verifications']=[];out['registrars']=[]
        out['data']['employees']=[x for x in out['data']['employees'] if x['email']==u['email']]
        out['data']['leaveRequests']=[x for x in out['data']['leaveRequests'] if x['emp']==u['name']]
        for key in ['jobs','applicants','onboarding']: out['data'][key]=[]
    return out

def dispatch(handler,method,path):
    if not path.startswith('/api/work/'): return False
    try:
        con=connect()
    except Exception:
        handler.reply(503,{'error':{'message':'Backend storage is unavailable. Configure PostgreSQL and first-run administrator credentials in Vercel.'}});return True
    try:
        con.execute('BEGIN IMMEDIATE')
        s=json.loads(con.execute('SELECT body FROM store WHERE id=1').fetchone()[0])
        body={}
        if method=='POST':
            size=int(handler.headers.get('Content-Length','0'))
            limit=3000000 if path.endswith('/credential') else 131072
            if not 0<size<=limit: raise ValueError('Invalid request size')
            body=json.loads(handler.rfile.read(size))
            if not isinstance(body,dict): raise ValueError('Invalid body')
            origin=handler.headers.get('Origin')
            if origin and origin not in ('http://'+handler.headers.get('Host',''), 'https://'+handler.headers.get('Host','')):
                raise PermissionError('Request origin denied')
        action=path.removeprefix('/api/work/')
        if action=='careers' and method=='GET':
            jobs=[j for j in s['data']['jobs'] if j['status']=='Open'] if 'recruitment' in s['settings']['features'] else []
            tests=[{'jobId':t['jobId'],'questions':[{'question':q['question'],'options':q['options']} for q in t['questions']]} for t in s['tests'] if any(j['id']==t['jobId'] for j in jobs)]
            handler.reply(200,{'organisation':s['settings']['name'],'jobs':jobs,'tests':tests});return True
        if action=='apply' and method=='POST':
            if 'recruitment' not in s['settings']['features']: raise ValueError('Recruitment is disabled')
            job=next((j for j in s['data']['jobs'] if j['id']==body.get('jobId') and j['status']=='Open'),None)
            if not job: raise ValueError('Job is closed or unavailable')
            email=need(body.get('email'),'Email').lower()
            if not re_email(email): raise ValueError('Invalid email')
            if any(a.get('email')==email and a['jobId']==job['id'] for a in s['data']['applicants']): raise ValueError('You have already applied for this job')
            test=next((t for t in s['tests'] if t['jobId']==job['id']),None)
            answers=body.get('answers',[]);score=None
            if test:
                if not isinstance(answers,list) or len(answers)!=len(test['questions']) or any(type(v)!=int or not 0<=v<4 for v in answers): raise ValueError('Complete all assessment questions')
                score=round(sum(q['answer']==a for q,a in zip(test['questions'],answers))/len(answers)*100)
            candidate={'id':max([a['id'] for a in s['data']['applicants']]+[0])+1,'jobId':job['id'],'name':need(body.get('name'),'Name'),'email':email,'institution':need(body.get('institution'),'Institution'),'qualification':need(body.get('qualification'),'Qualification'),'edu':body['qualification'],'exp':str(number(body.get('experience',0),0,70))+' yrs','statement':need(body.get('statement'),'Application statement'),'consent':body.get('consent') is True,'status':'Pending','testScore':score,'score':score or 0,'applied':now()}
            s['data']['applicants'].append(candidate);job['applicants']=sum(a['jobId']==job['id'] for a in s['data']['applicants'])
            record(s,{'email':email,'role':'candidate'},'application.submitted',f'Job {job["id"]}; application {candidate["id"]}')
            result={'message':'Application received. HR will review it.','reference':candidate['id']}
        elif action=='login' and method=='POST':
            email=str(body.get('email','')).lower().strip()
            u=next((x for x in s['users'] if x['email']==email and x['role']==body.get('role') and x.get('active',True)),None)
            password=str(body.get('password',''))
            if not u or not hmac.compare_digest(u['hash'],hashlib.pbkdf2_hmac('sha256',password.encode(),u['salt'].encode(),120000).hex()):
                record(s,{'email':email,'role':'unknown'},'login.failed','Invalid credentials')
                con.execute('UPDATE store SET body=? WHERE id=1',(json.dumps(s),));con.commit()
                handler.reply(401,{'error':{'message':'Invalid credentials or inactive account'}});return True
            token=secrets.token_urlsafe(32)
            con.execute('INSERT INTO sessions VALUES (?,?,?)',(token,email,(datetime.now(timezone.utc)+timedelta(hours=12)).isoformat()))
            handler.extra_cookie='hrimara_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+('; Secure' if os.environ.get('VERCEL') else '')
            record(s,u,'login.success','Signed in');result=view(s,u)
        else:
            from http.cookies import SimpleCookie
            cookie=SimpleCookie();cookie.load(handler.headers.get('Cookie',''))
            token=cookie['hrimara_session'].value if 'hrimara_session' in cookie else ''
            session=con.execute('SELECT email FROM sessions WHERE token=? AND expires>?',(token,now())).fetchone()
            u=next((x for x in s['users'] if session and x['email']==session['email'] and x.get('active',True)),None)
            if not u: handler.reply(401,{'error':{'message':'Please sign in'}});return True
            role=u['role']; staff=role in ('admin','hr')
            if action=='state' and method=='GET': handler.reply(200,view(s,u));return True
            if action=='attendance_code' and method=='GET':
                if not staff: raise PermissionError('Only an authorised workplace supervisor may display the clock code')
                secret=s['settings'].setdefault('attendanceSecret',secrets.token_hex(32))
                counter=int(time.time()//60)
                con.execute('UPDATE store SET body=? WHERE id=1',(json.dumps(s),));con.commit()
                handler.reply(200,{'code':workplace_code(secret,counter),'expiresAt':datetime.fromtimestamp((counter+1)*60,timezone.utc).isoformat()});return True
            if action=='file' and method=='GET':
                from urllib.parse import urlsplit, parse_qs
                ident=int(parse_qs(urlsplit(handler.path).query).get('id',['0'])[0])
                c=next(c for c in s['certificates'] if c['id']==ident)
                if not staff and c['email']!=u['email']: raise PermissionError('Evidence access denied')
                if not c.get('file'): raise ValueError('No uploaded evidence')
                content=base64.b64decode(c['blob']) if c.get('blob') else (ROOT/'private_uploads'/c['file']).read_bytes()
                handler.send_response(200);handler.send_header('Content-Type',c['mime']);handler.send_header('Content-Length',str(len(content)));handler.send_header('Content-Disposition','attachment; filename="credential-evidence'+c['extension']+'"');handler.send_header('Cache-Control','no-store');handler.send_header('X-Content-Type-Options','nosniff');handler.end_headers();handler.wfile.write(content);return True
            if method!='POST': raise ValueError('Unsupported request')
            feature={'job':'recruitment','test':'recruitment','candidate':'recruitment','verification':'recruitment','send_verification':'recruitment','registrar':'recruitment','credential':'growth','credential_review':'growth','clock':'attendance','pay_review':'attendance','exit':'exits','clearance':'exits','exit_complete':'exits'}.get(action)
            if feature and feature not in s['settings']['features']: raise PermissionError('This module is disabled by the administrator')
            if action=='logout':
                con.execute('DELETE FROM sessions WHERE token=?',(token,));handler.extra_cookie='hrimara_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
            elif action=='interaction':
                record(s,u,'ui.interaction',str(body.get('page',''))[:50]+' / '+str(body.get('control',''))[:100])
                con.execute('UPDATE store SET body=? WHERE id=1',(json.dumps(s),));con.commit();handler.reply(200,{'recorded':True});return True
            elif action=='profile':
                name=need(body.get('name'),'Name')
                if any(c in name for c in '<>\"\'`'): raise ValueError('Use a plain name without markup or quotation marks')
                old=u['name'];u['name']=name;u['avatar']=''.join(w[0] for w in name.split())[:2]
                for e in s['data']['employees']:
                    if e['email']==u['email']: e.update(name=name,avatar=u['avatar'],phone=str(body.get('phone',''))[:50])
                for request in s['data']['leaveRequests']:
                    if request['emp']==old: request['emp']=name
                for entry in s['data']['onboarding']:
                    if entry['name']==old: entry['name']=name
                    if entry['buddy']==old: entry['buddy']=name
            elif action=='feedback':
                if 'engagement' not in s['settings']['features']: raise PermissionError('Engagement is disabled')
                s.setdefault('feedback',[]).append({'id':len(s.get('feedback',[]))+1,'owner':u['email'],'name':'Name hidden' if body.get('hideName') else u['name'],'category':need(body.get('category'),'Category'),'text':need(body.get('text'),'Feedback'),'at':now()})
            elif action=='review_cycle':
                if not staff or 'performance' not in s['settings']['features']: raise PermissionError('Performance review access required')
                s.setdefault('reviewCycles',[]).append({'id':len(s.get('reviewCycles',[]))+1,'name':need(body.get('name'),'Cycle name'),'created':now(),'status':'Open'})
            elif action=='settings':
                if role!='admin': raise PermissionError('Administrator access required')
                selected=body.get('features',[])
                if not isinstance(selected,list) or any(f not in FEATURES for f in selected): raise ValueError('Invalid modules')
                s['settings'].update(name=need(body.get('name'),'Organisation name'),sector=need(body.get('sector'),'Sector'),features=selected,promotionThreshold=int(number(body.get('promotionThreshold',100),1,10000)))
            elif action=='account':
                if role!='admin': raise PermissionError('Administrator access required')
                email=need(body.get('email'),'Email').lower()
                existing=next((x for x in s['users'] if x['email']==email),None)
                if body.get('disable'):
                    if not existing or email==u['email'] or existing['role']=='admin': raise ValueError('Cannot deactivate this account')
                    existing['active']=False;con.execute('DELETE FROM sessions WHERE email=?',(email,))
                    for emp in s['data']['employees']:
                        if emp['email']==email: emp['status']='Inactive'
                else:
                    if existing: raise ValueError('Account already exists')
                    password=need(body.get('password'),'Initial password')
                    if len(password)<10: raise ValueError('Use at least 10 characters for the initial password')
                    new_role=body.get('role')
                    if new_role not in ('hr','employee'): raise ValueError('Choose HR or employee')
                    salt=secrets.token_hex(16);name=need(body.get('name'),'Name')
                    if any(c in name for c in '<>\"\'`'): raise ValueError('Use a plain name without markup or quotation marks')
                    if not re_email(email): raise ValueError('Invalid email')
                    s['users'].append({'email':email,'name':name,'role':new_role,'avatar':''.join(w[0] for w in name.split())[:2],'active':True,'salt':salt,'hash':hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),120000).hex()})
                    s['data']['employees'].append({'id':max([e['id'] for e in s['data']['employees']]+[0])+1,'name':name,'email':email,'role':body.get('jobTitle','Employee'),'dept':need(body.get('dept'),'Department'),'status':'Active','performance':0,'engagement':0,'risk':'Not assessed','joined':now()[:10],'avatar':''.join(w[0] for w in name.split())[:2],'payType':body.get('payType','Salaried'),'hourlyRate':number(body.get('hourlyRate',0))})
            elif action=='pay_config':
                if role!='admin': raise PermissionError('Administrator access required')
                emp=next(e for e in s['data']['employees'] if e['email']==body.get('email'))
                if body.get('payType') not in ('Hourly','Salaried'): raise ValueError('Invalid pay arrangement')
                emp.update(payType=body['payType'],hourlyRate=number(body.get('hourlyRate',0)))
            elif action=='leave_create':
                start=datetime.fromisoformat(need(body.get('from'),'Start date'))
                end=datetime.fromisoformat(need(body.get('to'),'End date'))
                if end<start: raise ValueError('End date must follow start date')
                if body.get('type') not in ('Annual Leave','Sick Leave','Study Leave','Maternity/Paternity','Emergency Leave'): raise ValueError('Invalid leave type')
                allowed=['undisclosed','recovery','environment','health','family','development','planned']
                if body.get('driver','undisclosed') not in allowed: raise ValueError('Invalid driver')
                s['data']['leaveRequests'].append({'id':max([r['id'] for r in s['data']['leaveRequests']]+[0])+1,'emp':u['name'],'type':body['type'],'from':start.date().isoformat(),'to':end.date().isoformat(),'days':(end-start).days+1,'reason':str(body.get('reason',''))[:2000],'driver':body.get('driver','undisclosed'),'status':'Pending'})
            elif action=='leave_status':
                request=next(r for r in s['data']['leaveRequests'] if r['id']==body.get('id'))
                status=body.get('status')
                if status=='Cancelled':
                    if request['emp']!=u['name'] or request['status']!='Pending': raise PermissionError('You may cancel only your own pending request')
                elif not staff or status not in ('Approved','Rejected'): raise PermissionError('HR leave review required')
                elif request['emp']==u['name']: raise PermissionError('Another reviewer must review your leave')
                request.update(status=status,reviewer=u['email'],reviewed=now())
            elif action=='onboarding_save':
                if not staff: raise PermissionError('HR access required')
                if 'onboarding' not in s['settings']['features']: raise PermissionError('Onboarding is disabled')
                value=body.get('record')
                if not isinstance(value,dict) or not any(e['id']==value.get('empId') for e in s['data']['employees']): raise ValueError('Invalid onboarding record')
                existing=next((r for r in s['data']['onboarding'] if r['id']==value.get('id')),None)
                if existing: existing.update(value)
                else: s['data']['onboarding'].append(value)
            elif action=='job':
                if not staff: raise PermissionError('HR access required')
                job=next((j for j in s['data']['jobs'] if j['id']==body.get('id')),None)
                if not job:
                    job={'id':max([j['id'] for j in s['data']['jobs']]+[0])+1,'posted':now()[:10],'applicants':0};s['data']['jobs'].append(job)
                status=body.get('status','Open')
                if status not in ('Open','Screening','Closed'): raise ValueError('Invalid job status')
                for k in ('title','dept','type','description','requirements'): job[k]=need(body.get(k),k)
                job['status']=status
            elif action=='test':
                if role!='admin': raise PermissionError('Only administrators create assessments')
                if not any(j['id']==body.get('jobId') for j in s['data']['jobs']): raise ValueError('Job not found')
                questions=body.get('questions',[])
                if not isinstance(questions,list) or not 1<=len(questions)<=20: raise ValueError('Provide 1-20 questions')
                for q in questions:
                    need(q.get('question'),'Question')
                    if len(q.get('options',[]))!=4 or any(not isinstance(o,str) or not o.strip() for o in q['options']) or type(q.get('answer'))!=int or not 0<=q['answer']<4: raise ValueError('Each question needs four options and a correct answer')
                s['tests']=[t for t in s['tests'] if t['jobId']!=body['jobId']]+[{'jobId':body['jobId'],'questions':questions,'passMark':number(body.get('passMark',60),0,100)}]
            elif action=='candidate':
                if not staff: raise PermissionError('HR access required')
                a=next(a for a in s['data']['applicants'] if a['id']==body.get('id'))
                if body.get('status') not in ('Pending','Review','Shortlisted','Rejected'): raise ValueError('Invalid candidate status')
                a['status']=body['status']
            elif action=='registrar':
                if role!='admin': raise PermissionError('Only administrators maintain verified contacts')
                contact={'institution':need(body.get('institution'),'Institution'),'email':need(body.get('email'),'Registrar email').lower()}
                if not re_email(contact['email']): raise ValueError('Invalid registrar email')
                s['registrars']=[r for r in s['registrars'] if r['institution'].lower()!=contact['institution'].lower()]+[contact]
            elif action=='send_verification':
                if not staff: raise PermissionError('HR access required')
                if body.get('confirm') is not True: raise ValueError('Review and confirm the recipient before sending')
                if not mailer.configured(): raise ValueError('Gmail is not configured. Set the organisation mailbox credentials on the server first.')
                v=next(v for v in s['verifications'] if v['id']==body.get('id'))
                a=next(a for a in s['data']['applicants'] if a['id']==v['candidateId'])
                if not a.get('consent') or a['status']!='Shortlisted': raise ValueError('Candidate consent and shortlist status are required')
                if v['status'] not in ('Draft — not sent','Failed to send'): raise ValueError('Request already sent, processing, or awaiting a delivery check')
                contact=next((r for r in s['registrars'] if r['institution'].lower()==v['institution'].lower()),None)
                if not contact or contact['email']!=v['email']: raise ValueError('Registrar contact changed. Review the request before sending.')
                v['status']='Sending';record(s,u,'verification.sending','Request '+str(v['id'])+' to '+v['email'])
                con.execute('UPDATE store SET body=? WHERE id=1',(json.dumps(s),));con.commit()
                sent_id=v['id']
                try:
                    message_id=mailer.send_verification(v,s['settings']['name']);outcome='Sent — awaiting reply';note='Accepted by Gmail; delivery and authenticity are not yet confirmed'
                except (smtplib.SMTPAuthenticationError,smtplib.SMTPRecipientsRefused):
                    outcome='Failed to send';message_id='';note='Gmail authentication or recipient rejection. Check mailbox configuration and contact.'
                except (smtplib.SMTPException,OSError,ValueError):
                    outcome='Delivery uncertain';message_id='';note='Connection ended unexpectedly. Check Sent mail before attempting another request.'
                con.execute('BEGIN IMMEDIATE')
                s=json.loads(con.execute('SELECT body FROM store WHERE id=1').fetchone()[0])
                v=next(v for v in s['verifications'] if v['id']==sent_id)
                v.update(status=outcome,messageId=message_id,deliveryNote=note,sentAt=now())
                record(s,u,'verification.delivery',f'Request {sent_id}: {outcome}')
            elif action=='verification':
                if not staff: raise PermissionError('HR access required')
                if body.get('response'):
                    v=next(v for v in s['verifications'] if v['id']==body.get('id'))
                    if body['response'] not in ('Confirmed','Unable to confirm'): raise ValueError('Invalid response')
                    v.update(status=body['response'],evidence=need(body.get('evidence'),'Registrar response reference'),reviewer=u['email'],reviewed=now())
                else:
                    shortlist=[a for a in s['data']['applicants'] if a['jobId']==body.get('jobId') and a['status']=='Shortlisted']
                    if not shortlist: raise ValueError('Shortlist at least one candidate first')
                    for a in shortlist:
                        if not a.get('consent'): continue
                        contact=next((r for r in s['registrars'] if r['institution'].lower()==a.get('institution','').lower()),None)
                        if not contact or any(v['candidateId']==a['id'] for v in s['verifications']): continue
                        s['verifications'].append({'id':len(s['verifications'])+1,'candidateId':a['id'],'candidate':a['name'],'institution':a['institution'],'email':contact['email'],'qualification':a['qualification'],'status':'Draft — not sent','created':now()})
                    # No email provider configured. Never claim that a draft was sent.
            elif action=='credential':
                credential={'id':len(s['certificates'])+1,'email':u['email'],'name':u['name'],'title':need(body.get('title'),'Credential title'),'issuer':need(body.get('issuer'),'Issuer'),'kind':body.get('kind','Certificate'),'reference':need(body.get('reference'),'Evidence reference or HTTPS link'),'status':'Pending','points':0,'created':now()}
                if any(c['email']==u['email'] and all(str(c[k]).casefold()==str(credential[k]).casefold() for k in ('title','issuer','reference')) for c in s['certificates']):
                    raise ValueError('This learning achievement has already been submitted')
                if body.get('fileData'):
                    content=base64.b64decode(body['fileData'],validate=True)
                    if len(content)>2000000: raise ValueError('Evidence must be under 2 MB')
                    if content.startswith(b'%PDF-'): mime,ext='application/pdf','.pdf'
                    elif content.startswith(b'\x89PNG\r\n\x1a\n'): mime,ext='image/png','.png'
                    elif content.startswith(b'\xff\xd8\xff'): mime,ext='image/jpeg','.jpg'
                    else: raise ValueError('Upload a PDF, PNG or JPEG file')
                    filename=secrets.token_hex(24)+ext
                    credential.update(file=filename,mime=mime,extension=ext,blob=base64.b64encode(content).decode())
                s['certificates'].append(credential)
            elif action=='credential_review':
                if not staff: raise PermissionError('HR access required')
                c=next(c for c in s['certificates'] if c['id']==body.get('id'))
                if c['email']==u['email']: raise PermissionError('A different reviewer must assess your credential')
                if body.get('status') not in ('Approved','Rejected'): raise ValueError('Invalid review')
                c.update(status=body['status'],points=int(number(body.get('points',0),0,100)) if body['status']=='Approved' else 0,reviewer=u['email'],note=need(body.get('note'),'Review note'))
            elif action=='clock':
                if set(body)-{'direction','code'}: raise ValueError('Clock requests cannot supply identity, timestamps, hours or rates')
                if body.get('direction') not in ('in','out'): raise ValueError('Invalid clock action')
                emp=next((e for e in s['data']['employees'] if e['email']==u['email'] and e['status']=='Active'),None)
                if not emp: raise PermissionError('An active employee record is required for attendance')
                secret=s['settings'].setdefault('attendanceSecret',secrets.token_hex(32))
                counter=int(time.time()//60)
                if s['settings'].get('requireWorkplaceCode',True):
                    failures=s['settings'].setdefault('clockFailures',{})
                    failure=failures.get(u['email'],{'counter':counter,'attempts':0})
                    if failure['counter']!=counter: failure={'counter':counter,'attempts':0}
                    if failure['attempts']>=5: raise PermissionError('Too many invalid workplace codes. Wait for the next code.')
                    if not hmac.compare_digest(str(body.get('code','')),workplace_code(secret,counter)):
                        failure['attempts']+=1;failures[u['email']]=failure
                        record(s,u,'clock.denied','Invalid workplace code')
                        con.execute('UPDATE store SET body=? WHERE id=1',(json.dumps(s),));con.commit()
                        handler.reply(403,{'error':{'message':'Enter the current workplace code supplied on site by your supervisor'}});return True
                    if s['settings'].setdefault('clockCounters',{}).get(u['email'])==counter: raise ValueError('This workplace code was already used by your account. Wait for the next code.')
                shift=next((x for x in s['shifts'] if x['email']==u['email'] and not x.get('out')),None)
                if body.get('direction')=='in':
                    if shift: raise ValueError('You are already clocked in')
                    s['shifts'].append({'id':len(s['shifts'])+1,'email':u['email'],'name':u['name'],'in':now(),'out':None,'hours':0,'amount':0,'status':'Open','payType':emp.get('payType','Salaried'),'rate':emp.get('hourlyRate',0)})
                elif body.get('direction')=='out':
                    if not shift: raise ValueError('Clock in before clocking out')
                    shift['out']=now()
                    if datetime.fromisoformat(shift['out'])<datetime.fromisoformat(shift['in']): raise ValueError('Server time anomaly: contact the administrator')
                    shift['seconds'],shift['hours'],shift['amount']=shift_totals(shift)
                    shift['status']='Needs review' if shift['seconds']>16*3600 else 'Awaiting approval'
                else: raise ValueError('Invalid clock action')
                s['settings'].setdefault('clockCounters',{})[u['email']]=counter
            elif action=='pay_review':
                if not staff: raise PermissionError('HR access required')
                shift=next(x for x in s['shifts'] if x['id']==body.get('id'))
                if not shift['out']: raise ValueError('Shift is still open')
                if shift['email']==u['email']: raise PermissionError('Another reviewer must approve your hours')
                if shift['status']=='Approved': raise ValueError('Timesheet is already approved')
                seconds,hours,amount=shift_totals(shift)
                if seconds>16*3600 and not body.get('note'): raise ValueError('A review note is required for shifts longer than 16 hours')
                shift.update(status='Approved',seconds=seconds,hours=hours,amount=amount,reviewer=u['email'],reviewed=now(),reviewNote=str(body.get('note',''))[:1000])
            elif action=='exit':
                email=body.get('email',u['email'])
                if not staff and email!=u['email']: raise PermissionError('You can only request your own exit')
                kind=body.get('kind','Resignation')
                if kind not in ('Resignation','Termination','Contract end') or (not staff and kind!='Resignation'): raise PermissionError('Only HR can initiate this exit type')
                if not any(x['email']==email for x in s['users']): raise ValueError('Account not found')
                if any(x['email']==email and x['status']!='Completed' for x in s['exits']): raise ValueError('An exit is already in progress')
                target=next(x for x in s['users'] if x['email']==email)
                if target['role']=='admin': raise ValueError('Administrator exits require separate governance')
                last=need(body.get('lastDay'),'Last working day');datetime.fromisoformat(last)
                s['exits'].append({'id':len(s['exits'])+1,'email':email,'name':target['name'],'kind':kind,'lastDay':last,'reason':need(body.get('reason'),'Reason'),'status':'In progress','steps':{'Manager handover':False,'IT access and assets':False,'Finance reconciliation':False,'HR documents':False},'created':now()})
            elif action=='clearance':
                if not staff: raise PermissionError('HR access required')
                x=next(x for x in s['exits'] if x['id']==body.get('id'))
                if x['email']==u['email'] or x['status']=='Completed': raise PermissionError('Cannot clear this exit')
                if body.get('step') not in x['steps']: raise ValueError('Unknown clearance step')
                x['steps'][body['step']]=True
            elif action=='exit_complete':
                if role!='admin': raise PermissionError('Administrator approval required')
                x=next(x for x in s['exits'] if x['id']==body.get('id'))
                if x['status']=='Completed' or not all(x['steps'].values()): raise ValueError('Complete all clearance steps first')
                if any(t['email']==x['email'] and not t['out'] for t in s['shifts']): raise ValueError('Resolve the open attendance shift first')
                target=next(t for t in s['users'] if t['email']==x['email']);target['active']=False
                con.execute('DELETE FROM sessions WHERE email=?',(x['email'],))
                for e in s['data']['employees']:
                    if e['email']==x['email']: e['status']='Offboarded'
                x.update(status='Completed',completed=now())
            else: raise ValueError('Unknown workflow')
            record(s,u,action,('Configuration updated' if action=='settings' else 'Workflow updated; record '+str(body.get('id',body.get('jobId',body.get('email','self'))))))
            result=view(s,u)
        con.execute('UPDATE store SET body=? WHERE id=1',(json.dumps(s),));con.commit();handler.reply(200,result)
    except PermissionError as exc:
        con.rollback();handler.reply(403,{'error':{'message':str(exc)}})
    except (ValueError,TypeError,KeyError,StopIteration,OverflowError) as exc:
        con.rollback();handler.reply(400,{'error':{'message':str(exc) or 'Record not found'}})
    except Exception:
        con.rollback();handler.reply(503,{'error':{'message':'The workflow could not be saved. Please retry or contact the administrator.'}})
    finally: con.close()
    return True
