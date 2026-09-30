from rest_framework.routers import DefaultRouter

from .views import EstadoLineaViewSet, LineaMovilViewSet, ProveedorViewSet, ServicioInternetViewSet, TipoSimViewSet

router = DefaultRouter()
router.register("proveedores", ProveedorViewSet)
router.register("tipos-sim", TipoSimViewSet)
router.register("estados-linea", EstadoLineaViewSet)
router.register("lineas", LineaMovilViewSet)
router.register("internet", ServicioInternetViewSet)

urlpatterns = router.urls
