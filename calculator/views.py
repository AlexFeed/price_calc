from django.shortcuts import render
from django import forms
from .models import Rate
from django.utils import timezone
from statistics import median
from datetime import timedelta
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseBadRequest
import json
from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.utils.dateparse import parse_datetime
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

VALIDITY_DAYS = 14


class CalcForm(forms.Form):
    origin_city = forms.CharField(label='Город отправления', max_length=200, required=False)
    destination_city = forms.CharField(label='Город прибытия', max_length=200, required=False)
    container_type = forms.CharField(label='Тип контейнера', max_length=100, required=False)
    transport_type = forms.CharField(label='Вид транспорта', max_length=100, required=False)
    email = forms.EmailField(label='Email (опционально)', required=False)
    include_all_dates = forms.BooleanField(label='Показывать записи за все время', required=False)


def compute_stats(qs):
    rates = [float(r.rate) for r in qs]
    if not rates:
        return None
    # handle negative values correctly — statistics functions work with negatives
    return {
        'min': min(rates),
        'max': max(rates),
        'avg': sum(rates) / len(rates),
        'median': median(rates),
        'count': len(rates),
    }


def index(request):
    # populate choices from DB unique values
    origins = Rate.objects.order_by('origin_city').values_list('origin_city', flat=True).distinct()
    destinations = Rate.objects.order_by('destination_city').values_list('destination_city', flat=True).distinct()
    containers = Rate.objects.order_by('container_type').values_list('container_type', flat=True).distinct()
    transports = Rate.objects.order_by('transport_type').values_list('transport_type', flat=True).distinct()

    if request.method == 'POST':
        form = CalcForm(request.POST)
        if form.is_valid():
            origin = form.cleaned_data['origin_city']
            dest = form.cleaned_data['destination_city']
            container = form.cleaned_data['container_type']
            transport = form.cleaned_data['transport_type']
            email = form.cleaned_data['email']

            qs = Rate.objects.all()
            if origin:
                qs = qs.filter(origin_city=origin)
            if dest:
                qs = qs.filter(destination_city=dest)
            if container:
                qs = qs.filter(container_type=container)
            if transport:
                qs = qs.filter(transport_type=transport)

            # Optionally restrict to rates within validity window (last VALIDITY_DAYS)
            include_all = form.cleaned_data.get('include_all_dates')
            if not include_all:
                since = timezone.now() - timedelta(days=VALIDITY_DAYS)
                qs = qs.filter(input_date__gte=since)

            stats = compute_stats(qs)

            # prepare list of matched Rate objects to show on results page
            rates_list = qs.order_by('-input_date')[:200]

            context = {
                'form': form,
                'origins': origins,
                'destinations': destinations,
                'containers': containers,
                'transports': transports,
                'stats': stats,
                'rates_list': rates_list,
                'validity_days': VALIDITY_DAYS,
            }
            return render(request, 'calculator/result.html', context)
    else:
        form = CalcForm()

    return render(request, 'calculator/index.html', {
        'form': form,
        'origins': origins,
        'destinations': destinations,
        'containers': containers,
        'transports': transports,
        'validity_days': VALIDITY_DAYS,
    })


