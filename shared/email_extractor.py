"""Placeholder for the email parsing/extraction service.

The real team provides a function with the same signature that extracts
needed fields from the raw email content. We keep a simple mock here so
the `email-processor` can call it during development.
"""
from datetime import datetime


def extract_data(raw_email_text: str) -> dict:
    """Extract fields from raw email text and return a dict.

    This is a best-effort mock: it looks for simple patterns like
    "origin: Москва" or "rate: 123.45". The real extractor will replace
    this function in production.
    """
    result = {
        'origin_city': None,
        'destination_city': None,
        'container_type': None,
        'transport_type': None,
        'email': None,
        'rate': None,
        'input_date': datetime.utcnow().isoformat() + 'Z',
    }

    text = raw_email_text.lower()
    # naive heuristics for demo purposes
    if 'москва' in text:
        result['origin_city'] = 'Москва'
    if 'санкт' in text or 'петербург' in text:
        result['destination_city'] = 'Санкт-Петербург'
    if '20ft' in text or '20ft' in raw_email_text:
        result['container_type'] = '20ft'
    if '40ft' in text:
        result['container_type'] = '40ft'
    if 'мор' in text:
        result['transport_type'] = 'морской'
    if 'ж/д' in text or 'жд' in text or 'жд' in raw_email_text:
        result['transport_type'] = 'ж/д'

    # find a number for rate
    import re
    m = re.search(r'([-+]?[0-9]+(?:\.[0-9]+)?)', raw_email_text)
    if m:
        try:
            result['rate'] = float(m.group(1))
        except Exception:
            result['rate'] = None

    return result
