"""Utilidades de fechas compartidas."""
from datetime import date, timedelta
from collections.abc import Iterator

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


def hoy() -> date:
    return timezone.localdate()


def rango_fechas(desde: date, hasta: date) -> Iterator[date]:
    """Itera día por día entre `desde` y `hasta` (ambos inclusive)."""
    actual = desde
    while actual <= hasta:
        yield actual
        actual += timedelta(days=1)


def es_fin_de_semana(dia: date) -> bool:
    return dia.weekday() >= 5


def parse_fecha_param(valor: str | None, nombre: str, default: date | None = None) -> date | None:
    """Parsea un parámetro de query (YYYY-MM-DD) devolviendo un error 400 claro si es inválido."""
    if not valor:
        return default
    fecha = parse_date(valor)
    if fecha is None:
        raise ValidationError({nombre: "Fecha inválida, use el formato AAAA-MM-DD."})
    return fecha


def parse_periodo(params, max_dias: int = 366) -> tuple[date, date]:
    """Lee `desde`/`hasta` de los query params. Por defecto, el día de hoy."""
    desde = parse_fecha_param(params.get("desde"), "desde", hoy())
    hasta = parse_fecha_param(params.get("hasta"), "hasta", desde)
    if hasta < desde:
        raise ValidationError({"hasta": "La fecha 'hasta' no puede ser anterior a 'desde'."})
    if (hasta - desde).days > max_dias:
        raise ValidationError({"hasta": f"El período no puede superar {max_dias} días."})
    return desde, hasta
