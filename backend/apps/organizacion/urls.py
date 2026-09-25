from rest_framework.routers import DefaultRouter

from .views import ModalidadContratacionViewSet, PuestoViewSet, UnidadOrganizativaViewSet

router = DefaultRouter()
router.register("unidades", UnidadOrganizativaViewSet)
router.register("puestos", PuestoViewSet)
router.register("modalidades", ModalidadContratacionViewSet)

urlpatterns = router.urls
