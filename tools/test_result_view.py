import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()
from django.test import Client
from calculator.models import Rate

# use an existing Rate to build a form POST
r = Rate.objects.first()
client = Client()
data = {
    'origin_city': r.origin_city if r else '',
    'destination_city': r.destination_city if r else '',
    'container_type': r.container_type if r else '',
    'transport_type': r.transport_type if r else '',
    'email': r.email if r else '',
}
resp = client.post('/', data)
print('status', resp.status_code)
content = resp.content.decode('utf-8', errors='replace')
print(content[:800])
