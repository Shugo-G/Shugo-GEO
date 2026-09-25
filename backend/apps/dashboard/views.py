from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import requiere_permisos

from .services import estado_personal, grilla_periodo

PERMISOS_DASHBOARD = requiere_permisos("personal.view_empleado", "novedades.view_novedad")


class EstadoPersonalView(APIView):
    """
    GET /api/dashboard/estado/?desde=&hasta=&unidad=&modalidad=&empleado=&estado=
    Filtros múltiples separados por coma. `estado` acepta `trabajando`,
    `sin_novedad` o ids de categoría.
    """

    permission_classes = [PERMISOS_DASHBOARD]

    def get(self, request):
        return Response(estado_personal(request.query_params))


class GrillaPeriodoView(APIView):
    """GET /api/dashboard/grilla/?desde=&hasta=&... (máximo 92 días)."""

    permission_classes = [PERMISOS_DASHBOARD]

    def get(self, request):
        return Response(grilla_periodo(request.query_params))
