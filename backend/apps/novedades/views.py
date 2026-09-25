from django.db.models import Count, Q, Sum
from django.http import FileResponse, Http404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.fechas import parse_fecha_param
from apps.core.viewsets import AuditedModelViewSet, CatalogoViewSet

from .filters import NovedadFilter
from .models import CategoriaEstado, DocumentoNovedad, Novedad, TipoNovedad
from .serializers import (
    CategoriaEstadoSerializer,
    DocumentoNovedadSerializer,
    NovedadSerializer,
    TipoNovedadSerializer,
)
from .services import anular_novedad, calcular_dias, eliminar_tipo, interrumpir_novedad, puede_eliminarse


class CategoriaEstadoViewSet(CatalogoViewSet):
    queryset = CategoriaEstado.objects.all()
    serializer_class = CategoriaEstadoSerializer


class TipoNovedadViewSet(CatalogoViewSet):
    queryset = TipoNovedad.objects.select_related("categoria")
    serializer_class = TipoNovedadSerializer
    filterset_fields = ["activo", "categoria", "descuenta_saldo", "mostrar_saldo"]

    def perform_destroy(self, instance):
        # Las licencias anuladas no bloquean: se eliminan junto con el tipo.
        eliminar_tipo(instance)

    @action(detail=True, methods=["get"])
    def uso(self, request, pk=None):
        """
        Quiénes usan el tipo: movimientos de saldo y novedades por empleado.
        Sirve para saber qué hay que corregir antes de poder eliminarlo.
        """
        from apps.vacaciones.models import MovimientoSaldo

        tipo = self.get_object()
        movimientos = (
            MovimientoSaldo.objects.filter(tipo_novedad=tipo)
            .values("empleado_id", "empleado__apellido", "empleado__nombre")
            .annotate(cantidad=Count("id"), dias=Sum("dias"))
            .order_by("empleado__apellido", "empleado__nombre")
        )
        novedades = (
            Novedad.todas.filter(tipo=tipo)
            .values("empleado_id", "empleado__apellido", "empleado__nombre")
            .annotate(cantidad=Count("id"), dias=Sum("dias"), anuladas=Count("id", filter=Q(anulada=True)))
            .order_by("empleado__apellido", "empleado__nombre")
        )

        def fila(r, **extra):
            return {
                "empleado_id": r["empleado_id"],
                "empleado": f"{r['empleado__apellido']}, {r['empleado__nombre']}",
                "cantidad": r["cantidad"],
                "dias": r["dias"] or 0,
                **extra,
            }

        filas_novedades = [fila(r, anuladas=r["anuladas"]) for r in novedades]
        comparten = list(tipo.tipos_que_comparten_saldo.values_list("nombre", flat=True))
        return Response(
            {
                "movimientos": [fila(r) for r in movimientos],
                "novedades": filas_novedades,
                "tipos_que_comparten_saldo": comparten,
                # Las anuladas no impiden eliminar: se borran junto con el tipo.
                "anuladas": sum(f["anuladas"] for f in filas_novedades),
                "bloquea_eliminacion": bool(
                    movimientos or comparten or any(f["cantidad"] > f["anuladas"] for f in filas_novedades)
                ),
            }
        )


class NovedadViewSet(AuditedModelViewSet):
    # `todas`: el listado incluye las anuladas (filtrables con ?situacion=).
    queryset = Novedad.todas.con_relaciones().select_related("anulada_por").annotate(cantidad_documentos=Count("documentos"))
    serializer_class = NovedadSerializer
    filterset_class = NovedadFilter
    search_fields = ["empleado__apellido", "empleado__nombre", "empleado__legajo", "motivo", "observaciones"]
    ordering_fields = ["fecha_desde", "fecha_hasta", "empleado__apellido", "dias"]

    @action(detail=False, methods=["get"], url_path="calcular-dias")
    def calcular_dias(self, request):
        """Previsualiza la cantidad de días para el formulario de carga."""
        try:
            tipo = TipoNovedad.objects.get(pk=request.query_params.get("tipo"))
        except (TipoNovedad.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"tipo": "Tipo de novedad inválido."})
        desde = parse_fecha_param(request.query_params.get("desde"), "desde")
        hasta = parse_fecha_param(request.query_params.get("hasta"), "hasta")
        if desde is None:
            raise ValidationError({"desde": "Indique la fecha de inicio."})
        return Response({"dias": calcular_dias(tipo, desde, hasta), "computo": tipo.get_computo_dias_display()})

    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        """Cierra una novedad abierta indicando la fecha de finalización."""
        self._exigir_permiso_edicion(request)
        novedad = self.get_object()
        serializer = self.get_serializer(novedad, data={"fecha_hasta": request.data.get("fecha_hasta")}, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def interrumpir(self, request, pk=None):
        """
        Corta una licencia antes de lo previsto (p. ej. el agente vuelve antes).
        Los días no tomados se reintegran al saldo.
        """
        self._exigir_permiso_edicion(request)
        novedad = self.get_object()
        fecha = parse_fecha_param(request.data.get("fecha_hasta"), "fecha_hasta")
        if fecha is None:
            raise ValidationError({"fecha_hasta": "Indique el último día efectivamente tomado."})
        novedad = interrumpir_novedad(novedad, fecha, request.data.get("motivo", ""))
        return Response(self.get_serializer(novedad).data)

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        """Anula una licencia cargada por error: se conserva el registro y sus días vuelven al saldo."""
        self._exigir_permiso_edicion(request)
        novedad = anular_novedad(self.get_object(), request.data.get("motivo", ""), request.user)
        return Response(self.get_serializer(novedad).data)

    def perform_destroy(self, instance):
        if not puede_eliminarse(instance):
            raise ValidationError(
                {
                    "detail": "Sólo pueden eliminarse licencias que todavía no comenzaron o que se cargaron hoy. "
                    "Si está en curso use 'Interrumpir'; si fue cargada por error use 'Anular'."
                }
            )
        instance.delete()

    def _exigir_permiso_edicion(self, request):
        # Las acciones POST se mapean por defecto al permiso "add"; éstas modifican una novedad existente.
        if not request.user.has_perm("novedades.change_novedad"):
            self.permission_denied(request)


class DocumentoNovedadViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Documentación respaldatoria. Por defecto sólo accesible para el rol Administrador."""

    queryset = DocumentoNovedad.objects.select_related("subido_por")
    serializer_class = DocumentoNovedadSerializer
    filterset_fields = ["novedad"]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(subido_por=self.request.user)

    def perform_destroy(self, instance):
        instance.archivo.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def descargar(self, request, pk=None):
        documento = self.get_object()
        try:
            archivo = documento.archivo.open("rb")
        except FileNotFoundError:
            raise Http404("El archivo no existe en el servidor.")
        return FileResponse(archivo, as_attachment=True, filename=documento.nombre_original)
