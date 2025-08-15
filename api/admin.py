from django.contrib import admin
from .models import Workflow


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "updated_at", "created_at")
    search_fields = ("name",)
