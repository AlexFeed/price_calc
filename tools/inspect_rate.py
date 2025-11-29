from calculator.models import Rate

r = Rate.objects.order_by('-id').first()
if not r:
    print('no rates')
else:
    print('ORM values:')
    print('origin repr:', repr(r.origin_city))
    print('destination repr:', repr(r.destination_city))
    print('container repr:', repr(r.container_type))
    print('transport repr:', repr(r.transport_type))
    print('rate repr:', repr(r.rate))

    # show utf-8 bytes
    try:
        print('\nUTF-8 bytes:')
        print('origin bytes:', r.origin_city.encode('utf-8'))
        print('origin hex:', r.origin_city.encode('utf-8').hex())
    except Exception as e:
        print('encode error', e)

    # try raw SQL fetch to see what sqlite returns
    from django.db import connection
    cur = connection.cursor()
    cur.execute('SELECT origin_city, destination_city FROM calculator_rate ORDER BY id DESC LIMIT 1')
    row = cur.fetchone()
    print('\nRaw SQL row:', row)
    if row:
        try:
            print('raw origin repr:', repr(row[0]))
            print('raw origin bytes:', row[0].encode('utf-8'))
        except Exception as e:
            print('raw encode error', e)
