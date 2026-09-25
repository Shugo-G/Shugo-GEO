from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import CargoPatrimonial, TipoInsumo


@admin.register(TipoInsumo)
class TipoInsumoAdmin(SimpleHistoryAdmin):
    list_display = ["nombre", "orden", "activo"]
    list_filter = ["activo"]


@admin.register(CargoPatrimonial)
class CargoPatrimonialAdmin(SimpleHistoryAdmin):
    list_display = ["tipo_insumo", "iub", "planilla_cargo", "empleado", "legajo", "fecha_asignacion", "fecha_cierre", "tipo_cierre"]
    list_filter = ["tipo_insumo", "tipo_cierre"]
    search_fields = ["iub", "planilla_cargo", "descripcion", "legajo", "empleado__apellido"]
