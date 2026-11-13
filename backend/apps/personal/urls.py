from rest_framework.routers import DefaultRouter

from .views import DocumentoEmpleadoViewSet, EmpleadoViewSet

router = DefaultRouter()
router.register("empleados", EmpleadoViewSet)
router.register("documentos", DocumentoEmpleadoViewSet)

urlpatterns = router.urls
