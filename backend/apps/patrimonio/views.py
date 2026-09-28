import django_filters
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.archivos import descargar_adjunto
from apps.core.fechas import hoy, parse_fecha_param
from apps.core.viewsets import AuditedModelViewSet, CatalogoViewSet
from apps.organizacion.selectors import unidades_con_descendientes
from apps.personal.models import Empleado

from .models import CargoPatrimonial, DocumentoCargo, TipoCierre, TipoInsumo
from .serializers import CargoPatrimonialSerializer, DocumentoCargoSerializer, TipoInsumoSerializer
from .services import dar_de_baja, transferir


class TipoInsumoViewSet(CatalogoViewSet):
    queryset = TipoInsumo.objects.all()
    serializer_class = TipoInsumoSerializer


class CargoFilter(django_filters.FilterSet):
    empleado = django_filters.BaseInFilter(field_name="empleado_id")
    tipo_insumo = django_filters.BaseInFilter(field_name="tipo_insumo_id")
    unidad = django_filters.CharFilter(method="filtrar_unidad")
    # vigentes = a cargo actualmente · historial = cerrados
    situacion = django_filters.ChoiceFilter(method="filtrar_situacion", choices=[("vigentes", "Vigentes"), ("historial", "Historial")])
    tipo_cierre = django_filters.ChoiceFilter(choices=TipoCierre.choices)

    class Meta:
        model = CargoPatrimonial
        fields = ["empleado", "tipo_insumo", "situacion", "tipo_cierre"]

    def filtrar_unidad(self, queryset, name, value):
        unidades = unidades_con_descendientes(value)
        return queryset if unidades is None else queryset.filter(empleado__unidad_id__in=unidades)

    def filtrar_situacion(self, queryset, name, value):
        return queryset.filter(fecha_cierre__isnull=value == "vigentes")


class CargoPatrimonialViewSet(AuditedModelViewSet):
    queryset = CargoPatrimonial.objects.con_relaciones().annotate(cantidad_documentos=Count("documentos"))
    serializer_class = CargoPatrimonialSerializer
    filterset_class = CargoFilter
    search_fields = ["iub", "planilla_cargo", "descripcion", "legajo", "empleado__apellido", "empleado__nombre", "destino"]
    ordering_fields = ["fecha_asignacion", "fecha_cierre", "iub", "empleado__apellido", "tipo_insumo__nombre"]

    def perform_destroy(self, instance):
        # Error de carga: se borra el registro con sus archivos.
        for documento in instance.documentos.all():
            documento.archivo.delete(save=False)
        instance.delete()

    def _exigir_edicion(self, request):
        if not request.user.has_perm("patrimonio.change_cargopatrimonial"):
            self.permission_denied(request)

    def _fecha(self, request):
        return parse_fecha_param(request.data.get("fecha"), "fecha", hoy())

    @action(detail=True, methods=["post"], url_path="dar-de-baja")
    def dar_de_baja(self, request, pk=None):
        """El insumo queda fuera de servicio."""
        self._exigir_edicion(request)
        cargo = dar_de_baja(self.get_object(), self._fecha(request), request.data.get("motivo", ""))
        return Response(self.get_serializer(cargo).data)

    @action(detail=True, methods=["post"])
    def transferir(self, request, pk=None):
        """
        {empleado, planilla_cargo} → transfiere a otro agente (nuevo cargo, mismo IUB, planilla nueva).
        {area_externa} → transfiere a un área ajena a Informática (queda sin agente).
        """
        self._exigir_edicion(request)
        empleado = None
        if request.data.get("empleado"):
            empleado = get_object_or_404(Empleado, pk=request.data["empleado"])
        cargo = transferir(
            self.get_object(),
            self._fecha(request),
            empleado=empleado,
            area_externa=request.data.get("area_externa") or "",
            planilla_cargo=request.data.get("planilla_cargo") or "",
            motivo=request.data.get("motivo", ""),
            usuario=request.user,
        )
        return Response(self.get_serializer(cargo).data)

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """Cantidad de bienes a cargo por tipo de insumo (tarjetas del inventario)."""
        qs = self.filter_queryset(self.get_queryset()).vigentes()
        conteo = dict(qs.values_list("tipo_insumo_id").annotate(n=Count("id")))
        insumos = TipoInsumo.objects.filter(Q(activo=True) | Q(id__in=conteo)).order_by("orden", "nombre")
        return Response(
            {
                "total": sum(conteo.values()),
                "por_insumo": [{"id": t.id, "nombre": t.nombre, "cantidad": conteo.get(t.id, 0)} for t in insumos],
            }
        )

    @action(detail=False, methods=["get"])
    def cierres(self, request):
        return Response([{"value": v, "label": l} for v, l in TipoCierre.choices])


class DocumentoCargoViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Archivos de un cargo (planilla de cargo, actas). Se descargan sólo por la API."""

    queryset = DocumentoCargo.objects.select_related("subido_por")
    serializer_class = DocumentoCargoSerializer
    filterset_fields = ["cargo"]
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
