import django_filters

from apps.organizacion.selectors import unidades_con_descendientes

from .models import Empleado


class EmpleadoFilter(django_filters.FilterSet):
    # Incluye a quienes dependen de unidades inferiores.
    unidad = django_filters.CharFilter(method="filtrar_unidad")
    modalidad = django_filters.BaseInFilter(field_name="modalidad_id")
    situacion_revista = django_filters.BaseInFilter(field_name="situacion_revista")
    contrato_vence_antes = django_filters.DateFilter(field_name="fecha_fin_contrato", lookup_expr="lte")

    class Meta:
        model = Empleado
        fields = ["unidad", "modalidad", "situacion_revista"]

    def filtrar_unidad(self, queryset, name, value):
        unidades = unidades_con_descendientes(value)
        return queryset if unidades is None else queryset.filter(unidad_id__in=unidades)
