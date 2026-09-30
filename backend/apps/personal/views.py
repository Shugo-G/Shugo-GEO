from django.db.models import Count, Sum
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.fechas import hoy
from apps.core.viewsets import AuditedModelViewSet
from apps.novedades.models import Novedad
from apps.novedades.selectors import novedades_por_empleado, resumir_novedad
from apps.vacaciones.services import saldos_por_empleado

from .filters import EmpleadoFilter
from .models import Empleado, SituacionRevista
from .serializers import EmpleadoSerializer


class EmpleadoViewSet(AuditedModelViewSet):
    queryset = Empleado.objects.con_relaciones()
    serializer_class = EmpleadoSerializer
    filterset_class = EmpleadoFilter
    search_fields = ["apellido", "nombre", "dni", "legajo", "email"]
    ordering_fields = ["apellido", "legajo", "fecha_ingreso", "unidad__nombre", "modalidad__nombre"]

    @action(detail=False, methods=["get"], url_path="situaciones")
    def situaciones(self, request):
        return Response([{"value": v, "label": l} for v, l in SituacionRevista.choices])

    @action(detail=True, methods=["get"])
    def ficha(self, request, pk=None):
        """Ficha individual: datos, situación del día, saldos y resumen de historial."""
        empleado = self.get_object()
        fecha = hoy()

        vigentes = novedades_por_empleado(fecha, fecha, [empleado.id]).get(empleado.id, [])
        proximas = (
            Novedad.objects.con_relaciones().filter(empleado=empleado, fecha_desde__gt=fecha).order_by("fecha_desde")[:5]
        )
        saldos = saldos_por_empleado([empleado.id])[empleado.id]

        historial = (
            Novedad.objects.filter(empleado=empleado)
            .values("tipo_id", "tipo__nombre", "tipo__color")
            .annotate(cantidad=Count("id"), dias=Sum("dias"))
            .order_by("tipo__nombre")
        )
        historial_anio = {
            h["tipo_id"]: h
            for h in Novedad.objects.filter(empleado=empleado, fecha_desde__year=fecha.year)
            .values("tipo_id")
            .annotate(cantidad=Count("id"), dias=Sum("dias"))
        }

        return Response(
            {
                "empleado": self.get_serializer(empleado).data,
                "situacion_actual": {
                    "fecha": fecha,
                    "trabajando": not vigentes,
                    "novedades": [resumir_novedad(n) for n in vigentes],
                },
                "proximas": [resumir_novedad(n) for n in proximas],
                "saldos": list(saldos.values()),
                "resumen_historial": [
                    {
                        "tipo_id": h["tipo_id"],
                        "tipo": h["tipo__nombre"],
                        "color": h["tipo__color"],
                        "cantidad": h["cantidad"],
                        "dias": h["dias"] or 0,
                        "cantidad_anio": historial_anio.get(h["tipo_id"], {}).get("cantidad", 0),
                        "dias_anio": historial_anio.get(h["tipo_id"], {}).get("dias") or 0,
                    }
                    for h in historial
                ],
            }
        )
