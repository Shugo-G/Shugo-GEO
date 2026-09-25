from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import ModalidadContratacion, Puesto, UnidadOrganizativa


@admin.register(UnidadOrganizativa)
class UnidadOrganizativaAdmin(SimpleHistoryAdmin):
    list_display = ["nombre", "tipo", "padre", "orden", "activo"]
    list_filter = ["tipo", "activo"]
    search_fields = ["nombre"]


@admin.register(Puesto)
class PuestoAdmin(SimpleHistoryAdmin):
    list_display = ["nombre", "orden", "activo"]
    list_filter = ["activo"]
    search_fields = ["nombre"]


@admin.register(ModalidadContratacion)
class ModalidadAdmin(SimpleHistoryAdmin):
    list_display = ["nombre", "usa_dni_como_legajo", "requiere_fecha_fin", "activo"]
    list_filter = ["activo"]
