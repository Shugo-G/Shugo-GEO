"""Tipos de insumo iniciales (idempotente; se pueden agregar más desde Configuración)."""
from .models import TipoInsumo

INSUMOS = [
    "CPU",
    "MONITOR",
    "NOTEBOOK",
    "DISCO",
    "NVR",
    "CÁMARA IP",
    "TELÉFONO IP",
    "TELÉFONO CELULAR",
    "SERVIDOR",
    "AUTO/CAMIONETA",
    "TELEVISOR",
    "ROUTER",
]


def cargar():
    for orden, nombre in enumerate(INSUMOS, start=1):
        TipoInsumo.objects.get_or_create(nombre=nombre, defaults={"orden": orden})
