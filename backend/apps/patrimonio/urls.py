from rest_framework.routers import DefaultRouter

from .views import CargoPatrimonialViewSet, DocumentoCargoViewSet, TipoInsumoViewSet

router = DefaultRouter()
router.register("insumos", TipoInsumoViewSet)
router.register("cargos", CargoPatrimonialViewSet)
router.register("documentos", DocumentoCargoViewSet)

urlpatterns = router.urls