def calc_api(request):
    """API: POST calculator query -> return stats and list of matched rates as JSON."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    # support JSON body or form-encoded POST
    origin = request.POST.get('origin_city') or request.GET.get('origin_city')
    dest = request.POST.get('destination_city') or request.GET.get('destination_city')
    container = request.POST.get('container_type') or request.GET.get('container_type')
    transport = request.POST.get('transport_type') or request.GET.get('transport_type')
    include_all = request.POST.get('include_all_dates') or request.POST.get('include_all') or request.GET.get(
        'include_all')

    qs = Rate.objects.all()
    if origin:
        qs = qs.filter(origin_city=origin)
    if dest:
        qs = qs.filter(destination_city=dest)
    if container:
        qs = qs.filter(container_type=container)
    if transport:
        qs = qs.filter(transport_type=transport)

    if not include_all:
        since = timezone.now() - timedelta(days=VALIDITY_DAYS)
        qs = qs.filter(input_date__gte=since)

    stats = compute_stats(qs)
    rates_list = qs.order_by('-input_date')[:200]

    records = []
    for r in rates_list:
        records.append({
            'id': r.id,
            'input_date': r.input_date.strftime('%Y-%m-%d %H:%M'),
            'origin_city': r.origin_city,
            'destination_city': r.destination_city,
            'container_type': r.container_type,
            'transport_type': r.transport_type,
            'email': r.email,
            'rate': float(r.rate),
        })

    return JsonResponse({'stats': stats, 'rates': records})


def atk_home(request):
    """Render the ATK landing page (static template)."""
    return render(request, 'calculator/ATK.html')


def interface_database(request):
    """Render the management interface page."""
    return render(request, 'calculator/interface_database.html')


def manage_users_api(request):
    """GET: list users; POST: create user (expects JSON with email,password,name)

    Uses Django's built-in User model so passwords are hashed and users appear in admin.
    """
    if request.method == 'GET':
        qs = User.objects.filter(is_active=True).order_by('-date_joined').values('id', 'email', 'first_name',
                                                                                 'date_joined')
        users = []
        for u in qs:
            users.append(
                {'id': u['id'], 'email': u['email'], 'name': u.get('first_name', ''), 'created_at': u['date_joined']})
        return JsonResponse({'users': users})

    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest('invalid json')

        email = payload.get('email')
        password = payload.get('password')
        name = payload.get('name', '')
        if not email or not password:
            return JsonResponse({'error': 'email and password required'}, status=400)

        # Create or update a Django User. Use email as username for simplicity.
        user = User.objects.filter(email=email).first()
        if user:
            # update password and name
            user.set_password(password)
            user.first_name = name or user.first_name
            user.save()
            created = False
        else:
            # create new user (username must be unique)
            username = email
            if User.objects.filter(username=username).exists():
                base = username
                i = 1
                while User.objects.filter(username=f"{base}_{i}").exists():
                    i += 1
                username = f"{base}_{i}"
            user = User.objects.create_user(username=username, email=email, password=password, first_name=name)
            created = True

        # Attempt to authenticate and log the user in so the client gets a session cookie
        try:
            # username used at creation time
            username_for_auth = user.username
            auth_user = authenticate(request, username=username_for_auth, password=password)
            if auth_user is not None:
                login(request, auth_user)
        except Exception:
            pass

        return JsonResponse({'id': user.id, 'email': user.email, 'name': user.first_name, 'created': created,
                             'date_joined': user.date_joined})


def manage_login_api(request):
    """POST: {email,password} -> returns user info if ok"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest('invalid json')

    email = payload.get('email')
    password = payload.get('password')
    if not email or not password:
        return JsonResponse({'error': 'email/password required'}, status=400)

    # Try authenticating using email as username first
    user = authenticate(request, username=email, password=password)
    if user is None:
        try:
            uobj = User.objects.get(email=email)
            user = authenticate(request, username=uobj.username, password=password)
        except User.DoesNotExist:
            user = None

    if user is None:
        return JsonResponse({'error': 'invalid credentials'}, status=403)

    # create session
    login(request, user)

    return JsonResponse({'id': user.id, 'email': user.email, 'name': user.first_name, 'date_joined': user.date_joined})


def whoami(request):
    """Return current authenticated user (or 401)."""
    if request.user.is_authenticated:
        return JsonResponse({'id': request.user.id, 'email': request.user.email, 'name': request.user.first_name})
    return JsonResponse({'error': 'anonymous'}, status=401)


def records_api(request):
    """
    API:
    GET -> вернуть список записей (с пагинацией и фильтрами)
    POST -> создать НОВУЮ запись

    Query params:
      - page (int, default=1)
      - page_size (int, default=10)
      - status (correct|incorrect|pending) optional
    """
    # Добавление нового письма в таблицу
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'authentication required'}, status=403)

        try:
            payload = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest('invalid json')

        # Подготовка данных
        try:
            from decimal import Decimal
            rate_val = Decimal(str(payload.get('rate', 0)))
        except:
            rate_val = 0

        # Парсинг даты (если пришла строка, превращаем в дату)
        input_date = payload.get('input_date') or payload.get('calculationDate')
        dt = timezone.now()
        if input_date:
            try:
                parsed = parse_datetime(input_date)
                if parsed: dt = parsed
            except: pass

        # Создание записи в базе
        new_record = Rate.objects.create(
            client_name=payload.get('client_name', ''),   # Название компании
            email=payload.get('email', ''),               # Email
            origin_city=payload.get('origin_city') or payload.get('routeFrom', ''),
            destination_city=payload.get('destination_city') or payload.get('routeTo', ''),
            rate=rate_val,
            input_date=dt,
            processing_status=payload.get('processing_status', 'pending'),

            # Дефолтные значения (можно будет добавить в форму позже)
            container_type=payload.get('container_type', '20ft'),
            transport_type=payload.get('transport_type', 'авто'),

            last_edited_by=request.user.email
        )

        # Возвращаем ID созданной записи
        return JsonResponse({'status': 'created', 'id': new_record.id}, status=201)


    # Получение всех записей из бд
    if request.method == 'GET':
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        status = request.GET.get('status')

        qs = Rate.objects.order_by('-input_date')
        if status:
            qs = qs.filter(processing_status=status)

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except (EmptyPage, PageNotAnInteger):
            page_obj = paginator.page(1)

        records = []
        for r in page_obj.object_list:
            records.append({
                'id': r.id,
                'client_name': r.client_name,
                'email': r.email,
                'origin_city': r.origin_city,
                'destination_city': r.destination_city,
                'container_type': r.container_type,
                'transport_type': r.transport_type,
                'rate': float(r.rate),
                'input_date': r.input_date.isoformat(),
                'processing_status': r.processing_status,
                'last_edited_by': r.last_edited_by,
            })

        return JsonResponse({
            'total': paginator.count,
            'page': page_obj.number,
            'page_size': page_size,
            'num_pages': paginator.num_pages,
            'records': records,
        })

    return JsonResponse({'error': 'method not allowed'}, status=405)


