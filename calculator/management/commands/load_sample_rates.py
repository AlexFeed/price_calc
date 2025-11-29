from django.core.management.base import BaseCommand
from ...models import Rate
import json
from django.utils.dateparse import parse_datetime
from django.utils import timezone


class Command(BaseCommand):
    help = 'Load sample rates from calculator/sample_rates.json'

    def handle(self, *args, **options):
        path = 'calculator/sample_rates.json'
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'File not found: {path}'))
            return

        count = 0
        for item in data:
            dt = parse_datetime(item.get('input_date'))
            if not dt:
                dt = timezone.now()
            Rate.objects.create(
                origin_city=item.get('origin_city', ''),
                destination_city=item.get('destination_city', ''),
                container_type=item.get('container_type', ''),
                transport_type=item.get('transport_type', ''),
                email=item.get('email'),
                rate=item.get('rate', 0),
                input_date=dt,
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f'Loaded {count} rates'))
