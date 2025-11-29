from calculator.models import Rate
from django.utils import timezone

Rate.objects.create(
    origin_city='Москва-ТЕСТ',
    destination_city='Санкт-Петербург-ТЕСТ',
    container_type='20ft',
    transport_type='морской',
    email='create@test.example',
    rate=123.45,
    input_date=timezone.now(),
)
print('created')
