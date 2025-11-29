from django.test import Client
import json

client = Client()
payload = {
    'origin_city': 'Москва',
    'destination_city': 'Санкт-Петербург',
    'container_type': '20ft',
    'transport_type': 'морской',
    'rate': -50,
    'input_date': '2025-11-05T12:00:00Z',
    'email': 'test@example.com',
}

resp = client.post('/api/receive_rate/', json.dumps(payload), content_type='application/json', HTTP_X_API_KEY='dev-secret-key')
print('status:', resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.content)
