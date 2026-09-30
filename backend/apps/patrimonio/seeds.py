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
    # Sólo en una instalación nueva: lo que el administrador borre o renombre no vuelve.
    if not TipoInsumo.objects.exists():
        for orden, nombre in enumerate(INSUMOS, start=1):
            TipoInsumo.objects.create(nombre=nombre, orden=orden)
