import django_filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.fechas import parse_periodo
from apps.core.permissions import requiere_permisos
from apps.core.viewsets import AuditedModelViewSet
from apps.novedades.selectors import novedades_en_periodo
from apps.organizacion.selectors import Arbol
from apps.personal.selectors import filtrar_empleados

from .models import DiaNoLaborable, TipoDiaNoLaborable
from .serializers import DiaNoLaborableSerializer
from .services import cargar_feriados_nacionales


class DiaNoLaborableFilter(django_filters.FilterSet):
    desde = django_filters.DateFilter(field_name="fecha", lookup_expr="gte")
    hasta = django_filters.DateFilter(field_name="fecha", lookup_expr="lte")
    anio = django_filters.NumberFilter(field_name="fecha", lookup_expr="year")

    class Meta:
        model = DiaNoLaborable
        fields = ["tipo", "desde", "hasta", "anio"]


class DiaNoLaborableViewSet(AuditedModelViewSet):
    queryset = DiaNoLaborable.objects.all()
    serializer_class = DiaNoLaborableSerializer
    filterset_class = DiaNoLaborableFilter
    search_fields = ["motivo", "norma"]
    ordering_fields = ["fecha"]

    @action(detail=False, methods=["get"])
    def tipos(self, request):
        return Response([{"value": v, "label": l} for v, l in TipoDiaNoLaborable.choices])

    @action(detail=False, methods=["post"], url_path="cargar-nacionales")
    def cargar_nacionales(self, request):
        if not request.user.has_perm("calendario.add_dianolaborable"):
            self.permission_denied(request)
        try:
            anio = int(request.data.get("anio"))
        except (TypeError, ValueError):
            raise ValidationError({"anio": "Indique un año válido."})
        creados, existentes = cargar_feriados_nacionales(anio)
        return Response({"creados": creados, "existentes": existentes})


class EventosCalendarioView(APIView):
    """
    Eventos para el calendario general: novedades del personal y días no
    laborables dentro del período, con los mismos filtros del dashboard.
    """

    permission_classes = [requiere_permisos("novedades.view_novedad", "calendario.view_dianolaborable")]

    def get(self, request):
        desde, hasta = parse_periodo(request.query_params, max_dias=190)
        empleados = filtrar_empleados(request.query_params)
        novedades = novedades_en_periodo(desde, hasta).filter(empleado__in=empleados)
        categorias = request.query_params.get("categoria")
        if categorias:
            novedades = novedades.filter(tipo__categoria_id__in=categorias.split(","))

        arbol = Arbol()
        eventos = [
            {
                "id": n.id,
                "empleado_id": n.empleado_id,
                "empleado": n.empleado.nombre_completo,
                "foto_url": n.empleado.foto.url if n.empleado.foto else None,
                "unidad": arbol.ruta(n.empleado.unidad_id),
                "tipo": n.tipo.nombre,
                "categoria_id": n.tipo.categoria_id,
                "categoria": n.tipo.categoria.nombre,
                "cuenta_como_presente": n.tipo.categoria.cuenta_como_presente,
                "color": n.tipo.color_efectivo,
                "desde": n.fecha_desde,
                "hasta": n.fecha_hasta,
                "abierta": n.fecha_hasta is None,
                "motivo": n.motivo,
            }
            for n in novedades
        ]
        no_laborables = DiaNoLaborableSerializer(
            DiaNoLaborable.objects.filter(fecha__range=(desde, hasta)), many=True
        ).data
        return Response(
            {
                "desde": desde,
                "hasta": hasta,
                # Agentes vigentes con los filtros aplicados: base para "trabajando X de Y".
                "total_empleados": empleados.count(),
                "novedades": eventos,
                "no_laborables": no_laborables,
            }
        )
