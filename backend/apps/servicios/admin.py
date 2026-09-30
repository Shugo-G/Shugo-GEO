from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import EstadoLinea, LineaMovil, Proveedor, ServicioInternet, TipoSim

for catalogo in (Proveedor, TipoSim, EstadoLinea):
    admin.site.register(catalogo, SimpleHistoryAdmin, list_display=["nombre", "orden", "activo"], list_filter=["activo"])


@admin.register(LineaMovil)
class LineaMovilAdmin(SimpleHistoryAdmin):
    list_display = ["numero", "numero_sim", "proveedor", "estado", "responsable", "area", "secretaria"]
    list_filter = ["proveedor", "estado", "tipo_sim"]
    search_fields = ["numero", "numero_sim", "responsable", "area", "secretaria"]


@admin.register(ServicioInternet)
class ServicioInternetAdmin(SimpleHistoryAdmin):
    list_display = ["sitio", "direccion", "proveedor", "numero_cliente", "velocidad", "ip_publica"]
    list_filter = ["proveedor"]
    search_fields = ["sitio", "direccion", "numero_cliente", "numero_fsan", "ip_publica"]
