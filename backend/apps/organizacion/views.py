from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.viewsets import CatalogoViewSet

from .models import ModalidadContratacion, TipoUnidad, UnidadOrganizativa
from .selectors import Arbol
from .serializers import ModalidadContratacionSerializer, UnidadOrganizativaSerializer


class UnidadOrganizativaViewSet(CatalogoViewSet):
    queryset = UnidadOrganizativa.objects.select_related("padre")
    serializer_class = UnidadOrganizativaSerializer
    filterset_fields = ["activo", "tipo", "padre"]

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
