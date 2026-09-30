from rest_framework.routers import DefaultRouter

from .views import ModalidadContratacionViewSet, UnidadOrganizativaViewSet

router = DefaultRouter()
router.register("unidades", UnidadOrganizativaViewSet)
router.register("modalidades", ModalidadContratacionViewSet)

urlpatterns = router.urls
