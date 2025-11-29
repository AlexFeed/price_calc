from calculator.models import Rate

r = Rate.objects.order_by('-id').first()
if not r:
    print('no rates')
else:
    print('id=', r.id)
    print('origin=', r.origin_city)
    print('destination=', r.destination_city)
    print('container=', r.container_type)
    print('transport=', r.transport_type)
    print('rate=', r.rate)
    print('input_date=', r.input_date)
