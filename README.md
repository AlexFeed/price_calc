# Price Calculator (Django prototype)

Minimal Django prototype for the customer's price calculator.

Setup (Windows PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata
python manage.py createsuperuser
python manage.py runserver
```

To load the provided sample JSON rates use:

```powershell
python manage.py load_sample_rates
```

Open http://127.0.0.1:8000/ to access the form.

Notes:
- Rates are stored in `calculator.Rate`.
- The UI filters by origin/destination/container/transport and uses only rates from the last 14 days.
- Negative rates are supported and included correctly in min/avg/max/median calculations.
