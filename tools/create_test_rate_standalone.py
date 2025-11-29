import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()
from calculator.models import Rate
from django.utils import timezone

Rate.objects.create(
    origin_city='Москва-СТАНДАЛОНЕ',
    destination_city='Санкт-Петербург-СТАНДАЛОНЕ',
    container_type='20ft',
    transport_type='морской',
    email='standalone@test.example',
    rate=321.0,
    input_date=timezone.now(),
)
print('created standalone')
