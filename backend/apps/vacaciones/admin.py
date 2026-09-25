from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import MovimientoSaldo


@admin.register(MovimientoSaldo)
class MovimientoSaldoAdmin(SimpleHistoryAdmin):
    list_display = ["empleado", "tipo_novedad", "concepto", "anio", "dias", "fecha"]
    list_filter = ["tipo_novedad", "concepto", "anio"]
    search_fields = ["empleado__apellido", "empleado__nombre", "empleado__legajo"]
