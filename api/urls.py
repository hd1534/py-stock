from django.urls import path
from . import views

app_name = 'api'

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('nodes/', views.nodes_list, name='nodes_list'),
]
