import os
import sys
import django

# Ensure project root is on path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
django.setup()

from django.contrib.auth.models import User

username = 'devadmin'
email = 'devadmin@example.com'
password = 'devpass123'

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print('superuser created:', username)
else:
    print('superuser already exists')
