import os, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()
from django.test import Client

c = Client()

# Test registration
payload = {'email': 'api_test_user@example.com', 'password': 'testpass', 'name': 'apitest'}
resp = c.post('/manage/api/users/', json.dumps(payload), content_type='application/json')
print('register status', resp.status_code, resp.content.decode())

# Test login
payload2 = {'email': 'api_test_user@example.com', 'password': 'testpass'}
resp2 = c.post('/manage/api/login/', json.dumps(payload2), content_type='application/json')
print('login status', resp2.status_code, resp2.content.decode())

# List users
resp3 = c.get('/manage/api/users/')
print('list status', resp3.status_code, resp3.content.decode())