def record_detail_api(request, record_id):
    """Return or update a single Rate record as JSON (by id)."""

    # GET -> return record
    if request.method == 'GET':
        try:
            r = Rate.objects.get(pk=record_id)
        except Rate.DoesNotExist:
            return JsonResponse({'error': 'not found'}, status=404)

        rec = {
            'id': r.id,
            'client_name': r.client_name,
            'email': r.email,
            'origin_city': r.origin_city,
            'destination_city': r.destination_city,
            'routeFrom': r.origin_city,
            'routeTo': r.destination_city,
            'container_type': r.container_type,
            'transport_type': r.transport_type,
            'rate': float(r.rate),
            'input_date': r.input_date.isoformat(),
            'calculationDate': r.input_date.isoformat(),
            'processing_status': r.processing_status,
            'processingStatus': r.processing_status,
            'last_edited_by': r.last_edited_by,
            'lastEditedBy': r.last_edited_by,
        }
        return JsonResponse({'record': rec})

    # POST -> update record
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'authentication required'}, status=403)

        try:
            payload = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest('invalid json')

        try:
            r = Rate.objects.get(pk=record_id)
        except Rate.DoesNotExist:
            return JsonResponse({'error': 'not found'}, status=404)

        # Обновляем поля
        # Читаем имя клиента
        if 'client_name' in payload:
            r.client_name = payload['client_name']

        if 'email' in payload:
            r.email = payload['email']

        # Остальные поля (без изменений логики)
        origin = payload.get('origin_city') or payload.get('routeFrom')
        dest = payload.get('destination_city') or payload.get('routeTo')
        if origin: r.origin_city = origin
        if dest: r.destination_city = dest

        rate_val = payload.get('rate')
        if rate_val is not None:
            try:
                from decimal import Decimal
                r.rate = Decimal(str(rate_val))
            except:
                pass

        input_date = payload.get('input_date') or payload.get('calculationDate')
        if input_date:
            try:
                dt = parse_datetime(input_date)
                if dt: r.input_date = dt
            except:
                pass

        processing = payload.get('processing_status') or payload.get('processingStatus')
        if processing in dict(Rate.PROCESSING_STATUS_CHOICES):
            r.processing_status = processing

        # Кто редактировал
        if request.user.email:
            r.last_edited_by = request.user.email

        r.save()
        return JsonResponse({'status': 'ok'})

    return JsonResponse({'error': 'method not allowed'}, status=405)


def notifications_api(request):
    """Return notifications: records with processing_status='incorrect'."""
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=405)

    qs = Rate.objects.filter(processing_status='incorrect').order_by('-input_date')
    items = []
    for r in qs[:50]:
        items.append({
            'id': r.id,
            'client': r.email or '',
            'routeFrom': r.origin_city,
            'routeTo': r.destination_city,
            'rate': float(r.rate),
            'input_date': r.input_date.isoformat(),
        })
    return JsonResponse({'count': qs.count(), 'items': items})


def manage_logout_api(request):
    """Log out current session."""
    from django.contrib.auth import logout
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    logout(request)
    return JsonResponse({'status': 'ok'})


@csrf_exempt
def receive_rate(request):
    """API endpoint for receiving parsed email data (JSON POST).

    Expected JSON fields: origin_city, destination_city, container_type,
    transport_type, rate, input_date (optional ISO), email (optional)
    """
    # Simple API key check (header X-API-KEY)
    api_key = request.headers.get('X-API-KEY') or request.META.get('HTTP_X_API_KEY')
    expected = getattr(settings, 'EMAIL_API_KEY', None)
    if expected and api_key != expected:
        return JsonResponse({'error': 'invalid api key'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest('invalid json')

    required = ['origin_city', 'destination_city', 'container_type', 'transport_type', 'rate']
    for f in required:
        if f not in payload:
            return JsonResponse({'error': f'missing field {f}'}, status=400)

    # parse rate and date
    try:
        rate_value = float(payload.get('rate'))
    except Exception:
        return JsonResponse({'error': 'invalid rate'}, status=400)

    input_date = payload.get('input_date')
    if input_date:
        try:
            # naive parsing; let Django handle timezone on save
            dt = parse_datetime(input_date)
            if dt is None:
                dt = timezone.now()
        except Exception:
            dt = timezone.now()
    else:
        dt = timezone.now()

    r = Rate.objects.create(
        origin_city=payload.get('origin_city', ''),
        destination_city=payload.get('destination_city', ''),
        container_type=payload.get('container_type', ''),
        transport_type=payload.get('transport_type', ''),
        email=payload.get('email'),
        rate=rate_value,
        input_date=dt,
    )

    return JsonResponse({'status': 'ok', 'id': r.id})
