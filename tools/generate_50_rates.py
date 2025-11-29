import os
import sys
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pricecalc.settings')
import django
django.setup()

from calculator.models import Rate
from django.utils import timezone


cities = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
    'Нижний Новгород', 'Челябинск', 'Ростов-на-Дону', 'Уфа', 'Красноярск',
    'Пермь', 'Воронеж', 'Волгоград', 'Саратов', 'Тюмень', 'Ижевск',
    'Барнаул', 'Ульяновск', 'Иркутск', 'Кемерово'
]

containers = ['20ft', '40ft']
transports = ['морской', 'ж/д', 'авто']

def random_rate():
    # include some negative and positive, decimals
    return round(random.uniform(-200.0, 2000.0), 2)


def random_date_within(days=60):
    now = timezone.now()
    delta = timedelta(days=random.randint(0, days), hours=random.randint(0,23), minutes=random.randint(0,59))
    return now - delta


def main(n=50):
    created = 0
    for i in range(n):
        origin = random.choice(cities)
        dest = random.choice([c for c in cities if c != origin])
        cont = random.choice(containers)
        tr = random.choice(transports)
        rate = random_rate()
        # random processing status for testing notifications and filters
        processing_status = random.choice(['correct', 'incorrect', 'pending'])
        dt = random_date_within(60)

        Rate.objects.create(
            origin_city=origin,
            destination_city=dest,
            container_type=cont,
            transport_type=tr,
            email=f'test{i}@example.com',
            rate=rate,
            processing_status=processing_status,
            input_date=dt,
        )
        created += 1

    print(f'Created {created} rates')


if __name__ == '__main__':
    main(50)
