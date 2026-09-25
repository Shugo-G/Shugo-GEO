import django_filters
from django.db.models import Q

from apps.organizacion.selectors import unidades_con_descendientes

from .models import Novedad


class NovedadFilter(django_filters.FilterSet):
    empleado = django_filters.BaseInFilter(field_name="empleado_id")
    tipo = django_filters.BaseInFilter(field_name="tipo_id")
    categoria = django_filters.BaseInFilter(field_name="tipo__categoria_id")
    unidad = django_filters.CharFilter(method="filtrar_unidad")
    modalidad = django_filters.BaseInFilter(field_name="empleado__modalidad_id")
    descuenta_saldo = django_filters.BooleanFilter(field_name="tipo__descuenta_saldo")
    abierta = django_filters.BooleanFilter(field_name="fecha_hasta", lookup_expr="isnull")
    # Superposición con un período: desde/hasta
    desde = django_filters.DateFilter(method="filtrar_desde")
    hasta = django_filters.DateFilter(field_name="fecha_desde", lookup_expr="lte")
    anio = django_filters.NumberFilter(field_name="fecha_desde", lookup_expr="year")
    # activas = programadas y en curso · historial = finalizadas, interrumpidas y anuladas
    situacion = django_filters.ChoiceFilter(
        method="filtrar_situacion",
        choices=[("activas", "Activas"), ("historial", "Historial"), ("anuladas", "Anuladas")],
    )

    class Meta:
        model = Novedad
        fields = ["empleado", "tipo", "categoria", "unidad", "modalidad", "abierta"]

    def filtrar_unidad(self, queryset, name, value):
        unidades = unidades_con_descendientes(value)
        return queryset if unidades is None else queryset.filter(empleado__unidad_id__in=unidades)

    def filtrar_situacion(self, queryset, name, value):
        from apps.core.fechas import hoy

        if value == "activas":
            return queryset.activas(hoy())
        if value == "historial":
            return queryset.historial(hoy())
        return queryset.filter(anulada=True)

    def filtrar_desde(self, queryset, name, value):
        return queryset.filter(Q(fecha_hasta__gte=value) | Q(fecha_hasta__isnull=True))
