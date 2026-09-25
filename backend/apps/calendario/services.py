"""Cómputo de días hábiles/corridos y carga de feriados."""
from datetime import date

import holidays
from django.conf import settings

from apps.core.fechas import es_fin_de_semana, rango_fechas

from .models import DiaNoLaborable, TipoDiaNoLaborable


class ComputoDias:
    HABILES = "HABILES"
    CORRIDOS = "CORRIDOS"
    CHOICES = [(HABILES, "Días hábiles"), (CORRIDOS, "Días corridos")]


def dias_no_laborables(desde: date, hasta: date) -> dict[date, DiaNoLaborable]:
    return {d.fecha: d for d in DiaNoLaborable.objects.filter(fecha__range=(desde, hasta))}


def es_habil(dia: date, no_laborables: dict | set) -> bool:
    return not es_fin_de_semana(dia) and dia not in no_laborables


def contar_dias(desde: date, hasta: date, modo: str = ComputoDias.HABILES) -> int:
    """Cantidad de días entre dos fechas (inclusive) según el modo de cómputo."""
    if hasta < desde:
        return 0
    if modo == ComputoDias.CORRIDOS:
        return (hasta - desde).days + 1
    no_laborables = set(dias_no_laborables(desde, hasta))
    return sum(1 for dia in rango_fechas(desde, hasta) if es_habil(dia, no_laborables))


def cargar_feriados_nacionales(anio: int) -> tuple[int, int]:
    """Carga los feriados nacionales del año. No pisa registros existentes. Devuelve (creados, existentes)."""
    feriados = holidays.country_holidays(settings.SHUGO["PAIS_FERIADOS"], years=anio, language="es")
    creados = existentes = 0
    for fecha, nombre in sorted(feriados.items()):
        tipo = (
            TipoDiaNoLaborable.NO_LABORABLE
            if "turístico" in nombre.lower() or "turistico" in nombre.lower()
            else TipoDiaNoLaborable.FERIADO_NACIONAL
        )
        _, creado = DiaNoLaborable.objects.get_or_create(fecha=fecha, defaults={"tipo": tipo, "motivo": nombre})
        creados += creado
        existentes += not creado
    return creados, existentes
