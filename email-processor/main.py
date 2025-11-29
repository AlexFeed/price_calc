import os
import time
from email_handler import EmailHandler


def env(name, default=None):
    return os.environ.get(name, default)


def run_once():
    imap_host = env('IMAP_HOST')
    imap_user = env('IMAP_USER')
    imap_pass = env('IMAP_PASS')
    api_url = env('DJANGO_API_URL')
    api_key = env('DJANGO_API_KEY')

    if not (imap_host and imap_user and imap_pass and api_url):
        print('Please set IMAP_HOST, IMAP_USER, IMAP_PASS and DJANGO_API_URL')
        return

    h = EmailHandler(imap_host, imap_user, imap_pass, api_url, api_key)
    h.fetch_unseen_and_process()


if __name__ == '__main__':
    # simple loop; in production use supervisor/systemd or celery
    interval = int(env('POLL_SECONDS', 60))
    print('email-processor starting, polling every', interval, 'seconds')
    while True:
        try:
            run_once()
        except Exception as e:
            print('error:', e)
        time.sleep(interval)
