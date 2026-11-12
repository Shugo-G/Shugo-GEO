from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.archivos import descargar_adjunto
from apps.core.viewsets import CatalogoViewSet

from .models import Adicional, Cargo, DocumentoUnidad, ModalidadContratacion, TipoUnidad, UnidadOrganizativa
from .selectors import Arbol
from .serializers import (
    AdicionalSerializer,
    CargoSerializer,
    DocumentoUnidadSerializer,
    ModalidadContratacionSerializer,
    UnidadOrganizativaSerializer,
)


class UnidadOrganizativaViewSet(CatalogoViewSet):
    queryset = UnidadOrganizativa.objects.select_related("padre")
    serializer_class = UnidadOrganizativaSerializer
    filterset_fields = ["activo", "tipo", "padre"]

    def perform_destroy(self, instance):
        archivos = [d.archivo for d in instance.documentos.all()]
        instance.delete()  # si está en uso falla acá (409) y no se toca ningún archivo
        for archivo in archivos:
            archivo.delete(save=False)

    @action(detail=False, methods=["get"])
    def arbol(self, request):
        """Estructura completa anidada, con cantidad de agentes activos por unidad."""
        conteo = dict(
            UnidadOrganizativa.objects.annotate(
                n=Count("empleados", filter=Q(empleados__situacion_revista="ACTIVO"))
            ).values_list("id", "n")
        )
        solo_activas = request.query_params.get("activo") in ("true", "1")
        return Response(Arbol().como_lista_anidada(conteo, solo_activas=solo_activas))

    @action(detail=False, methods=["get"])
    def tipos(self, request):
        return Response([{"value": v, "label": l} for v, l in TipoUnidad.choices])


class ModalidadContratacionViewSet(CatalogoViewSet):
    queryset = ModalidadContratacion.objects.all()
    serializer_class = ModalidadContratacionSerializer


class CargoViewSet(CatalogoViewSet):
    queryset = Cargo.objects.all()
    serializer_class = CargoSerializer


class AdicionalViewSet(CatalogoViewSet):
    queryset = Adicional.objects.all()
    serializer_class = AdicionalSerializer


class DocumentoUnidadViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Adjuntos de una unidad (acto administrativo que la crea). Se descargan sólo por la API."""

    queryset = DocumentoUnidad.objects.select_related("subido_por")
    serializer_class = DocumentoUnidadSerializer
    filterset_fields = ["unidad"]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(subido_por=self.request.user)

    def perform_destroy(self, instance):
        instance.archivo.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def descargar(self, request, pk=None):
        documento = self.get_object()
        return descargar_adjunto(documento.archivo, documento.nombre_original)
