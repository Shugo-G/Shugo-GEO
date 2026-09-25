from rest_framework.routers import DefaultRouter

from .views import CargoPatrimonialViewSet, TipoInsumoViewSet

router = DefaultRouter()
router.register("insumos", TipoInsumoViewSet)
router.register("cargos", CargoPatrimonialViewSet)

urlpatterns = router.urls
