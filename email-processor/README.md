Email-processor service

Usage (PowerShell):

Set environment variables (example):

```powershell
$env:IMAP_HOST = 'imap.example.com'
$env:IMAP_USER = 'inbox@example.com'
$env:IMAP_PASS = 'secret'
$env:DJANGO_API_URL = 'http://127.0.0.1:8000/api/receive_rate/'
$env:DJANGO_API_KEY = 'dev-secret-key'
python main.py
```

Notes:
- This service uses the shared extractor `shared/email_extractor.py` as a placeholder.
- In production replace `extract_data` with the real extractor implementation.
- Run under a supervisor or as a scheduled job; the script currently loops every `POLL_SECONDS` seconds.
