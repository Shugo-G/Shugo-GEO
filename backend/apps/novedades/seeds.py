"""Artículos de licencia iniciales (idempotente; el administrador los configura luego)."""
from apps.calendario.services import ComputoDias

from .models import TipoNovedad

TIPOS = [
    # nombre, color, cómputo, descuenta saldo, requiere doc, permite abierta, orden
    ("Licencia vacaciones", "#faad14", ComputoDias.HABILES, True, False, False, 1),
    ("Licencia invernal", "#1677ff", ComputoDias.HABILES, False, False, False, 2),
    ("Licencia médica", "#eb2f96", ComputoDias.CORRIDOS, False, True, True, 3),
    ("Ausencia", "#f5222d", ComputoDias.HABILES, False, False, True, 4),
]


def cargar():
    # Sólo en una instalación nueva: lo que el administrador borre o renombre no
    # vuelve a aparecer (inicializar corre en cada arranque del contenedor).
    if TipoNovedad.objects.exists():
        return
    tipos = {}
    for nombre, color, computo, saldo, doc, abierta, orden in TIPOS:
        tipos[nombre] = TipoNovedad.objects.create(
            nombre=nombre,
            color=color,
            computo_dias=computo,
            descuenta_saldo=saldo,
            requiere_documentacion=doc,
            permite_sin_fecha_fin=abierta,
            orden=orden,
        )
    # La licencia invernal comparte la bolsa de días de las vacaciones.
    tipos["Licencia invernal"].descuenta_saldo = True
    tipos["Licencia invernal"].saldo_de = tipos["Licencia vacaciones"]
    tipos["Licencia invernal"].save()
