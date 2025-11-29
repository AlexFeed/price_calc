from django.urls import path
from . import views

app_name = 'calculator'

urlpatterns = [
    # Main landing: calculator (index)
    path('', views.index, name='home'),
    # Management interface (alternate path)
    path('manage/', views.interface_database, name='manage'),
    # Calculator page (accessible after auth from the main page)
    path('calculator/', views.index, name='calculator'),
    path('calculator/api/calc/', views.calc_api, name='calculator_api_calc'),
    # API for manage users
    path('manage/api/users/', views.manage_users_api, name='manage_users_api'),
    path('manage/api/login/', views.manage_login_api, name='manage_login_api'),
    path('manage/api/whoami/', views.whoami, name='manage_whoami'),
    path('manage/api/logout/', views.manage_logout_api, name='manage_logout'),
    path('manage/api/records/', views.records_api, name='manage_records_api'),
    path('manage/api/records/<int:record_id>/', views.record_detail_api, name='manage_record_detail_api'),
    path('manage/api/notifications/', views.notifications_api, name='manage_notifications_api'),
    path('api/receive_rate/', views.receive_rate, name='receive_rate'),
]
