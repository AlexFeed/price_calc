from django.db import models


class Rate(models.Model):
    origin_city = models.CharField(max_length=200)
    destination_city = models.CharField(max_length=200)
    container_type = models.CharField(max_length=100)
    transport_type = models.CharField(max_length=100)
    client_name = models.CharField(max_length=200, blank=True, null=True, verbose_name="Имя клиента")

    CURRENCY_CHOICES = [
        ('USD', '$'),
        ('RUB', '₽')
    ]
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD', verbose_name="Валюта")

    # processing status: correct / incorrect / pending
    PROCESSING_STATUS_CHOICES = [
        ('correct', 'Корректно'),
        ('incorrect', 'Некорректно'),
        ('pending', 'В обработке'),
    ]
    processing_status = models.CharField(max_length=20, choices=PROCESSING_STATUS_CHOICES, default='pending')
    # who last edited this record (email)
    last_edited_by = models.EmailField(blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    input_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-input_date']

    def __str__(self):
        return f"{self.client_name or 'NoName'} {self.origin_city} -> {self.destination_city} | {self.container_type} | {self.transport_type} : {self.rate}"


