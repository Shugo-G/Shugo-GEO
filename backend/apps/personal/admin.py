from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Empleado


@admin.register(Empleado)
class EmpleadoAdmin(SimpleHistoryAdmin):
    list_display = ["legajo", "apellido", "nombre", "unidad", "modalidad", "situacion_revista"]
    list_filter = ["unidad", "modalidad", "situacion_revista"]
    search_fields = ["apellido", "nombre", "dni", "legajo"]
