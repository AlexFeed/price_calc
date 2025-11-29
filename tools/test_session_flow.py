import os, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()
from django.test import Client

c = Client()

# Register (this should log the user in)
payload = {'email': 'session_user@example.com', 'password': 'sesspass', 'name': 'session'}
resp = c.post('/manage/api/users/', json.dumps(payload), content_type='application/json')
print('register:', resp.status_code, resp.content.decode())

# whoami
resp2 = c.get('/manage/api/whoami/')
print('whoami after register:', resp2.status_code, resp2.content.decode())

# logout
resp3 = c.post('/manage/api/logout/')
print('logout:', resp3.status_code, resp3.content.decode())

# whoami after logout
resp4 = c.get('/manage/api/whoami/')
print('whoami after logout:', resp4.status_code, resp4.content.decode())
