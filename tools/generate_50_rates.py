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

# Список выдуманных названий компаний для генерации
company_names = [
    'ООО Логистика-Плюс', 'АО ТрансГрупп', 'ИП Иванов', 'ООО Северный Путь',
    'ЗАО Быстрая Доставка', 'ООО Вектор', 'Global Trade Ltd', 'ООО Импорт-Экспорт',
    'АО СтройМаш', 'ИП Петров', 'ТК Энергия', 'ООО Океан', 'Морской Бриз',
    'ООО АгроТранс', 'Сибирский Экспресс', 'ООО ТехноСнаб', 'Альянс Логистик'
]

def random_rate():
    # include some negative (subsidy) and positive, decimals
    return round(random.uniform(-200.0, 2000.0), 2)

def random_date_within(days=60):
    now = timezone.now()
    delta = timedelta(days=random.randint(0, days), hours=random.randint(0,23), minutes=random.randint(0,59))
    return now - delta

def main(n=50):
    created = 0
    print(f"Генерация {n} новых записей...")

    for i in range(n):
        origin = random.choice(cities)
        dest = random.choice([c for c in cities if c != origin])
        cont = random.choice(containers)
        tr = random.choice(transports)
        rate_val = random_rate()

        # Случайный статус
        processing_status = random.choice(['correct', 'incorrect', 'pending'])
        dt = random_date_within(60)

        # Выбираем случайную компанию
        company = random.choice(company_names)

        # Создание новой строки в базе данных ставок
        Rate.objects.create(
            origin_city=origin, # Город отправления
            destination_city=dest, # Город назначения
            container_type=cont, # Тип контейнера
            transport_type=tr, # Тип транспорта
            client_name=company,           # Название компании
            email=f'manager{i}@example.com', # Email менеджера

            rate=rate_val, # Значение ставки
            processing_status=processing_status, # Значение статуса обработки
            input_date=dt, # Значение даты
        )
        created += 1

    print(f'Успешно создано {created} ставок с новыми полями')

if __name__ == '__main__':
    main(50)

