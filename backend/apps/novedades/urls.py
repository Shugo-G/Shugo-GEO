from rest_framework.routers import SimpleRouter

from .views import DocumentoNovedadViewSet, NovedadViewSet, TipoNovedadViewSet

# SimpleRouter (sin vista raíz) porque las novedades se exponen en la raíz del módulo.
router = SimpleRouter()
router.register("tipos", TipoNovedadViewSet)
router.register("documentos", DocumentoNovedadViewSet)
router.register("", NovedadViewSet)

urlpatterns = router.urls
