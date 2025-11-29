import os
import sys
# ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()
from calculator.models import Rate

r = Rate.objects.order_by('-id').first()
if not r:
    print('no rate')
else:
    bpath = os.path.join(os.path.dirname(__file__), 'out_origin.bin')
    tpath = os.path.join(os.path.dirname(__file__), 'out_origin.txt')
    with open(bpath, 'wb') as fb:
        fb.write(r.origin_city.encode('utf-8', errors='replace'))
    with open(tpath, 'w', encoding='utf-8', errors='replace') as ft:
        ft.write(r.origin_city)
    print('wrote', bpath, tpath)
