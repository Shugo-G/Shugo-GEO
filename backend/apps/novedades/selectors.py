"""Consultas de novedades reutilizadas por dashboard, calendario, ficha y reportes."""
from collections import defaultdict
from datetime import date

from django.db.models import QuerySet

from .models import Novedad


def novedades_en_periodo(desde: date, hasta: date) -> QuerySet[Novedad]:
    return Novedad.objects.con_relaciones().en_periodo(desde, hasta).order_by("fecha_desde")


def novedades_por_empleado(desde: date, hasta: date, empleado_ids) -> dict[int, list[Novedad]]:
    """Agrupa por empleado las novedades que se superponen con el período."""
    resultado: dict[int, list[Novedad]] = defaultdict(list)
    for novedad in novedades_en_periodo(desde, hasta).filter(empleado_id__in=empleado_ids):
        resultado[novedad.empleado_id].append(novedad)
    return resultado


def novedad_vigente_en(novedad: Novedad, dia: date) -> bool:
    return novedad.fecha_desde <= dia and (novedad.fecha_hasta is None or novedad.fecha_hasta >= dia)


def resumir_novedad(novedad: Novedad) -> dict:
    """Representación compacta usada en dashboard y ficha."""
    return {
        "id": novedad.id,
        "tipo_id": novedad.tipo_id,
        "tipo": novedad.tipo.nombre,
        "color": novedad.tipo.color,
        "desde": novedad.fecha_desde,
        "hasta": novedad.fecha_hasta,
        "dias": novedad.dias,
        "motivo": novedad.motivo,
        "interrumpida": novedad.interrumpida,
    }
