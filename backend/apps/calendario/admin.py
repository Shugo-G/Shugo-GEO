from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import DiaNoLaborable


@admin.register(DiaNoLaborable)
class DiaNoLaborableAdmin(SimpleHistoryAdmin):
    list_display = ["fecha", "tipo", "motivo", "norma"]
    list_filter = ["tipo"]
    date_hierarchy = "fecha"
