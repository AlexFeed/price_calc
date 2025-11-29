import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()
from calculator.models import Rate

count = Rate.objects.count()
print('deleting', count, 'rates')
Rate.objects.all().delete()
print('deleted')
