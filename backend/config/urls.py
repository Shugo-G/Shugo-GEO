from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Cada módulo expone sus rutas bajo /api/<prefijo>/.
# Para sumar un módulo nuevo alcanza con agregar una línea acá.
API_MODULES = [
    ("auth/", "apps.accounts.urls"),
    ("core/", "apps.core.urls"),
    ("organizacion/", "apps.organizacion.urls"),
    ("personal/", "apps.personal.urls"),
    ("calendario/", "apps.calendario.urls"),
    ("novedades/", "apps.novedades.urls"),
    ("vacaciones/", "apps.vacaciones.urls"),
    ("dashboard/", "apps.dashboard.urls"),
    ("patrimonio/", "apps.patrimonio.urls"),
    ("reportes/", "apps.reportes.urls"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    *[path(f"api/{prefix}", include(module)) for prefix, module in API_MODULES],
]

if settings.DEBUG:
    # En desarrollo sólo se sirven las fotos. La documentación respaldatoria
    # nunca es pública: se descarga por la API con autenticación.
    urlpatterns += static(f"{settings.MEDIA_URL}fotos/", document_root=f"{settings.MEDIA_ROOT}/fotos")
