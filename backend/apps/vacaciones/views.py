import django_filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import requiere_permisos
from apps.core.viewsets import AuditedModelViewSet
from apps.novedades.models import TipoNovedad
from apps.organizacion.selectors import Arbol, unidades_con_descendientes
from apps.personal.models import Empleado
from apps.personal.selectors import filtrar_empleados

from .models import ConceptoMovimiento, MovimientoSaldo
from .serializers import AsignacionMasivaSerializer, MovimientoSaldoSerializer
from .services import asignar_dias_masivo, bolsas_de_saldo, guardar_preferencia, saldos_por_empleado


class MovimientoSaldoFilter(django_filters.FilterSet):
    empleado = django_filters.BaseInFilter(field_name="empleado_id")
    unidad = django_filters.CharFilter(method="filtrar_unidad")

    class Meta:
        model = MovimientoSaldo
        fields = ["empleado", "tipo_novedad", "concepto", "anio", "unidad"]

    def filtrar_unidad(self, queryset, name, value):
        unidades = unidades_con_descendientes(value)
        return queryset if unidades is None else queryset.filter(empleado__unidad_id__in=unidades)


class MovimientoSaldoViewSet(AuditedModelViewSet):
    queryset = MovimientoSaldo.objects.select_related("empleado", "tipo_novedad", "creado_por")
    serializer_class = MovimientoSaldoSerializer
    filterset_class = MovimientoSaldoFilter
    search_fields = ["empleado__apellido", "empleado__nombre", "empleado__legajo", "motivo"]
    ordering_fields = ["fecha", "anio", "dias"]

    @action(detail=False, methods=["get"])
    def conceptos(self, request):
        return Response([{"value": v, "label": l} for v, l in ConceptoMovimiento.choices])

    @action(detail=False, methods=["post"], url_path="asignacion-masiva")
    def asignacion_masiva(self, request):
        """Asigna días a todos los empleados vigentes (o a los filtrados por unidad organizativa/modalidad/lista)."""
        serializer = AsignacionMasivaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        empleados = Empleado.objects.vigentes()
        if datos.get("empleados"):
            empleados = empleados.filter(id__in=datos["empleados"])
        if datos.get("unidad"):
            empleados = empleados.filter(unidad_id__in=Arbol().descendientes(datos["unidad"]))
        if datos.get("modalidad"):
            empleados = empleados.filter(modalidad_id__in=datos["modalidad"])

        creados, omitidos = asignar_dias_masivo(
            empleados=list(empleados),
            tipo=datos["tipo_novedad"],
            anio=datos["anio"],
            dias=datos["dias"],
            motivo=datos.get("motivo") or f"Asignación {datos['anio']}",
            usuario=request.user,
            omitir_existentes=datos["omitir_existentes"],
        )
        return Response({"creados": creados, "omitidos": omitidos})


class PreferenciaSaldoView(APIView):
    """
    POST {empleado, tipo, anio, visible}: muestra u oculta una bolsa (y año, si es
    anual) en la ficha del empleado. `visible: null` vuelve a la regla por defecto.
    """

    permission_classes = [requiere_permisos("personal.change_empleado")]

    def post(self, request):
        from django.shortcuts import get_object_or_404

        empleado = get_object_or_404(Empleado, pk=request.data.get("empleado"))
        tipo = get_object_or_404(TipoNovedad, pk=request.data.get("tipo"))
        visible = request.data.get("visible")
        if visible not in (True, False, None):
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"visible": "Debe ser true, false o null."})
        bolsa = tipo.tipo_saldo
        anio = request.data.get("anio") if bolsa.saldo_por_anio else None
        guardar_preferencia(empleado, bolsa, visible, anio)
        return Response(saldos_por_empleado([empleado.id])[empleado.id].get((bolsa.id, anio)))


class SaldosView(APIView):
    """Saldos de cada empleado por bolsa de días (filtros comunes del dashboard)."""

    permission_classes = [requiere_permisos("vacaciones.view_movimientosaldo")]

    def get(self, request):
        empleados = list(filtrar_empleados(request.query_params))
        # Se muestra una columna por bolsa de días; filtrar por un tipo que comparte
        # saldo (p. ej. Licencia invernal) muestra la bolsa que usa.
        filtro = request.query_params.get("tipo")
        incluir_ocultas = request.query_params.get("incluir_ocultas") in ("1", "true")
        tipos = bolsas_de_saldo(
            TipoNovedad.objects.filter(id__in=filtro.split(",")) if filtro else None,
            incluir_ocultas=incluir_ocultas or bool(filtro),
        )
        saldos = saldos_por_empleado([e.id for e in empleados], tipos)
        arbol = Arbol()
        filas = [
            {
                "empleado_id": e.id,
                "empleado": e.nombre_completo,
                "legajo": e.legajo,
                "unidad": arbol.ruta(e.unidad_id),
                "modalidad": e.modalidad.nombre,
                "saldos": list(saldos[e.id].values()),
            }
            for e in empleados
        ]
        return Response({"tipos": [{"id": t.id, "nombre": t.nombre} for t in tipos], "resultados": filas})
