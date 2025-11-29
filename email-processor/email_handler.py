import imaplib
import email
from email.header import decode_header
import os
import requests
from shared.email_extractor import extract_data


class EmailHandler:
    def __init__(self, imap_host, imap_user, imap_pass, api_url, api_key=None):
        self.imap_host = imap_host
        self.imap_user = imap_user
        self.imap_pass = imap_pass
        self.api_url = api_url
        self.api_key = api_key

    def _connect(self):
        m = imaplib.IMAP4_SSL(self.imap_host)
        m.login(self.imap_user, self.imap_pass)
        return m

    def fetch_unseen_and_process(self):
        m = self._connect()
        try:
            m.select('INBOX')
            typ, msgnums = m.search(None, 'UNSEEN')
            if typ != 'OK':
                return
            for num in msgnums[0].split():
                typ, data = m.fetch(num, '(RFC822)')
                if typ != 'OK':
                    continue
                raw = data[0][1]
                msg = email.message_from_bytes(raw)
                body = self._get_body(msg)
                parsed = extract_data(body)

                # post to API
                headers = {'Content-Type': 'application/json'}
                if self.api_key:
                    headers['X-API-KEY'] = self.api_key

                resp = requests.post(self.api_url, json=parsed, headers=headers, timeout=10)
                if resp.status_code == 200:
                    # mark seen
                    m.store(num, '+FLAGS', '\\Seen')
                else:
                    print('API error', resp.status_code, resp.text)
        finally:
            try:
                m.close()
            except Exception:
                pass
            m.logout()

    def _get_body(self, msg):
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                disp = str(part.get('Content-Disposition'))
                if ctype == 'text/plain' and 'attachment' not in disp:
                    charset = part.get_content_charset() or 'utf-8'
                    return part.get_payload(decode=True).decode(charset, errors='replace')
            # fallback to first part
            part = msg.get_payload(0)
            charset = part.get_content_charset() or 'utf-8'
            return part.get_payload(decode=True).decode(charset, errors='replace')
        else:
            charset = msg.get_content_charset() or 'utf-8'
            return msg.get_payload(decode=True).decode(charset, errors='replace')
