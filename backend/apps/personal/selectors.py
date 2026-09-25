"""Consultas de personal reutilizadas por dashboard, calendario y reportes."""
from django.db.models import Q, QuerySet

from apps.organizacion.selectors import unidades_con_descendientes

from .models import Empleado


def _ids(valor: str | None) -> list[str]:
    return [v for v in (valor or "").split(",") if v]


def filtrar_empleados(params, solo_vigentes: bool = True) -> QuerySet[Empleado]:
    """
    Aplica los filtros comunes (unidad organizativa —incluye sus dependientes—,
    modalidad, empleado, búsqueda) recibidos como query params. Los valores múltiples van separados por coma.
    """
    qs = Empleado.objects.con_relaciones()
    if solo_vigentes:
        qs = qs.vigentes()
    if (unidades := unidades_con_descendientes(params.get("unidad"))) is not None:
        qs = qs.filter(unidad_id__in=unidades)
    if modalidades := _ids(params.get("modalidad")):
        qs = qs.filter(modalidad_id__in=modalidades)
    if empleados := _ids(params.get("empleado")):
        qs = qs.filter(id__in=empleados)
    if situaciones := _ids(params.get("situacion_revista")):
        qs = qs.filter(situacion_revista__in=situaciones)
    if texto := (params.get("q") or "").strip():
        qs = qs.filter(
            Q(apellido__icontains=texto) | Q(nombre__icontains=texto) | Q(dni__icontains=texto) | Q(legajo__icontains=texto)
        )
    return qs
