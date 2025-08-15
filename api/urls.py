from django.urls import path
from . import views

app_name = 'api'

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('nodes/', views.nodes_list, name='nodes_list'),
    path('nodes/<str:node_id>/execute/',
         views.node_execute, name='node_execute'),
    path('workflows/', views.workflows_list, name='workflows_list'),
    path('workflows/create/', views.workflows_create, name='workflows_create'),
    path('workflows/<int:wf_id>/', views.workflows_detail, name='workflows_detail'),
]
