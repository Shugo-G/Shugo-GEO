from rest_framework.routers import DefaultRouter

from .views import (
    AdicionalViewSet,
    CargoViewSet,
    DocumentoUnidadViewSet,
    ModalidadContratacionViewSet,
    UnidadOrganizativaViewSet,
)

router = DefaultRouter()
router.register("unidades", UnidadOrganizativaViewSet)
router.register("documentos-unidad", DocumentoUnidadViewSet)
router.register("modalidades", ModalidadContratacionViewSet)
router.register("cargos", CargoViewSet)
router.register("adicionales", AdicionalViewSet)

urlpatterns = router.urls
