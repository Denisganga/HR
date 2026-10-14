"""Google Workspace/Gmail SMTP delivery; credentials remain server-side."""
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid

def configured(): return bool(os.environ.get('GMAIL_ADDRESS') and os.environ.get('GMAIL_APP_PASSWORD'))
def send_verification(v, organisation):
    if not configured(): raise ValueError('Configure GMAIL_ADDRESS and GMAIL_APP_PASSWORD in the server .env before sending')
    message=EmailMessage()
    message['From']=os.environ['GMAIL_ADDRESS']
    message['To']=v['email']
    message['Subject']=f'Qualification verification — HRIMARA-{v["id"]}'
    message['Message-ID']=make_msgid()
    message.set_content(f'Dear Academic Registrar,\n\nWith the candidate\'s recorded consent, please confirm the following qualification:\n\nCandidate: {v["candidate"]}\nInstitution: {v["institution"]}\nQualification: {v["qualification"]}\nRequest reference: HRIMARA-{v["id"]}\n\nPlease reply from your official institution mailbox. HR will record and review your response; this request does not presume authenticity.\n\nRegards,\n{organisation}')
    with smtplib.SMTP('smtp.gmail.com',587,timeout=15) as client:
        client.ehlo();client.starttls(context=ssl.create_default_context());client.ehlo()
        client.login(os.environ['GMAIL_ADDRESS'],os.environ['GMAIL_APP_PASSWORD'].replace(' ',''))
        refused=client.send_message(message)
        if refused: raise smtplib.SMTPRecipientsRefused(refused)
    return message['Message-ID']
