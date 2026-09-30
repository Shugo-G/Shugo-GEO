from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import DocumentoNovedad, Novedad, TipoNovedad


@admin.register(TipoNovedad)
class TipoNovedadAdmin(SimpleHistoryAdmin):
    list_display = ["nombre", "color", "computo_dias", "descuenta_saldo", "requiere_documentacion", "activo"]
    list_filter = ["activo"]


class DocumentoInline(admin.TabularInline):
    model = DocumentoNovedad
    extra = 0


@admin.register(Novedad)
class NovedadAdmin(SimpleHistoryAdmin):
    list_display = ["empleado", "tipo", "fecha_desde", "fecha_hasta", "dias"]
    list_filter = ["tipo"]
    search_fields = ["empleado__apellido", "empleado__nombre", "empleado__legajo"]
    date_hierarchy = "fecha_desde"
    inlines = [DocumentoInline]
