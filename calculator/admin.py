from django.contrib import admin
from .models import Rate


@admin.register(Rate)
class RateAdmin(admin.ModelAdmin):
    list_display = ('origin_city', 'destination_city', 'container_type', 'transport_type', 'rate', 'processing_status', 'last_edited_by', 'input_date')
    list_filter = ('origin_city', 'destination_city', 'container_type', 'transport_type', 'processing_status')
    search_fields = ('origin_city', 'destination_city', 'container_type', 'transport_type', 'last_edited_by')
