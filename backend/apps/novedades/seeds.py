"""Categorías de estado y tipos de novedad iniciales (idempotente, configurables luego)."""
from apps.calendario.services import ComputoDias

from .models import CategoriaEstado, TipoNovedad

CATEGORIAS = [
    # nombre, color, cuenta_como_presente, orden
    ("Vacaciones", "#faad14", False, 1),
    ("Licencia médica", "#eb2f96", False, 2),
    ("Licencia", "#1677ff", False, 3),
    ("Ausente", "#f5222d", False, 4),
    ("Comisión / Afectación", "#13c2c2", True, 5),
    ("Otro", "#8c8c8c", False, 6),
]

TIPOS = [
    # nombre, categoría, cómputo, descuenta saldo, requiere doc, permite abierta, orden
    ("Licencia vacaciones", "Vacaciones", ComputoDias.HABILES, True, False, False, 1),
    ("Licencia invernal", "Licencia", ComputoDias.HABILES, False, False, False, 2),
    ("Licencia médica", "Licencia médica", ComputoDias.CORRIDOS, False, True, True, 3),
    ("Ausencia", "Ausente", ComputoDias.HABILES, False, False, True, 4),
    ("Comisión de servicio", "Comisión / Afectación", ComputoDias.HABILES, False, False, True, 5),
]


def cargar():
    categorias = {}
    for nombre, color, presente, orden in CATEGORIAS:
        categorias[nombre], _ = CategoriaEstado.objects.get_or_create(
            nombre=nombre, defaults={"color": color, "cuenta_como_presente": presente, "orden": orden}
        )
    tipos = {}
    for nombre, categoria, computo, saldo, doc, abierta, orden in TIPOS:
        tipos[nombre] = TipoNovedad.objects.get_or_create(
            nombre=nombre,
            defaults={
                "categoria": categorias[categoria],
                "computo_dias": computo,
                "descuenta_saldo": saldo,
                "requiere_documentacion": doc,
                "permite_sin_fecha_fin": abierta,
                "orden": orden,
            },
        )
    # Al crearse, la licencia invernal comparte la bolsa de días de las vacaciones.
    # Sólo en la creación: si el administrador lo cambia después, no se pisa.
    invernal, creado = tipos["Licencia invernal"]
    if creado:
        invernal.descuenta_saldo = True
        invernal.saldo_de = tipos["Licencia vacaciones"][0]
        invernal.save()
